import { TrendingUp } from 'lucide-react';
import {
  calculateExpenseTotal,
  formatCurrency,
  fromPaisa,
  getLocalDateString
} from '../../lib/finance';
import { Panel, PanelHeader, EmptyState } from '../../components/ui';

export function AnalyticsScreen({
  transactions,
  totalBudgetPaisa,
  monthlyExpense,
  monthlyExpenseTrend,
  monthlyBudgetTrend,
  categoryTotals,
  paymentMethodTotals,
  budgetAnalysisRef
}) {
  const overallBudget = fromPaisa(totalBudgetPaisa);
  const totalSpent = calculateExpenseTotal(transactions);
  const remainingBalance = overallBudget - totalSpent;
  const spendingPercent = overallBudget > 0 ? (totalSpent / overallBudget) * 100 : 0;
  const currentDate = new Date();
  const currentMonth = getLocalDateString(currentDate).slice(0, 7);
  const previousMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  const previousMonth = getLocalDateString(previousMonthDate).slice(0, 7);
  const previousMonthExpense = calculateExpenseTotal(transactions, previousMonth);
  const monthChange = previousMonthExpense > 0
    ? ((monthlyExpense - previousMonthExpense) / previousMonthExpense) * 100
    : null;
  const currentMonthTransactions = transactions.filter((transaction) => transaction.date?.startsWith(currentMonth));
  const averageDailyExpense = monthlyExpense / Math.max(1, currentDate.getDate());
  const largestExpense = currentMonthTransactions.reduce(
    (largest, transaction) => Math.max(largest, Number(transaction.amount || 0)),
    0
  );
  const monthLabel = (date) => date.toLocaleDateString('en-PK', { month: 'short' });
  const highestTrendAmount = Math.max(1, ...monthlyExpenseTrend.map((month) => month.amount));
  const categoryColors = ['#2f66f6', '#d02222', '#30a316', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899', '#64748b'];
  const categoryTotal = categoryTotals.reduce((total, [, amount]) => total + amount, 0);
  let categoryGradientStart = 0;
  const categoryGradient = categoryTotals.length
    ? categoryTotals.map(([, amount], index) => {
        const start = categoryGradientStart;
        categoryGradientStart += categoryTotal ? (amount / categoryTotal) * 100 : 0;
        return `${categoryColors[index % categoryColors.length]} ${start}% ${categoryGradientStart}%`;
      }).join(', ')
    : '#e8edf5 0% 100%';

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
  const xForIndex = (index) => left + ((right - left) * index) / (monthlyBudgetTrend.length - 1);
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

  return (
    <div className="stacked-blocks">
      <Panel className="analytics-overview">
        <PanelHeader>
          <div>
            <p className="eyebrow">Your finances</p>
            <h2>Spending overview</h2>
          </div>
          <TrendingUp size={18} />
        </PanelHeader>

        <div className="metric-grid analytics-metric-grid">
          <div className="metric-card">
            <span>Expenses this month</span>
            <strong>{formatCurrency(monthlyExpense)}</strong>
          </div>
          <div className="metric-card">
            <span>Transactions this month</span>
            <strong>{currentMonthTransactions.length}</strong>
          </div>
          <div className="metric-card">
            <span>Average per day</span>
            <strong>{formatCurrency(averageDailyExpense)}</strong>
          </div>
          <div className="metric-card">
            <span>Largest expense this month</span>
            <strong>{formatCurrency(largestExpense)}</strong>
          </div>
        </div>

        <p className={`analytics-comparison${monthChange === null || monthChange === 0 ? '' : monthChange > 0 ? ' increase' : ' decrease'}`}>
          {monthChange === null
            ? `Previous month: ${formatCurrency(previousMonthExpense)} · not enough data to compare`
            : monthChange === 0
              ? 'Spending is unchanged from last month'
            : `${Math.abs(monthChange).toFixed(1)}% ${monthChange > 0 ? 'more' : 'less'} than last month`}
        </p>
      </Panel>

      <Panel className="analytics-section">
        <PanelHeader>
          <div>
            <p className="eyebrow">Trend</p>
            <h2>Monthly spending</h2>
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

      <Panel className="analytics-section">
        <PanelHeader>
          <div>
            <p className="eyebrow">This month</p>
            <h2>Spending by category</h2>
          </div>
        </PanelHeader>

        <div className="analytics-donut-layout">
          {categoryTotals.length === 0 ? (
            <EmptyState>No expense data is available yet.</EmptyState>
          ) : (
            <>
              <div
                className="analytics-donut"
                role="img"
                aria-label={`Category spending breakdown totaling ${formatCurrency(categoryTotal)}`}
                style={{ background: `conic-gradient(${categoryGradient})` }}
              >
                <span>
                  <small>Total spent</small>
                  <strong>{formatCurrency(categoryTotal)}</strong>
                </span>
              </div>
              <div className="analytics-donut-legend">
                {categoryTotals.map(([label, total], index) => {
                  const share = categoryTotal > 0 ? (total / categoryTotal) * 100 : 0;
                  return (
                    <div className="analytics-donut-item" key={label}>
                      <i style={{ background: categoryColors[index % categoryColors.length] }} />
                      <span>{label}</span>
                      <strong>{share.toFixed(1)}%</strong>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </Panel>

      <Panel className="analytics-section">
        <PanelHeader>
          <div>
            <p className="eyebrow">This month</p>
            <h2>Spending by payment method</h2>
          </div>
        </PanelHeader>
        <div className="category-list">
          {paymentMethodTotals.length === 0 ? (
            <EmptyState>No expense data is available yet.</EmptyState>
          ) : (
            paymentMethodTotals.map(({ label, amount }) => (
              <div key={label} className="category-row">
                <span>{label}</span>
                <strong>{formatCurrency(amount)}</strong>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel ref={budgetAnalysisRef} className="budget-analytics-panel">
        <PanelHeader>
          <div>
            <p className="eyebrow">Budget</p>
            <h2>Budget performance</h2>
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
                <strong>{formatCurrency(totalSpent)}</strong>
              </div>
              <div className="budget-summary-item">
                <span>{remainingBalance < 0 ? 'Spent over budget' : 'Remaining budget'}</span>
                <strong className={remainingBalance < 0 ? 'expense' : 'budget-change-value'}>
                  {formatCurrency(Math.abs(remainingBalance))}
                </strong>
              </div>
            </div>
            <div
              className={`budget-progress${remainingBalance < 0 ? ' over-budget' : ''}`}
              role="progressbar"
              aria-label="Overall budget spent"
              aria-valuemin="0"
              aria-valuemax={overallBudget}
              aria-valuenow={Math.min(totalSpent, overallBudget)}
              aria-valuetext={`${Math.round(spendingPercent)}% used`}
            >
              <span style={{ width: `${Math.min(spendingPercent, 100)}%` }} />
            </div>
            <p className="analytics-footnote">{Math.round(spendingPercent)}% of your total budget has been used.</p>
          </section>
        ) : (
          <EmptyState>Add a budget to see budget performance here.</EmptyState>
        )}
      </Panel>

      <Panel className="analytics-section analytics-budget-analysis">
        <PanelHeader>
          <div>
            <p className="eyebrow">Analysis</p>
            <h2>Budget vs. spending</h2>
          </div>
        </PanelHeader>
        <svg
          className="monthly-analysis-chart"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="img"
          aria-label="Monthly expense bars compared with available monthly budget"
        >
          {[0, 1, 2, 3].map((line) => {
            const y = top + (plotHeight * line) / 3;
            return <line key={line} className="chart-gridline" x1={left} x2={right} y1={y} y2={y} />;
          })}
          {monthlyBudgetTrend.map((month, index) => {
            const x = xForIndex(index);
            const expenseY = yForValue(month.amount);
            return (
              <g key={month.month}>
                <rect
                  className="analysis-expense-bar"
                  x={x - 12}
                  y={expenseY}
                  width="24"
                  height={Math.max(2, bottom - expenseY)}
                  rx="4"
                >
                  <title>{`${month.month}: Expenses ${formatCurrency(month.amount)}`}</title>
                </rect>
                <text className="weekly-chart-date" x={x} y="172" textAnchor="middle">
                  {monthLabel(month.date)}
                </text>
                {month.budget !== null ? (
                  <circle className="analysis-budget-point" cx={x} cy={yForValue(month.budget)} r="3.5">
                    <title>{`${month.month}: Budget ${formatCurrency(month.budget)}`}</title>
                  </circle>
                ) : null}
              </g>
            );
          })}
          {budgetLinePath ? <path className="analysis-budget-line" d={budgetLinePath} /> : null}
        </svg>
        <div className="weekly-chart-legend" aria-label="Chart legend">
          <span><i className="weekly-legend-dot expense-dot" />Expenses</span>
          <span><i className="weekly-legend-dot budget-dot" />{hasMonthlyBudget ? 'Monthly budget' : 'No monthly budget history'}</span>
        </div>
        <p className="analytics-footnote">Compare monthly expense totals with saved budgets and budget additions · PKR</p>
      </Panel>

      <p className="analytics-data-note">Income, cash-flow and savings-rate reports aren’t shown because this app currently records expenses only.</p>
    </div>
  );
}
