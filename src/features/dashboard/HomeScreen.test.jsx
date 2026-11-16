import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HomeScreen } from './HomeScreen';
import { getLocalDateString, toPaisa } from '../../lib/finance';

describe('HomeScreen', () => {
  const dummyPreferences = { name: 'Alex', currency: 'PKR' };

  it('displays the updated budget and current month expenses when remaining > latest budget', () => {
    // Current month transactions vs previous month
    const currentMonth = getLocalDateString().slice(0, 7);
    const transactions = [
      { id: 1, type: 'expense', amount: 2000, date: `${currentMonth}-05`, categoryId: 'food' },
      { id: 2, type: 'expense', amount: 3000, date: `${currentMonth}-10`, categoryId: 'bills' },
      // Previous month transaction: should NOT be included in current month expenses
      { id: 3, type: 'expense', amount: 10000, date: '2026-10-15', categoryId: 'rent' }
    ];

    // Budget history:
    // older: 50,000; latest: 30,000.
    // Current month expenses = 2,000 + 3,000 = 5,000 (October 10,000 ignored).
    // Baseline budget = 50,000.
    // Remaining budget = 50,000 - 5,000 = 45,000.
    // Since remaining (45,000) > latest budget (30,000):
    // Adds 2nd last budget (50,000) -> 30,000 + 50,000 = 80,000 >= 45,000!
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

    // Remaining available balance = 50,000 - 5,000 = 45,000
    const availablePills = getAllByText(/PKR 45,000/);
    expect(availablePills.length).toBeGreaterThan(0);

    // Budget displayed = 80,000 (because 45,000 > 30,000 so 2nd last 50,000 was added)
    const budgetPills = getAllByText(/PKR 80,000/);
    expect(budgetPills.length).toBeGreaterThan(0);
  });

  it('shows exactly the updated budget and preserves remaining budget when remaining budget <= latest budget', () => {
    const currentMonth = getLocalDateString().slice(0, 7);
    // Expenses = 10,000
    const transactions = [
      { id: 1, type: 'expense', amount: 10000, date: `${currentMonth}-05`, categoryId: 'food' }
    ];

    // Initial baseline: 50,000. Expenses = 10,000. Remaining = 40,000.
    // Latest updated budget = 50,000.
    // Since remaining (40,000) <= latest budget (50,000), displayed budget is 50,000 (NOT 100,000!)
    // Remaining budget stays 40,000.
    const budgetHistory = [
      { id: 'b2', amount: toPaisa(50000), date: `${currentMonth}-16`, createdAt: `${currentMonth}-16T10:00:00Z` },
      { id: 'b1', amount: toPaisa(50000), date: `${currentMonth}-01`, createdAt: `${currentMonth}-01T10:00:00Z` }
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

    // Budget shows updated 50,000 (not cumulative 100,000)
    const budgetPills = getAllByText(/PKR 50,000/);
    expect(budgetPills.length).toBeGreaterThan(0);

    // Available balance shows 40,000
    const availablePills = getAllByText(/PKR 40,000/);
    expect(availablePills.length).toBeGreaterThan(0);

    // Expenses show 10,000
    const expensePills = getAllByText(/PKR 10,000/);
    expect(expensePills.length).toBeGreaterThan(0);
  });
});
