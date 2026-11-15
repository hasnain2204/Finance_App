import { Plus } from 'lucide-react';
import { calculateExpenseTotal, formatCurrency, fromPaisa } from '../../lib/finance';
import { Panel, PanelHeader, EmptyState } from '../../components/ui';
import { HistoryItem } from '../transactions/HistoryItem';
import { WeeklyTrendChart } from './WeeklyTrendChart';

export function HomeScreen({
  preferences,
  budgets,
  totalBudgetPaisa,
  transactions,
  weeklySpending,
  transactionHistory,
  categoryMap,
  paymentMap,
  onOpenAddExpense,
  onOpenBudget,
  onOpenTransactions,
  onOpenTransaction
}) {
  const hasBudget = budgets.some((budget) => budget.categoryId === 'overall');
  const overallBudgetAmount = hasBudget ? fromPaisa(totalBudgetPaisa) : null;
  const availableBalance = overallBudgetAmount === null
    ? null
    : overallBudgetAmount - calculateExpenseTotal(transactions);

  return (
    <div className="home-dashboard">
      <section className="home-heading-meta">
        <h2>{`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, ${preferences?.name || 'User'}`}</h2>
        <p>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </section>

      <section className="hero-panel home-summary-card">
        <div className="home-balance">
          <span>Available balance</span>
          {availableBalance === null ? (
            <button type="button" className="home-budget-prompt" onClick={onOpenBudget}>
              Add to budget
            </button>
          ) : (
            <strong className={availableBalance < 0 ? 'expense' : ''}>
              {formatCurrency(availableBalance)}
            </strong>
          )}
        </div>

        <div className="home-summary-metrics">
          <div className="home-summary-metric home-budget-metric">
            <span>Budget</span>
            <strong>{overallBudgetAmount === null ? 'Not set' : formatCurrency(overallBudgetAmount)}</strong>
          </div>
          <div className="home-summary-metric home-expense-metric">
            <span>Total expenses</span>
            <strong>{formatCurrency(calculateExpenseTotal(transactions))}</strong>
          </div>
        </div>

        <button type="button" className="primary-action full hero-add-button" onClick={onOpenAddExpense}>
          <Plus size={16} /> Add Transaction
        </button>
      </section>

      <Panel className="home-chart-card">
        <PanelHeader>
          <h2>Weekly expenses &amp; remaining budget</h2>
        </PanelHeader>
        <WeeklyTrendChart weeklySpending={weeklySpending} dateFormat={preferences?.dateFormat} />
        <p className="chart-footer">Bars show each day’s expenses; lines show cumulative expenses and remaining budget (PKR)</p>
      </Panel>

      <Panel className="home-recent-card">
        <PanelHeader>
          <h2>Recent transactions</h2>
          <button type="button" className="link-button" onClick={onOpenTransactions}>View All</button>
        </PanelHeader>

        <div className="transaction-list compact">
          {transactionHistory.length === 0 ? (
            <EmptyState>No transactions yet.</EmptyState>
          ) : (
            transactionHistory.slice(0, 4).map((entry) => (
              <HistoryItem
                key={`${entry.historyType}-${entry.id}`}
                entry={entry}
                categoryMap={categoryMap}
                paymentMap={paymentMap}
                dateFormat={preferences?.dateFormat}
                onOpen={onOpenTransaction}
              />
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
