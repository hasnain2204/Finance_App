import { NamedEntityManager } from '../../components/ui';

export function BudgetTypesScreen({
  budgetTypes,
  selectedBudgetTypeId,
  budgetTypeNameDraft,
  setBudgetTypeNameDraft,
  budgetTypeEditStatus,
  setBudgetTypeEditStatus,
  budgetTypeInput,
  setBudgetTypeInput,
  budgetTypeToDelete,
  setBudgetTypeToDelete,
  onSelect,
  onSave,
  onAdd,
  onDelete,
  onBack,
  defaultBudgetTypeId,
  onSelectDefault
}) {
  return (
    <NamedEntityManager
      title="Budget Types"
      listAriaLabel="Budget types"
      items={budgetTypes}
      selectedId={selectedBudgetTypeId}
      nameDraft={budgetTypeNameDraft}
      onNameDraftChange={(event) => {
        setBudgetTypeNameDraft(event.target.value);
        setBudgetTypeEditStatus({ type: 'idle', message: '' });
      }}
      editStatus={budgetTypeEditStatus}
      onSelect={onSelect}
      onSave={onSave}
      onRequestDelete={(budgetType) => {
        setBudgetTypeEditStatus({ type: 'idle', message: '' });
        setBudgetTypeToDelete(budgetType);
      }}
      entityToDelete={budgetTypeToDelete}
      onCancelDelete={() => setBudgetTypeToDelete(null)}
      onConfirmDelete={onDelete}
      deleteTitleId="delete-budget-type-title"
      deleteTitle="Remove Budget Type?"
      deleteDescription={
        budgetTypeToDelete
          ? `Remove “${budgetTypeToDelete.name}” from your budget types? Budget types used by existing budgets cannot be removed.`
          : ''
      }
      nameLabel="Budget Type Name"
      nameInputId="budget-type-name"
      addFormId="account-add-budget-type-form"
      addInput={budgetTypeInput}
      onAddInputChange={(event) => {
        setBudgetTypeInput(event.target.value);
        setBudgetTypeEditStatus({ type: 'idle', message: '' });
      }}
      onAdd={onAdd}
      addPlaceholder="Budget type name"
      addAriaLabel="Budget type name"
      onBack={onBack}
      defaultItemId={defaultBudgetTypeId}
      onSelectDefault={onSelectDefault}
      defaultLabel="Default Budget Type"
    />
  );
}
