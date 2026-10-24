import { describe, it, expect } from 'vitest';
import {
  toPaisa,
  fromPaisa,
  formatCurrency,
  calculateBalance,
  calculateMonthlySummary,
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

  it('calculates available balance from income and expense totals', () => {
    const summary = calculateBalance([
      { type: 'income', amount: 5000 },
      { type: 'expense', amount: 1200 },
      { type: 'income', amount: 2500 },
      { type: 'expense', amount: 500 }
    ]);

    expect(summary.income).toBe(7500);
    expect(summary.expense).toBe(1700);
    expect(summary.balance).toBe(5800);
  });

  it('calculates monthly summary by period', () => {
    const data = [
      { type: 'income', amount: 1000, date: '2026-10-01T00:00:00.000Z' },
      { type: 'expense', amount: 400, date: '2026-10-13T00:00:00.000Z' },
      { type: 'expense', amount: 150, date: '2026-09-20T00:00:00.000Z' }
    ];

    const summary = calculateMonthlySummary(data, '2026-10');

    expect(summary.income).toBe(1000);
    expect(summary.expense).toBe(400);
    expect(summary.balance).toBe(600);
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
