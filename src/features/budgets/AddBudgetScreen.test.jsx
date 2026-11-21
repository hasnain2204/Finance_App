import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { AddBudgetScreen } from './AddBudgetScreen';

describe('AddBudgetScreen', () => {
  const dummyBudgetForm = {
    amount: '50000',
    budgetCategory: 'Salary',
    date: '2026-11-16',
    description: 'Monthly salary allocation'
  };

  it('renders budget form with inline rows, Amount first and required without Rs in label', () => {
    const { container } = render(
      <AddBudgetScreen
        budgetFormRef={{ current: null }}
        editingBudgetHistoryId={null}
        form={dummyBudgetForm}
        budgetTypes={[{ id: 'bt-1', name: 'Salary' }, { id: 'bt-2', name: 'Freelance' }]}
        status={{ type: 'idle', message: '' }}
        dateFormat="YYYY-MM-DD"
        onBack={vi.fn()}
        onChange={vi.fn()}
        onSave={vi.fn()}
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

    // Verify 5 inline rows (Amount, Category, Date, Duration, Description)
    const rows = container.querySelectorAll('.transaction-form .form-inline-row');
    expect(rows.length).toBe(5);

    expect(rows[0].querySelector('label').textContent).toContain('Amount');
    expect(rows[1].querySelector('label').textContent).toContain('Category');
    expect(rows[2].querySelector('label').textContent).toContain('Date');
    expect(rows[3].querySelector('label').textContent).toContain('Duration');
    expect(rows[4].querySelector('label').textContent).toContain('Description');

    // Verify submit button for new budget
    const submitBtn = container.querySelector('button[type="submit"]');
    expect(submitBtn.textContent).toBe('Save Budget');
  });

  it('handles duration toggle and custom days preset pills', () => {
    const handleChange = vi.fn();

    const { getByText, rerender, container } = render(
      <AddBudgetScreen
        budgetFormRef={{ current: null }}
        editingBudgetHistoryId={null}
        form={{ ...dummyBudgetForm, periodType: 'month' }}
        budgetTypes={[{ id: 'bt-1', name: 'Salary' }]}
        status={{ type: 'idle', message: '' }}
        dateFormat="YYYY-MM-DD"
        onBack={vi.fn()}
        onChange={handleChange}
        onSave={vi.fn()}
      />
    );

    const fullMonthBtn = getByText('Full Month');
    const customDaysBtn = getByText('Custom Days');
    expect(fullMonthBtn.getAttribute('aria-checked')).toBe('true');
    expect(customDaysBtn.getAttribute('aria-checked')).toBe('false');

    // Click Custom Days
    fireEvent.click(customDaysBtn);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: { name: 'periodType', value: 'custom_days' } })
    );

    // Re-render in custom_days mode
    rerender(
      <AddBudgetScreen
        budgetFormRef={{ current: null }}
        editingBudgetHistoryId={null}
        form={{ ...dummyBudgetForm, periodType: 'custom_days', durationDays: '15' }}
        budgetTypes={[{ id: 'bt-1', name: 'Salary' }]}
        status={{ type: 'idle', message: '' }}
        dateFormat="YYYY-MM-DD"
        onBack={vi.fn()}
        onChange={handleChange}
        onSave={vi.fn()}
      />
    );

    const daysInput = container.querySelector('#budget-duration-days');
    expect(daysInput).not.toBeNull();
    expect(daysInput.value).toBe('15');

    // Click preset pill 7d
    const pill7d = getByText('7d');
    fireEvent.click(pill7d);
    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ target: { name: 'durationDays', value: '7' } })
    );
  });

  it('renders Edit Budget title and Save Changes button when editing', () => {
    const handleSave = vi.fn((e) => e.preventDefault());
    const handleBack = vi.fn();

    const { container, getByRole, getByText } = render(
      <AddBudgetScreen
        budgetFormRef={{ current: null }}
        editingBudgetHistoryId="bh-123"
        form={dummyBudgetForm}
        budgetTypes={[{ id: 'bt-1', name: 'Salary' }]}
        status={{ type: 'idle', message: '' }}
        dateFormat="YYYY-MM-DD"
        onBack={handleBack}
        onChange={vi.fn()}
        onSave={handleSave}
      />
    );

    // Check title
    expect(getByText('Edit Budget')).toBeDefined();

    // Check button
    const submitBtn = container.querySelector('button[type="submit"]');
    expect(submitBtn.textContent).toBe('Save Changes');

    // Test back button
    const backBtn = container.querySelector('.back-button');
    fireEvent.click(backBtn);
    expect(handleBack).toHaveBeenCalledTimes(1);

    // Test submit
    fireEvent.submit(container.querySelector('form'));
    expect(handleSave).toHaveBeenCalledTimes(1);
  });
});
