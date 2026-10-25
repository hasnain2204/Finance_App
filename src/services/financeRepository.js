import { Capacitor } from '@capacitor/core';
import { db, seedDatabase } from '../db/db';
import {
  buildBackupPayload,
  calculateCumulativeBudgetTotal,
  createBudgetHistoryEntry,
  restoreBackupData as writeBackupData
} from '../lib/finance';
import {
  createSyncId,
  getCanonicalSyncId,
  getSyncIdentityReport
} from './syncIdentity';
import { createNativeSqliteAdapter, seedNativeSqliteDatabase } from './nativeSqliteAdapter';
import { importBackupToNativeSqlite } from './nativeBackupMigration';
import { enqueueLocalMutation } from './financeSyncQueue';

const syncTransactionTables = (database) => [
  database.syncOutbox,
  database.syncMetadata,
  database.syncEntityState
];

export function createFinanceRepository(database, seed) {
  const useNativeSqlite = database?.adapterType === 'native-sqlite' || (!database && Capacitor.isNativePlatform());
  database ||= useNativeSqlite ? createNativeSqliteAdapter() : db;
  seed ||= useNativeSqlite ? () => seedNativeSqliteDatabase(database) : seedDatabase;
  const setActiveBudget = async (month, categoryId, amount) => {
    const id = `budget-${month}-${categoryId}`;
    const existing = await database.budgets.get(id);
    if (amount === null) {
      if (existing && id !== 'budget-all-overall') {
        const deletable = existing.syncId ? existing : { ...existing, syncId: createSyncId() };
        if (deletable !== existing) await database.budgets.put(deletable);
        await enqueueLocalMutation(database, { collection: 'budgets', operation: 'delete', record: deletable });
      }
      await database.budgets.delete(id);
    } else {
      const category = categoryId === 'overall' ? null : await database.categories.get(categoryId);
      const nextBudget = {
        ...existing,
        id,
        categoryId,
        month,
        amount,
        syncId: existing?.syncId || createSyncId(),
        ...(categoryId === 'overall'
          ? { syncRole: 'derived' }
          : { categorySyncId: category?.syncId || existing?.categorySyncId || null })
      };
      await database.budgets.put(nextBudget);
      if (id !== 'budget-all-overall') {
        await enqueueLocalMutation(database, { collection: 'budgets', operation: 'upsert', record: nextBudget });
      }
    }
  };

  const recalculateCumulativeBudget = async () => {
    const [allBudgets, allHistory] = await Promise.all([
      database.budgets.toArray(),
      database.budgetHistory.toArray()
    ]);
    const total = calculateCumulativeBudgetTotal(
      allBudgets.filter((budget) => budget.id !== 'budget-all-overall'),
      allHistory
    );
    const existing = await database.budgets.get('budget-all-overall');
    await database.budgets.put({
      ...existing,
      id: 'budget-all-overall',
      categoryId: 'overall',
      month: 'all',
      amount: total,
      syncId: existing?.syncId || createSyncId(),
      syncRole: 'derived'
    });
  };

  return {
    syncStorage: database,
    getSyncStorage() { return database; },
    async loadData() {
      await seed();
      const [allTransactions, allCategories, allPaymentMethods, allBudgets, allBudgetHistory, allPreferences,
        syncEntityStates, syncConflicts] = await Promise.all([
        database.transactions.orderBy('date').reverse().toArray(),
        database.categories.orderBy('name').toArray(),
        database.paymentMethods.orderBy('name').toArray(),
        database.budgets.toArray(),
        database.budgetHistory.toArray(),
        database.preferences.get('app'),
        database.syncEntityState.toArray(),
        database.syncConflicts.toArray()
      ]);

      const unresolvedEntities = new Set(syncConflicts
        .filter((conflict) => conflict.status === 'unresolved')
        .flatMap((conflict) => [
          `${conflict.collection}:${conflict.syncId}`,
          ...(conflict.remotePayload?.sync_id
            ? [`${conflict.collection}:${conflict.remotePayload.sync_id}`]
            : [])
        ]));
      const tombstonedEntities = new Set(syncEntityStates
        .filter((state) => state.deletedAt)
        .filter((state) => !unresolvedEntities.has(`${state.collection}:${state.syncId}`))
        .map((state) => `${state.collection}:${state.syncId}`));
      const visible = (collection, records) => records.filter((record) => (
        !tombstonedEntities.has(`${collection}:${record.syncId}`)
      ));
      const transactions = visible('transactions', allTransactions);
      const categories = visible('categories', allCategories);
      const paymentMethods = visible('paymentMethods', allPaymentMethods);
      const budgets = visible('budgets', allBudgets);
      const budgetHistory = visible('budgetHistory', allBudgetHistory);
      const preferences = allPreferences && !tombstonedEntities.has(`preferences:${allPreferences.syncId}`)
        ? allPreferences
        : undefined;

      let loadedBudgets = budgets;
      if (!loadedBudgets.some((budget) => budget.id === 'budget-all-overall')) {
        const total = calculateCumulativeBudgetTotal(loadedBudgets, budgetHistory);
        if (total > 0) {
          const cumulativeBudget = {
            id: 'budget-all-overall',
            categoryId: 'overall',
            month: 'all',
            amount: total,
            syncId: createSyncId(),
            syncRole: 'derived'
          };
          await database.budgets.put(cumulativeBudget);
          loadedBudgets = [...loadedBudgets, cumulativeBudget];
        }
      }

      return {
        transactions,
        categories,
        paymentMethods,
        budgets: loadedBudgets,
        budgetHistory,
        preferences,
        syncIdentityReport: getSyncIdentityReport({
          transactions: allTransactions,
          categories: allCategories,
          paymentMethods: allPaymentMethods,
          budgets: allBudgets,
          budgetHistory: allBudgetHistory,
          preferences: allPreferences ? [allPreferences] : []
        })
      };
    },

    async savePreferences(preferences) {
      return database.transaction('rw', database.preferences, ...syncTransactionTables(database), async () => {
        const existing = await database.preferences.get(preferences.id);
        const nextPreferences = {
          ...preferences,
          syncId: preferences.syncId || existing?.syncId || createSyncId()
        };
        const result = await database.preferences.put(nextPreferences);
        await enqueueLocalMutation(database, {
          collection: 'preferences',
          operation: 'upsert',
          record: nextPreferences
        });
        return result;
      });
    },

    async saveTransaction(id, transaction) {
      return database.transaction(
        'rw',
        database.transactions,
        database.categories,
        database.paymentMethods,
        ...syncTransactionTables(database),
        async () => {
          const [existing, category, paymentMethod] = await Promise.all([
            id ? database.transactions.get(id) : null,
            database.categories.get(transaction.categoryId),
            database.paymentMethods.get(transaction.paymentMethodId)
          ]);
          const nextTransaction = {
            ...transaction,
            syncId: transaction.syncId || existing?.syncId || createSyncId(),
            categorySyncId: category?.syncId || transaction.categorySyncId || null,
            paymentMethodSyncId: paymentMethod?.syncId || transaction.paymentMethodSyncId || null
          };
          if (id) {
            const result = await database.transactions.update(id, nextTransaction);
            if (result) await enqueueLocalMutation(database, {
              collection: 'transactions', operation: 'upsert', record: { ...existing, ...nextTransaction, id }
            });
            return result;
          }
          const createdId = await database.transactions.add(nextTransaction);
          await enqueueLocalMutation(database, {
            collection: 'transactions', operation: 'upsert', record: { ...nextTransaction, id: createdId }
          });
          return createdId;
        }
      );
    },

    async saveBudgetHistory({ id, month, budgetCategory, date, amount, description, timestamp = new Date() }) {
      await database.transaction('rw', database.budgets, database.budgetHistory, database.categories,
        ...syncTransactionTables(database), async () => {
        const existingHistory = id ? await database.budgetHistory.get(id) : null;
        if (id && !existingHistory) {
          throw new Error('Budget history entry no longer exists.');
        }

        if (existingHistory && existingHistory.entryType !== 'addition') {
          const oldMonth = existingHistory.month;
          const categoryId = existingHistory.categoryId || 'overall';
          const oldMonthBudget = await database.budgets.get(`budget-${oldMonth}-${categoryId}`);
          const historyEntry = {
            ...existingHistory,
            month,
            date,
            amount,
            description: description.trim(),
            createdAt: timestamp.toISOString(),
            syncId: existingHistory.syncId || createSyncId(),
            ...(categoryId === 'overall'
              ? {}
              : {
                  categorySyncId: (await database.categories.get(categoryId))?.syncId ||
                    existingHistory.categorySyncId || null
                })
          };
          if (oldMonth !== month) {
            const oldMonthHistory = await database.budgetHistory
              .where('month').equals(oldMonth)
              .filter((entry) => entry.id !== existingHistory.id && (entry.categoryId || 'overall') === categoryId && entry.entryType !== 'addition')
              .toArray();
            oldMonthHistory.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            await setActiveBudget(
              oldMonth,
              categoryId,
              oldMonthHistory.length ? oldMonthHistory[0].amount : existingHistory.previousAmount ?? null
            );
          }
          historyEntry.previousAmount = oldMonth === month ? oldMonthBudget?.amount ?? null : null;
          await database.budgetHistory.put(historyEntry);
          await enqueueLocalMutation(database, {
            collection: 'budgetHistory', operation: 'upsert', record: historyEntry
          });
          await setActiveBudget(month, categoryId, amount);
          await recalculateCumulativeBudget();
          return;
        }

        const cumulativeBudget = await database.budgets.get('budget-all-overall');
        const allBudgets = await database.budgets.toArray();
        const allHistory = await database.budgetHistory.toArray();
        const currentTotal = cumulativeBudget?.amount ?? calculateCumulativeBudgetTotal(allBudgets, allHistory);
        const addition = existingHistory
          ? amount - Number(existingHistory.amount || 0)
          : amount;
        const entryTotal = existingHistory
          ? currentTotal - Number(existingHistory.amount || 0)
          : currentTotal;
        const historyEntry = existingHistory
          ? {
              ...existingHistory,
              month,
              categoryId: 'overall',
              date,
              budgetCategory,
              previousAmount: entryTotal,
              amount,
              description: description.trim(),
              createdAt: timestamp.toISOString(),
              syncId: existingHistory.syncId || createSyncId(),
              entryType: 'addition'
            }
          : {
              ...createBudgetHistoryEntry(month, 'overall', currentTotal, amount, description, date, timestamp),
              syncId: createSyncId(),
              budgetCategory,
              entryType: 'addition'
            };
        const historyId = await database.budgetHistory[existingHistory ? 'put' : 'add'](historyEntry);
        const savedHistoryEntry = { ...historyEntry, id: historyId };
        await enqueueLocalMutation(database, {
          collection: 'budgetHistory', operation: 'upsert', record: savedHistoryEntry
        });
        await database.budgets.put({
          id: 'budget-all-overall',
          categoryId: 'overall',
          month: 'all',
          amount: currentTotal + addition,
          syncId: cumulativeBudget?.syncId || createSyncId(),
          syncRole: 'derived'
        });
      });
    },

    async deleteTransactionOrBudgetHistory(record) {
      if (record.historyType !== 'budget') {
        await database.transaction('rw', database.transactions, ...syncTransactionTables(database), async () => {
          const transaction = await database.transactions.get(record.id);
          if (!transaction) return;
          const deletable = transaction.syncId ? transaction : { ...transaction, syncId: createSyncId() };
          if (deletable !== transaction) await database.transactions.put(deletable);
          await enqueueLocalMutation(database, {
            collection: 'transactions', operation: 'delete', record: deletable
          });
          await database.transactions.delete(record.id);
        });
        return;
      }

      const categoryId = record.categoryId || 'overall';
      await database.transaction('rw', database.budgets, database.budgetHistory, database.categories,
        ...syncTransactionTables(database), async () => {
        const historyEntry = await database.budgetHistory.get(record.id);
        if (!historyEntry) return;
        if (record.entryType !== 'addition') {
          const remainingHistory = await database.budgetHistory
            .where('month').equals(record.month)
            .filter((historyEntry) => (
              historyEntry.id !== record.id &&
              historyEntry.entryType !== 'addition' &&
              (historyEntry.categoryId || 'overall') === categoryId
            ))
            .toArray();
          remainingHistory.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
          await setActiveBudget(
            record.month,
            categoryId,
            remainingHistory.length ? remainingHistory[0].amount : historyEntry.previousAmount ?? record.previousAmount ?? null
          );
        }
        const deletable = historyEntry.syncId ? historyEntry : { ...historyEntry, syncId: createSyncId() };
        if (deletable !== historyEntry) await database.budgetHistory.put(deletable);
        await enqueueLocalMutation(database, {
          collection: 'budgetHistory', operation: 'delete', record: deletable
        });
        await database.budgetHistory.delete(record.id);
        await recalculateCumulativeBudget();
      });
    },

    createCategory(category) {
      const syncId = getCanonicalSyncId('categories', category.id) || category.syncId || createSyncId();
      return database.transaction('rw', database.categories, ...syncTransactionTables(database), async () => {
        const nextCategory = { ...category, syncId };
        const id = await database.categories.add(nextCategory);
        await enqueueLocalMutation(database, {
          collection: 'categories', operation: 'upsert', record: { ...nextCategory, id }
        });
        return id;
      });
    },

    async updateCategory(id, name) {
      return database.transaction('rw', database.categories, ...syncTransactionTables(database), async () => {
        const existing = await database.categories.get(id);
        if (!existing) return false;
        const nextCategory = { ...existing, name, syncId: existing.syncId || createSyncId() };
        await database.categories.put(nextCategory);
        await enqueueLocalMutation(database, {
          collection: 'categories', operation: 'upsert', record: nextCategory
        });
        return true;
      });
    },

    async deleteCategory(id) {
      return database.transaction(
        'rw',
        database.categories,
        database.transactions,
        database.budgetHistory,
        database.budgets,
        ...syncTransactionTables(database),
        async () => {
          const [transaction, historyEntry, budget] = await Promise.all([
            database.transactions.where('categoryId').equals(id).first(),
            database.budgetHistory.where('categoryId').equals(id).first(),
            database.budgets.where('categoryId').equals(id).first()
          ]);
          if (transaction || historyEntry || budget) return false;
          const category = await database.categories.get(id);
          if (category) await enqueueLocalMutation(database, {
            collection: 'categories', operation: 'delete', record: category
          });
          await database.categories.delete(id);
          return true;
        }
      );
    },

    createPaymentMethod(paymentMethod) {
      const syncId = getCanonicalSyncId('paymentMethods', paymentMethod.id) || paymentMethod.syncId || createSyncId();
      return database.transaction('rw', database.paymentMethods, ...syncTransactionTables(database), async () => {
        const nextPaymentMethod = { ...paymentMethod, syncId };
        const id = await database.paymentMethods.add(nextPaymentMethod);
        await enqueueLocalMutation(database, {
          collection: 'paymentMethods', operation: 'upsert', record: { ...nextPaymentMethod, id }
        });
        return id;
      });
    },

    async updatePaymentMethod(id, name) {
      return database.transaction('rw', database.paymentMethods, ...syncTransactionTables(database), async () => {
        const existing = await database.paymentMethods.get(id);
        if (!existing) return false;
        const nextPaymentMethod = { ...existing, name, syncId: existing.syncId || createSyncId() };
        await database.paymentMethods.put(nextPaymentMethod);
        await enqueueLocalMutation(database, {
          collection: 'paymentMethods', operation: 'upsert', record: nextPaymentMethod
        });
        return true;
      });
    },

    async deletePaymentMethod(id) {
      return database.transaction('rw', database.paymentMethods, database.transactions,
        ...syncTransactionTables(database), async () => {
        const transaction = await database.transactions.where('paymentMethodId').equals(id).first();
        if (transaction) return false;
        const paymentMethod = await database.paymentMethods.get(id);
        if (paymentMethod) await enqueueLocalMutation(database, {
          collection: 'paymentMethods', operation: 'delete', record: paymentMethod
        });
        await database.paymentMethods.delete(id);
        return true;
      });
    },

    async exportBackupPayload() {
      const data = await database.transaction(
        'r',
        database.transactions,
        database.categories,
        database.paymentMethods,
        database.budgets,
        database.budgetHistory,
        database.preferences,
        async () => {
          const [transactions, categories, paymentMethods, budgets, budgetHistory, preferences] =
            await Promise.all([
              database.transactions.toArray(),
              database.categories.toArray(),
              database.paymentMethods.toArray(),
              database.budgets.toArray(),
              database.budgetHistory.toArray(),
              database.preferences.toArray()
            ]);
          return { transactions, categories, paymentMethods, budgets, budgetHistory, preferences };
        }
      );
      return buildBackupPayload(data);
    },

    restoreBackup(backup, options) {
      if (database.adapterType === 'native-sqlite') {
        return importBackupToNativeSqlite(database, options?.sourceText ?? backup, options);
      }
      return writeBackupData(database, backup);
    },

    async getSyncIdentityReport() {
      const [transactions, categories, paymentMethods, budgets, budgetHistory, preferences] = await Promise.all([
        database.transactions.toArray(),
        database.categories.toArray(),
        database.paymentMethods.toArray(),
        database.budgets.toArray(),
        database.budgetHistory.toArray(),
        database.preferences.toArray()
      ]);
      return getSyncIdentityReport({
        transactions,
        categories,
        paymentMethods,
        budgets,
        budgetHistory,
        preferences
      });
    }
  };
}

export const financeRepository = createFinanceRepository();
