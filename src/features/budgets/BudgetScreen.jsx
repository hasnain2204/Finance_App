import { useEffect, useMemo, useState } from 'react';
import { WalletCards } from 'lucide-react';
import { Panel, PanelHeader, EmptyState } from '../../components/ui';
import { HistoryItem } from '../transactions/HistoryItem';
import { groupTransactionsByDateBuckets } from '../transactions/TransactionsScreen';

export function BudgetScreen({
  budgetHistory = [],
  categoryMap = {},
  paymentMap = {},
  dateFormat = 'DD MMM YYYY',
  onOpenAddBudget,
  onOpenTransaction
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // After 2s, expand horizontally from left to right
    const expandTimer = setTimeout(() => {
      setIsExpanded(true);
    }, 2000);

    // Keep in full form for 10s (2s wait + 10s full form = 12s total), then automatically return to original form
    const collapseTimer = setTimeout(() => {
      setIsExpanded(false);
    }, 12000);

    return () => {
      clearTimeout(expandTimer);
      clearTimeout(collapseTimer);
    };
  }, []);

  const dateGroups = useMemo(
    () => groupTransactionsByDateBuckets(budgetHistory),
    [budgetHistory]
  );

  return (
    <div className="stacked-blocks budget-view-shell">
      <Panel>
        <PanelHeader>
          <div>
            <h2>Budget history</h2>
          </div>
        </PanelHeader>

        {dateGroups.length === 0 ? (
          <div className="transaction-list">
            <EmptyState>No budget history yet.</EmptyState>
          </div>
        ) : (
          <div className="transaction-groups">
            {dateGroups.map((group) => (
              <section key={group.id} className="transaction-date-group" aria-label={group.title}>
                <div className="transaction-date-group-header">
                  <h3 className="transaction-date-group-title">{group.title}</h3>
                  <span className="transaction-date-group-badge">
                    {group.items.length}
                  </span>
                </div>
                <div className="transaction-list">
                  {group.items.map((entry) => (
                    <HistoryItem
                      key={`budget-${entry.id}`}
                      entry={{ ...entry, historyType: 'budget', returnTab: 'budget' }}
                      categoryMap={categoryMap}
                      paymentMap={paymentMap}
                      dateFormat={dateFormat}
                      onOpen={onOpenTransaction}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </Panel>

      <div className="floating-action-group" aria-label="Quick actions">
        <button
          type="button"
          className={`fab-button ${isExpanded ? 'is-expanded' : ''}`}
          onClick={onOpenAddBudget}
          aria-label="Add budget"
          title="Add Budget"
        >
          <WalletCards size={22} strokeWidth={2.4} className="fab-icon" />
          <span className="fab-label">Add Budget</span>
        </button>
      </div>
    </div>
  );
}
