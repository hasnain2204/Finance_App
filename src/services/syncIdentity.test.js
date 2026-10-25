import { describe, expect, it } from 'vitest';
import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';
import { addSyncIdentities, migrateSyncIdentities } from './syncIdentity';

describe('sync identity migration', () => {
  it('preserves existing valid IDs and relationship references across repeated migrations', async () => {
    const data = {
      transactions: [{
        id: 1,
        syncId: '30000000-0000-4000-8000-000000000001',
        categoryId: 'cat-food',
        categorySyncId: '10000000-0000-4000-8000-000000000001',
        paymentMethodId: 'pm-cash',
        paymentMethodSyncId: '20000000-0000-4000-8000-000000000001'
      }],
      categories: [{
        id: 'cat-food',
        syncId: '10000000-0000-4000-8000-000000000001',
        name: 'Food',
        type: 'expense'
      }],
      paymentMethods: [{
        id: 'pm-cash',
        syncId: '20000000-0000-4000-8000-000000000001',
        name: 'Cash'
      }],
      budgets: [{
        id: 'budget-food',
        syncId: '40000000-0000-4000-8000-000000000001',
        categoryId: 'cat-food',
        categorySyncId: '10000000-0000-4000-8000-000000000001'
      }],
      budgetHistory: [{
        id: 1,
        syncId: '50000000-0000-4000-8000-000000000001',
        categoryId: 'cat-food',
        categorySyncId: '10000000-0000-4000-8000-000000000001'
      }],
      preferences: [{ id: 'app', syncId: '60000000-0000-4000-8000-000000000001' }]
    };
    const tables = Object.fromEntries(Object.entries(data).map(([name, initialRows]) => {
      let rows = initialRows.map((record) => ({ ...record }));
      return [name, {
        toArray: async () => rows.map((record) => ({ ...record })),
        bulkPut: async (records) => { rows = records.map((record) => ({ ...record })); },
        getRows: () => rows
      }];
    }));
    const transaction = { table: (name) => tables[name] };

    await migrateSyncIdentities(transaction);
    const firstMigration = Object.fromEntries(
      Object.entries(tables).map(([name, table]) => [name, table.getRows().map((record) => ({ ...record }))])
    );
    await migrateSyncIdentities(transaction);

    for (const store of Object.keys(data)) {
      expect(tables[store].getRows().map(({ syncId }) => syncId))
        .toEqual(firstMigration[store].map(({ syncId }) => syncId));
    }
    expect(tables.categories.getRows()[0].syncId).toBe(data.categories[0].syncId);
    expect(tables.paymentMethods.getRows()[0].syncId).toBe(data.paymentMethods[0].syncId);
    expect(tables.transactions.getRows()[0]).toMatchObject({
      syncId: data.transactions[0].syncId,
      categorySyncId: data.transactions[0].categorySyncId,
      paymentMethodSyncId: data.transactions[0].paymentMethodSyncId
    });
    expect(tables.budgets.getRows()[0].categorySyncId).toBe(data.budgets[0].categorySyncId);
    expect(tables.budgetHistory.getRows()[0].categorySyncId).toBe(data.budgetHistory[0].categorySyncId);
  });

  it('uses canonical default IDs only when a default record has no valid existing ID', async () => {
    const identities = Object.fromEntries([
      ['transactions', []],
      ['categories', defaultCategories.map(({ id, name, type }) => ({ id, name, type }))],
      ['paymentMethods', defaultPaymentMethods.map(({ id, name }) => ({ id, name }))],
      ['budgets', []],
      ['budgetHistory', []],
      ['preferences', []]
    ]);
    const identified = addSyncIdentities(identities);

    expect(identified.categories.map(({ syncId }) => syncId))
      .toEqual(defaultCategories.map(({ syncId }) => syncId));
    expect(identified.paymentMethods.map(({ syncId }) => syncId))
      .toEqual(defaultPaymentMethods.map(({ syncId }) => syncId));
  });
});
