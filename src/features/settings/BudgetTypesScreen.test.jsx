import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BudgetTypesScreen } from './BudgetTypesScreen';

describe('BudgetTypesScreen', () => {
  const dummyBudgetTypes = [
    { id: 'bt-1', name: 'Salary' },
    { id: 'bt-2', name: 'Freelance' },
    { id: 'bt-3', name: 'Business' }
  ];

  it('renders budget types list, top default selector, inline add bar, and save button', () => {
    const onSelectDefault = vi.fn();
    const onAdd = vi.fn();
    const onSave = vi.fn();

    render(
      <BudgetTypesScreen
        budgetTypes={dummyBudgetTypes}
        selectedBudgetTypeId="bt-1"
        budgetTypeNameDraft="Salary"
        setBudgetTypeNameDraft={vi.fn()}
        budgetTypeEditStatus={{ type: 'idle', message: '' }}
        setBudgetTypeEditStatus={vi.fn()}
        budgetTypeInput="Investment"
        setBudgetTypeInput={vi.fn()}
        budgetTypeToDelete={null}
        setBudgetTypeToDelete={vi.fn()}
        onSelect={vi.fn()}
        onSave={onSave}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        defaultBudgetTypeId="bt-1"
        onSelectDefault={onSelectDefault}
      />
    );

    // Verify Title
    expect(screen.getByRole('heading', { name: 'Budget Types' })).not.toBeNull();

    // Verify Default Selector Trigger exists
    expect(screen.getByRole('button', { name: /Salary/i })).not.toBeNull();

    // Verify All Budget Types Rendered
    expect(screen.getAllByText('Salary').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Freelance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Business').length).toBeGreaterThanOrEqual(1);

    // Verify Inline Add Row
    const addInput = screen.getByPlaceholderText('Budget type name');
    expect(addInput).not.toBeNull();
    const addBtn = screen.getByRole('button', { name: 'Add' });
    expect(addBtn).not.toBeNull();

    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledOnce();

    // Verify Save Changes button at bottom
    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveBtn).not.toBeNull();
    fireEvent.click(saveBtn);
    expect(onSave).toHaveBeenCalledOnce();
  });
});
