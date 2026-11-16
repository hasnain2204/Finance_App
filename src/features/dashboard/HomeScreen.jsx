import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Zap } from 'lucide-react';
import {
  calculateFinanceDashboard,
  calculateSpendingVelocity,
  formatCurrency,
  getSmartGreeting
} from '../../lib/finance';
import { Panel, PanelHeader, EmptyState } from '../../components/ui';
import { HistoryItem } from '../transactions/HistoryItem';
import { WeeklyTrendChart } from './WeeklyTrendChart';

export function HomeScreen({
  preferences,
  budgets,
  budgetHistory = [],
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
  const [isCompact, setIsCompact] = useState(false);
  const sentinelRef = useRef(null);

  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          if (sentinelRef.current) {
            const rect = sentinelRef.current.getBoundingClientRect();
            // Fluid progressive transition starts as soon as greeting is halfway scrolled
            setIsCompact(rect.top <= 48);
          } else {
            setIsCompact(window.scrollY > 40);
          }
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const { displayedBudget, remainingBudget: availableBalance, monthlyExpense } = useMemo(() => {
    return calculateFinanceDashboard({
      budgetHistory,
      budgets,
      transactions,
      currentDate: new Date()
    });
  }, [budgetHistory, budgets, transactions]);

  const velocity = useMemo(() => {
    return calculateSpendingVelocity({
      transactions,
      monthlyExpense,
      overallBudget: displayedBudget
    });
  }, [transactions, monthlyExpense, displayedBudget]);

  return (
    <div className="home-dashboard">
      <section className="home-heading-meta">
        <h2>{`${getSmartGreeting()}, ${preferences?.name || 'User'}`}</h2>
        <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </section>

      <div ref={sentinelRef} className="hero-scroll-sentinel" aria-hidden="true" />

      <section
        className={`hero-panel home-summary-card ${isCompact ? 'is-compact-sticky' : ''}`}
        aria-label="Financial summary overview"
      >
        <div className="compact-sticky-stats" aria-label="Key statistics summary">
          <div className="compact-stat-item">
            <span className="compact-stat-label">Available</span>
            {availableBalance === null ? (
              <strong className="compact-stat-value">Not set</strong>
            ) : (
              <strong className={`compact-stat-value ${availableBalance < 0 ? 'expense' : ''}`}>
                {formatCurrency(availableBalance)}
              </strong>
            )}
          </div>
          <div className="compact-stat-divider" aria-hidden="true" />
          <div className="compact-stat-item">
            <span className="compact-stat-label">Budget</span>
            <strong className="compact-stat-value">
              {displayedBudget === null ? 'Not set' : formatCurrency(displayedBudget)}
            </strong>
          </div>
          <div className="compact-stat-divider" aria-hidden="true" />
          <div className="compact-stat-item">
            <span className="compact-stat-label">Expenses</span>
            <strong className="compact-stat-value">
              {formatCurrency(monthlyExpense)}
            </strong>
          </div>
        </div>

        <div className="expanded-hero-content">
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
              <strong>{displayedBudget === null ? 'Not set' : formatCurrency(displayedBudget)}</strong>
            </div>
            <div className="home-summary-metric home-expense-metric">
              <span>Total expenses</span>
              <strong>{formatCurrency(monthlyExpense)}</strong>
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
        </div>
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
