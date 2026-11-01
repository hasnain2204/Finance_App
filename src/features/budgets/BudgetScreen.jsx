import { Panel, PanelHeader, EmptyState, StatusMessage } from '../../components/ui';
import { HistoryItem } from '../transactions/HistoryItem';
import { budgetCategories } from '../../hooks/useFinanceApp';

export function BudgetScreen({
  budgetFormRef,
  budgetForm,
  editingBudgetHistoryId,
  status,
  budgetHistory,
  categoryMap,
  paymentMap,
  dateFormat,
  onFormChange,
  onSave,
  onOpenTransaction
}) {
  const sortedBudgetHistory = [...budgetHistory]
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  return (
    <div className="stacked-blocks">
      <Panel>
        <form ref={budgetFormRef} className="budget-form" onSubmit={onSave}>
          <div className="budget-entry-box">
            <div className="budget-field-row">
              <label htmlFor="budget-category">Category</label>
              <select
                id="budget-category"
                name="budgetCategory"
                value={budgetForm.budgetCategory}
                onChange={onFormChange}
                required
              >
                {budgetCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="budget-field-row">
              <label htmlFor="budget-date">Date</label>
              <input
                id="budget-date"
                name="date"
                type="date"
                value={budgetForm.date}
                onChange={onFormChange}
                required
              />
            </div>

            <div className="budget-field-row">
              <label htmlFor="budget-amount">Amount (Rs)</label>
              <input
                id="budget-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="Rs 2000"
                value={budgetForm.amount}
                onChange={onFormChange}
                required
              />
            </div>

            <div className="budget-field-row">
              <label htmlFor="budget-description">Description</label>
              <textarea
                id="budget-description"
                className="budget-description-field"
                name="description"
                value={budgetForm.description}
                onChange={onFormChange}
                placeholder="(optional)"
                rows="1"
              />
            </div>

            <button className="primary-action full" type="submit">
              {editingBudgetHistoryId ? 'Save Changes' : 'Save Budget'}
            </button>
          </div>

          <StatusMessage type={status.type} message={status.message} />
        </form>
      </Panel>

      <Panel className="budget-history-panel">
        <PanelHeader>
          <h2>Budget history</h2>
        </PanelHeader>
        <div className="transaction-list">
          {sortedBudgetHistory.length === 0 ? (
            <EmptyState>No budget history yet.</EmptyState>
          ) : (
            sortedBudgetHistory.map((entry) => (
              <HistoryItem
                key={`budget-${entry.id}`}
                entry={{ ...entry, historyType: 'budget' }}
                categoryMap={categoryMap}
                paymentMap={paymentMap}
                dateFormat={dateFormat}
                onOpen={onOpenTransaction}
              />
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
