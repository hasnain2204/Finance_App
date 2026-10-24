export function toPaisa(value) {
  return Math.round(Number(value || 0) * 100);
}

export function fromPaisa(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

export function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export const dateFormatOptions = ['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

export function formatDate(value, dateFormat = 'DD MMM YYYY') {
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? new Date(`${value}T00:00:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const monthName = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = String(date.getFullYear());

  switch (dateFormatOptions.includes(dateFormat) ? dateFormat : 'DD MMM YYYY') {
    case 'DD/MM/YYYY':
      return `${day}/${month}/${year}`;
    case 'MM/DD/YYYY':
      return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD':
      return `${year}-${month}-${day}`;
    default:
      return `${day} ${monthName} ${year}`;
  }
}

export function formatCurrency(value) {
  const numericValue = Number(value || 0);
  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 2
  }).format(numericValue);

  return `PKR ${formatted}`;
}

export function calculateExpenseTotal(transactions = [], month) {
  return transactions
    .filter((tx) => tx.type === 'expense' && (!month || tx.date?.startsWith(month)))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
}

export function calculateCumulativeBudgetTotal(budgets = [], budgetHistory = []) {
  const cumulativeBudget = budgets.find((budget) => budget.id === 'budget-all-overall');
  if (cumulativeBudget) return Number(cumulativeBudget.amount || 0);

  const legacyBudgets = budgets
    .filter((budget) => budget.categoryId === 'overall' && budget.month !== 'all')
    .reduce((total, budget) => total + Number(budget.amount || 0), 0);
  const additions = budgetHistory
    .filter((entry) => entry.entryType === 'addition')
    .reduce((total, entry) => total + Number(entry.amount || 0), 0);

  return legacyBudgets + additions;
}

export function calculateCategoryExpenseTotals(transactions = [], month) {
  return transactions.reduce((totals, tx) => {
    if (tx.type !== 'expense' || (month && !tx.date?.startsWith(month))) return totals;
    totals[tx.categoryId] = (totals[tx.categoryId] || 0) + Number(tx.amount || 0);
    return totals;
  }, {});
}

export function calculateBudgetProgress(limit, spent) {
  const budget = Math.max(0, Number(limit) || 0);
  const expense = Math.max(0, Number(spent) || 0);

  return {
    remaining: budget - expense,
    percent: budget > 0 ? (expense / budget) * 100 : 0,
    isOverBudget: budget > 0 && expense > budget
  };
}

export function createBudgetHistoryEntry(
  month,
  categoryId,
  previousAmount,
  amount,
  description = '',
  date = getLocalDateString(),
  timestamp = new Date()
) {
  return {
    month,
    categoryId,
    date,
    createdAt: timestamp.toISOString(),
    previousAmount,
    amount,
    description: description.trim()
  };
}

export function validateTransaction(formValues) {
  const amount = Number(formValues.amount || 0);
  const date = String(formValues.date || '');
  const errors = [];

  if (!Number.isFinite(amount) || amount < 0.01 || !Number.isSafeInteger(toPaisa(amount))) {
    errors.push('Amount must be at least PKR 0.01 and within the supported range.');
  }

  const parsedDate = new Date(`${date}T00:00:00`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.getFullYear() !== Number(date.slice(0, 4)) ||
    parsedDate.getMonth() + 1 !== Number(date.slice(5, 7)) ||
    parsedDate.getDate() !== Number(date.slice(8, 10))
  ) {
    errors.push('Select a valid transaction date.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function buildBackupPayload(data) {
  return JSON.stringify({
    version: 2,
    exportedAt: new Date().toISOString(),
    ...data
  }, null, 2);
}
