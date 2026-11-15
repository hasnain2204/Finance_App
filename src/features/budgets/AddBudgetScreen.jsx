import { useMemo } from 'react';
import { BackHeader, StatusMessage, ThemedDatePicker, ThemedSelect } from '../../components/ui';
import { budgetCategories } from '../../hooks/useFinanceApp';

export function AddBudgetScreen({
  budgetFormRef,
  editingBudgetHistoryId,
  form,
  budgetTypes,
  status,
  dateFormat = 'DD MMM YYYY',
  onBack,
  onChange,
  onSave
}) {
  const options = useMemo(() => {
    if (Array.isArray(budgetTypes) && budgetTypes.length > 0) {
      return budgetTypes.map((type) => (typeof type === 'object' && type !== null ? type.name : String(type)));
    }
    return budgetCategories;
  }, [budgetTypes]);

  return (
    <main className="add-transaction-shell add-budget-shell">
      <BackHeader
        title={editingBudgetHistoryId ? 'Edit Budget' : 'Add Budget'}
        onBack={onBack}
        backLabel="Back to budgets"
        iconSize={20}
      />

      <section className="add-transaction-content">
        <form ref={budgetFormRef} className="budget-form transaction-form" onSubmit={onSave}>
          <div className="form-inline-row">
            <label htmlFor="budget-amount" className="form-inline-label">
              Amount <span className="required-star" aria-hidden="true">*</span>
            </label>
            <div className="form-inline-control">
              <input
                id="budget-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="0.00"
                value={form.amount}
                onChange={onChange}
                required
              />
            </div>
          </div>

          <div className="form-inline-row">
            <label htmlFor="budget-category" className="form-inline-label">Category</label>
            <div className="form-inline-control">
              <ThemedSelect
                id="budget-category"
                name="budgetCategory"
                label="Budget Category"
                value={form.budgetCategory}
                onChange={onChange}
                required
                options={options}
              />
            </div>
          </div>

          <div className="form-inline-row">
            <label htmlFor="budget-date" className="form-inline-label">Date</label>
            <div className="form-inline-control">
              <ThemedDatePicker
                id="budget-date"
                name="date"
                label="Date"
                value={form.date}
                onChange={onChange}
                dateFormat={dateFormat}
                required
              />
            </div>
          </div>

          <div className="form-inline-row">
            <label htmlFor="budget-description" className="form-inline-label">Description</label>
            <div className="form-inline-control">
              <input
                id="budget-description"
                name="description"
                value={form.description}
                onChange={onChange}
                placeholder="Description"
              />
            </div>
          </div>

          <button className="primary-action full transaction-save-button" type="submit">
            {editingBudgetHistoryId ? 'Save Changes' : 'Save Budget'}
          </button>

          <StatusMessage type={status.type} message={status.message} />
        </form>
      </section>
    </main>
  );
}
