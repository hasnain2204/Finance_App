import { Pencil, Trash2 } from 'lucide-react';
import { StatusMessage } from './StatusMessage';
import { ConfirmDialog } from './ConfirmDialog';
import { BackHeader } from './BackHeader';

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
  showAddForm,
  onToggleAddForm,
  addFormId,
  addInput,
  onAddInputChange,
  onAdd,
  addButtonLabel,
  addPlaceholder,
  addAriaLabel,
  onBack
}) {
  return (
    <main className="account-shell">
      <BackHeader title={title} onBack={onBack} backLabel="Back to More" />

      <section className="account-content">
        <div className="account-category-list" aria-label={listAriaLabel}>
          {items.map((item) => (
            <div className="account-category-row" key={item.id}>
              <span>{item.name}</span>
              <div className="account-category-actions">
                <button
                  type="button"
                  className="account-category-edit"
                  onClick={() => onSelect(item)}
                  aria-label={`Edit ${item.name}`}
                  aria-pressed={selectedId === item.id}
                >
                  <Pencil size={20} />
                </button>
                <button
                  type="button"
                  className="account-category-remove"
                  onClick={() => onRequestDelete(item)}
                  aria-label={`Remove ${item.name}`}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <StatusMessage type={editStatus.type} message={editStatus.message} />

        <form className="account-category-form" onSubmit={onSave}>
          <label htmlFor={nameInputId}>{nameLabel}</label>
          <input
            id={nameInputId}
            value={nameDraft}
            onChange={onNameDraftChange}
            aria-label={nameLabel}
            disabled={!selectedId}
            required
          />
          <button className="primary-action full account-save-button" type="submit" disabled={!selectedId}>
            Save Changes
          </button>
        </form>
        <section className="account-add-category">
          <button
            type="button"
            className="secondary-button wide"
            onClick={onToggleAddForm}
            aria-expanded={showAddForm}
            aria-controls={addFormId}
          >
            {addButtonLabel}
          </button>
          {showAddForm ? (
            <form
              id={addFormId}
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                onAdd();
              }}
            >
              <input
                value={addInput}
                onChange={onAddInputChange}
                placeholder={addPlaceholder}
                aria-label={addAriaLabel}
                required
              />
              <button type="submit" className="secondary-button">Add</button>
            </form>
          ) : null}
        </section>
      </section>
      <ConfirmDialog
        open={Boolean(entityToDelete)}
        titleId={deleteTitleId}
        title={deleteTitle}
        description={deleteDescription}
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
        confirmLabel="Remove"
      />
    </main>
  );
}
