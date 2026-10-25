import { describe, it, expect } from 'vitest';
import {
  toPaisa,
  fromPaisa,
  formatCurrency,
  calculateBudgetProgress,
  calculateCumulativeBudgetTotal,
  calculateCategoryExpenseTotals,
  calculateExpenseTotal,
  createBudgetHistoryEntry,
  buildBackupPayload,
  normalizeBackupData,
  parseBackupPayload,
  restoreBackupData,
  buildMonthlyBudgetTrend,
  buildMonthlyExpenseTrend,
  buildWeeklyBudgetTrend,
  getLocalDateString,
  formatDate,
  validateTransaction
} from './finance';

const completeBackupData = () => ({
  transactions: [{
    id: 15,
    syncId: '30000000-0000-4000-8000-000000000001',
    title: 'Groceries',
    amount: 12550,
    type: 'expense',
    categoryId: 'cat-food',
    categorySyncId: '10000000-0000-4000-8000-000000000001',
    paymentMethodId: 'pm-cash',
    paymentMethodSyncId: '20000000-0000-4000-8000-000000000001',
    date: '2026-10-24',
    notes: 'Weekly shop',
    createdAt: '2026-10-24T12:00:00.000Z'
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
    id: 'budget-2026-10-food',
    syncId: '40000000-0000-4000-8000-000000000001',
    categoryId: 'cat-food',
    categorySyncId: '10000000-0000-4000-8000-000000000001',
    month: '2026-10',
    amount: 25000
  }],
  budgetHistory: [{
    id: 7,
    syncId: '50000000-0000-4000-8000-000000000001',
    month: '2026-10',
    categoryId: 'cat-food',
    categorySyncId: '10000000-0000-4000-8000-000000000001',
    date: '2026-10-24',
    createdAt: '2026-10-24T12:00:00.000Z',
    previousAmount: null,
    amount: 25000,
    description: 'Monthly budget'
  }],
  preferences: [{
    id: 'app',
    syncId: '60000000-0000-4000-8000-000000000001',
    currency: 'PKR',
    lightMode: false,
    name: 'A User',
    onboardingCompleted: true,
    dateFormat: 'YYYY-MM-DD',
    notificationsEnabled: true
  }]
});

const completeLegacyBackupData = () => {
  const data = completeBackupData();
  const withoutFields = (record, fields) => Object.fromEntries(
    Object.entries(record).filter(([key]) => !fields.includes(key))
  );
  return {
    ...data,
    transactions: data.transactions.map((record) => withoutFields(record, [
      'syncId', 'categorySyncId', 'paymentMethodSyncId'
    ])),
    categories: data.categories.map((record) => withoutFields(record, ['syncId'])),
    paymentMethods: data.paymentMethods.map((record) => withoutFields(record, ['syncId'])),
    budgets: data.budgets.map((record) => withoutFields(record, ['syncId', 'categorySyncId'])),
    budgetHistory: data.budgetHistory.map((record) => withoutFields(record, ['syncId', 'categorySyncId'])),
    preferences: data.preferences.map((record) => withoutFields(record, ['syncId']))
  };
};

describe('finance utilities', () => {
  it('converts rupees to paisa correctly', () => {
    expect(toPaisa(125.5)).toBe(12550);
    expect(toPaisa(10)).toBe(1000);
  });

  it('converts paisa to rupees correctly', () => {
    expect(fromPaisa(12550)).toBe(125.5);
    expect(fromPaisa(1000)).toBe(10);
  });

  it('formats PKR values correctly', () => {
    expect(formatCurrency(3800)).toBe('PKR 3,800');
    expect(formatCurrency(12550)).toBe('PKR 12,550');
    expect(formatCurrency(12.5)).toBe('PKR 12.5');
    expect(formatCurrency(12.34)).toBe('PKR 12.34');
  });

  it('calculates expense totals for all transactions or a selected month', () => {
    const transactions = [
      { type: 'income', amount: 5000, date: '2026-10-01' },
      { type: 'expense', amount: 1200 },
      { type: 'expense', amount: 500, date: '2026-10-15' },
      { type: 'expense', amount: 150, date: '2026-09-20' }
    ];

    expect(calculateExpenseTotal(transactions)).toBe(1850);
    expect(calculateExpenseTotal(transactions, '2026-10')).toBe(500);
  });

  it('adds each budget contribution to the existing cumulative total', () => {
    const budgets = [
      { id: 'budget-2026-09-overall', month: '2026-09', categoryId: 'overall', amount: 25000 },
      { id: 'budget-2026-10-overall', month: '2026-10', categoryId: 'overall', amount: 50000 }
    ];
    const history = [
      { entryType: 'addition', amount: 12500 },
      { entryType: 'addition', amount: 8000 },
      { entryType: 'legacy', amount: 90000 }
    ];

    expect(calculateCumulativeBudgetTotal(budgets, history)).toBe(95500);
    expect(calculateCumulativeBudgetTotal([
      ...budgets,
      { id: 'budget-all-overall', month: 'all', categoryId: 'overall', amount: 100000 }
    ], history)).toBe(100000);
  });

  it('calculates expense totals per category for a selected month', () => {
    const data = [
      { type: 'expense', categoryId: 'food', amount: 400, date: '2026-10-13' },
      { type: 'expense', categoryId: 'food', amount: 100, date: '2026-10-19' },
      { type: 'expense', categoryId: 'travel', amount: 150, date: '2026-09-20' },
      { type: 'income', categoryId: 'food', amount: 1000, date: '2026-10-01' }
    ];

    expect(calculateCategoryExpenseTotals(data, '2026-10')).toEqual({ food: 500 });
  });

  it('calculates remaining and over-budget progress', () => {
    expect(calculateBudgetProgress(1000, 400)).toEqual({
      remaining: 600,
      percent: 40,
      isOverBudget: false
    });
    expect(calculateBudgetProgress(1000, 1200)).toEqual({
      remaining: -200,
      percent: 120,
      isOverBudget: true
    });
  });

  it('records budget entries with the selected date and description', () => {
    const timestamp = new Date('2026-10-24T12:00:00.000Z');

    expect(createBudgetHistoryEntry('2026-10', 'overall', null, 125000, 'Monthly plan', '2026-10-23', timestamp)).toEqual({
      month: '2026-10',
      categoryId: 'overall',
      date: '2026-10-23',
      createdAt: timestamp.toISOString(),
      previousAmount: null,
      amount: 125000,
      description: 'Monthly plan'
    });
    expect(createBudgetHistoryEntry('2026-10', 'overall', 125000, 125000, '', '2026-10-24', timestamp).amount).toBe(125000);
    expect(createBudgetHistoryEntry('2026-10', 'cat-food', 125000, null, '', '2026-10-24', timestamp).amount).toBeNull();
  });

  it('round trips v4 backups with stable sync IDs and relationship references', () => {
    const data = completeBackupData();
    const backup = JSON.parse(buildBackupPayload(data));
    const restored = normalizeBackupData(backup);

    expect(backup.version).toBe(4);
    expect(backup.exportedAt).toBeTruthy();
    expect(restored.transactions).toEqual(data.transactions);
    expect(restored.categories).toEqual(data.categories);
    expect(restored.paymentMethods).toEqual(data.paymentMethods);
    expect(restored.budgets).toEqual(data.budgets);
    expect(restored.budgetHistory).toEqual(data.budgetHistory);
    expect(restored.preferences).toEqual(data.preferences);
    expect(restored.transactions[0]).toMatchObject({
      syncId: data.transactions[0].syncId,
      categorySyncId: data.transactions[0].categorySyncId,
      paymentMethodSyncId: data.transactions[0].paymentMethodSyncId
    });
    expect(restored.budgets[0].categorySyncId).toBe(data.budgets[0].categorySyncId);
    expect(restored.budgetHistory[0].categorySyncId).toBe(data.budgetHistory[0].categorySyncId);
    expect(restored.syncIdentityReport).toMatchObject({
      duplicateSyncIds: [],
      identityWarnings: [],
      unresolvedRelationships: []
    });
  });

  it('continues to import complete legacy v3 backups without sync identity fields', () => {
    const restored = normalizeBackupData({
      version: 3,
      ...completeLegacyBackupData()
    });

    expect(restored.transactions[0]).toMatchObject({
      id: 15,
      title: 'Groceries',
      amount: 12550,
      categoryId: 'cat-food',
      paymentMethodId: 'pm-cash'
    });
    expect(restored.categories).toEqual([{ id: 'cat-food', name: 'Food', type: 'expense' }]);
    expect(restored.paymentMethods).toEqual([{ id: 'pm-cash', name: 'Cash' }]);
    expect(restored.budgets[0]).toMatchObject({ amount: 25000, categoryId: 'cat-food' });
    expect(restored.preferences[0]).toMatchObject({ id: 'app', currency: 'PKR' });
  });

  it('rejects malformed, missing, or duplicate v4 sync identity fields', () => {
    const missingSyncId = completeBackupData();
    delete missingSyncId.categories[0].syncId;
    expect(() => normalizeBackupData({ version: 4, ...missingSyncId }))
      .toThrow('Backup categories contain an invalid sync ID.');

    const malformedRelationship = completeBackupData();
    malformedRelationship.transactions[0].categorySyncId = 'not-a-uuid';
    expect(() => normalizeBackupData({ version: 4, ...malformedRelationship }))
      .toThrow('Backup transactions contain an invalid record.');

    const duplicateSyncId = completeBackupData();
    duplicateSyncId.transactions[0].syncId = duplicateSyncId.categories[0].syncId;
    expect(() => normalizeBackupData({ version: 4, ...duplicateSyncId }))
      .toThrow('Backup contains duplicate sync IDs.');
  });

  it('recovers missing and unknown payment methods without breaking transaction references', () => {
    const backup = completeLegacyBackupData();
    backup.paymentMethods = [{ id: 'pm-cash', name: 'Cash' }];
    backup.transactions = [
      { ...backup.transactions[0], paymentMethodId: 'pm-legacy' },
      { ...backup.transactions[0], id: 16, paymentMethodId: undefined }
    ];

    const restored = normalizeBackupData({
      version: 3,
      ...backup
    });

    expect(restored.transactions.map((transaction) => transaction.paymentMethodId))
      .toEqual(['pm-legacy', 'pm-other']);
    expect(restored.paymentMethods).toContainEqual({
      id: 'pm-legacy',
      name: 'Recovered method (pm-legacy)'
    });
    expect(restored.paymentMethods).toContainEqual({ id: 'pm-other', name: 'Other' });
    expect(restored.warnings).toHaveLength(2);
  });

  it('accepts older backups without preferences or payment methods', () => {
    const restored = normalizeBackupData({
      version: 2,
      transactions: [{
        id: 1,
        title: 'Lunch',
        amount: 12.5,
        type: 'expense',
        categoryId: 'cat-food',
        date: '2026-10-24'
      }],
      categories: [{ id: 'cat-food', name: 'Food', type: 'expense' }],
      budgets: [{ id: 'budget-2026-10-food', categoryId: 'cat-food', month: '2026-10', amount: 12500 }]
    });

    expect(restored.transactions[0].amount).toBe(1250);
    expect(restored.transactions[0].paymentMethodId).toBe('pm-other');
    expect(restored.preferences).toBeNull();
    expect(restored.paymentMethods.some((method) => method.id === 'pm-other')).toBe(true);
    expect(restored.budgets[0].amount).toBe(12500);
    expect(restored.warnings).toContain('1 transaction(s) without a payment method were assigned to Other.');

    const versionOne = normalizeBackupData({
      version: 1,
      transactions: [{
        id: 2,
        title: 'Tea',
        amount: 12.5,
        type: 'expense',
        categoryId: 'cat-food',
        date: '2026-10-24'
      }],
      categories: [{ id: 'cat-food', name: 'Food', type: 'expense' }],
      budgets: [{ id: 'budget-2026-10-food', categoryId: 'cat-food', month: '2026-10', amount: 125 }]
    });
    expect(versionOne.transactions[0].amount).toBe(1250);
    expect(versionOne.budgets[0].amount).toBe(12500);
  });

  it('rejects malformed JSON and incomplete or malformed v3 backups', () => {
    expect(() => parseBackupPayload('{not-json')).toThrow('Backup file is not valid JSON.');
    expect(() => buildBackupPayload({ transactions: [] }))
      .toThrow('A complete backup requires every data collection and app preferences.');

    const incomplete = completeBackupData();
    delete incomplete.budgetHistory;
    expect(() => normalizeBackupData({ version: 3, ...incomplete }))
      .toThrow('Backup collection "budgetHistory" is missing or invalid.');

    const missingRequiredField = completeBackupData();
    delete missingRequiredField.transactions[0].title;
    expect(() => normalizeBackupData({ version: 3, ...missingRequiredField }))
      .toThrow('Backup transactions contain an invalid record.');
  });

  it('preserves existing records when a restore write fails inside its transaction', async () => {
    const makeTable = (initialRows, shouldFail = false) => {
      let rows = initialRows;
      return {
        clear: async () => { rows = []; },
        bulkPut: async (records) => {
          if (shouldFail) throw new Error('simulated write failure');
          rows = [...rows, ...records];
        },
        getRows: () => rows,
        restoreRows: (snapshot) => { rows = snapshot; }
      };
    };
    const database = {
      transactions: makeTable([{ id: 1, title: 'Existing transaction' }]),
      categories: makeTable([{ id: 'existing-category' }]),
      paymentMethods: makeTable([{ id: 'existing-method' }]),
      budgets: makeTable([{ id: 'existing-budget' }], true),
      budgetHistory: makeTable([{ id: 1, description: 'Existing history' }]),
      preferences: makeTable([{ id: 'app', name: 'Existing preferences' }])
    };
    database.transaction = async (...args) => {
      const tables = args.slice(1, -1);
      const callback = args[args.length - 1];
      const snapshots = tables.map((table) => table.getRows());
      try {
        await callback();
      } catch (error) {
        tables.forEach((table, index) => table.restoreRows(snapshots[index]));
        throw error;
      }
    };
    const before = Object.fromEntries(
      Object.entries(database)
        .filter(([, table]) => typeof table.getRows === 'function')
        .map(([name, table]) => [name, table.getRows()])
    );

    await expect(restoreBackupData(database, normalizeBackupData({
      version: 3,
      ...completeBackupData()
    }))).rejects.toThrow('simulated write failure');
    for (const [name, rows] of Object.entries(before)) {
      expect(database[name].getRows()).toEqual(rows);
    }
  });

  it('restores v4 records without replacing stable IDs or their references', async () => {
    const makeTable = () => {
      let rows = [];
      return {
        clear: async () => { rows = []; },
        bulkPut: async (records) => { rows = [...rows, ...records]; },
        getRows: () => rows
      };
    };
    const database = {
      transactions: makeTable(),
      categories: makeTable(),
      paymentMethods: makeTable(),
      budgets: makeTable(),
      budgetHistory: makeTable(),
      preferences: makeTable()
    };
    database.transaction = async (...args) => args.at(-1)();
    const backup = normalizeBackupData({ version: 4, ...completeBackupData() });

    await restoreBackupData(database, backup);

    expect(database.transactions.getRows()[0]).toMatchObject({
      syncId: completeBackupData().transactions[0].syncId,
      categorySyncId: completeBackupData().transactions[0].categorySyncId,
      paymentMethodSyncId: completeBackupData().transactions[0].paymentMethodSyncId
    });
    expect(database.categories.getRows()[0].syncId).toBe(completeBackupData().categories[0].syncId);
    expect(database.paymentMethods.getRows()[0].syncId).toBe(completeBackupData().paymentMethods[0].syncId);
    expect(database.budgets.getRows()[0].categorySyncId).toBe(completeBackupData().budgets[0].categorySyncId);
    expect(database.budgetHistory.getRows()[0].categorySyncId)
      .toBe(completeBackupData().budgetHistory[0].categorySyncId);
  });

  it('formats dates using the local calendar date', () => {
    expect(getLocalDateString(new Date(2026, 9, 24, 0, 30))).toBe('2026-10-24');
  });

  it('formats dates using the selected display format', () => {
    const date = '2026-10-03';
    expect(formatDate(date, 'DD MMM YYYY')).toBe('03 Oct 2026');
    expect(formatDate(date, 'DD/MM/YYYY')).toBe('03/10/2026');
    expect(formatDate(date, 'MM/DD/YYYY')).toBe('10/03/2026');
    expect(formatDate(date, 'YYYY-MM-DD')).toBe('2026-10-03');
  });

  it('builds a seven-day daily expense and remaining budget trend', () => {
    const trend = buildWeeklyBudgetTrend([
      { type: 'expense', date: '2026-10-03', amount: 50 },
      { type: 'expense', date: '2026-10-05', amount: 20 },
      { type: 'expense', date: '2026-10-05', amount: 5 },
      { type: 'income', date: '2026-10-05', amount: 100 },
      { type: 'expense', date: '2026-10-11', amount: 30 }
    ], 200, new Date(2026, 9, 10));

    expect(trend).toHaveLength(7);
    expect(trend[0]).toMatchObject({
      isoDate: '2026-10-04',
      expenses: 0,
      totalExpenses: 50,
      remainingBudget: 150
    });
    expect(trend[1]).toMatchObject({
      isoDate: '2026-10-05',
      expenses: 25,
      totalExpenses: 75,
      remainingBudget: 125
    });
    expect(trend[6]).toMatchObject({
      isoDate: '2026-10-10',
      expenses: 0,
      totalExpenses: 75,
      remainingBudget: 125
    });
  });

  it('builds a six-month expense trend and ignores income', () => {
    const trend = buildMonthlyExpenseTrend([
      { type: 'expense', date: '2026-07-03', amount: 25 },
      { type: 'expense', date: '2026-08-03', amount: 100 },
      { type: 'income', date: '2026-08-05', amount: 500 },
      { type: 'expense', date: '2026-10-01', amount: 60 },
      { type: 'expense', date: '2026-04-30', amount: 1000 }
    ], 6, new Date(2026, 9, 25));

    expect(trend.map(({ month, amount }) => [month, amount])).toEqual([
      ['2026-05', 0],
      ['2026-06', 0],
      ['2026-07', 25],
      ['2026-08', 100],
      ['2026-09', 0],
      ['2026-10', 60]
    ]);
  });

  it('compares monthly expenses with category budgets and budget additions', () => {
    const trend = buildMonthlyBudgetTrend(
      [{ type: 'expense', date: '2026-10-03', amount: 75 }],
      [{ id: 'budget-2026-10-food', month: '2026-10', categoryId: 'food', amount: 20000 }],
      [{ month: '2026-09', entryType: 'addition', amount: 15000 }],
      2,
      new Date(2026, 9, 25)
    );

    expect(trend.map(({ month, amount, budget }) => [month, amount, budget])).toEqual([
      ['2026-09', 0, 150],
      ['2026-10', 75, 200]
    ]);
  });

  it('rejects transactions with missing or invalid dates', () => {
    expect(validateTransaction({ amount: '10', date: '' }).errors).toContain('Select a valid transaction date.');
    expect(validateTransaction({ amount: '10', date: '2026-02-31' }).isValid).toBe(false);
    expect(validateTransaction({ amount: '10', date: '2026-10-24' }).isValid).toBe(true);
  });

  it('rejects amounts that cannot be stored accurately in paisa', () => {
    expect(validateTransaction({ amount: '0.001', date: '2026-10-24' }).isValid).toBe(false);
    expect(validateTransaction({ amount: '10', date: '2026-10-24' }).isValid).toBe(true);
  });
});
