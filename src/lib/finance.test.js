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
    title: 'Groceries',
    amount: 12550,
    type: 'expense',
    categoryId: 'cat-food',
    paymentMethodId: 'pm-cash',
    date: '2026-10-24',
    notes: 'Weekly shop',
    createdAt: '2026-10-24T12:00:00.000Z'
  }],
  categories: [{ id: 'cat-food', name: 'Food', type: 'expense' }],
  paymentMethods: [{ id: 'pm-cash', name: 'Cash' }],
  budgets: [{ id: 'budget-2026-10-food', categoryId: 'cat-food', month: '2026-10', amount: 25000 }],
  budgetHistory: [{
    id: 7,
    month: '2026-10',
    categoryId: 'cat-food',
    date: '2026-10-24',
    createdAt: '2026-10-24T12:00:00.000Z',
    previousAmount: null,
    amount: 25000,
    description: 'Monthly budget'
  }],
  preferences: [{
    id: 'app',
    currency: 'PKR',
    lightMode: false,
    name: 'A User',
    onboardingCompleted: true,
    dateFormat: 'YYYY-MM-DD',
    notificationsEnabled: true
  }]
});

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

  it('round trips every database collection and preserves preferences in v3 backups', () => {
    const data = completeBackupData();
    const backup = JSON.parse(buildBackupPayload(data));
    const restored = normalizeBackupData(backup);

    expect(backup.version).toBe(3);
    expect(backup.exportedAt).toBeTruthy();
    expect(restored.transactions).toEqual(data.transactions);
    expect(restored.categories).toEqual(data.categories);
    expect(restored.paymentMethods).toEqual(data.paymentMethods);
    expect(restored.budgets).toEqual(data.budgets);
    expect(restored.budgetHistory).toEqual(data.budgetHistory);
    expect(restored.preferences).toEqual(data.preferences);
  });

  it('recovers missing and unknown payment methods without breaking transaction references', () => {
    const backup = completeBackupData();
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
