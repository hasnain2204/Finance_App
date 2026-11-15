import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BudgetScreen } from './BudgetScreen';

describe('BudgetScreen', () => {
  const dummyBudgetForm = {
    amount: '50000',
    budgetCategory: 'Salary',
    date: '2026-11-16',
    description: 'Monthly salary allocation'
  };

  it('renders budget form with inline rows, Amount first and required without Rs in label', () => {
    const { container } = render(
      <BudgetScreen
        budgetFormRef={{ current: null }}
        budgetForm={dummyBudgetForm}
        editingBudgetHistoryId={null}
        status={{ type: 'idle', message: '' }}
        budgetHistory={[]}
        categoryMap={{}}
        paymentMap={{}}
        dateFormat="YYYY-MM-DD"
        onFormChange={vi.fn()}
        onSave={vi.fn()}
        onOpenTransaction={vi.fn()}
      />
    );

    // Verify Amount label does not contain (Rs) or (PKR)
    const amountLabel = container.querySelector('label[for="budget-amount"]');
    expect(amountLabel).not.toBeNull();
    expect(amountLabel.textContent).toContain('Amount');
    expect(amountLabel.textContent).not.toContain('(Rs)');
    expect(amountLabel.textContent).not.toContain('(PKR)');

    // Verify Amount input is required
    const amountInput = container.querySelector('#budget-amount');
    expect(amountInput.required).toBe(true);

    // Verify 4 inline rows
    const rows = container.querySelectorAll('.budget-form .form-inline-row');
    expect(rows.length).toBe(4);

    expect(rows[0].querySelector('label').textContent).toContain('Amount');
    expect(rows[1].querySelector('label').textContent).toContain('Category');
    expect(rows[2].querySelector('label').textContent).toContain('Date');
    expect(rows[3].querySelector('label').textContent).toContain('Description');

    // Verify save button
    const submitBtn = container.querySelector('button[type="submit"]');
    expect(submitBtn.textContent).toBe('Save Budget');
  });
});
