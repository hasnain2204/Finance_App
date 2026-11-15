import { BackHeader, StatusMessage, ThemedDatePicker, ThemedSelect } from '../../components/ui';

export function AddTransactionScreen({
  editingTransactionId,
  form,
  categories,
  paymentMethods,
  status,
  dateFormat = 'DD MMM YYYY',
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
          <div className="form-inline-row">
            <label htmlFor="transaction-amount" className="form-inline-label">
              Amount <span className="required-star" aria-hidden="true">*</span>
            </label>
            <div className="form-inline-control">
              <input
                id="transaction-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                value={form.amount}
                onChange={onChange}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-inline-row">
            <label htmlFor="transaction-category" className="form-inline-label">Category</label>
            <div className="form-inline-control">
              <ThemedSelect
                id="transaction-category"
                name="categoryId"
                label="Category"
                value={form.categoryId}
                onChange={onChange}
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
              />
            </div>
          </div>

          <div className="form-inline-row">
            <label htmlFor="transaction-method" className="form-inline-label">Payment Method</label>
            <div className="form-inline-control">
              <ThemedSelect
                id="transaction-method"
                name="paymentMethodId"
                label="Payment Method"
                value={form.paymentMethodId}
                onChange={onChange}
                options={paymentMethods.map((m) => ({ value: m.id, label: m.name }))}
              />
            </div>
          </div>

          <div className="form-inline-row">
            <label htmlFor="transaction-date" className="form-inline-label">Date</label>
            <div className="form-inline-control">
              <ThemedDatePicker
                id="transaction-date"
                name="date"
                label="Date"
                value={form.date}
                onChange={onChange}
                dateFormat={dateFormat}
              />
            </div>
          </div>

          <div className="form-inline-row">
            <label htmlFor="transaction-title" className="form-inline-label">Description</label>
            <div className="form-inline-control">
              <input id="transaction-title" name="title" value={form.title} onChange={onChange} placeholder="Description" />
            </div>
          </div>

          <button className="primary-action full transaction-save-button" type="submit">
            {editingTransactionId ? 'Save Changes' : 'Save Expense'}
          </button>
        </form>

        <StatusMessage type={status.type} message={status.message} />

        {/* <p className="transaction-device-note">Saved on this device.</p> */}
      </section>
    </main>
  );
}
