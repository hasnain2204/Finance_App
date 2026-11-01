import { Trash2, Utensils, WalletCards } from 'lucide-react';
import { formatCurrency, formatDate, fromPaisa } from '../../lib/finance';
import { BackHeader, ConfirmDialog } from '../../components/ui';

export function TransactionDetailScreen({
  selectedTransaction,
  categoryMap,
  paymentMap,
  preferences,
  showDeleteConfirm,
  onBack,
  onEditBudget,
  onEditTransaction,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete
}) {
  if (!selectedTransaction) return null;

  if (selectedTransaction.historyType === 'budget') {
    const date = new Date(`${selectedTransaction.date}T00:00:00`);
    const time = selectedTransaction.createdAt
      ? new Date(selectedTransaction.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
      : '—';
    const isBudgetAddition = selectedTransaction.entryType === 'addition';
    const budgetLabel = !selectedTransaction.categoryId || selectedTransaction.categoryId === 'overall'
      ? 'Overall budget'
      : `${categoryMap[selectedTransaction.categoryId]?.name || 'Category'} budget`;

    return (
      <main className="detail-shell">
        <BackHeader
          title="Budget Entry"
          onBack={onBack}
          backLabel="Back to budget history"
        />

        <section className="detail-content">
          <div className="detail-summary">
            <span className="detail-icon budget-change"><WalletCards size={26} strokeWidth={1.7} /></span>
            <h2>{budgetLabel}</h2>
            <strong className="budget-change-value">
              {!isBudgetAddition && selectedTransaction.amount === null
                ? 'Removed'
                : formatCurrency(fromPaisa(selectedTransaction.amount))}
            </strong>
            <p>
              {isBudgetAddition
                ? 'Added to your overall budget'
                : selectedTransaction.amount === null
                  ? 'Budget limit removed'
                  : selectedTransaction.previousAmount === null
                    ? 'Budget limit set'
                    : 'Budget limit updated'}
            </p>
          </div>

          <section className="detail-card">
            <div><span>Date</span><strong>{formatDate(date, preferences?.dateFormat)}</strong></div>
            <div><span>Time</span><strong>{time}</strong></div>
            {isBudgetAddition ? (
              <>
                <div>
                  <span>Balance before</span>
                  <strong>{formatCurrency(fromPaisa(selectedTransaction.previousAmount || 0))}</strong>
                </div>
                <div>
                  <span>Amount added</span>
                  <strong>{formatCurrency(fromPaisa(selectedTransaction.amount))}</strong>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span>Previous limit</span>
                  <strong>{selectedTransaction.previousAmount === null ? 'Not set' : formatCurrency(fromPaisa(selectedTransaction.previousAmount))}</strong>
                </div>
                <div>
                  <span>New limit</span>
                  <strong>{selectedTransaction.amount === null ? 'Not set' : formatCurrency(fromPaisa(selectedTransaction.amount))}</strong>
                </div>
              </>
            )}
            {selectedTransaction.description ? (
              <div><span>Description</span><strong>{selectedTransaction.description}</strong></div>
            ) : null}
          </section>

          <div className="detail-actions">
            {selectedTransaction.amount !== null ? (
              <button
                type="button"
                className="detail-edit-button"
                onClick={() => onEditBudget(selectedTransaction)}
              >
                Edit
              </button>
            ) : null}
            <button
              type="button"
              className="detail-delete-button"
              onClick={onRequestDelete}
            >
              <Trash2 size={17} /> Delete
            </button>
          </div>
        </section>

        <ConfirmDialog
          open={showDeleteConfirm}
          titleId="delete-budget-title"
          title="Delete Budget History?"
          description={isBudgetAddition
            ? 'This budget addition will be removed from your total balance.'
            : 'This change will be removed and the previous budget value restored.'}
          onCancel={onCancelDelete}
          onConfirm={onConfirmDelete}
        />
      </main>
    );
  }

  const categoryName = categoryMap[selectedTransaction.categoryId]?.name || 'Other';
  const methodName = paymentMap[selectedTransaction.paymentMethodId]?.name || 'Other';
  const date = new Date(`${selectedTransaction.date}T00:00:00`);

  return (
    <main className="detail-shell">
      <BackHeader
        title="Transaction Detail"
        onBack={onBack}
        backLabel="Back to transactions"
      />

      <section className="detail-content">
        <div className="detail-summary">
          <span className="detail-icon expense"><Utensils size={26} strokeWidth={1.7} /></span>
          <h2>{categoryName}</h2>
          <strong className="expense">- {formatCurrency(Number(selectedTransaction.amount || 0))}</strong>
          <p>Expense</p>
        </div>

        <section className="detail-card">
          <div><span>Date</span><strong>{formatDate(date, preferences?.dateFormat)}</strong></div>
          <div><span>Time</span><strong>{selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '02:30 PM'}</strong></div>
          <div><span>Payment Method</span><strong>{methodName}</strong></div>
          <div><span>Description</span><strong>{selectedTransaction.title || 'No description'}</strong></div>
        </section>

        <div className="detail-actions">
          <button type="button" className="detail-edit-button" onClick={onEditTransaction}>Edit</button>
          <button type="button" className="detail-delete-button" onClick={onRequestDelete}><Trash2 size={17} /> Delete</button>
        </div>
      </section>

      <ConfirmDialog
        open={showDeleteConfirm}
        titleId="delete-title"
        title="Delete Transaction?"
        description="This transaction will be permanently removed."
        onCancel={onCancelDelete}
        onConfirm={onConfirmDelete}
      />
    </main>
  );
}
