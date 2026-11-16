import { useState, useRef } from 'react';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';
import { StatusMessage } from './StatusMessage';
import { ConfirmDialog } from './ConfirmDialog';
import { BackHeader } from './BackHeader';
import { ThemedSelect } from './ThemedSelect';

export function NamedEntityManager({
  title,
  listAriaLabel,
  items,
  selectedId,
  nameDraft,
  onNameDraftChange,
  editStatus,
  onSelect,
  onSave,
  onRequestDelete,
  entityToDelete,
  onCancelDelete,
  onConfirmDelete,
  deleteTitleId,
  deleteTitle,
  deleteDescription,
  nameLabel,
  nameInputId,
  addFormId,
  addInput,
  onAddInputChange,
  onAdd,
  addPlaceholder,
  addAriaLabel,
  onBack,
  defaultItemId,
  onSelectDefault,
  defaultLabel,
  onReorder
}) {
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const touchStartIndexRef = useRef(null);

  const reorderList = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || fromIndex == null || toIndex == null) return;
    if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return;
    const nextItems = [...items];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, moved);
    onReorder?.(nextItems);
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    }
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (index) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    const fromIndex = draggedIndex !== null
      ? draggedIndex
      : Number(e.dataTransfer?.getData('text/plain'));
    if (!Number.isNaN(fromIndex) && fromIndex !== index) {
      reorderList(fromIndex, index);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleTouchStart = (index) => {
    touchStartIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e) => {
    if (touchStartIndexRef.current === null) return;
    const touch = e.touches[0];
    if (!touch) return;
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const row = element?.closest('[data-item-index]');
    if (row) {
      const targetIndex = Number(row.getAttribute('data-item-index'));
      if (!Number.isNaN(targetIndex) && targetIndex !== dragOverIndex) {
        setDragOverIndex(targetIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartIndexRef.current !== null && dragOverIndex !== null && touchStartIndexRef.current !== dragOverIndex) {
      reorderList(touchStartIndexRef.current, dragOverIndex);
    }
    touchStartIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <main className="account-shell">
      <BackHeader title={title} onBack={onBack} backLabel="Back to More" />

      <section className="account-content">
        {/* Topmost Default Item Selector */}
        {onSelectDefault ? (
          <div className="account-default-selector-card">
            <label htmlFor={`${nameInputId}-default`} className="account-default-label">
              {defaultLabel || `Default ${nameLabel}`}
            </label>
            <ThemedSelect
              id={`${nameInputId}-default`}
              label={defaultLabel || `Default ${nameLabel}`}
              value={defaultItemId || items[0]?.id || ''}
              onChange={(e) => onSelectDefault?.(e.target.value)}
              options={items.map((item) => ({ value: item.id, label: item.name }))}
            />
          </div>
        ) : null}

        {/* Categories / Payment Methods / Budget Types List with Drag Handle & Click-to-Edit */}
        <div className="account-category-list" aria-label={listAriaLabel}>
          {items.map((item, index) => {
            const isEditing = selectedId === item.id;
            const isDragging = draggedIndex === index;
            const isDragOver = dragOverIndex === index;

            return (
              <div
                className={`account-category-row ${isEditing ? 'is-editing' : ''} ${isDragging ? 'is-dragging' : ''} ${isDragOver ? 'is-drag-over' : ''}`}
                key={item.id}
                data-item-index={index}
                draggable={!isEditing}
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => handleDragLeave(index)}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
              >
                {/* Leftmost drag handle to reorder list items */}
                <button
                  type="button"
                  className="account-category-drag-handle"
                  aria-label={`Drag to reorder ${item.name}`}
                  title="Drag to reorder"
                  onTouchStart={() => handleTouchStart(index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <GripVertical size={18} aria-hidden="true" />
                </button>

                {isEditing ? (
                  <form
                    className="account-category-inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      onSave?.(e);
                    }}
                  >
                    <input
                      id={nameInputId}
                      className="account-category-inline-input"
                      value={nameDraft}
                      onChange={onNameDraftChange}
                      aria-label={nameLabel}
                      autoFocus
                      required
                    />
                  </form>
                ) : (
                  <button
                    type="button"
                    className="account-category-name-button"
                    onClick={() => onSelect(item)}
                    aria-label={`Edit ${item.name}`}
                  >
                    <span className="account-category-name-text">{item.name}</span>
                    <Pencil size={15} className="account-category-pencil-hint" aria-hidden="true" />
                  </button>
                )}

                <div className="account-category-actions">
                  <button
                    type="button"
                    className="account-category-remove"
                    onClick={() => onRequestDelete(item)}
                    aria-label={`Delete ${item.name}`}
                  >
                    <Trash2 size={19} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <StatusMessage type={editStatus?.type} message={editStatus?.message} />

        {/* Always-visible One-Line Add Form (Input Box + Add Button) */}
        <form
          id={addFormId}
          className="account-add-inline-row"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd();
          }}
        >
          <input
            className="account-add-inline-input"
            value={addInput}
            onChange={onAddInputChange}
            placeholder={addPlaceholder}
            aria-label={addAriaLabel}
            required
          />
          <button type="submit" className="primary-action account-add-inline-btn">
            Add
          </button>
        </form>

        {/* Bottommost Save Changes Button */}
        <button
          type="button"
          className="primary-action full account-save-button"
          onClick={onSave}
          disabled={!selectedId}
        >
          Save Changes
        </button>
      </section>

      {/* Confirmation Dialog showing Cancel and Delete buttons */}
      <ConfirmDialog
        open={Boolean(entityToDelete)}
        titleId={deleteTitleId}
        title={deleteTitle}
        description={deleteDescription}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
        confirmLabel="Delete"
      />
    </main>
  );
}
