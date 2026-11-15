import { useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
  Zap
} from 'lucide-react';
import {
  calculateCategorySurge,
  calculateExpenseTotal,
  calculateFinancialHealthScore,
  calculateSpendingVelocity,
  calculateWeekdayWeekendSplit,
  filterTransactionsByRange,
  formatCurrency,
  formatDate,
  fromPaisa,
  getLocalDateString
} from '../../lib/finance';
import { EmptyState, Panel, PanelHeader } from '../../components/ui';

export function AnalyticsScreen({
  transactions = [],
  totalBudgetPaisa = 0,
  monthlyExpense = 0,
  monthlyExpenseTrend = [],
  monthlyBudgetTrend = [],
  categoryTotals = [],
  paymentMethodTotals = [],
  categoryMap = {},
  paymentMap = {},
  dateFormat = 'DD MMM YYYY',
  onOpenTransaction,
  budgetAnalysisRef
}) {
  const [timeRange, setTimeRange] = useState('this-month');
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);

  const overallBudget = fromPaisa(totalBudgetPaisa);
  const currentDate = useMemo(() => new Date(), []);
  const currentMonth = useMemo(() => getLocalDateString(currentDate).slice(0, 7), [currentDate]);
  const previousMonthDate = useMemo(() => new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1), [currentDate]);
  const previousMonth = useMemo(() => getLocalDateString(previousMonthDate).slice(0, 7), [previousMonthDate]);

  // 1. Time Range Filtering
  const filteredTransactions = useMemo(() => {
    return filterTransactionsByRange(transactions, timeRange, currentDate);
  }, [transactions, timeRange, currentDate]);

  const totalSpentInRange = useMemo(() => {
    return filteredTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  }, [filteredTransactions]);

  // Dynamic Category Totals for active time range
  const dynamicCategoryTotals = useMemo(() => {
    const totals = {};
    for (const tx of filteredTransactions) {
      if (tx.type !== 'expense') continue;
      const id = tx.categoryId || 'cat-other';
      totals[id] = (totals[id] || 0) + Number(tx.amount || 0);
    }
    return Object.entries(totals)
      .map(([id, amount]) => ({
        id,
        label: categoryMap[id]?.name || 'Other',
        amount
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, categoryMap]);

  // Dynamic Payment Method Totals for active time range
  const dynamicPaymentTotals = useMemo(() => {
    const totals = {};
    for (const tx of filteredTransactions) {
      if (tx.type !== 'expense') continue;
      const id = tx.paymentMethodId || 'pm-other';
      totals[id] = (totals[id] || 0) + Number(tx.amount || 0);
    }
    return Object.entries(totals)
      .map(([id, amount]) => ({
        id,
        label: paymentMap[id]?.name || 'Other',
        amount
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [filteredTransactions, paymentMap]);

  // 2. Spending Velocity & Month-End Run-Rate (Current Month)
  const velocity = useMemo(() => {
    return calculateSpendingVelocity({
      transactions,
      monthlyExpense,
      overallBudget,
      referenceDate: currentDate
    });
  }, [transactions, monthlyExpense, overallBudget, currentDate]);

  // 3. Financial Health Score (0-100)
  const healthScore = useMemo(() => {
    return calculateFinancialHealthScore({
      totalSpent: monthlyExpense,
      overallBudget,
      daysElapsed: velocity.daysElapsed,
      daysInMonth: velocity.daysInMonth
    });
  }, [monthlyExpense, overallBudget, velocity]);

  // 4. Weekday vs Weekend Spending Split
  const weekdayWeekend = useMemo(() => {
    return calculateWeekdayWeekendSplit(filteredTransactions);
  }, [filteredTransactions]);

  // 5. Category Surge / Drift Detector
  const categorySurge = useMemo(() => {
    return calculateCategorySurge(transactions, currentMonth, previousMonth, categoryMap);
  }, [transactions, currentMonth, previousMonth, categoryMap]);

  // Selected Category Transactions for Drill-Down
  const selectedCategoryTransactions = useMemo(() => {
    if (!selectedCategoryId) return [];
    return filteredTransactions.filter((tx) => tx.categoryId === selectedCategoryId);
  }, [filteredTransactions, selectedCategoryId]);

  const selectedCategoryData = useMemo(() => {
    if (!selectedCategoryId) return null;
    const cat = dynamicCategoryTotals.find((c) => c.id === selectedCategoryId);
    return cat || { id: selectedCategoryId, label: categoryMap[selectedCategoryId]?.name || 'Category', amount: 0 };
  }, [dynamicCategoryTotals, selectedCategoryId, categoryMap]);

  // Donut Gradient Configuration
  const categoryColors = ['#17634f', '#d02222', '#30a316', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#63726a'];
  let categoryGradientStart = 0;
  const categoryGradient = dynamicCategoryTotals.length
    ? dynamicCategoryTotals.map((item, index) => {
        const start = categoryGradientStart;
        categoryGradientStart += totalSpentInRange ? (item.amount / totalSpentInRange) * 100 : 0;
        return `${categoryColors[index % categoryColors.length]} ${start}% ${categoryGradientStart}%`;
      }).join(', ')
    : '#e8efeb 0% 100%';

  const timeRangeOptions = [
    { key: 'this-month', label: 'This Month' },
    { key: 'last-month', label: 'Last Month' },
    { key: '3-months', label: 'Last 3M' },
    { key: '6-months', label: 'Last 6M' },
    { key: 'all-time', label: 'All Time' }
  ];

  const chartWidth = 360;
  const chartHeight = 190;
  const left = 22;
  const right = 338;
  const top = 16;
  const bottom = 148;
  const plotHeight = bottom - top;
  const hasMonthlyBudget = monthlyBudgetTrend.some((month) => month.budget !== null);
  const maxValue = Math.max(
    1,
    ...monthlyBudgetTrend.map((month) => Math.max(month.amount, month.budget || 0))
  );
  const xForIndex = (index) => left + ((right - left) * index) / Math.max(1, monthlyBudgetTrend.length - 1);
  const yForValue = (value) => bottom - (value / maxValue) * plotHeight;
  const budgetPoints = monthlyBudgetTrend
    .filter((month) => month.budget !== null)
    .map((month) => {
      const index = monthlyBudgetTrend.indexOf(month);
      return `${xForIndex(index)},${yForValue(month.budget)}`;
    });
  const budgetLinePath = budgetPoints.length
    ? budgetPoints.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point}`).join(' ')
    : '';

  const monthLabel = (date) => date.toLocaleDateString('en-PK', { month: 'short' });
  const highestTrendAmount = Math.max(1, ...monthlyExpenseTrend.map((m) => m.amount));

  return (
    <div className="stacked-blocks analytics-v2">
      {/* 1. Time Range Selector Bar */}
      <section className="analytics-range-selector" aria-label="Select time range">
        {timeRangeOptions.map((opt) => (
          <button
            key={opt.key}
            type="button"
            className={`range-pill ${timeRange === opt.key ? 'active' : ''}`}
            onClick={() => {
              setTimeRange(opt.key);
              setSelectedCategoryId(null);
            }}
          >
            {opt.label}
          </button>
        ))}
      </section>

      {/* 2. Executive Health & Spending Velocity Card */}
      <Panel className="analytics-overview">
        <PanelHeader>
          <div>
            <p className="eyebrow">Financial Velocity</p>
            <h2>Pace &amp; Projections</h2>
          </div>
          <div className="analytics-health-badge" title="Budget Adherence Rating">
            <span className="health-score">{healthScore.score !== null ? healthScore.score : '—'}</span>
            <span className="health-label">{healthScore.rating}</span>
          </div>
        </PanelHeader>

        <div className="velocity-summary-grid">
          <div className="velocity-metric-item">
            <span className="velocity-label">
              <Zap size={14} className="velocity-icon" /> Daily Run-Rate
            </span>
            <strong className="velocity-value">{formatCurrency(velocity.dailyAverage)}</strong>
            <small className="velocity-sub">Pace per day ({velocity.daysElapsed} days in)</small>
          </div>

          <div className="velocity-metric-item">
            <span className="velocity-label">
              <Clock size={14} className="velocity-icon" /> Est. Month-End
            </span>
            <strong className={`velocity-value ${velocity.status === 'danger' ? 'danger' : ''}`}>
              {formatCurrency(velocity.projectedTotal)}
            </strong>
            <small className="velocity-sub">{velocity.message}</small>
          </div>

          {velocity.safeDailyLimit !== null && velocity.safeDailyLimit > 0 ? (
            <div className="velocity-metric-item">
              <span className="velocity-label">
                <CheckCircle2 size={14} className="velocity-icon" /> Safe Daily Limit
              </span>
              <strong className="velocity-value">{formatCurrency(velocity.safeDailyLimit)}</strong>
              <small className="velocity-sub">Remaining daily allowance</small>
            </div>
          ) : null}
        </div>

        {overallBudget > 0 ? (
          <div className="velocity-timeline-bar" aria-label="Month progress and budget burn">
            <div className="timeline-labels">
              <span>Day {velocity.daysElapsed} of {velocity.daysInMonth}</span>
              <span className={`status-pill ${velocity.status}`}>{velocity.label}</span>
            </div>
            <div className="timeline-track">
              <div
                className={`timeline-fill ${velocity.status}`}
                style={{ width: `${Math.min(100, Math.round((velocity.dailyAverage * velocity.daysElapsed / overallBudget) * 100))}%` }}
              />
            </div>
          </div>
        ) : null}
      </Panel>

      {/* 3. Category Surge Alert (Anomaly Detection) */}
      {categorySurge ? (
        <article className="surge-alert-card" aria-label="Category surge alert">
          <div className="surge-icon-wrap">
            <Sparkles size={18} />
          </div>
          <div className="surge-copy">
            <strong>{categorySurge.isNew ? `New Spending in ${categorySurge.categoryName}` : `Spending Surge in ${categorySurge.categoryName}`}</strong>
            <p>
              {categorySurge.isNew
                ? `First-time activity with ${formatCurrency(categorySurge.currentAmount)} logged this month.`
                : `Increased by ${Math.round(categorySurge.percentChange)}% (+${formatCurrency(categorySurge.diffAmount)}) compared to last month.`}
            </p>
          </div>
        </article>
      ) : null}

      {/* 4. Category Breakdown & Interactive Drill-Down */}
      <Panel className="analytics-section">
        <PanelHeader>
          <div>
            <p className="eyebrow">Category Analytics</p>
            <h2>Spending by Category</h2>
          </div>
          <span className="range-indicator">{timeRangeOptions.find((o) => o.key === timeRange)?.label}</span>
        </PanelHeader>

        <div className="analytics-donut-layout">
          {dynamicCategoryTotals.length === 0 ? (
            <EmptyState>No expense data recorded in this time range.</EmptyState>
          ) : (
            <>
              <div
                className="analytics-donut"
                role="img"
                aria-label={`Category spending breakdown totaling ${formatCurrency(totalSpentInRange)}`}
                style={{ background: `conic-gradient(${categoryGradient})` }}
              >
                <span>
                  <small>Total spent</small>
                  <strong>{formatCurrency(totalSpentInRange)}</strong>
                </span>
              </div>
              <div className="analytics-donut-legend">
                {dynamicCategoryTotals.map((item, index) => {
                  const share = totalSpentInRange > 0 ? (item.amount / totalSpentInRange) * 100 : 0;
                  const isSelected = selectedCategoryId === item.id;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`analytics-donut-item clickable ${isSelected ? 'active' : ''}`}
                      onClick={() => setSelectedCategoryId(isSelected ? null : item.id)}
                      title={`Click to inspect ${item.label}`}
                    >
                      <i style={{ background: categoryColors[index % categoryColors.length] }} />
                      <span>{item.label}</span>
                      <strong>{share.toFixed(1)}%</strong>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Category Drill-Down Inspection View */}
        {selectedCategoryData ? (
          <section className="category-drilldown-panel" aria-label={`Filtered ledger for ${selectedCategoryData.label}`}>
            <div className="drilldown-header">
              <div>
                <p className="eyebrow">Category Drill-Down</p>
                <h3>{selectedCategoryData.label}</h3>
              </div>
              <button
                type="button"
                className="drilldown-close"
                onClick={() => setSelectedCategoryId(null)}
                aria-label="Clear filter"
              >
                <X size={16} /> Clear filter
              </button>
            </div>
            <div className="drilldown-metrics">
              <div>
                <span>Total Spent</span>
                <strong>{formatCurrency(selectedCategoryData.amount)}</strong>
              </div>
              <div>
                <span>Transactions</span>
                <strong>{selectedCategoryTransactions.length}</strong>
              </div>
              <div>
                <span>Share of Total</span>
                <strong>
                  {totalSpentInRange > 0 ? ((selectedCategoryData.amount / totalSpentInRange) * 100).toFixed(1) : 0}%
                </strong>
              </div>
            </div>

            <div className="drilldown-transactions-list">
              {selectedCategoryTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="drilldown-tx-row"
                  onClick={() => onOpenTransaction && onOpenTransaction(tx)}
                  role={onOpenTransaction ? 'button' : undefined}
                >
                  <div className="tx-copy">
                    <strong>{tx.title || 'Expense'}</strong>
                    <small>{formatDate(tx.date, dateFormat)} · {paymentMap[tx.paymentMethodId]?.name || 'Cash'}</small>
                  </div>
                  <strong className="tx-amount">{formatCurrency(tx.amount)}</strong>
                </div>
              ))}
            </div>
            {selectedCategoryTransactions.length > 5 ? (
              <p className="drilldown-more-notice">
                Showing recent 5 of {selectedCategoryTransactions.length} transactions in this period.
              </p>
            ) : null}
          </section>
        ) : null}
      </Panel>

      {/* 5. Weekday vs Weekend Spending Habits */}
      <Panel className="analytics-section">
        <PanelHeader>
          <div>
            <p className="eyebrow">Behavioral Insights</p>
            <h2>Weekday vs. Weekend Habits</h2>
          </div>
        </PanelHeader>

        <div className="habit-split-container">
          {weekdayWeekend.peakDay ? (
            <div className="habit-peak-badge">
              <Sparkles size={13} className="peak-icon" />
              <span>
                Peak spending day: <strong>{weekdayWeekend.peakDay.name}</strong> ({formatCurrency(weekdayWeekend.peakDay.amount)})
              </span>
            </div>
          ) : null}

          <div className="habit-split-bar" aria-label="Weekday to Weekend ratio">
            <div
              className="habit-weekday-fill"
              style={{ width: `${Math.round(weekdayWeekend.weekdayPercent)}%` }}
              title={`Weekdays: ${Math.round(weekdayWeekend.weekdayPercent)}%`}
            />
            <div
              className="habit-weekend-fill"
              style={{ width: `${Math.round(weekdayWeekend.weekendPercent)}%` }}
              title={`Weekends: ${Math.round(weekdayWeekend.weekendPercent)}%`}
            />
          </div>

          <div className="habit-metrics-grid">
            <div className="habit-metric-box weekday">
              <span className="dot weekday-dot" />
              <div>
                <span>Weekdays (Mon–Fri)</span>
                <strong>{formatCurrency(weekdayWeekend.weekdayTotal)}</strong>
                <small>{weekdayWeekend.weekdayCount} transactions ({Math.round(weekdayWeekend.weekdayPercent)}%)</small>
              </div>
            </div>
            <div className="habit-metric-box weekend">
              <span className="dot weekend-dot" />
              <div>
                <span>Weekends (Sat–Sun)</span>
                <strong>{formatCurrency(weekdayWeekend.weekendTotal)}</strong>
                <small>{weekdayWeekend.weekendCount} transactions ({Math.round(weekdayWeekend.weekendPercent)}%)</small>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* 6. Spending by Payment Method */}
      <Panel className="analytics-section">
        <PanelHeader>
          <div>
            <p className="eyebrow">Payment Channels</p>
            <h2>Spending by Method</h2>
          </div>
        </PanelHeader>
        <div className="category-list">
          {dynamicPaymentTotals.length === 0 ? (
            <EmptyState>No payment data recorded yet.</EmptyState>
          ) : (
            dynamicPaymentTotals.map(({ label, amount }) => (
              <div key={label} className="category-row">
                <span>{label}</span>
                <strong>{formatCurrency(amount)}</strong>
              </div>
            ))
          )}
        </div>
      </Panel>

      {/* 7. Budget Performance & Monthly Trend */}
      <Panel ref={budgetAnalysisRef} className="budget-analytics-panel">
        <PanelHeader>
          <div>
            <p className="eyebrow">Budget</p>
            <h2>Budget Performance</h2>
          </div>
        </PanelHeader>
        {overallBudget > 0 ? (
          <section className="budget-overall-summary">
            <div className="budget-summary">
              <div className="budget-summary-item">
                <span>Total budget</span>
                <strong>{formatCurrency(overallBudget)}</strong>
              </div>
              <div className="budget-summary-item">
                <span>Total expenses</span>
                <strong>{formatCurrency(monthlyExpense)}</strong>
              </div>
              <div className="budget-summary-item">
                <span>{overallBudget - monthlyExpense < 0 ? 'Spent over budget' : 'Remaining budget'}</span>
                <strong className={overallBudget - monthlyExpense < 0 ? 'expense' : 'budget-change-value'}>
                  {formatCurrency(Math.abs(overallBudget - monthlyExpense))}
                </strong>
              </div>
            </div>
            <div
              className={`budget-progress${overallBudget - monthlyExpense < 0 ? ' over-budget' : ''}`}
              role="progressbar"
              aria-label="Overall budget spent"
              aria-valuemin="0"
              aria-valuemax={overallBudget}
              aria-valuenow={Math.min(monthlyExpense, overallBudget)}
              aria-valuetext={`${Math.round((monthlyExpense / overallBudget) * 100)}% used`}
            >
              <span style={{ width: `${Math.min((monthlyExpense / overallBudget) * 100, 100)}%` }} />
            </div>
            <p className="analytics-footnote">
              {Math.round((monthlyExpense / overallBudget) * 100)}% of your monthly budget has been used.
            </p>
          </section>
        ) : (
          <EmptyState>Add a budget in the Budget tab to see performance tracking here.</EmptyState>
        )}
      </Panel>

      {/* 8. Six-Month Trend Chart */}
      <Panel className="analytics-section">
        <PanelHeader>
          <div>
            <p className="eyebrow">Trend</p>
            <h2>6-Month Spending History</h2>
          </div>
        </PanelHeader>
        <div className="monthly-trend-chart" role="img" aria-label="Expense totals for the last six months">
          {monthlyExpenseTrend.map((month) => {
            const barHeight = month.amount > 0 ? Math.max(8, (month.amount / highestTrendAmount) * 100) : 0;
            return (
              <div className="monthly-trend-column" key={month.month}>
                <strong title={`${month.month}: ${formatCurrency(month.amount)}`}>
                  {month.amount ? formatCurrency(month.amount) : '—'}
                </strong>
                <div className="monthly-trend-track">
                  <span style={{ height: `${barHeight}%` }} />
                </div>
                <small>{monthLabel(month.date)}</small>
              </div>
            );
          })}
        </div>
        <p className="analytics-footnote">Expense totals by month · PKR</p>
      </Panel>
    </div>
  );
}
