import { useMemo } from 'react';
import { Plus, Zap } from 'lucide-react';
import {
  calculateExpenseTotal,
  calculateSpendingVelocity,
  formatCurrency,
  fromPaisa,
  getLocalDateString
} from '../../lib/finance';
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

  const currentMonthStr = useMemo(() => getLocalDateString().slice(0, 7), []);
  const monthlyExpense = useMemo(
    () => calculateExpenseTotal(transactions, currentMonthStr),
    [transactions, currentMonthStr]
  );

  const velocity = useMemo(() => {
    return calculateSpendingVelocity({
      transactions,
      monthlyExpense,
      overallBudget: overallBudgetAmount
    });
  }, [transactions, monthlyExpense, overallBudgetAmount]);

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

        <div className="home-velocity-card" aria-label="Spending pace and projection">
          <div className="home-velocity-row">
            <span className="home-velocity-label">
              <Zap size={13} className="home-velocity-icon" /> Daily Pace
            </span>
            <span className={`status-pill ${velocity.status}`}>{velocity.label}</span>
          </div>
          <div className="home-velocity-metrics">
            <strong>{formatCurrency(velocity.dailyAverage)} <small>/ day</small></strong>
            <span>{velocity.message}</span>
          </div>
          {velocity.safeDailyLimit !== null && velocity.safeDailyLimit > 0 ? (
            <div className="home-velocity-safe-limit">
              Safe Daily Limit: <strong>{formatCurrency(velocity.safeDailyLimit)}</strong> / day
            </div>
          ) : null}
        </div>

        <button type="button" className="primary-action full hero-add-button" onClick={onOpenAddExpense}>
          <Plus size={16} /> Add Transaction
        </button>
      </section>

      <Panel className="home-chart-card">
        <PanelHeader>
          <h2>Weekly Analysis</h2>
        </PanelHeader>
        <WeeklyTrendChart weeklySpending={weeklySpending} dateFormat={preferences?.dateFormat} />
        {/* <p className="chart-footer">Bars show each day’s expenses; lines show cumulative expenses and remaining budget (PKR)</p> */}
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
