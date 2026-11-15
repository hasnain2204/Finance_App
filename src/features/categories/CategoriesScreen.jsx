import { NamedEntityManager } from '../../components/ui';

export function CategoriesScreen({
  categories,
  selectedCategoryId,
  categoryNameDraft,
  setCategoryNameDraft,
  categoryEditStatus,
  setCategoryEditStatus,
  categoryInput,
  setCategoryInput,
  categoryToDelete,
  setCategoryToDelete,
  onSelect,
  onSave,
  onAdd,
  onDelete,
  onBack,
  defaultCategoryId,
  onSelectDefault
}) {
  return (
    <NamedEntityManager
      title="Categories"
      listAriaLabel="Categories"
      items={categories}
      selectedId={selectedCategoryId}
      nameDraft={categoryNameDraft}
      onNameDraftChange={(event) => {
        setCategoryNameDraft(event.target.value);
        setCategoryEditStatus({ type: 'idle', message: '' });
      }}
      editStatus={categoryEditStatus}
      onSelect={onSelect}
      onSave={onSave}
      onRequestDelete={(category) => {
        setCategoryEditStatus({ type: 'idle', message: '' });
        setCategoryToDelete(category);
      }}
      entityToDelete={categoryToDelete}
      onCancelDelete={() => setCategoryToDelete(null)}
      onConfirmDelete={onDelete}
      deleteTitleId="delete-category-title"
      deleteTitle="Remove Category?"
      deleteDescription={
        categoryToDelete
          ? `Remove “${categoryToDelete.name}” from your categories? Categories used by existing expenses or budgets cannot be removed.`
          : ''
      }
      nameLabel="Category Name"
      nameInputId="account-category-name"
      addFormId="account-add-category-form"
      addInput={categoryInput}
      onAddInputChange={(event) => {
        setCategoryInput(event.target.value);
        setCategoryEditStatus({ type: 'idle', message: '' });
      }}
      onAdd={onAdd}
      addPlaceholder="Category name"
      addAriaLabel="Category name"
      onBack={onBack}
      defaultItemId={defaultCategoryId}
      onSelectDefault={onSelectDefault}
      defaultLabel="Default Category"
    />
  );
}
