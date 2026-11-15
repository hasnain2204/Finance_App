import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { BudgetScreen } from './BudgetScreen';

describe('BudgetScreen', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const dummyBudgetHistory = [
    {
      id: 'bh-1',
      date: '2026-11-16',
      createdAt: '2026-11-16T10:00:00.000Z',
      budgetCategory: 'Salary',
      amount: 5000000,
      description: 'Monthly salary'
    },
    {
      id: 'bh-2',
      date: '2026-10-01',
      createdAt: '2026-10-01T10:00:00.000Z',
      budgetCategory: 'Freelance',
      amount: 2500000,
      description: 'Project advance'
    }
  ];

  it('renders empty state when budget history is empty', () => {
    const { getByText } = render(
      <BudgetScreen
        budgetHistory={[]}
        onOpenAddBudget={vi.fn()}
        onOpenTransaction={vi.fn()}
      />
    );

    expect(getByText('No budget history yet.')).toBeDefined();
  });

  it('renders budget items grouped by date and allows clicking an item', () => {
    const handleOpenTransaction = vi.fn();

    const { getByText } = render(
      <BudgetScreen
        budgetHistory={dummyBudgetHistory}
        dateFormat="YYYY-MM-DD"
        onOpenAddBudget={vi.fn()}
        onOpenTransaction={handleOpenTransaction}
      />
    );

    expect(getByText('Budget history')).toBeDefined();
    expect(getByText('Monthly salary')).toBeDefined();

    // Click on item
    fireEvent.click(getByText('Monthly salary'));
    expect(handleOpenTransaction).toHaveBeenCalledTimes(1);
    expect(handleOpenTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'bh-1',
        historyType: 'budget',
        returnTab: 'budget'
      })
    );
  });

  it('renders floating action button and manages expand/collapse timing', () => {
    const handleOpenAddBudget = vi.fn();

    const { container } = render(
      <BudgetScreen
        budgetHistory={[]}
        onOpenAddBudget={handleOpenAddBudget}
        onOpenTransaction={vi.fn()}
      />
    );

    const fab = container.querySelector('.fab-button');
    expect(fab).not.toBeNull();
    expect(fab.classList.contains('is-expanded')).toBe(false);

    // Fast-forward 2 seconds -> should expand
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(fab.classList.contains('is-expanded')).toBe(true);

    // Fast-forward 10 more seconds (12s total) -> should collapse
    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(fab.classList.contains('is-expanded')).toBe(false);

    // Click floating action button
    fireEvent.click(fab);
    expect(handleOpenAddBudget).toHaveBeenCalledTimes(1);
  });
});
