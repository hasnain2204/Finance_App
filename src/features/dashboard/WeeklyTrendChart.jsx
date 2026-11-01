import { formatCurrency, formatDate } from '../../lib/finance';

export function WeeklyTrendChart({ weeklySpending, dateFormat }) {
  const chartWidth = 360;
  const plotTop = 14;
  const plotBottom = 142;
  const plotHeight = plotBottom - plotTop;
  const plotLeft = 12;
  const plotWidth = chartWidth - plotLeft * 2;
  const hasBudget = weeklySpending.some((day) => day.remainingBudget !== null);
  const values = weeklySpending.flatMap((day) => (
    hasBudget ? [day.totalExpenses, day.remainingBudget] : [day.totalExpenses]
  ));
  const minValue = Math.min(0, ...values);
  const maxValue = Math.max(1, ...values);
  const valueRange = maxValue - minValue || 1;
  const xForIndex = (index) => plotLeft + (plotWidth * index) / (weeklySpending.length - 1);
  const yForValue = (value) => plotBottom - ((value - minValue) / valueRange) * plotHeight;
  const expensesPoints = weeklySpending.map((day, index) => (
    `${xForIndex(index)},${yForValue(day.totalExpenses)}`
  )).join(' ');
  const budgetPoints = hasBudget
    ? weeklySpending.map((day, index) => (
        `${xForIndex(index)},${yForValue(day.remainingBudget)}`
      )).join(' ')
    : '';

  return (
    <>
      <svg
        className="weekly-trend-chart"
        viewBox={`0 0 ${chartWidth} 190`}
        role="img"
        aria-label="Seven-day chart of daily expenses and remaining budget"
      >
        {[0, 1, 2, 3].map((line) => {
          const y = plotTop + (plotHeight * line) / 3;
          return <line key={line} className="chart-gridline" x1={plotLeft} x2={chartWidth - plotLeft} y1={y} y2={y} />;
        })}
        {weeklySpending.map((day, index) => {
          const x = xForIndex(index);
          const expenseY = yForValue(day.expenses);
          const zeroY = yForValue(0);
          return (
            <rect
              key={`bar-${day.isoDate}`}
              className="weekly-expense-bar"
              x={x - 10}
              y={Math.min(expenseY, zeroY)}
              width="20"
              height={Math.max(2, Math.abs(zeroY - expenseY))}
              rx="4"
            >
              <title>{`${formatDate(day.isoDate, dateFormat)}: ${formatCurrency(day.expenses)} spent`}</title>
            </rect>
          );
        })}
        <polyline className="weekly-expense-line" points={expensesPoints} />
        {hasBudget ? <polyline className="weekly-budget-line" points={budgetPoints} /> : null}
        {weeklySpending.map((day, index) => {
          const x = xForIndex(index);
          const expenseY = yForValue(day.totalExpenses);
          const budgetY = hasBudget ? yForValue(day.remainingBudget) : null;
          return (
            <g key={day.isoDate}>
              <circle className="weekly-expense-point" cx={x} cy={expenseY} r="3.5">
                <title>{`${formatDate(day.isoDate, dateFormat)}: Overall expenses ${formatCurrency(day.totalExpenses)}`}</title>
              </circle>
              {hasBudget ? (
                <circle className="weekly-budget-point" cx={x} cy={budgetY} r="3.5">
                  <title>{`${formatDate(day.isoDate, dateFormat)}: Remaining budget ${formatCurrency(day.remainingBudget)}`}</title>
                </circle>
              ) : null}
              <text className="weekly-chart-date" x={x} y="174" textAnchor="middle">
                {formatDate(day.isoDate, dateFormat)}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="weekly-chart-legend" aria-label="Chart legend">
        <span><i className="weekly-legend-dot expense-dot" />Overall expenses</span>
        <span><i className="weekly-legend-dot budget-dot" />{hasBudget ? 'Remaining budget' : 'Budget not set'}</span>
      </div>
    </>
  );
}
