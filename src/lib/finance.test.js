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
  getLocalDateString,
  validateTransaction
} from './finance';

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

  it('includes budgets in version 2 backups', () => {
    const budget = { id: 'budget-2026-10-overall', categoryId: 'overall', month: '2026-10', amount: 125000 };
    const history = {
      id: 1,
      month: '2026-10',
      date: '2026-10-24',
      createdAt: '2026-10-24T12:00:00.000Z',
      previousAmount: null,
      amount: 125000
    };
    const backup = JSON.parse(buildBackupPayload({
      transactions: [],
      budgets: [budget],
      budgetHistory: [history]
    }));

    expect(backup.version).toBe(2);
    expect(backup.budgets).toEqual([budget]);
    expect(backup.budgetHistory).toEqual([history]);
  });

  it('formats dates using the local calendar date', () => {
    expect(getLocalDateString(new Date(2026, 9, 24, 0, 30))).toBe('2026-10-24');
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
