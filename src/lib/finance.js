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

export function formatCurrency(value) {
  const numericValue = Number(value || 0);
  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 2
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

export function calculateMonthlySummary(transactions = [], month = getLocalDateString().slice(0, 7)) {
  const monthTransactions = transactions.filter((tx) => {
    if (!tx.date) return false;
    return tx.date.startsWith(month);
  });

  return calculateBalance(monthTransactions);
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
    version: 1,
    exportedAt: new Date().toISOString(),
    ...data
  }, null, 2);
}
