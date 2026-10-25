import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';

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

export function buildWeeklyBudgetTrend(transactions = [], budgetAmount = null, endDate = new Date()) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate() - (6 - index));
    return { date, isoDate: getLocalDateString(date), expenses: 0 };
  });

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !transaction.date) continue;
    const day = days.find((item) => item.isoDate === transaction.date);
    if (day) day.expenses += Number(transaction.amount || 0);
  }

  let cumulativeExpenses = transactions
    .filter((transaction) => transaction.type === 'expense' && transaction.date < days[0].isoDate)
    .reduce((total, transaction) => total + Number(transaction.amount || 0), 0);

  return days.map((day) => {
    cumulativeExpenses += day.expenses;
    return {
      date: day.date,
      isoDate: day.isoDate,
      expenses: day.expenses,
      totalExpenses: cumulativeExpenses,
      remainingBudget: budgetAmount === null ? null : budgetAmount - cumulativeExpenses
    };
  });
}

export function buildMonthlyExpenseTrend(transactions = [], monthCount = 6, endDate = new Date()) {
  const count = Math.max(1, Math.floor(Number(monthCount) || 1));
  const months = Array.from({ length: count }, (_, index) => {
    const date = new Date(endDate.getFullYear(), endDate.getMonth() - (count - index - 1), 1);
    return {
      date,
      month: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
      amount: 0
    };
  });
  const monthTotals = new Map(months.map(({ month }) => [month, 0]));

  for (const transaction of transactions) {
    if (transaction.type !== 'expense' || !transaction.date) continue;
    const month = transaction.date.slice(0, 7);
    if (monthTotals.has(month)) {
      monthTotals.set(month, monthTotals.get(month) + Number(transaction.amount || 0));
    }
  }

  return months.map((month) => ({ ...month, amount: monthTotals.get(month.month) }));
}

export function buildMonthlyBudgetTrend(
  transactions = [],
  budgets = [],
  budgetHistory = [],
  monthCount = 6,
  endDate = new Date()
) {
  const expenseTrend = buildMonthlyExpenseTrend(transactions, monthCount, endDate);
  return expenseTrend.map((month) => {
    const categoryBudgets = budgets
      .filter((budget) => budget.month === month.month && budget.categoryId !== 'overall')
      .reduce((total, budget) => total + Number(budget.amount || 0), 0);
    const additions = budgetHistory
      .filter((entry) => entry.month === month.month && entry.entryType === 'addition')
      .reduce((total, entry) => total + Number(entry.amount || 0), 0);
    const overallBudget = budgets.find(
      (budget) => budget.month === month.month && budget.categoryId === 'overall'
    );
    const budgetPaisa = categoryBudgets || additions || Number(overallBudget?.amount || 0);

    return {
      ...month,
      budget: budgetPaisa > 0 ? fromPaisa(budgetPaisa) : null
    };
  });
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

const backupCollectionNames = [
  'transactions',
  'categories',
  'paymentMethods',
  'budgets',
  'budgetHistory',
  'preferences'
];

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime()) &&
    date.getFullYear() === Number(value.slice(0, 4)) &&
    date.getMonth() + 1 === Number(value.slice(5, 7)) &&
    date.getDate() === Number(value.slice(8, 10));
}

function isValidMonthString(value) {
  return typeof value === 'string' &&
    /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function validatePreferences(preferences) {
  if (!Array.isArray(preferences) || !preferences.length) {
    throw new Error('Backup preferences are missing.');
  }

  const ids = new Set();
  for (const preference of preferences) {
    if (!isRecord(preference) || typeof preference.id !== 'string' || !preference.id.trim() || ids.has(preference.id)) {
      throw new Error('Backup preferences contain an invalid ID.');
    }
    ids.add(preference.id);
    if (
      (preference.currency !== undefined && preference.currency !== 'PKR') ||
      (preference.lightMode !== undefined && typeof preference.lightMode !== 'boolean') ||
      (preference.name !== undefined && typeof preference.name !== 'string') ||
      (preference.onboardingCompleted !== undefined && typeof preference.onboardingCompleted !== 'boolean') ||
      (preference.dateFormat !== undefined && !dateFormatOptions.includes(preference.dateFormat)) ||
      (preference.notificationsEnabled !== undefined && typeof preference.notificationsEnabled !== 'boolean')
    ) {
      throw new Error('Backup preferences contain invalid settings.');
    }
  }
  if (!ids.has('app')) throw new Error('Backup app settings are missing.');
  return preferences.map((preference) => ({ ...preference }));
}

export function normalizeBackupData(backup) {
  if (!isRecord(backup) || ![1, 2, 3].includes(backup.version)) {
    throw new Error('Unsupported backup format or version.');
  }
  const isCurrentVersion = backup.version === 3;
  if (backup.exportedAt !== undefined && (
    typeof backup.exportedAt !== 'string' || Number.isNaN(new Date(backup.exportedAt).getTime())
  )) {
    throw new Error('Backup export date is invalid.');
  }
  for (const collection of backupCollectionNames) {
    if (isCurrentVersion && !Array.isArray(backup[collection])) {
      throw new Error(`Backup collection "${collection}" is missing or invalid.`);
    }
  }
  if (!Array.isArray(backup.transactions)) {
    throw new Error('Backup transactions are missing or invalid.');
  }

  const categoriesInput = backup.categories === undefined && !isCurrentVersion
    ? defaultCategories
    : backup.categories;
  const paymentMethodsInput = backup.paymentMethods === undefined && !isCurrentVersion
    ? defaultPaymentMethods
    : backup.paymentMethods;
  const budgetsInput = backup.budgets === undefined && !isCurrentVersion ? [] : backup.budgets;
  const historyInput = backup.budgetHistory === undefined && !isCurrentVersion ? [] : backup.budgetHistory;
  if (
    !Array.isArray(categoriesInput) ||
    !Array.isArray(paymentMethodsInput) ||
    !Array.isArray(budgetsInput) ||
    !Array.isArray(historyInput)
  ) {
    throw new Error('A backup collection has an invalid format.');
  }

  const categories = [];
  const categoryIds = new Set();
  for (const category of categoriesInput) {
    if (
      !isRecord(category) ||
      typeof category.id !== 'string' ||
      !category.id.trim() ||
      typeof category.name !== 'string' ||
      !category.name.trim() ||
      !['expense', 'income'].includes(category.type) ||
      categoryIds.has(category.id)
    ) {
      throw new Error('Backup categories contain an invalid record.');
    }
    categoryIds.add(category.id);
    if (category.type === 'expense') categories.push({ ...category });
  }
  if (!categories.length) {
    if (isCurrentVersion) throw new Error('Backup must contain at least one expense category.');
    categories.push(...defaultCategories.map((category) => ({ ...category })));
    for (const category of categories) categoryIds.add(category.id);
  }
  const expenseCategoryIds = new Set(categories.map((category) => category.id));

  const paymentMethods = [];
  const paymentMethodIds = new Set();
  for (const method of paymentMethodsInput) {
    if (
      !isRecord(method) ||
      typeof method.id !== 'string' ||
      !method.id.trim() ||
      typeof method.name !== 'string' ||
      !method.name.trim() ||
      paymentMethodIds.has(method.id)
    ) {
      throw new Error('Backup payment methods contain an invalid record.');
    }
    paymentMethodIds.add(method.id);
    paymentMethods.push({ ...method });
  }
  if (isCurrentVersion && !paymentMethods.length) {
    throw new Error('Backup must contain at least one payment method.');
  }
  if (!paymentMethodsInput.length && !isCurrentVersion) {
    paymentMethods.push(...defaultPaymentMethods.map((method) => ({ ...method })));
    for (const method of paymentMethods) paymentMethodIds.add(method.id);
  }

  const warnings = [];
  let missingMethodCount = 0;
  let recoveredMethodCount = 0;
  const transactions = [];
  const transactionIds = new Set();
  for (const transaction of backup.transactions) {
    if (
      !isRecord(transaction) ||
      !['expense', 'income'].includes(transaction.type) ||
      typeof transaction.title !== 'string' ||
      !transaction.title.trim() ||
      typeof transaction.categoryId !== 'string' ||
      !transaction.categoryId.trim() ||
      !isValidDateString(transaction.date) ||
      typeof transaction.amount !== 'number' ||
      !Number.isFinite(transaction.amount) ||
      transaction.amount <= 0 ||
      (transaction.id !== undefined && (!Number.isSafeInteger(transaction.id) || transaction.id <= 0)) ||
      (isCurrentVersion && transaction.id === undefined) ||
      (transaction.notes !== undefined && typeof transaction.notes !== 'string') ||
      (transaction.createdAt !== undefined && (
        typeof transaction.createdAt !== 'string' || Number.isNaN(new Date(transaction.createdAt).getTime())
      )) ||
      (transaction.paymentMethodId !== undefined &&
        transaction.paymentMethodId !== null &&
        (typeof transaction.paymentMethodId !== 'string' || !transaction.paymentMethodId.trim()))
    ) {
      throw new Error('Backup transactions contain an invalid record.');
    }
    if (transaction.id !== undefined) {
      if (transactionIds.has(transaction.id)) throw new Error('Backup transaction IDs are duplicated.');
      transactionIds.add(transaction.id);
    }
    if (transaction.type === 'income') continue;
    if (!expenseCategoryIds.has(transaction.categoryId)) {
      throw new Error(`Transaction references missing category "${transaction.categoryId}".`);
    }

    let paymentMethodId = transaction.paymentMethodId;
    if (!paymentMethodId) {
      paymentMethodId = 'pm-other';
      missingMethodCount += 1;
    } else if (!paymentMethodIds.has(paymentMethodId)) {
      paymentMethods.push({
        id: paymentMethodId,
        name: `Recovered method (${paymentMethodId})`
      });
      paymentMethodIds.add(paymentMethodId);
      recoveredMethodCount += 1;
    }

    const rawAmount = transaction.amount;
    const amount = isCurrentVersion
      ? rawAmount
      : toPaisa(rawAmount);
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error('Backup transaction amount is outside the supported range.');
    }
    transactions.push({
      ...transaction,
      amount,
      paymentMethodId,
      notes: transaction.notes || ''
    });
  }
  if (missingMethodCount) {
    if (!paymentMethodIds.has('pm-other')) {
      paymentMethods.push({ id: 'pm-other', name: 'Other' });
      paymentMethodIds.add('pm-other');
    }
    warnings.push(`${missingMethodCount} transaction(s) without a payment method were assigned to Other.`);
  }
  if (recoveredMethodCount) {
    warnings.push(`${recoveredMethodCount} unknown payment method(s) were restored as named recovery methods.`);
  }

  const budgets = [];
  const budgetIds = new Set();
  for (const budget of budgetsInput) {
    if (
      !isRecord(budget) ||
      typeof budget.id !== 'string' ||
      !budget.id.trim() ||
      budgetIds.has(budget.id) ||
      typeof budget.categoryId !== 'string' ||
      (budget.categoryId !== 'overall' && !expenseCategoryIds.has(budget.categoryId)) ||
      (budget.month !== 'all' && !isValidMonthString(budget.month)) ||
      typeof budget.amount !== 'number' ||
      !Number.isFinite(budget.amount) ||
      budget.amount < 0
    ) {
      throw new Error('Backup budgets contain an invalid record.');
    }
    budgetIds.add(budget.id);
    const amount = backup.version === 1 ? toPaisa(budget.amount) : budget.amount;
    if (!Number.isSafeInteger(amount)) throw new Error('Backup budget amount is outside the supported range.');
    budgets.push({ ...budget, amount });
  }

  const budgetHistory = [];
  const historyIds = new Set();
  const validHistoryAmount = (amount) => (
    amount === null || (Number.isSafeInteger(amount) && amount >= 0)
  );
  for (const entry of historyInput) {
    if (
      !isRecord(entry) ||
      (entry.id !== undefined && (!Number.isSafeInteger(entry.id) || entry.id <= 0)) ||
      (isCurrentVersion && entry.id === undefined) ||
      (entry.id !== undefined && historyIds.has(entry.id)) ||
      !isValidMonthString(entry.month) ||
      !isValidDateString(entry.date) ||
      typeof entry.createdAt !== 'string' ||
      Number.isNaN(new Date(entry.createdAt).getTime()) ||
      (entry.categoryId !== undefined && (
        typeof entry.categoryId !== 'string' ||
        (entry.categoryId !== 'overall' && !expenseCategoryIds.has(entry.categoryId))
      )) ||
      (entry.budgetCategory !== undefined && typeof entry.budgetCategory !== 'string') ||
      (entry.description !== undefined && typeof entry.description !== 'string') ||
      !validHistoryAmount(entry.previousAmount) ||
      !validHistoryAmount(entry.amount) ||
      (entry.entryType !== undefined && typeof entry.entryType !== 'string')
    ) {
      throw new Error('Backup budget history contains an invalid record.');
    }
    if (entry.id !== undefined) historyIds.add(entry.id);
    budgetHistory.push({ ...entry });
  }

  let preferences = null;
  if (backup.preferences !== undefined) {
    preferences = validatePreferences(backup.preferences);
  } else if (isCurrentVersion) {
    throw new Error('Backup preferences are missing.');
  }

  return {
    version: backup.version,
    transactions,
    categories,
    paymentMethods,
    budgets,
    budgetHistory,
    preferences,
    skippedIncomeCount: backup.transactions.filter((transaction) => transaction.type === 'income').length,
    warnings
  };
}

export function parseBackupPayload(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error('Backup file is not valid JSON.');
  }
  return normalizeBackupData(parsed);
}

export async function restoreBackupData(database, backup) {
  await database.transaction(
    'rw',
    database.transactions,
    database.categories,
    database.paymentMethods,
    database.budgets,
    database.budgetHistory,
    database.preferences,
    async () => {
      await database.transactions.clear();
      await database.categories.clear();
      await database.paymentMethods.clear();
      await database.budgets.clear();
      await database.budgetHistory.clear();
      if (backup.preferences) await database.preferences.clear();

      if (backup.transactions.length) await database.transactions.bulkPut(backup.transactions);
      if (backup.categories.length) await database.categories.bulkPut(backup.categories);
      if (backup.paymentMethods.length) await database.paymentMethods.bulkPut(backup.paymentMethods);
      if (backup.budgets.length) await database.budgets.bulkPut(backup.budgets);
      if (backup.budgetHistory.length) await database.budgetHistory.bulkPut(backup.budgetHistory);
      if (backup.preferences?.length) await database.preferences.bulkPut(backup.preferences);
    }
  );
}

export function buildBackupPayload(data) {
  if (
    !isRecord(data) ||
    backupCollectionNames.some((collection) => !Array.isArray(data[collection])) ||
    !data.preferences.some((preference) => isRecord(preference) && preference.id === 'app')
  ) {
    throw new Error('A complete backup requires every data collection and app preferences.');
  }
  return JSON.stringify({
    ...data,
    version: 3,
    exportedAt: new Date().toISOString()
  }, null, 2);
}
