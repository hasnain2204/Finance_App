import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NamedEntityManager } from './NamedEntityManager';

describe('NamedEntityManager', () => {
  const dummyItems = [
    { id: '1', name: 'Category A' },
    { id: '2', name: 'Category B' }
  ];

  it('renders all items in default non-editable state with drag handles', () => {
    const onSelect = vi.fn();
    const onReorder = vi.fn();
    const onRequestDelete = vi.fn();

    render(
      <NamedEntityManager
        title="Categories"
        listAriaLabel="Categories"
        items={dummyItems}
        selectedId={null}
        nameDraft=""
        onNameDraftChange={vi.fn()}
        onSelect={onSelect}
        onSave={vi.fn()}
        onRequestDelete={onRequestDelete}
        entityToDelete={null}
        onCancelDelete={vi.fn()}
        onConfirmDelete={vi.fn()}
        deleteTitle="Delete Category?"
        deleteDescription="Delete this category?"
        nameLabel="Category Name"
        nameInputId="category-name"
        addFormId="add-category-form"
        addInput=""
        onAddInputChange={vi.fn()}
        onAdd={vi.fn()}
        addPlaceholder="Category name"
        addAriaLabel="Category name"
        onBack={vi.fn()}
        onReorder={onReorder}
      />
    );

    // Items are in default non-editable form
    const itemA = screen.getByRole('button', { name: 'Edit Category A' });
    const itemB = screen.getByRole('button', { name: 'Edit Category B' });
    expect(itemA).not.toBeNull();
    expect(itemB).not.toBeNull();

    // Clicking an item invokes onSelect
    fireEvent.click(itemA);
    expect(onSelect).toHaveBeenCalledWith(dummyItems[0]);

    // Drag handle is present on leftmost of each item
    const handles = screen.getAllByRole('button', { name: /Drag to reorder/i });
    expect(handles).toHaveLength(2);

    // Trash delete button is present for each item
    const deleteBtns = screen.getAllByRole('button', { name: /Delete Category/i });
    expect(deleteBtns).toHaveLength(2);
    fireEvent.click(deleteBtns[0]);
    expect(onRequestDelete).toHaveBeenCalledWith(dummyItems[0]);
  });

  it('switches to editable form when selectedId matches an item and renders Cancel/Delete in dialog', () => {
    const onSave = vi.fn();
    const onConfirmDelete = vi.fn();
    const onCancelDelete = vi.fn();

    render(
      <NamedEntityManager
        title="Categories"
        listAriaLabel="Categories"
        items={dummyItems}
        selectedId="1"
        nameDraft="Category A Updated"
        onNameDraftChange={vi.fn()}
        onSelect={vi.fn()}
        onSave={onSave}
        onRequestDelete={vi.fn()}
        entityToDelete={dummyItems[0]}
        onCancelDelete={onCancelDelete}
        onConfirmDelete={onConfirmDelete}
        deleteTitleId="del-title"
        deleteTitle="Delete Category?"
        deleteDescription="Delete Category A? Any transactions using this category will be changed to General."
        nameLabel="Category Name"
        nameInputId="category-name"
        addFormId="add-category-form"
        addInput=""
        onAddInputChange={vi.fn()}
        onAdd={vi.fn()}
        addPlaceholder="Category name"
        addAriaLabel="Category name"
        onBack={vi.fn()}
      />
    );

    // Selected item is in editable input mode
    const input = screen.getByLabelText('Category Name');
    expect(input).not.toBeNull();
    expect(input.value).toBe('Category A Updated');

    // Save Changes button is enabled
    const saveBtn = screen.getByRole('button', { name: 'Save Changes' });
    expect(saveBtn.disabled).toBe(false);

    // Confirm dialog has Cancel and Delete buttons
    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    const deleteBtn = screen.getByRole('button', { name: 'Delete' });
    expect(cancelBtn).not.toBeNull();
    expect(deleteBtn).not.toBeNull();

    fireEvent.click(cancelBtn);
    expect(onCancelDelete).toHaveBeenCalledOnce();

    fireEvent.click(deleteBtn);
    expect(onConfirmDelete).toHaveBeenCalledOnce();
  });
});
