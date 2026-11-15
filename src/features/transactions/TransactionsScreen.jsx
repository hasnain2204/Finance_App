import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Panel, PanelHeader, EmptyState } from '../../components/ui';
import { HistoryItem } from './HistoryItem';
import { getLocalDateString } from '../../lib/finance';

export function groupTransactionsByDateBuckets(items, now = new Date()) {
  const buckets = {
    last24Hours: [],
    last7Days: [],
    lastMonth: [],
    older: []
  };

  const todayStr = getLocalDateString(now);
  const nowMs = now.getTime();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
  const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

  for (const entry of items) {
    let entryDateMs = null;
    if (entry.createdAt) {
      const parsed = new Date(entry.createdAt).getTime();
      if (!isNaN(parsed)) entryDateMs = parsed;
    }
    if (!entryDateMs && entry.date) {
      const parsed = new Date(`${entry.date}T12:00:00`).getTime();
      if (!isNaN(parsed)) entryDateMs = parsed;
    }

    if (!entryDateMs) {
      buckets.older.push(entry);
      continue;
    }

    const diffMs = nowMs - entryDateMs;

    if (diffMs <= ONE_DAY_MS || (entry.date && entry.date === todayStr)) {
      buckets.last24Hours.push(entry);
    } else if (diffMs <= SEVEN_DAYS_MS) {
      buckets.last7Days.push(entry);
    } else if (diffMs <= THIRTY_DAYS_MS) {
      buckets.lastMonth.push(entry);
    } else {
      buckets.older.push(entry);
    }
  }

  return [
    { id: 'last-24-hours', title: 'Last 24 Hours', items: buckets.last24Hours },
    { id: 'last-7-days', title: 'Last 7 Days', items: buckets.last7Days },
    { id: 'last-month', title: 'Last Month', items: buckets.lastMonth },
    { id: 'older', title: 'Older', items: buckets.older }
  ].filter((group) => group.items.length > 0);
}

export function TransactionsScreen({
  transactionHistory,
  categoryMap,
  paymentMap,
  dateFormat,
  onOpenAddExpense,
  onOpenTransaction
}) {
  const dateGroups = useMemo(
    () => groupTransactionsByDateBuckets(transactionHistory),
    [transactionHistory]
  );

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

        {dateGroups.length === 0 ? (
          <div className="transaction-list">
            <EmptyState>No transactions yet.</EmptyState>
          </div>
        ) : (
          <div className="transaction-groups">
            {dateGroups.map((group) => (
              <section key={group.id} className="transaction-date-group" aria-label={group.title}>
                <div className="transaction-date-group-header">
                  <h3 className="transaction-date-group-title">{group.title}</h3>
                  <span className="transaction-date-group-badge">
                    {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>
                <div className="transaction-list">
                  {group.items.map((entry) => (
                    <HistoryItem
                      key={`${entry.historyType}-${entry.id}`}
                      entry={entry}
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
    </div>
  );
}
