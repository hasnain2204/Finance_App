export function toPaisa(value) {
  return Math.round(Number(value || 0) * 100);
}

export function fromPaisa(value) {
  return Number((Number(value || 0) / 100).toFixed(2));
}

export function formatCurrency(value) {
  const numericValue = Number(value || 0);
  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 0
  }).format(numericValue);

  return `PKR ${formatted}`;
}

export function calculateBalance(transactions = []) {
  const income = transactions
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const expense = transactions
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  return {
    income,
    expense,
    balance: income - expense
  };
}

export function calculateMonthlySummary(transactions = [], month = new Date().toISOString().slice(0, 7)) {
  const monthTransactions = transactions.filter((tx) => {
    if (!tx.date) return false;
    return tx.date.startsWith(month);
  });

  return calculateBalance(monthTransactions);
}

export function validateTransaction(formValues) {
  const amount = Number(formValues.amount || 0);
  const errors = [];

  if (!Number.isFinite(amount) || amount <= 0) {
    errors.push('Amount must be greater than zero.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export function buildBackupPayload(data) {
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data
  }, null, 2);
}
