import Dexie from 'dexie';
import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';
import { createSyncId, migrateSyncIdentities } from '../services/syncIdentity';

export const db = new Dexie('pws-v1-db');

db.version(1).stores({
  transactions: '++id, type, categoryId, paymentMethodId, date, amount, title',
  categories: 'id, name, type',
  paymentMethods: 'id, name',
  budgets: 'id, categoryId, month',
  preferences: 'id'
});

db.version(2).stores({
  transactions: '++id, type, categoryId, paymentMethodId, date, amount, title',
  categories: 'id, name, type',
  paymentMethods: 'id, name',
  budgets: 'id, categoryId, month',
  preferences: 'id'
}).upgrade(async (transaction) => {
  await transaction.table('transactions').where('type').equals('income').delete();
  await transaction.table('categories').where('type').equals('income').delete();
  const expenseCategoryIds = new Set(
    await transaction.table('categories').where('type').equals('expense').primaryKeys()
  );
  const existingBudgets = await transaction.table('budgets').toArray();
  await transaction.table('budgets').clear();
  const migratedBudgets = existingBudgets
    .filter((budget) => budget.categoryId === 'overall' || expenseCategoryIds.has(budget.categoryId))
    .map((budget) => ({
      ...budget,
      amount: Math.round(Number(budget.amount || 0) * 100)
    }));
  if (migratedBudgets.length) await transaction.table('budgets').bulkPut(migratedBudgets);
});

db.version(3).stores({
  transactions: '++id, type, categoryId, paymentMethodId, date, amount, title',
  categories: 'id, name, type',
  paymentMethods: 'id, name',
  budgets: 'id, categoryId, month',
  budgetHistory: '++id, month, date, createdAt',
  preferences: 'id'
});

db.version(4).stores({
  transactions: '++id, type, categoryId, paymentMethodId, date, amount, title',
  categories: 'id, name, type',
  paymentMethods: 'id, name',
  budgets: 'id, categoryId, month',
  budgetHistory: '++id, month, categoryId, date, createdAt',
  preferences: 'id'
});

db.version(5).stores({
  transactions: '++id, type, categoryId, paymentMethodId, date, amount, title, syncId, categorySyncId, paymentMethodSyncId',
  categories: 'id, name, type, syncId',
  paymentMethods: 'id, name, syncId',
  budgets: 'id, categoryId, month, syncId, categorySyncId',
  budgetHistory: '++id, month, categoryId, date, createdAt, syncId, categorySyncId',
  preferences: 'id, syncId'
}).upgrade(migrateSyncIdentities);

export async function seedDatabase() {
  const categoryCount = await db.categories.count();
  const paymentCount = await db.paymentMethods.count();
  if (categoryCount === 0) {
    await db.categories.bulkPut(defaultCategories);
  }

  if (paymentCount === 0) {
    await db.paymentMethods.bulkPut(defaultPaymentMethods);
  }

  const prefsCount = await db.preferences.count();
  if (prefsCount === 0) {
    await db.preferences.put({
      id: 'app',
      syncId: createSyncId(),
      currency: 'PKR',
      lightMode: true,
      dateFormat: 'DD MMM YYYY',
      notificationsEnabled: false
    });
  }
}

export async function resetDatabase() {
  await db.transaction('rw', db.transactions, db.categories, db.paymentMethods, db.budgets, db.budgetHistory, db.preferences, async () => {
    await db.transactions.clear();
    await db.categories.clear();
    await db.paymentMethods.clear();
    await db.budgets.clear();
    await db.budgetHistory.clear();
    await db.preferences.clear();
  });

  await seedDatabase();
}
