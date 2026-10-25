import { describe, expect, it } from 'vitest';
import { importBackupToNativeSqlite } from './nativeBackupMigration';
import { isSyncId } from './syncIdentity';

const categorySyncId = '11000000-0000-4000-8000-000000000001';
const paymentSyncId = '22000000-0000-4000-8000-000000000001';
const transactionSyncId = '33000000-0000-4000-8000-000000000001';
const budgetSyncId = '44000000-0000-4000-8000-000000000001';
const derivedBudgetSyncId = '55000000-0000-4000-8000-000000000001';
const historySyncId = '66000000-0000-4000-8000-000000000001';
const preferenceSyncId = '77000000-0000-4000-8000-000000000001';

const collectionNames = [
  'transactions',
  'categories',
  'paymentMethods',
  'budgets',
  'budgetHistory',
  'preferences'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createMemoryDatabase(initialData = {}, failOnBulkPut = null) {
  const rows = Object.fromEntries(collectionNames.map((name) => [name, clone(initialData[name] || [])]));
  const nextIds = {
    transactions: Math.max(0, ...(rows.transactions || []).map((record) => Number(record.id) || 0)) + 1,
    budgetHistory: Math.max(0, ...(rows.budgetHistory || []).map((record) => Number(record.id) || 0)) + 1
  };
  let injectedFailure = false;
  const database = {};

  for (const name of collectionNames) {
    database[name] = {
      add: async (record) => {
        const row = { ...record };
        if (row.id === undefined && nextIds[name] !== undefined) row.id = nextIds[name]++;
        rows[name].push(row);
        return row.id;
      },
      bulkPut: async (records) => {
        for (const record of records) {
          const row = { ...record };
          if (row.id === undefined && nextIds[name] !== undefined) row.id = nextIds[name]++;
          const existingIndex = rows[name].findIndex((candidate) => candidate.id === row.id);
          if (existingIndex === -1) rows[name].push(row);
          else rows[name][existingIndex] = row;
          if (failOnBulkPut === name && !injectedFailure) {
            injectedFailure = true;
            throw new Error(`Injected ${name} write failure.`);
          }
        }
      },
      clear: async () => { rows[name] = []; },
      count: async () => rows[name].length,
      toArray: async () => clone(rows[name])
    };
  }

  database.transaction = async (_mode, ...args) => {
    const callback = args.at(-1);
    const snapshot = clone(rows);
    const idSnapshot = { ...nextIds };
    try {
      return await callback();
    } catch (error) {
      for (const name of collectionNames) rows[name] = snapshot[name];
      Object.assign(nextIds, idSnapshot);
      throw error;
    }
  };
  database.readAll = () => clone(rows);
  return database;
}

function createV4Backup(overrides = {}) {
  const base = {
    version: 4,
    exportedAt: '2026-10-25T08:00:00.000Z',
    transactions: [{
      id: 42,
      syncId: transactionSyncId,
      title: 'Groceries',
      amount: 12345,
      type: 'expense',
      categoryId: 'old-category-local-id',
      categorySyncId,
      paymentMethodId: 'old-method-local-id',
      paymentMethodSyncId: paymentSyncId,
      date: '2026-10-24',
      notes: 'weekly shop',
      createdAt: '2026-10-24T10:30:00.000Z'
    }],
    categories: [{ id: 'category-local-id', syncId: categorySyncId, name: 'Food', type: 'expense' }],
    paymentMethods: [{ id: 'method-local-id', syncId: paymentSyncId, name: 'Cash' }],
    budgets: [
      {
        id: 'budget-2026-10-cat-food',
        syncId: budgetSyncId,
        categoryId: 'old-category-local-id',
        categorySyncId,
        month: '2026-10',
        amount: 55555
      },
      {
        id: 'budget-all-overall',
        syncId: derivedBudgetSyncId,
        categoryId: 'overall',
        month: 'all',
        amount: 12500,
        syncRole: 'derived'
      }
    ],
    budgetHistory: [{
      id: 7,
      syncId: historySyncId,
      month: '2026-10',
      categoryId: 'overall',
      date: '2026-10-24',
      createdAt: '2026-10-24T10:30:00.000Z',
      previousAmount: 0,
      amount: 12500,
      description: 'October budget',
      budgetCategory: 'Salary',
      entryType: 'addition'
    }],
    preferences: [{
      id: 'app',
      syncId: preferenceSyncId,
      currency: 'PKR',
      lightMode: true,
      name: 'Hasnain',
      onboardingCompleted: true,
      dateFormat: 'DD MMM YYYY',
      notificationsEnabled: false
    }]
  };
  return { ...base, ...overrides };
}

function createV3Backup() {
  return {
    version: 3,
    transactions: [{
      id: 9,
      title: 'Legacy v3 expense',
      amount: 4567,
      type: 'expense',
      categoryId: 'cat-food',
      paymentMethodId: 'pm-cash',
      date: '2026-10-20',
      notes: ''
    }],
    categories: [{ id: 'cat-food', name: 'Food', type: 'expense' }],
    paymentMethods: [{ id: 'pm-cash', name: 'Cash' }],
    budgets: [],
    budgetHistory: [],
    preferences: [{ id: 'app', currency: 'PKR', lightMode: true, dateFormat: 'DD MMM YYYY' }]
  };
}

describe('native SQLite backup migration', () => {
  it('imports version 4 while preserving stable IDs, remapping references, counts, paisa, and cumulative totals', async () => {
    const backupText = JSON.stringify(createV4Backup());
    const database = createMemoryDatabase();

    const result = await importBackupToNativeSqlite(database, backupText);
    const stored = database.readAll();
    const transaction = stored.transactions[0];
    const report = result.migrationVerification;

    expect(transaction).toMatchObject({
      id: 42,
      syncId: transactionSyncId,
      categoryId: 'category-local-id',
      categorySyncId,
      paymentMethodId: 'method-local-id',
      paymentMethodSyncId: paymentSyncId,
      amount: 12345
    });
    expect(stored.categories[0]).toMatchObject({ id: 'category-local-id', syncId: categorySyncId });
    expect(stored.paymentMethods[0]).toMatchObject({ id: 'method-local-id', syncId: paymentSyncId });
    expect(stored.budgets[0]).toMatchObject({ categoryId: 'category-local-id', categorySyncId });
    expect(stored.budgetHistory[0]).toMatchObject({ id: 7, categoryId: 'overall', amount: 12500 });
    expect(stored.preferences[0]).toMatchObject({ id: 'app', syncId: preferenceSyncId });
    expect(report.verified).toBe(true);
    expect(report.counts.transactions).toEqual({ source: 1, destination: 1, comparable: true, matches: true });
    expect(report.counts.categories).toMatchObject({ source: 1, destination: 1, matches: true });
    expect(report.counts.paymentMethods).toMatchObject({ source: 1, destination: 1, matches: true });
    expect(report.counts.budgets).toMatchObject({ source: 2, destination: 2, matches: true });
    expect(report.counts.budgetHistory).toMatchObject({ source: 1, destination: 1, matches: true });
    expect(report.counts.preferences).toMatchObject({ source: 1, destination: 1, matches: true });
    expect(report.references).toMatchObject({ sourceCount: 3, destinationCount: 3, matched: true });
    expect(report.financial.expenseTotalPaisa).toEqual({ source: 12345, destination: 12345, matches: true });
    expect(report.financial.cumulativeBudgetTotalPaisa).toEqual({ source: 12500, destination: 12500, matches: true });
  });

  it.each([
    ['version 1', {
      version: 1,
      transactions: [{
        title: 'Legacy v1 expense', amount: 12.34, type: 'expense',
        categoryId: 'cat-food', date: '2026-10-18'
      }]
    }, 1234],
    ['version 2', {
      version: 2,
      transactions: [{
        title: 'Legacy v2 expense', amount: 25.5, type: 'expense',
        categoryId: 'cat-food', date: '2026-10-19', paymentMethodId: 'pm-cash'
      }]
    }, 2550],
    ['version 3', createV3Backup(), 4567]
  ])('keeps documented %s backup conversion and import compatibility', async (_label, backup, expectedPaisa) => {
    const database = createMemoryDatabase();
    const result = await importBackupToNativeSqlite(database, JSON.stringify(backup));
    const stored = database.readAll();

    expect(stored.transactions).toHaveLength(1);
    expect(stored.transactions[0].amount).toBe(expectedPaisa);
    expect(isSyncId(stored.transactions[0].syncId)).toBe(true);
    expect(result.migrationVerification.verified).toBe(true);
    expect(result.migrationVerification.financial.expenseTotalPaisa).toEqual({
      source: expectedPaisa,
      destination: expectedPaisa,
      matches: true
    });
    if (backup.version < 3) {
      expect(result.migrationVerification.counts.preferences).toMatchObject({
        source: null,
        comparable: false
      });
    }
  });

  it('uses stable generated identities for a repeated legacy import', async () => {
    const backupText = JSON.stringify({
      version: 1,
      transactions: [{
        id: 81,
        title: 'Legacy expense', amount: 19.99, type: 'expense',
        categoryId: 'cat-food', date: '2026-10-17'
      }]
    });
    const database = createMemoryDatabase();

    await importBackupToNativeSqlite(database, backupText);
    const firstIdentity = database.readAll().transactions[0].syncId;
    const secondResult = await importBackupToNativeSqlite(database, backupText, { replaceExisting: true });

    expect(database.readAll().transactions).toHaveLength(1);
    expect(database.readAll().transactions[0].syncId).toBe(firstIdentity);
    expect(secondResult.migrationVerification.verified).toBe(true);
  });

  it('blocks implicit replacement and does not duplicate existing records', async () => {
    const database = createMemoryDatabase();
    const backupText = JSON.stringify(createV4Backup());
    await importBackupToNativeSqlite(database, backupText);
    const before = database.readAll();

    await expect(importBackupToNativeSqlite(database, backupText))
      .rejects.toThrow('SQLite already contains data');
    expect(database.readAll()).toEqual(before);
    expect(database.readAll().transactions).toHaveLength(1);
  });

  it('rejects malformed JSON, invalid v4 identities, and unresolved references before changing data', async () => {
    const initial = { preferences: [{ id: 'app', syncId: preferenceSyncId, currency: 'PKR' }] };
    const database = createMemoryDatabase(initial);
    const before = database.readAll();

    await expect(importBackupToNativeSqlite(database, '{broken-json'))
      .rejects.toThrow('Backup file is not valid JSON');
    const invalidIdentity = createV4Backup({
      transactions: [{ ...createV4Backup().transactions[0], syncId: 'not-a-uuid' }]
    });
    await expect(importBackupToNativeSqlite(database, JSON.stringify(invalidIdentity), { replaceExisting: true }))
      .rejects.toThrow('invalid sync ID');

    const unresolvedReference = createV4Backup({
      transactions: [{ ...createV4Backup().transactions[0], categorySyncId: '88000000-0000-4000-8000-000000000001' }]
    });
    await expect(importBackupToNativeSqlite(database, JSON.stringify(unresolvedReference), { replaceExisting: true }))
      .rejects.toThrow('does not match a backup record');
    expect(database.readAll()).toEqual(before);
  });

  it('preserves existing preferences when importing a legacy backup without that collection', async () => {
    const existingPreference = { id: 'app', syncId: preferenceSyncId, currency: 'PKR', lightMode: false };
    const database = createMemoryDatabase({ preferences: [existingPreference] });
    const legacyBackup = {
      version: 1,
      transactions: [{
        title: 'Old expense', amount: 2.5, type: 'expense',
        categoryId: 'cat-food', date: '2026-10-16'
      }]
    };

    const result = await importBackupToNativeSqlite(database, JSON.stringify(legacyBackup), { replaceExisting: true });

    expect(database.readAll().preferences).toEqual([existingPreference]);
    expect(result.migrationVerification.counts.preferences).toMatchObject({
      source: null,
      destination: 1,
      comparable: false,
      matches: null
    });
    expect(result.migrationVerification.verified).toBe(true);
  });

  it('rolls back replacement writes if a later collection fails', async () => {
    const existing = {
      transactions: [{ id: 2, syncId: transactionSyncId, title: 'Keep existing', amount: 10, type: 'expense', categoryId: 'legacy', date: '2026-10-01' }],
      categories: [{ id: 'legacy', syncId: categorySyncId, name: 'Legacy', type: 'expense' }],
      preferences: [{ id: 'app', syncId: preferenceSyncId, currency: 'PKR' }]
    };
    const database = createMemoryDatabase(existing, 'transactions');
    const before = database.readAll();

    await expect(importBackupToNativeSqlite(database, JSON.stringify(createV4Backup()), { replaceExisting: true }))
      .rejects.toThrow('Injected transactions write failure');
    expect(database.readAll()).toEqual(before);
  });
});
