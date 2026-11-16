import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BudgetTypesScreen } from './BudgetTypesScreen';

describe('BudgetTypesScreen', () => {
  const dummyBudgetTypes = [
    { id: 'bt-1', name: 'Salary' },
    { id: 'bt-2', name: 'Freelance' },
    { id: 'bt-3', name: 'Business' }
  ];

  it('renders budget types list, top default selector, inline add bar, and drag handles', () => {
    const onSelectDefault = vi.fn();
    const onAdd = vi.fn();
    const onSave = vi.fn();
    const onSelect = vi.fn();
    const onReorder = vi.fn();

    const { container } = render(
      <BudgetTypesScreen
        budgetTypes={dummyBudgetTypes}
        selectedBudgetTypeId={null}
        budgetTypeNameDraft=""
        setBudgetTypeNameDraft={vi.fn()}
        budgetTypeEditStatus={{ type: 'idle', message: '' }}
        setBudgetTypeEditStatus={vi.fn()}
        budgetTypeInput="Investment"
        setBudgetTypeInput={vi.fn()}
        budgetTypeToDelete={null}
        setBudgetTypeToDelete={vi.fn()}
        onSelect={onSelect}
        onSave={onSave}
        onAdd={onAdd}
        onDelete={vi.fn()}
        onBack={vi.fn()}
        defaultBudgetTypeId="bt-1"
        onSelectDefault={onSelectDefault}
        onReorder={onReorder}
      />
    );

    // Verify Title
    expect(screen.getByRole('heading', { name: 'Budget Types' })).not.toBeNull();

    // Verify Default Selector Trigger exists
    const defaultSelectorTrigger = container.querySelector('#budget-type-name-default');
    expect(defaultSelectorTrigger).not.toBeNull();
    expect(defaultSelectorTrigger.textContent).toContain('Salary');

    // Verify items are rendered in default position (not in editable form)
    expect(screen.getByRole('button', { name: 'Edit Salary' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Freelance' })).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Edit Business' })).not.toBeNull();

    // Clicking an item invokes onSelect to make it editable
    fireEvent.click(screen.getByRole('button', { name: 'Edit Freelance' }));
    expect(onSelect).toHaveBeenCalledWith(dummyBudgetTypes[1]);

    // Verify Drag handles on leftmost of each type
    const dragHandles = screen.getAllByRole('button', { name: /Drag to reorder/i });
    expect(dragHandles).toHaveLength(3);

    // Save Changes button is disabled when nothing is selected
    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveBtn.disabled).toBe(true);

    // Verify Inline Add Row
    const addInput = screen.getByPlaceholderText('Budget type name');
    expect(addInput).not.toBeNull();
    const addBtn = screen.getByRole('button', { name: 'Add' });
    expect(addBtn).not.toBeNull();

    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it('renders confirmation dialog with Cancel and Delete buttons when deleting', () => {
    const onDelete = vi.fn();
    const onCancelDelete = vi.fn();

    render(
      <BudgetTypesScreen
        budgetTypes={dummyBudgetTypes}
        selectedBudgetTypeId={null}
        budgetTypeNameDraft=""
        setBudgetTypeNameDraft={vi.fn()}
        budgetTypeEditStatus={{ type: 'idle', message: '' }}
        setBudgetTypeEditStatus={vi.fn()}
        budgetTypeInput=""
        setBudgetTypeInput={vi.fn()}
        budgetTypeToDelete={dummyBudgetTypes[0]}
        setBudgetTypeToDelete={onCancelDelete}
        onSelect={vi.fn()}
        onSave={vi.fn()}
        onAdd={vi.fn()}
        onDelete={onDelete}
        onBack={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Delete Budget Type?' })).not.toBeNull();
    expect(screen.getByText(/Any budgets using this budget type will be changed to General/i)).not.toBeNull();

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    expect(cancelBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();

    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
