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

export function createFinanceRepository(database, seed) {
  const useNativeSqlite = database?.adapterType === 'native-sqlite' || (!database && Capacitor.isNativePlatform());
  database ||= useNativeSqlite ? createNativeSqliteAdapter() : db;
  seed ||= useNativeSqlite ? () => seedNativeSqliteDatabase(database) : seedDatabase;
  const setActiveBudget = async (month, categoryId, amount) => {
    const id = `budget-${month}-${categoryId}`;
    if (amount === null) {
      await database.budgets.delete(id);
    } else {
      const existing = await database.budgets.get(id);
      const category = categoryId === 'overall' ? null : await database.categories.get(categoryId);
      await database.budgets.put({
        ...existing,
        id,
        categoryId,
        month,
        amount,
        syncId: existing?.syncId || createSyncId(),
        ...(categoryId === 'overall'
          ? { syncRole: 'derived' }
          : { categorySyncId: category?.syncId || existing?.categorySyncId || null })
      });
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
    async loadData() {
      await seed();
      const [transactions, categories, paymentMethods, budgets, budgetHistory, preferences] = await Promise.all([
        database.transactions.orderBy('date').reverse().toArray(),
        database.categories.orderBy('name').toArray(),
        database.paymentMethods.orderBy('name').toArray(),
        database.budgets.toArray(),
        database.budgetHistory.toArray(),
        database.preferences.get('app')
      ]);

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
          transactions,
          categories,
          paymentMethods,
          budgets: loadedBudgets,
          budgetHistory,
          preferences: preferences ? [preferences] : []
        })
      };
    },

    async savePreferences(preferences) {
      const existing = await database.preferences.get(preferences.id);
      return database.preferences.put({
        ...preferences,
        syncId: preferences.syncId || existing?.syncId || createSyncId()
      });
    },

    async saveTransaction(id, transaction) {
      return database.transaction(
        'rw',
        database.transactions,
        database.categories,
        database.paymentMethods,
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
          if (id) return database.transactions.update(id, nextTransaction);
          return database.transactions.add(nextTransaction);
        }
      );
    },

    async saveBudgetHistory({ id, month, budgetCategory, date, amount, description, timestamp = new Date() }) {
      await database.transaction('rw', database.budgets, database.budgetHistory, database.categories, async () => {
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
              entryType: 'addition'
            }
          : {
              ...createBudgetHistoryEntry(month, 'overall', currentTotal, amount, description, date, timestamp),
              syncId: createSyncId(),
              budgetCategory,
              entryType: 'addition'
            };
        await database.budgetHistory[existingHistory ? 'put' : 'add'](historyEntry);
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
        await database.transactions.delete(record.id);
        return;
      }

      const categoryId = record.categoryId || 'overall';
      await database.transaction('rw', database.budgets, database.budgetHistory, database.categories, async () => {
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
            remainingHistory.length ? remainingHistory[0].amount : record.previousAmount ?? null
          );
        }
        await database.budgetHistory.delete(record.id);
        await recalculateCumulativeBudget();
      });
    },

    createCategory(category) {
      const syncId = getCanonicalSyncId('categories', category.id) || category.syncId || createSyncId();
      return database.categories.add({ ...category, syncId });
    },

    async updateCategory(id, name) {
      return Boolean(await database.categories.update(id, { name }));
    },

    async deleteCategory(id) {
      return database.transaction(
        'rw',
        database.categories,
        database.transactions,
        database.budgetHistory,
        database.budgets,
        async () => {
          const [transaction, historyEntry, budget] = await Promise.all([
            database.transactions.where('categoryId').equals(id).first(),
            database.budgetHistory.where('categoryId').equals(id).first(),
            database.budgets.where('categoryId').equals(id).first()
          ]);
          if (transaction || historyEntry || budget) return false;
          await database.categories.delete(id);
          return true;
        }
      );
    },

    createPaymentMethod(paymentMethod) {
      const syncId = getCanonicalSyncId('paymentMethods', paymentMethod.id) || paymentMethod.syncId || createSyncId();
      return database.paymentMethods.add({ ...paymentMethod, syncId });
    },

    async updatePaymentMethod(id, name) {
      return Boolean(await database.paymentMethods.update(id, { name }));
    },

    async deletePaymentMethod(id) {
      return database.transaction('rw', database.paymentMethods, database.transactions, async () => {
        const transaction = await database.transactions.where('paymentMethodId').equals(id).first();
        if (transaction) return false;
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
