import { BackHeader, StatusMessage } from '../../components/ui';

export function AddTransactionScreen({
  editingTransactionId,
  form,
  categories,
  paymentMethods,
  status,
  onBack,
  onChange,
  onSubmit
}) {
  return (
    <main className="add-transaction-shell">
      <BackHeader
        title={editingTransactionId ? 'Edit Expense' : 'Add Expense'}
        onBack={onBack}
        backLabel={editingTransactionId ? 'Back to transactions' : 'Back to home'}
        iconSize={20}
      />

      <section className="add-transaction-content">
        <form className="transaction-form" onSubmit={onSubmit}>
          <label htmlFor="transaction-amount">Amount (PKR)</label>
          <input id="transaction-amount" name="amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={onChange} placeholder="Rs0" />

          <label htmlFor="transaction-category">Category</label>
          <select id="transaction-category" name="categoryId" value={form.categoryId} onChange={onChange}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <label htmlFor="transaction-title">Description</label>
          <input id="transaction-title" name="title" value={form.title} onChange={onChange} placeholder="Description" />

          <label htmlFor="transaction-method">Payment Method</label>
          <select id="transaction-method" name="paymentMethodId" value={form.paymentMethodId} onChange={onChange}>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>{method.name}</option>
            ))}
          </select>

          <label htmlFor="transaction-date">Date</label>
          <input id="transaction-date" name="date" type="date" value={form.date} onChange={onChange} />

          <button className="primary-action full transaction-save-button" type="submit">
            {editingTransactionId ? 'Save Changes' : 'Save Expense'}
          </button>
        </form>

        <StatusMessage type={status.type} message={status.message} />

        <p className="transaction-device-note">Saved on this device.</p>
      </section>
    </main>
  );
}
