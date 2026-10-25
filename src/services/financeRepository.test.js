import { describe, expect, it, vi } from 'vitest';
import { createFinanceRepository } from './financeRepository';
import { isSyncId } from './syncIdentity';

function createTable(initialRows = [], keyField = 'id') {
  let rows = [...initialRows];
  let nextId = Math.max(0, ...rows.map((row) => Number(row.id) || 0)) + 1;

  const matchingRows = (index, value) => rows.filter((row) => row[index] === value);
  const query = (matches) => ({
    first: async () => matches()[0],
    filter: (predicate) => query(() => matches().filter(predicate)),
    toArray: async () => matches()
  });

  const table = {
    add: async (record) => {
      const row = { ...record, ...(keyField === 'id' && record.id === undefined ? { id: nextId++ } : {}) };
      rows.push(row);
      return row.id;
    },
    bulkPut: async (records) => Promise.all(records.map((record) => table.put(record))),
    clear: async () => { rows = []; },
    count: async () => rows.length,
    delete: async (id) => { rows = rows.filter((row) => row[keyField] !== id); },
    get: async (id) => rows.find((row) => row[keyField] === id),
    orderBy: (index) => ({
      reverse: () => ({
        toArray: async () => [...rows].sort((a, b) => String(b[index]).localeCompare(String(a[index])))
      }),
      toArray: async () => [...rows].sort((a, b) => String(a[index]).localeCompare(String(b[index])))
    }),
    put: async (record) => {
      const index = rows.findIndex((row) => row[keyField] === record[keyField]);
      if (index === -1) rows.push(record);
      else rows[index] = record;
      return record[keyField];
    },
    toArray: async () => [...rows],
    update: async (id, changes) => {
      const index = rows.findIndex((row) => row[keyField] === id);
      if (index === -1) return 0;
      rows[index] = { ...rows[index], ...changes };
      return 1;
    },
    where: (index) => ({
      equals: (value) => query(() => matchingRows(index, value))
    }),
    getRows: () => rows
  };
  return table;
}

function createDatabase(initialData = {}) {
  const database = {
    transactions: createTable(initialData.transactions),
    categories: createTable(initialData.categories),
    paymentMethods: createTable(initialData.paymentMethods),
    budgets: createTable(initialData.budgets),
    budgetHistory: createTable(initialData.budgetHistory),
    preferences: createTable(initialData.preferences),
    syncOutbox: createTable(initialData.syncOutbox),
    syncConflicts: createTable(initialData.syncConflicts),
    syncMetadata: createTable(initialData.syncMetadata, 'key'),
    syncEntityState: createTable(initialData.syncEntityState),
    transactionModes: [],
    transaction: async function (mode, ...args) {
      this.transactionModes.push(mode);
      return args.at(-1)();
    }
  };
  return database;
}

describe('finance repository', () => {
  it('seeds and loads collections while materializing a missing cumulative budget', async () => {
    const database = createDatabase({
      transactions: [{ id: 1, date: '2026-10-25', amount: 250, type: 'expense' }],
      budgets: [{ id: 'budget-2026-10-overall', month: '2026-10', categoryId: 'overall', amount: 500 }],
      budgetHistory: [{ id: 1, entryType: 'addition', amount: 250 }]
    });
    const seed = vi.fn();
    const repository = createFinanceRepository(database, seed);

    const loaded = await repository.loadData();

    expect(seed).toHaveBeenCalledOnce();
    expect(loaded.transactions).toHaveLength(1);
    expect(loaded.budgets).toContainEqual(expect.objectContaining({
      id: 'budget-all-overall',
      categoryId: 'overall',
      month: 'all',
      amount: 750,
      syncRole: 'derived'
    }));
    expect(isSyncId(loaded.budgets.find(({ id }) => id === 'budget-all-overall').syncId)).toBe(true);
  });

  it('adds transactions and preserves local and sync IDs when updating a transaction', async () => {
    const existingSyncId = '70000000-0000-4000-8000-000000000001';
    const database = createDatabase({ transactions: [{ id: 14, syncId: existingSyncId, title: 'Old title' }] });
    const repository = createFinanceRepository(database, vi.fn());

    const createdId = await repository.saveTransaction(null, { title: 'New transaction', amount: 1234 });
    const updatedCount = await repository.saveTransaction(14, { title: 'Updated title', amount: 5678 });

    expect(createdId).toBe(15);
    expect(updatedCount).toBe(1);
    expect(database.transactions.getRows()).toContainEqual(expect.objectContaining({
      id: 14,
      syncId: existingSyncId,
      title: 'Updated title',
      amount: 5678
    }));
    expect(isSyncId(database.transactions.getRows().find(({ id }) => id === createdId).syncId)).toBe(true);
  });

  it('saves a budget addition and cumulative total atomically in paisa', async () => {
    const database = createDatabase();
    const repository = createFinanceRepository(database, vi.fn());

    await repository.saveBudgetHistory({
      month: '2026-10',
      budgetCategory: 'Salary',
      date: '2026-10-25',
      amount: 12550,
      description: 'October budget',
      timestamp: new Date('2026-10-25T12:00:00.000Z')
    });

    expect(database.transactionModes).toEqual(['rw']);
    expect(database.budgetHistory.getRows()[0]).toMatchObject({
      month: '2026-10',
      categoryId: 'overall',
      amount: 12550,
      previousAmount: 0,
      budgetCategory: 'Salary',
      entryType: 'addition'
    });
    expect(database.budgets.getRows()).toContainEqual(expect.objectContaining({
      id: 'budget-all-overall',
      categoryId: 'overall',
      month: 'all',
      amount: 12550,
      syncRole: 'derived'
    }));
    expect(isSyncId(database.budgets.getRows().find(({ id }) => id === 'budget-all-overall').syncId)).toBe(true);
  });

  it('deletes budget history and recalculates the cumulative total atomically', async () => {
    const database = createDatabase({
      budgetHistory: [{
        id: 3,
        month: '2026-10',
        categoryId: 'overall',
        date: '2026-10-25',
        amount: 12550,
        entryType: 'addition'
      }],
      budgets: [{
        id: 'budget-all-overall',
        categoryId: 'overall',
        month: 'all',
        amount: 12550
      }]
    });
    const repository = createFinanceRepository(database, vi.fn());

    await repository.deleteTransactionOrBudgetHistory({
      id: 3,
      historyType: 'budget',
      month: '2026-10',
      categoryId: 'overall',
      entryType: 'addition'
    });

    expect(database.transactionModes).toEqual(['rw']);
    expect(database.budgetHistory.getRows()).toEqual([]);
    expect(database.budgets.getRows()).toContainEqual(expect.objectContaining({
      id: 'budget-all-overall',
      categoryId: 'overall',
      month: 'all',
      amount: 0,
      syncRole: 'derived'
    }));
    expect(isSyncId(database.budgets.getRows().find(({ id }) => id === 'budget-all-overall').syncId)).toBe(true);
  });

  it('protects categories referenced by transactions and preserves backup export format', async () => {
    const categorySyncId = '10000000-0000-4000-8000-000000000001';
    const paymentMethodSyncId = '20000000-0000-4000-8000-000000000001';
    const database = createDatabase({
      transactions: [{
        id: 1,
        syncId: '30000000-0000-4000-8000-000000000001',
        categoryId: 'cat-food',
        categorySyncId: categorySyncId,
        paymentMethodId: 'pm-cash',
        paymentMethodSyncId: paymentMethodSyncId
      }],
      categories: [{ id: 'cat-food', syncId: categorySyncId, name: 'Food', type: 'expense' }],
      paymentMethods: [{ id: 'pm-cash', syncId: paymentMethodSyncId, name: 'Cash' }],
      preferences: [{ id: 'app', syncId: '60000000-0000-4000-8000-000000000001', currency: 'PKR' }]
    });
    const repository = createFinanceRepository(database, vi.fn());

    await expect(repository.deleteCategory('cat-food')).resolves.toBe(false);
    expect(database.categories.getRows()).toHaveLength(1);
    const backup = JSON.parse(await repository.exportBackupPayload());
    expect(backup).toMatchObject({
      version: 4,
      transactions: [{
        id: 1,
        syncId: '30000000-0000-4000-8000-000000000001',
        categoryId: 'cat-food',
        categorySyncId,
        paymentMethodSyncId
      }],
      categories: [{ id: 'cat-food', syncId: categorySyncId }],
      paymentMethods: [{ id: 'pm-cash', syncId: paymentMethodSyncId }],
      preferences: [{ id: 'app', syncId: '60000000-0000-4000-8000-000000000001' }]
    });
    expect(backup.exportedAt).toBeTruthy();
  });

  it('restores a validated v4 backup while preserving stable identities and references', async () => {
    const database = createDatabase({
      transactions: [{ id: 9, title: 'Replace me' }]
    });
    const repository = createFinanceRepository(database, vi.fn());
    const categorySyncId = '10000000-0000-4000-8000-000000000001';
    const paymentMethodSyncId = '20000000-0000-4000-8000-000000000001';
    const backup = {
      version: 4,
      transactions: [{
        id: 4,
        syncId: '30000000-0000-4000-8000-000000000001',
        title: 'Restored',
        amount: 250,
        type: 'expense',
        categoryId: 'cat-food',
        categorySyncId,
        paymentMethodId: 'pm-cash',
        paymentMethodSyncId,
        date: '2026-10-25',
        notes: ''
      }],
      categories: [{ id: 'cat-food', syncId: categorySyncId, name: 'Food', type: 'expense' }],
      paymentMethods: [{ id: 'pm-cash', syncId: paymentMethodSyncId, name: 'Cash' }],
      budgets: [],
      budgetHistory: [],
      preferences: [{ id: 'app', syncId: '60000000-0000-4000-8000-000000000001', currency: 'PKR' }]
    };

    await repository.restoreBackup(backup);

    expect(database.transactionModes).toEqual(['rw']);
    expect(database.transactions.getRows()).toEqual(backup.transactions);
    expect(database.categories.getRows()[0].syncId).toBe(categorySyncId);
    expect(database.paymentMethods.getRows()[0].syncId).toBe(paymentMethodSyncId);
  });
});
