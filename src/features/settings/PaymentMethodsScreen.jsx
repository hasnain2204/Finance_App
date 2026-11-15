import { NamedEntityManager } from '../../components/ui';

export function PaymentMethodsScreen({
  paymentMethods,
  selectedPaymentMethodId,
  paymentMethodNameDraft,
  setPaymentMethodNameDraft,
  paymentMethodEditStatus,
  setPaymentMethodEditStatus,
  showAddPaymentMethodForm,
  setShowAddPaymentMethodForm,
  methodInput,
  setMethodInput,
  paymentMethodToDelete,
  setPaymentMethodToDelete,
  onSelect,
  onSave,
  onAdd,
  onDelete,
  onBack
}) {
  return (
    <NamedEntityManager
      title="Payment Methods"
      listAriaLabel="Payment methods"
      items={paymentMethods}
      selectedId={selectedPaymentMethodId}
      nameDraft={paymentMethodNameDraft}
      onNameDraftChange={(event) => {
        setPaymentMethodNameDraft(event.target.value);
        setPaymentMethodEditStatus({ type: 'idle', message: '' });
      }}
      editStatus={paymentMethodEditStatus}
      onSelect={onSelect}
      onSave={onSave}
      onRequestDelete={(method) => {
        setPaymentMethodEditStatus({ type: 'idle', message: '' });
        setPaymentMethodToDelete(method);
      }}
      entityToDelete={paymentMethodToDelete}
      onCancelDelete={() => setPaymentMethodToDelete(null)}
      onConfirmDelete={onDelete}
      deleteTitleId="delete-payment-method-title"
      deleteTitle="Remove Payment Method?"
      deleteDescription={
        paymentMethodToDelete
          ? `Remove “${paymentMethodToDelete.name}” from your payment methods? Methods used by existing transactions cannot be removed.`
          : ''
      }
      nameLabel="Payment Method Name"
      nameInputId="payment-method-name"
      showAddForm={showAddPaymentMethodForm}
      onToggleAddForm={() => {
        setShowAddPaymentMethodForm((current) => !current);
        setMethodInput('');
        setPaymentMethodEditStatus({ type: 'idle', message: '' });
      }}
      addFormId="account-add-payment-method-form"
      addInput={methodInput}
      onAddInputChange={(event) => {
        setMethodInput(event.target.value);
        setPaymentMethodEditStatus({ type: 'idle', message: '' });
      }}
      onAdd={onAdd}
      addButtonLabel="Add Payment Method"
      addPlaceholder="Payment method name"
      addAriaLabel="Payment method name"
      onBack={onBack}
    />
  );
}
