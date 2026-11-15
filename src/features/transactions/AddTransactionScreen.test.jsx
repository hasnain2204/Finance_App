import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AddTransactionScreen } from './AddTransactionScreen';

describe('AddTransactionScreen', () => {
  const dummyForm = {
    amount: '1500',
    categoryId: 'cat-1',
    paymentMethodId: 'pay-1',
    date: '2026-11-16',
    title: 'Groceries'
  };

  const dummyCategories = [
    { id: 'cat-1', name: 'Food' },
    { id: 'cat-2', name: 'Bills' }
  ];

  const dummyPaymentMethods = [
    { id: 'pay-1', name: 'Cash' },
    { id: 'pay-2', name: 'Bank' }
  ];

  it('renders fields in the required sequence with Amount required and without PKR in braces', () => {
    const { container } = render(
      <AddTransactionScreen
        editingTransactionId={null}
        form={dummyForm}
        categories={dummyCategories}
        paymentMethods={dummyPaymentMethods}
        status={{ type: 'idle', message: '' }}
        onBack={vi.fn()}
        onChange={vi.fn()}
        onSubmit={vi.fn()}
      />
    );

    // Verify Amount label does not contain PKR
    const amountLabel = container.querySelector('label[for="transaction-amount"]');
    expect(amountLabel).not.toBeNull();
    expect(amountLabel.textContent).toContain('Amount');
    expect(amountLabel.textContent).not.toContain('PKR');

    // Verify Amount input is required
    const amountInput = container.querySelector('#transaction-amount');
    expect(amountInput.required).toBe(true);

    // Verify field sequence across inline rows
    const rows = container.querySelectorAll('.form-inline-row');
    expect(rows.length).toBe(5);

    expect(rows[0].querySelector('label').textContent).toContain('Amount');
    expect(rows[1].querySelector('label').textContent).toContain('Category');
    expect(rows[2].querySelector('label').textContent).toContain('Payment Method');
    expect(rows[3].querySelector('label').textContent).toContain('Date');
    expect(rows[4].querySelector('label').textContent).toContain('Description');
  });
});
