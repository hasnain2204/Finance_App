import { ArrowUpRight, WalletCards } from 'lucide-react';
import { formatCurrency, formatDate, fromPaisa } from '../../lib/finance';

export function HistoryItem({
  entry,
  categoryMap,
  paymentMap,
  dateFormat,
  onOpen
}) {
  const isBudgetChange = entry.historyType === 'budget';
  const categoryId = entry.categoryId || 'overall';
  const isBudgetAddition = entry.entryType === 'addition';
  const budgetLabel = categoryId === 'overall'
    ? 'Overall budget'
    : `${categoryMap[categoryId]?.name || 'Category'} budget`;
  const budgetCategory = isBudgetAddition ? entry.budgetCategory || 'Other' : budgetLabel;
  const title = isBudgetChange
    ? isBudgetAddition
      ? budgetCategory
      : entry.amount === null
        ? `${budgetLabel} removed`
        : entry.previousAmount === null
          ? `${budgetLabel} set`
          : `${budgetLabel} updated`
    : entry.title;
  const descriptionPreview = isBudgetChange && entry.description
    ? entry.description.trim().replace(/\s+/g, ' ').split(' ').slice(0, 12).join(' ')
    : '';
  const subtitle = isBudgetChange
    ? descriptionPreview || 'Budget updated'
    : (() => {
        const paymentMethodLabel = paymentMap[entry.paymentMethodId]?.name || 'Cash';
        return entry.title ? `${paymentMethodLabel} · ${entry.title}` : paymentMethodLabel;
      })();
  const amount = isBudgetChange
    ? entry.amount === null
      ? 'Removed'
      : formatCurrency(fromPaisa(entry.amount))
    : formatCurrency(Number(entry.amount || 0));

  return (
    <button
      type="button"
      className="transaction-item transaction-row"
      onClick={() => onOpen(entry)}
      aria-label={`View ${title} transaction`}
    >
      <div className={`transaction-icon ${isBudgetChange ? 'budget-change' : 'expense'}`}>
        {isBudgetChange ? <WalletCards size={16} /> : <ArrowUpRight size={16} />}
      </div>
      <div className="transaction-copy">
        <strong>{isBudgetChange ? title : categoryMap[entry.categoryId]?.name || 'Other'}</strong>
        <span>{subtitle}</span>
      </div>
      <div className="transaction-meta align-right">
        <strong className={isBudgetChange ? 'budget-change-value' : 'expense'}>{amount}</strong>
        <span>{formatDate(entry.date, dateFormat)}</span>
      </div>
    </button>
  );
}
