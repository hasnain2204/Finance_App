import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from './App';

vi.mock('./services/financeRepository', () => {
  return {
    financeRepository: {
      loadData: vi.fn().mockResolvedValue({
        transactions: [],
        categories: [{ id: 'cat-1', name: 'Food', type: 'expense' }],
        paymentMethods: [{ id: 'pm-1', name: 'Cash' }],
        budgets: [],
        budgetHistory: [],
        preferences: {
          id: 'app',
          currency: 'PKR',
          lightMode: true,
          name: 'Hasnain',
          onboardingCompleted: true,
          dateFormat: 'DD MMM YYYY',
          notificationsEnabled: false
        }
      }),
      savePreferences: vi.fn().mockResolvedValue(true),
      saveTransaction: vi.fn().mockResolvedValue(true),
      saveBudgetHistory: vi.fn().mockResolvedValue(true),
      createCategory: vi.fn().mockResolvedValue('cat-2'),
      createPaymentMethod: vi.fn().mockResolvedValue('pm-2'),
      exportBackupPayload: vi.fn().mockResolvedValue('{}'),
      restoreBackup: vi.fn().mockResolvedValue({ migrationVerification: { verified: true } })
    }
  };
});

describe('App component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders home dashboard when onboarding is complete', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Good (Morning|Afternoon|Evening), Hasnain/)).toBeInTheDocument();
    });

    expect(screen.getByText('Available balance')).toBeInTheDocument();
    expect(screen.getByText('Add to budget')).toBeInTheDocument();
  });

  it('switches tabs to Transactions, Analytics, and Budget', async () => {
    const user = userEvent.setup();
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/Good (Morning|Afternoon|Evening), Hasnain/)).toBeInTheDocument();
    });

    const txTab = screen.getByRole('button', { name: 'Transactions' });
    await user.click(txTab);
    expect(screen.getByRole('heading', { name: 'Transactions' })).toBeInTheDocument();

    const analyticsTab = screen.getByRole('button', { name: 'Analytics' });
    await user.click(analyticsTab);
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();

    const budgetTab = screen.getByRole('button', { name: 'Budget' });
    await user.click(budgetTab);
    expect(screen.getByRole('heading', { name: 'Budget' })).toBeInTheDocument();
  });
});
