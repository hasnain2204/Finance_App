import Dexie from 'dexie';
import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';

export const db = new Dexie('pws-v1-db');

db.version(1).stores({
  transactions: '++id, type, categoryId, paymentMethodId, date, amount, title',
  categories: 'id, name, type',
  paymentMethods: 'id, name',
  budgets: 'id, categoryId, month',
  preferences: 'id'
});

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
    await db.preferences.put({ id: 'app', currency: 'PKR', lightMode: true });
  }
}

export async function resetDatabase() {
  await db.transaction('rw', db.transactions, db.categories, db.paymentMethods, db.preferences, async () => {
    await db.transactions.clear();
    await db.categories.clear();
    await db.paymentMethods.clear();
    await db.preferences.clear();
  });

  await seedDatabase();
}
