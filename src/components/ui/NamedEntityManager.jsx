import { Pencil, Trash2 } from 'lucide-react';
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
  defaultLabel
}) {
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

        {/* Categories / Payment Methods List with Click-to-Edit */}
        <div className="account-category-list" aria-label={listAriaLabel}>
          {items.map((item) => {
            const isEditing = selectedId === item.id;
            return (
              <div
                className={`account-category-row ${isEditing ? 'is-editing' : ''}`}
                key={item.id}
              >
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
                    aria-label={`Remove ${item.name}`}
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
