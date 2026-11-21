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
  validateTransaction,
  filterTransactionsByRange,
  calculateSpendingVelocity,
  calculateWeekdayWeekendSplit,
  calculateCategorySurge,
  calculateFinancialHealthScore,
  calculateAnalyticsOverview,
  calculateHomeDisplayBudget,
  calculateFinanceDashboard
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

  describe('V2 Analytics Engines', () => {
    const mockTxs = [
      { id: 1, type: 'expense', amount: 1000, date: '2026-11-10', categoryId: 'cat-food' },
      { id: 2, type: 'expense', amount: 2000, date: '2026-11-14', categoryId: 'cat-transport' }, // Saturday
      { id: 3, type: 'expense', amount: 1500, date: '2026-10-15', categoryId: 'cat-food' },
      { id: 4, type: 'expense', amount: 500, date: '2026-09-05', categoryId: 'cat-bills' }
    ];

    it('filters transactions accurately by time range preset', () => {
      const ref = new Date('2026-11-15T12:00:00Z');
      expect(filterTransactionsByRange(mockTxs, 'this-month', ref)).toHaveLength(2);
      expect(filterTransactionsByRange(mockTxs, 'last-month', ref)).toHaveLength(1);
      expect(filterTransactionsByRange(mockTxs, '3-months', ref)).toHaveLength(4);
      expect(filterTransactionsByRange(mockTxs, 'all-time', ref)).toHaveLength(4);
    });

    it('calculates spending velocity, safe daily limit and month-end projection correctly', () => {
      const ref = new Date('2026-11-15T12:00:00Z'); // Day 15 of 30 days
      const result = calculateSpendingVelocity({
        transactions: mockTxs,
        monthlyExpense: 3000,
        overallBudget: 5000,
        referenceDate: ref
      });

      expect(result.daysElapsed).toBe(15);
      expect(result.daysRemaining).toBe(15);
      expect(result.dailyAverage).toBe(200);
      expect(result.projectedTotal).toBe(6000); // 3000 + 200*15 = 6000
      expect(result.safeDailyLimit).toBeCloseTo(133.33, 1); // (5000 - 3000) / 15
      expect(result.status).toBe('warning'); // 6000 exceeds 5000 budget
      expect(result.label).toBe('Pacing High');
    });

    it('applies early month pace smoothing on days 1-3', () => {
      const ref = new Date('2026-11-02T12:00:00Z'); // Day 2 of 30 days
      const result = calculateSpendingVelocity({
        transactions: mockTxs,
        monthlyExpense: 1000,
        overallBudget: 5000,
        referenceDate: ref
      });

      expect(result.daysElapsed).toBe(2);
      expect(result.daysRemaining).toBe(28);
      expect(result.dailyAverage).toBe(500); // 1000 / 2
      expect(result.projectedTotal).toBe(15000); // 1000 + 500*28
      expect(result.status).toBe('warning');
      expect(result.message).toContain('Early pace high');
      expect(result.safeDailyLimit).toBeCloseTo(142.85, 1); // (5000 - 1000) / 28
    });

    it('computes weekday vs weekend spending split and identifies peak spending day', () => {
      const result = calculateWeekdayWeekendSplit(mockTxs);
      expect(result.grandTotal).toBe(5000);
      expect(result.weekendTotal).toBe(2500); // 2026-11-14 (Sat) + 2026-09-05 (Sat)
      expect(result.weekdayTotal).toBe(2500);
      expect(result.weekendPercent).toBe(50);
      expect(result.weekdayPercent).toBe(50);
      expect(result.peakDay).not.toBeNull();
      expect(result.peakDay?.name).toBe('Saturday');
      expect(result.peakDay?.amount).toBe(2500);
    });

    it('identifies category spending surges and detects newly active categories', () => {
      const surge = calculateCategorySurge(
        mockTxs,
        '2026-11',
        '2026-10',
        { 'cat-food': { name: 'Food' }, 'cat-transport': { name: 'Transport' } }
      );
      // Transport had 0 in Oct and 2000 in Nov
      expect(surge).not.toBeNull();
      expect(surge?.categoryName).toBe('Transport');
      expect(surge?.diffAmount).toBe(2000);
      expect(surge?.isNew).toBe(true);
    });

    it('calculates financial health score and handles unconfigured budgets cleanly', () => {
      const goodScore = calculateFinancialHealthScore({
        totalSpent: 1000,
        overallBudget: 5000,
        daysElapsed: 15,
        daysInMonth: 30
      });
      expect(goodScore.score).toBeGreaterThanOrEqual(80);
      expect(['Good', 'Excellent']).toContain(goodScore.rating);

      const overBudgetScore = calculateFinancialHealthScore({
        totalSpent: 6000,
        overallBudget: 5000,
        daysElapsed: 15,
        daysInMonth: 30
      });
      expect(overBudgetScore.score).toBeLessThanOrEqual(50);
      expect(overBudgetScore.rating).toBe('Attention Needed');

      const noBudgetScore = calculateFinancialHealthScore({
        totalSpent: 3000,
        overallBudget: null
      });
      expect(noBudgetScore.score).toBeNull();
      expect(noBudgetScore.rating).toBe('No Budget Set');
    });

    it('runs single-pass aggregation via calculateAnalyticsOverview', () => {
      const overview = calculateAnalyticsOverview(mockTxs, {
        currentMonth: '2026-11'
      });
      expect(overview.totalExpense).toBe(5000);
      expect(overview.currentMonthExpense).toBe(3000);
      expect(overview.categoryTotals['cat-food']).toBe(1000);
      expect(overview.categoryTotals['cat-transport']).toBe(2000);
    });

    it('calculates home display budget summing budgets within the target month', () => {
      // Case 1: No budget at all
      expect(calculateHomeDisplayBudget([], [], '2026-11')).toBeNull();

      // Case 2: One budget in target month -> shows 50,000
      const history1 = [
        { id: 'b1', amount: 5000000, date: '2026-11-10', createdAt: '2026-11-10T10:00:00Z', entryType: 'addition' }
      ];
      expect(calculateHomeDisplayBudget(history1, [], '2026-11')).toBe(50000);

      // Case 3: Multiple budgets added in the same month -> adds them up accordingly
      const history2 = [
        { id: 'b2', amount: 2000000, date: '2026-11-15', createdAt: '2026-11-15T10:00:00Z', entryType: 'addition' },
        { id: 'b1', amount: 5000000, date: '2026-11-10', createdAt: '2026-11-10T10:00:00Z', entryType: 'addition' }
      ];
      expect(calculateHomeDisplayBudget(history2, [], '2026-11')).toBe(70000);

      // Case 4: Budgets in a different month are not added into target month
      const history3 = [
        { id: 'b3', amount: 3000000, date: '2026-12-01', createdAt: '2026-12-01T10:00:00Z', entryType: 'addition' },
        { id: 'b2', amount: 2000000, date: '2026-11-15', createdAt: '2026-11-15T10:00:00Z', entryType: 'addition' }
      ];
      expect(calculateHomeDisplayBudget(history3, [], '2026-11')).toBe(20000);
      expect(calculateHomeDisplayBudget(history3, [], '2026-12')).toBe(30000);
      expect(calculateHomeDisplayBudget(history3, [], '2026-10')).toBeNull();
    });

    describe('calculateFinanceDashboard', () => {
      it('returns null budgets when no budget exists and calculates monthly expenses', () => {
        const transactions = [
          { type: 'expense', amount: 500, date: '2026-11-05' },
          { type: 'expense', amount: 1200, date: '2026-11-10' },
          { type: 'expense', amount: 3000, date: '2026-10-20' } // Different month
        ];
        const res = calculateFinanceDashboard({
          budgetHistory: [],
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-16')
        });

        expect(res.displayedBudget).toBeNull();
        expect(res.remainingBudget).toBeNull();
        expect(res.monthlyExpense).toBe(1700);
      });

      it('displays the single budget and calculates banking available balance correctly', () => {
        const history = [
          { id: 'b1', amount: 5000000, date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' }
        ];
        const transactions = [
          { type: 'expense', amount: 10000, date: '2026-11-05' }
        ];
        const res = calculateFinanceDashboard({
          budgetHistory: history,
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-16')
        });

        expect(res.displayedBudget).toBe(50000);
        expect(res.remainingBudget).toBe(40000);
        expect(res.monthlyExpense).toBe(10000);
      });

      it('adds up multiple budgets in current month and calculates banking available balance', () => {
        // Two budgets added in November: 50,000 + 30,000 = 80,000
        // Spent 10,000 -> available balance = 70,000
        const history = [
          { id: 'b2', amount: 3000000, date: '2026-11-16', createdAt: '2026-11-16T10:00:00Z' },
          { id: 'b1', amount: 5000000, date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' }
        ];
        const transactions = [
          { type: 'expense', amount: 10000, date: '2026-11-05' }
        ];
        const res = calculateFinanceDashboard({
          budgetHistory: history,
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-16')
        });

        expect(res.displayedBudget).toBe(80000);
        expect(res.remainingBudget).toBe(70000);
        expect(res.monthlyExpense).toBe(10000);
      });

      it('acts like a real-world bank account balance across months independent of monthly budget', () => {
        // October: Budget 50,000 deposited, 15,000 spent -> end of Oct balance = 35,000.
        // November: 60,000 deposited, 20,000 spent.
        // Total deposits = 50,000 + 60,000 = 110,000.
        // Total all-time expenses = 15,000 + 20,000 = 35,000.
        // Bank Available balance = 110,000 - 35,000 = 75,000.
        // November Budget = 60,000 (only November budgets).
        // November Expenses = 20,000 (only November expenses).
        const history = [
          { id: 'b2', amount: 6000000, date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' },
          { id: 'b1', amount: 5000000, date: '2026-10-01', createdAt: '2026-10-01T10:00:00Z' }
        ];
        const transactions = [
          { type: 'expense', amount: 15000, date: '2026-10-20' },
          { type: 'expense', amount: 20000, date: '2026-11-10' }
        ];

        const res = calculateFinanceDashboard({
          budgetHistory: history,
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-16')
        });

        expect(res.displayedBudget).toBe(60000);
        expect(res.remainingBudget).toBe(75000);
        expect(res.monthlyExpense).toBe(20000);
      });

      it('preserves existing bank balance when entering a new month before a new budget is set', () => {
        // In October: user deposited 50,000, spent 15,000. Balance = 35,000.
        // On 2026-11-01: No November budget has been added yet.
        const history = [
          { id: 'b1', amount: 5000000, date: '2026-10-01', createdAt: '2026-10-01T10:00:00Z' }
        ];
        const transactions = [
          { type: 'expense', amount: 15000, date: '2026-10-20' }
        ];

        const res = calculateFinanceDashboard({
          budgetHistory: history,
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-01')
        });

        expect(res.displayedBudget).toBeNull(); // No budget set for November yet
        expect(res.monthlyExpense).toBe(0); // November expenses start at 0
        expect(res.remainingBudget).toBe(35000); // 35,000 is still available in the bank account!
      });

      it('adds income transactions to banking available balance', () => {
        const history = [
          { id: 'b1', amount: 5000000, date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' }
        ];
        const transactions = [
          { type: 'income', amount: 10000, date: '2026-11-05' },
          { type: 'expense', amount: 20000, date: '2026-11-10' }
        ];

        const res = calculateFinanceDashboard({
          budgetHistory: history,
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-16')
        });

        expect(res.displayedBudget).toBe(50000);
        expect(res.remainingBudget).toBe(40000); // 50,000 + 10,000 - 20,000 = 40,000
        expect(res.monthlyExpense).toBe(20000);
      });

      it('shows negative remaining balance when total all-time expenses exceed total deposits', () => {
        const history = [
          { id: 'b1', amount: 2000000, date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' }
        ];
        const transactions = [
          { type: 'expense', amount: 35000, date: '2026-11-10' }
        ];
        const res = calculateFinanceDashboard({
          budgetHistory: history,
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-16')
        });

        expect(res.displayedBudget).toBe(20000);
        expect(res.remainingBudget).toBe(-15000); // 20,000 - 35,000
        expect(res.monthlyExpense).toBe(35000);
      });

      it('resets expenses at the 1st of a new month and isolates expenses to the month', () => {
        const transactions = [
          { type: 'expense', amount: 25000, date: '2026-10-31' },
          { type: 'expense', amount: 5000, date: '2026-11-01' },
          { type: 'expense', amount: 3000, date: '2026-11-05' }
        ];
        const history = [
          { id: 'b1', amount: 6000000, date: '2026-11-01', createdAt: '2026-11-01T10:00:00Z' }
        ];

        // On 2026-11-01 (or mid November), October's 25,000 is reset and excluded from monthly expense
        const res = calculateFinanceDashboard({
          budgetHistory: history,
          budgets: [],
          transactions,
          currentDate: new Date('2026-11-10')
        });

        expect(res.monthlyExpense).toBe(8000); // 5,000 + 3,000 (not 33,000!)
        expect(res.displayedBudget).toBe(60000);
        // Bank balance: 60,000 deposited - (25,000 Oct + 8,000 Nov) = 27,000
        expect(res.remainingBudget).toBe(27000);

        // In the next month (2026-12-01), November's expenses also reset to 0
        const nextMonthRes = calculateFinanceDashboard({
          budgetHistory: [
            ...history,
            { id: 'b2', amount: 7000000, date: '2026-12-01', createdAt: '2026-12-01T10:00:00Z' }
          ],
          budgets: [],
          transactions,
          currentDate: new Date('2026-12-01')
        });
        expect(nextMonthRes.monthlyExpense).toBe(0);
        expect(nextMonthRes.displayedBudget).toBe(70000); // Only December's budget
        // Total deposited: 60k + 70k = 130k; Total expenses: 25k + 8k = 33k; Bank balance = 97,000
        expect(nextMonthRes.remainingBudget).toBe(97000);
      });
    });
  });
});
