import { NamedEntityManager } from '../../components/ui';

export function PaymentMethodsScreen({
  paymentMethods,
  selectedPaymentMethodId,
  paymentMethodNameDraft,
  setPaymentMethodNameDraft,
  paymentMethodEditStatus,
  setPaymentMethodEditStatus,
  methodInput,
  setMethodInput,
  paymentMethodToDelete,
  setPaymentMethodToDelete,
  onSelect,
  onSave,
  onAdd,
  onDelete,
  onBack,
  defaultPaymentMethodId,
  onSelectDefault,
  onReorder
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
      deleteTitle="Delete Payment Method?"
      deleteDescription={
        paymentMethodToDelete
          ? `Delete “${paymentMethodToDelete.name}”? Any transactions using this payment method will be changed to General.`
          : ''
      }
      nameLabel="Payment Method Name"
      nameInputId="payment-method-name"
      addFormId="account-add-payment-method-form"
      addInput={methodInput}
      onAddInputChange={(event) => {
        setMethodInput(event.target.value);
        setPaymentMethodEditStatus({ type: 'idle', message: '' });
      }}
      onAdd={onAdd}
      addPlaceholder="Payment method name"
      addAriaLabel="Payment method name"
      onBack={onBack}
      defaultItemId={defaultPaymentMethodId}
      onSelectDefault={onSelectDefault}
      defaultLabel="Default Payment Method"
      onReorder={onReorder}
    />
  );
}
