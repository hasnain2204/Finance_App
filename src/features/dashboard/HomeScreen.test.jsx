import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';
import { getLocalDateString, toPaisa } from '../../lib/finance';

describe('HomeScreen', () => {
  const dummyPreferences = { name: 'Alex', currency: 'PKR' };

  it('displays the current month cumulative budget and banking available balance', () => {
    // Current month transactions vs previous month
    const currentMonth = getLocalDateString().slice(0, 7);
    const transactions = [
      { id: 1, type: 'expense', amount: 2000, date: `${currentMonth}-05`, categoryId: 'food' },
      { id: 2, type: 'expense', amount: 3000, date: `${currentMonth}-10`, categoryId: 'bills' },
      // Previous month transaction: deducted from bank available balance, excluded from monthly expense
      { id: 3, type: 'expense', amount: 10000, date: '2026-10-15', categoryId: 'rent' }
    ];

    // Budget history:
    // b1: 50,000 in current month; b2: 30,000 in current month.
    // If more than one budget added in current month, they are added up: 50,000 + 30,000 = 80,000.
    // Current month expenses = 2,000 + 3,000 = 5,000.
    // Available balance = total deposits (80,000) - total all-time expenses (15,000) = 65,000.
    const budgetHistory = [
      { id: 'b2', amount: toPaisa(30000), date: `${currentMonth}-16`, createdAt: `${currentMonth}-16T10:00:00Z` },
      { id: 'b1', amount: toPaisa(50000), date: `${currentMonth}-01`, createdAt: `${currentMonth}-01T10:00:00Z` }
    ];

    const { getAllByText } = render(
      <HomeScreen
        preferences={dummyPreferences}
        budgets={[{ id: 'budget-all-overall', categoryId: 'overall', amount: toPaisa(80000) }]}
        budgetHistory={budgetHistory}
        totalBudgetPaisa={toPaisa(80000)}
        transactions={transactions}
        weeklySpending={[]}
        transactionHistory={[]}
        categoryMap={{}}
        paymentMap={{}}
        onOpenAddExpense={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenTransactions={vi.fn()}
        onOpenTransaction={vi.fn()}
      />
    );

    // Current month expenses should be 2,000 + 3,000 = 5,000 (NOT 15,000!)
    const expensePills = getAllByText(/PKR 5,000/);
    expect(expensePills.length).toBeGreaterThan(0);

    // Budget displayed = 80,000 (50,000 + 30,000 added up in current month)
    const budgetPills = getAllByText(/PKR 80,000/);
    expect(budgetPills.length).toBeGreaterThan(0);

    // Available balance = 80,000 - 15,000 = 65,000
    const availablePills = getAllByText(/PKR 65,000/);
    expect(availablePills.length).toBeGreaterThan(0);
  });

  it('isolates budget to current month while available balance preserves all-time account funds', () => {
    const currentMonth = getLocalDateString().slice(0, 7);
    // Expenses = 10,000
    const transactions = [
      { id: 1, type: 'expense', amount: 10000, date: `${currentMonth}-05`, categoryId: 'food' }
    ];

    // b1 was added in October (previous month): 50,000
    // b2 was added in November (current month): 50,000
    // Current month budget = 50,000 (only November budgets count toward November budget)
    // Available balance = 50,000 + 50,000 - 10,000 = 90,000
    const budgetHistory = [
      { id: 'b2', amount: toPaisa(50000), date: `${currentMonth}-16`, createdAt: `${currentMonth}-16T10:00:00Z` },
      { id: 'b1', amount: toPaisa(50000), date: '2026-10-01', createdAt: '2026-10-01T10:00:00Z' }
    ];

    const { getAllByText } = render(
      <HomeScreen
        preferences={dummyPreferences}
        budgets={[{ id: 'budget-all-overall', categoryId: 'overall', amount: toPaisa(100000) }]}
        budgetHistory={budgetHistory}
        totalBudgetPaisa={toPaisa(100000)}
        transactions={transactions}
        weeklySpending={[]}
        transactionHistory={[]}
        categoryMap={{}}
        paymentMap={{}}
        onOpenAddExpense={vi.fn()}
        onOpenBudget={vi.fn()}
        onOpenTransactions={vi.fn()}
        onOpenTransaction={vi.fn()}
      />
    );

    // Budget shows current month's budget 50,000 (not October's 50,000)
    const budgetPills = getAllByText(/PKR 50,000/);
    expect(budgetPills.length).toBeGreaterThan(0);

    // Available balance shows 90,000 (100,000 total deposited - 10,000 total expenses)
    const availablePills = getAllByText(/PKR 90,000/);
    expect(availablePills.length).toBeGreaterThan(0);

    // Expenses show 10,000
    const expensePills = getAllByText(/PKR 10,000/);
    expect(expensePills.length).toBeGreaterThan(0);
  });
});
