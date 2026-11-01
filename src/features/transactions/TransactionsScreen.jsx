import { Plus } from 'lucide-react';
import { Panel, PanelHeader, EmptyState } from '../../components/ui';
import { HistoryItem } from './HistoryItem';

export function TransactionsScreen({
  transactionHistory,
  categoryMap,
  paymentMap,
  dateFormat,
  onOpenAddExpense,
  onOpenTransaction
}) {
  return (
    <div className="stacked-blocks">
      <button type="button" className="primary-action full transaction-list-add-button" onClick={onOpenAddExpense}>
        <Plus size={16} /> Add Expense
      </button>
      <Panel>
        <PanelHeader>
          <div>
            <h2>Transaction history</h2>
          </div>
        </PanelHeader>

        <div className="transaction-list">
          {transactionHistory.length === 0 ? (
            <EmptyState>No transactions yet.</EmptyState>
          ) : (
            transactionHistory.map((entry) => (
              <HistoryItem
                key={`${entry.historyType}-${entry.id}`}
                entry={entry}
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
