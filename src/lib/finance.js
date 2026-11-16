import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';
import { addSyncIdentities, getSyncIdentityReport, isSyncId } from '../services/syncIdentity';
import { enqueueRestoreDiff } from '../services/financeSyncQueue';

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

export function getSmartGreeting(date = new Date()) {
  const hours = date.getHours();
  // 00:00 to 04:59 -> Late night / middle of night: Good Night
  // 05:00 to 11:59 -> Good Morning
  // 12:00 to 16:59 -> Good Afternoon
  // 17:00 to 20:59 -> Good Evening
  // 21:00 to 23:59 -> Good Night
  if (hours < 5 || hours >= 21) {
    return 'Good Night';
  }
  if (hours < 12) {
    return 'Good Morning';
  }
  if (hours < 17) {
    return 'Good Afternoon';
  }
  return 'Good Evening';
}

export const supportedCurrencies = [
  { code: 'PKR', symbol: 'PKR', name: 'Pakistani Rupee', country: 'Pakistan', flag: '🇵🇰' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', country: 'India', flag: '🇮🇳' },
  { code: 'USD', symbol: '$', name: 'US Dollar', country: 'United States', flag: '🇺🇸' },
  { code: 'EUR', symbol: '€', name: 'Euro', country: 'European Union', flag: '🇪🇺' },
  { code: 'GBP', symbol: '£', name: 'British Pound', country: 'United Kingdom', flag: '🇬🇧' },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham', country: 'United Arab Emirates', flag: '🇦🇪' },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', country: 'Saudi Arabia', flag: '🇸🇦' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', country: 'Bangladesh', flag: '🇧🇩' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', country: 'Japan', flag: '🇯🇵' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', country: 'China', flag: '🇨🇳' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', country: 'Malaysia', flag: '🇲🇾' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', country: 'Indonesia', flag: '🇮🇩' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', country: 'Turkey', flag: '🇹🇷' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', country: 'Canada', flag: '🇨🇦' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar', country: 'Australia', flag: '🇦🇺' }
];

export const currencyMap = Object.fromEntries(
  supportedCurrencies.map((c) => [c.code, c])
);

let currentGlobalCurrency = 'PKR';

export function setGlobalCurrency(currency) {
  if (currency && typeof currency === 'string') {
    currentGlobalCurrency = currency.toUpperCase();
  }
}

export function getGlobalCurrency() {
  return currentGlobalCurrency;
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

export function formatCurrency(value, currency) {
  const numericValue = Number(value || 0);
  const activeCurrency = (currency || currentGlobalCurrency || 'PKR').toUpperCase();
  const meta = currencyMap[activeCurrency] || { symbol: activeCurrency };

  const formatted = new Intl.NumberFormat('en-PK', {
    maximumFractionDigits: 2
  }).format(numericValue);

  return `${meta.symbol} ${formatted}`;
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

export function calculateHomeDisplayBudget(budgetHistory = [], budgets = [], remainingBudget = null) {
  const sortedEntries = [...budgetHistory]
    .filter((entry) => entry && entry.amount !== null && entry.amount !== undefined && !isNaN(Number(entry.amount)))
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(`${a.date}T12:00:00`).getTime() : 0);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(`${b.date}T12:00:00`).getTime() : 0);
      return timeB - timeA;
    });

  if (sortedEntries.length === 0) {
    const hasOverall = budgets.some((b) => b.categoryId === 'overall');
    if (!hasOverall) return null;
    const overallBudget = budgets.find((b) => b.id === 'budget-all-overall' || b.categoryId === 'overall');
    return overallBudget ? fromPaisa(Number(overallBudget.amount || 0)) : null;
  }

  // 1. Start with the latest budget
  const latestAmount = fromPaisa(Number(sortedEntries[0].amount || 0));
  let effectiveBudget = latestAmount;

  // 2. If remaining budget is not set or <= latest budget, return latest updated budget
  if (remainingBudget === null || remainingBudget === undefined || remainingBudget <= effectiveBudget) {
    return effectiveBudget;
  }

  // 3. If remaining budget is greater than latest budget, add 2nd last, 3rd last, etc.
  for (let i = 1; i < sortedEntries.length; i++) {
    const prevAmount = fromPaisa(Number(sortedEntries[i].amount || 0));
    effectiveBudget += prevAmount;
    if (effectiveBudget >= remainingBudget) {
      break;
    }
  }

  // Ensure budget is always greater than or equal to remaining budget
  if (effectiveBudget < remainingBudget) {
    effectiveBudget = Math.max(effectiveBudget, remainingBudget);
  }

  return effectiveBudget;
}

export function calculateFinanceDashboard({
  budgetHistory = [],
  budgets = [],
  transactions = [],
  currentDate = new Date()
} = {}) {
  const dateObj = currentDate instanceof Date ? currentDate : new Date(currentDate);
  const currentMonth = !Number.isNaN(dateObj.getTime())
    ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
    : getLocalDateString().slice(0, 7);

  // 1. Monthly expenses: strictly according to month (resets on 1st of every month)
  const monthlyExpense = transactions
    .filter((tx) => tx.type === 'expense' && tx.date?.startsWith(currentMonth))
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  // 2. Budget history sorted newest first
  const sortedEntries = [...budgetHistory]
    .filter((entry) => entry && entry.amount !== null && entry.amount !== undefined && !isNaN(Number(entry.amount)))
    .sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (a.date ? new Date(`${a.date}T12:00:00`).getTime() : 0);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (b.date ? new Date(`${b.date}T12:00:00`).getTime() : 0);
      return timeB - timeA;
    });

  const hasOverallBudget = budgets.some((b) => b.categoryId === 'overall') || sortedEntries.length > 0;
  if (!hasOverallBudget && sortedEntries.length === 0) {
    return {
      displayedBudget: null,
      remainingBudget: null,
      monthlyExpense
    };
  }

  if (sortedEntries.length === 0) {
    const overallBudget = budgets.find((b) => b.id === 'budget-all-overall' || b.categoryId === 'overall');
    const budgetAmount = overallBudget ? fromPaisa(Number(overallBudget.amount || 0)) : null;
    return {
      displayedBudget: budgetAmount,
      remainingBudget: budgetAmount === null ? null : budgetAmount - monthlyExpense,
      monthlyExpense
    };
  }

  // Filter entries to current month if any exist; otherwise fall back to all entries
  const currentMonthEntries = sortedEntries.filter((entry) => {
    const entryMonth = entry.month || (entry.date ? entry.date.slice(0, 7) : '');
    return entryMonth === currentMonth;
  });

  const activeEntries = currentMonthEntries.length > 0 ? currentMonthEntries : sortedEntries;

  // Single entry case:
  if (activeEntries.length === 1) {
    const singleBudget = fromPaisa(Number(activeEntries[0].amount || 0));
    return {
      displayedBudget: singleBudget,
      remainingBudget: singleBudget - monthlyExpense,
      monthlyExpense
    };
  }

  // Multiple entries case:
  // Latest budget is activeEntries[0]
  const latestBudget = fromPaisa(Number(activeEntries[0].amount || 0));
  let displayedBudget = latestBudget;

  // Calculate prior remaining budget from previous entries if available
  let priorRemaining = 0;
  if (activeEntries.length > 1) {
    const priorDashboard = calculateFinanceDashboard({
      budgetHistory: activeEntries.slice(1),
      budgets,
      transactions,
      currentDate
    });
    priorRemaining = priorDashboard.remainingBudget ?? 0;
  }

  // Target threshold:
  // - If monthlyExpense > displayedBudget, latest budget alone is overspent:
  //   add previous budgets so displayedBudget covers monthlyExpense if possible
  //   (so available section shows the positive amount left behind, not negative if something is still left).
  // - If priorRemaining > latestBudget, previous remaining balance was higher than latest budget:
  //   add previous budgets so displayedBudget >= priorRemaining.
  const targetThreshold = Math.max(
    monthlyExpense,
    priorRemaining > 0 ? priorRemaining : 0
  );

  if (targetThreshold > displayedBudget) {
    for (let i = 1; i < activeEntries.length; i++) {
      const prevAmount = fromPaisa(Number(activeEntries[i].amount || 0));
      displayedBudget += prevAmount;
      if (displayedBudget >= targetThreshold) {
        break;
      }
    }
    if (priorRemaining > 0 && displayedBudget < priorRemaining) {
      displayedBudget = priorRemaining;
    }
  }

  // Available balance is the amount left behind of the latest budget/s
  const remainingBudget = displayedBudget - monthlyExpense;

  return {
    displayedBudget,
    remainingBudget,
    monthlyExpense
  };
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

function validatePreferences(preferences, validateSyncId = () => {}) {
  if (!Array.isArray(preferences) || !preferences.length) {
    throw new Error('Backup preferences are missing.');
  }

  const ids = new Set();
  for (const preference of preferences) {
    if (!isRecord(preference) || typeof preference.id !== 'string' || !preference.id.trim() || ids.has(preference.id)) {
      throw new Error('Backup preferences contain an invalid ID.');
    }
    ids.add(preference.id);
    validateSyncId(preference, 'preferences');
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
  if (!isRecord(backup) || ![1, 2, 3, 4].includes(backup.version)) {
    throw new Error('Unsupported backup format or version.');
  }
  const isCurrentVersion = backup.version === 3 || backup.version === 4;
  const hasSyncIdentity = backup.version === 4;
  const syncIds = new Set();
  const validateSyncId = (record, collection) => {
    if (!hasSyncIdentity) return;
    if (!isSyncId(record.syncId)) {
      throw new Error(`Backup ${collection} contain an invalid sync ID.`);
    }
    if (syncIds.has(record.syncId)) {
      throw new Error(`Backup contains duplicate sync IDs.`);
    }
    syncIds.add(record.syncId);
  };
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
    validateSyncId(category, 'categories');
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
    validateSyncId(method, 'payment methods');
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
        (typeof transaction.paymentMethodId !== 'string' || !transaction.paymentMethodId.trim())) ||
      (hasSyncIdentity && (
        (transaction.categorySyncId !== undefined && transaction.categorySyncId !== null && !isSyncId(transaction.categorySyncId)) ||
        (transaction.paymentMethodSyncId !== undefined && transaction.paymentMethodSyncId !== null && !isSyncId(transaction.paymentMethodSyncId))
      ))
    ) {
      throw new Error('Backup transactions contain an invalid record.');
    }
    validateSyncId(transaction, 'transactions');
    if (transaction.id !== undefined) {
      if (transactionIds.has(transaction.id)) throw new Error('Backup transaction IDs are duplicated.');
      transactionIds.add(transaction.id);
    }
    if (transaction.type === 'income') continue;
    if (!expenseCategoryIds.has(transaction.categoryId)) {
      if (!hasSyncIdentity) {
        throw new Error(`Transaction references missing category "${transaction.categoryId}".`);
      }
      warnings.push(`Transaction ${transaction.id ?? '(no ID)'} references missing category "${transaction.categoryId}".`);
    }

    let paymentMethodId = transaction.paymentMethodId;
    if (!paymentMethodId) {
      paymentMethodId = 'pm-other';
      missingMethodCount += 1;
    } else if (!paymentMethodIds.has(paymentMethodId)) {
      if (hasSyncIdentity) {
        warnings.push(`Transaction ${transaction.id ?? '(no ID)'} references missing payment method "${paymentMethodId}".`);
      } else {
        paymentMethods.push({
          id: paymentMethodId,
          name: `Recovered method (${paymentMethodId})`
        });
        paymentMethodIds.add(paymentMethodId);
        recoveredMethodCount += 1;
      }
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
      budget.amount < 0 ||
      (hasSyncIdentity && budget.categorySyncId !== undefined && budget.categorySyncId !== null && !isSyncId(budget.categorySyncId))
    ) {
      if (
        hasSyncIdentity &&
        isRecord(budget) &&
        typeof budget.id === 'string' &&
        budget.id.trim() &&
        typeof budget.categoryId === 'string' &&
        budget.categoryId !== 'overall' &&
        !expenseCategoryIds.has(budget.categoryId) &&
        (budget.month === 'all' || isValidMonthString(budget.month)) &&
        typeof budget.amount === 'number' &&
        Number.isSafeInteger(budget.amount) &&
        budget.amount >= 0 &&
        (budget.categorySyncId === undefined || budget.categorySyncId === null || isSyncId(budget.categorySyncId))
      ) {
        warnings.push(`Budget "${budget.id}" references missing category "${budget.categoryId}".`);
      } else {
        throw new Error('Backup budgets contain an invalid record.');
      }
    }
    budgetIds.add(budget.id);
    validateSyncId(budget, 'budgets');
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
        (!hasSyncIdentity && entry.categoryId !== 'overall' && !expenseCategoryIds.has(entry.categoryId))
      )) ||
      (hasSyncIdentity && entry.categorySyncId !== undefined && entry.categorySyncId !== null && !isSyncId(entry.categorySyncId)) ||
      (entry.budgetCategory !== undefined && typeof entry.budgetCategory !== 'string') ||
      (entry.description !== undefined && typeof entry.description !== 'string') ||
      !validHistoryAmount(entry.previousAmount) ||
      !validHistoryAmount(entry.amount) ||
      (entry.entryType !== undefined && typeof entry.entryType !== 'string')
    ) {
      throw new Error('Backup budget history contains an invalid record.');
    }
    if (entry.id !== undefined) historyIds.add(entry.id);
    validateSyncId(entry, 'budget history');
    if (
      hasSyncIdentity &&
      entry.categoryId &&
      entry.categoryId !== 'overall' &&
      !expenseCategoryIds.has(entry.categoryId)
    ) {
      warnings.push(`Budget history entry ${entry.id ?? '(no ID)'} references missing category "${entry.categoryId}".`);
    }
    budgetHistory.push({ ...entry });
  }

  let preferences = null;
  if (backup.preferences !== undefined) {
    preferences = validatePreferences(backup.preferences, validateSyncId);
  } else if (isCurrentVersion) {
    throw new Error('Backup preferences are missing.');
  }

  const normalized = {
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
  if (hasSyncIdentity) {
    normalized.syncIdentityReport = getSyncIdentityReport({
      transactions,
      categories,
      paymentMethods,
      budgets,
      budgetHistory,
      preferences: preferences || []
    });
  }
  return normalized;
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
  const data = addSyncIdentities({
    transactions: backup.transactions,
    categories: backup.categories,
    paymentMethods: backup.paymentMethods,
    budgets: backup.budgets,
    budgetHistory: backup.budgetHistory,
    preferences: backup.preferences || []
  });
  const transactionTables = [
    database.transactions,
    database.categories,
    database.paymentMethods,
    database.budgets,
    database.budgetHistory,
    database.preferences,
    database.syncOutbox,
    database.syncMetadata,
    database.syncEntityState
  ].filter(Boolean);
  await database.transaction('rw', ...transactionTables, async () => {
      const before = database.syncOutbox ? Object.fromEntries(await Promise.all([
        'transactions', 'categories', 'paymentMethods', 'budgets', 'budgetHistory', 'preferences'
      ].map(async (store) => [store, await database[store].toArray()]))) : null;
      await database.transactions.clear();
      await database.categories.clear();
      await database.paymentMethods.clear();
      await database.budgets.clear();
      await database.budgetHistory.clear();
      if (backup.preferences) await database.preferences.clear();

      if (data.transactions.length) await database.transactions.bulkPut(data.transactions);
      if (data.categories.length) await database.categories.bulkPut(data.categories);
      if (data.paymentMethods.length) await database.paymentMethods.bulkPut(data.paymentMethods);
      if (data.budgets.length) await database.budgets.bulkPut(data.budgets);
      if (data.budgetHistory.length) await database.budgetHistory.bulkPut(data.budgetHistory);
      if (backup.preferences && data.preferences.length) await database.preferences.bulkPut(data.preferences);
      if (database.syncOutbox) {
        const after = Object.fromEntries(await Promise.all([
          'transactions', 'categories', 'paymentMethods', 'budgets', 'budgetHistory', 'preferences'
        ].map(async (store) => [store, await database[store].toArray()])));
        await enqueueRestoreDiff(database, before, after);
      }
    });
  return data.syncIdentityReport;
}

export function buildBackupPayload(data) {
  if (
    !isRecord(data) ||
    backupCollectionNames.some((collection) => !Array.isArray(data[collection])) ||
    !data.preferences.some((preference) => isRecord(preference) && preference.id === 'app')
  ) {
    throw new Error('A complete backup requires every data collection and app preferences.');
  }
  const identityReport = getSyncIdentityReport(data);
  if (identityReport.duplicateSyncIds.length || identityReport.identityWarnings.some(
    (warning) => warning.code === 'missing-or-invalid-sync-id'
  )) {
    throw new Error('Backup data contains invalid sync identities.');
  }
  for (const collection of backupCollectionNames) {
    for (const record of data[collection]) {
      if (!isSyncId(record.syncId)) {
        throw new Error(`Backup collection "${collection}" contains a record without a valid sync ID.`);
      }
    }
  }
  const seenSyncIds = new Set();
  for (const collection of backupCollectionNames) {
    for (const record of data[collection]) {
      if (seenSyncIds.has(record.syncId)) {
        throw new Error('Backup contains duplicate sync IDs.');
      }
      seenSyncIds.add(record.syncId);
    }
  }
  return JSON.stringify({
    ...data,
    version: 4,
    exportedAt: new Date().toISOString()
  }, null, 2);
}

export function filterTransactionsByRange(transactions = [], rangeKey = 'this-month', referenceDate = new Date()) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const currentMonthStr = getLocalDateString(ref).slice(0, 7);

  if (rangeKey === 'all-time') {
    return [...transactions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  if (rangeKey === 'this-month') {
    return transactions
      .filter((tx) => tx.date?.startsWith(currentMonthStr))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  if (rangeKey === 'last-month') {
    const prevDate = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
    const prevMonthStr = getLocalDateString(prevDate).slice(0, 7);
    return transactions
      .filter((tx) => tx.date?.startsWith(prevMonthStr))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  const monthsBack = rangeKey === '3-months' ? 3 : rangeKey === '6-months' ? 6 : 1;
  const cutoffDate = new Date(ref.getFullYear(), ref.getMonth() - (monthsBack - 1), 1);
  const cutoffStr = getLocalDateString(cutoffDate).slice(0, 7);

  return transactions
    .filter((tx) => (tx.date || '').slice(0, 7) >= cutoffStr && (tx.date || '').slice(0, 7) <= currentMonthStr)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

export function calculateSpendingVelocity({
  transactions = [],
  monthlyExpense = 0,
  overallBudget = null,
  referenceDate = new Date()
}) {
  const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const dayOfMonth = Math.max(1, ref.getDate());
  const daysInMonth = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const daysRemaining = Math.max(0, daysInMonth - dayOfMonth);

  const totalExpense = monthlyExpense > 0
    ? monthlyExpense
    : calculateExpenseTotal(transactions, getLocalDateString(ref).slice(0, 7));

  const dailyAverage = totalExpense / dayOfMonth;
  const projectedTotal = totalExpense + (dailyAverage * daysRemaining);
  const remainingBudget = overallBudget !== null && overallBudget > 0
    ? Math.max(0, overallBudget - totalExpense)
    : 0;
  const safeDailyLimit = daysRemaining > 0 ? remainingBudget / daysRemaining : 0;

  if (overallBudget !== null && overallBudget > 0) {
    const dailyBudgetRunRate = overallBudget / daysInMonth;
    const velocityRatio = dailyBudgetRunRate > 0 ? dailyAverage / dailyBudgetRunRate : 1;
    const projectedRemaining = overallBudget - projectedTotal;

    if (totalExpense > overallBudget) {
      return {
        dailyAverage,
        projectedTotal,
        safeDailyLimit: 0,
        daysElapsed: dayOfMonth,
        daysRemaining,
        daysInMonth,
        velocityRatio,
        status: 'danger',
        label: 'Over Budget',
        message: `Exceeded by ${formatCurrency(totalExpense - overallBudget)}`
      };
    }

    if (projectedTotal > overallBudget) {
      const isEarlyMonth = dayOfMonth <= 3;
      return {
        dailyAverage,
        projectedTotal,
        safeDailyLimit,
        daysElapsed: dayOfMonth,
        daysRemaining,
        daysInMonth,
        velocityRatio,
        status: 'warning',
        label: 'Pacing High',
        message: isEarlyMonth
          ? `Early pace high. Safe limit: ${formatCurrency(safeDailyLimit)}/day`
          : `May exceed budget by ${formatCurrency(Math.abs(projectedRemaining))}`
      };
    }

    return {
      dailyAverage,
      projectedTotal,
      safeDailyLimit,
      daysElapsed: dayOfMonth,
      daysRemaining,
      daysInMonth,
      velocityRatio,
      status: 'good',
      label: 'On Track',
      message: `Projected ${formatCurrency(projectedTotal)} (${Math.round((projectedTotal / overallBudget) * 100)}% of budget)`
    };
  }

  return {
    dailyAverage,
    projectedTotal,
    safeDailyLimit: null,
    daysElapsed: dayOfMonth,
    daysRemaining,
    daysInMonth,
    velocityRatio: 1,
    status: 'neutral',
    label: 'Daily Pace',
    message: `Average ${formatCurrency(dailyAverage)} / day`
  };
}

export function calculateWeekdayWeekendSplit(transactions = []) {
  let weekdayTotal = 0;
  let weekendTotal = 0;
  let weekdayCount = 0;
  let weekendCount = 0;
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];

  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.date) continue;
    const dateObj = new Date(`${tx.date}T00:00:00`);
    if (Number.isNaN(dateObj.getTime())) continue;
    const day = dateObj.getDay();
    const amount = Number(tx.amount || 0);

    dayTotals[day] += amount;

    if (day === 0 || day === 6) {
      weekendTotal += amount;
      weekendCount += 1;
    } else {
      weekdayTotal += amount;
      weekdayCount += 1;
    }
  }

  const grandTotal = weekdayTotal + weekendTotal;
  let peakDayIndex = 0;
  let maxDayTotal = 0;
  for (let i = 0; i < 7; i++) {
    if (dayTotals[i] > maxDayTotal) {
      maxDayTotal = dayTotals[i];
      peakDayIndex = i;
    }
  }
  const peakDay = maxDayTotal > 0 ? { name: dayNames[peakDayIndex], amount: maxDayTotal } : null;

  return {
    weekdayTotal,
    weekendTotal,
    grandTotal,
    weekdayPercent: grandTotal > 0 ? (weekdayTotal / grandTotal) * 100 : 0,
    weekendPercent: grandTotal > 0 ? (weekendTotal / grandTotal) * 100 : 0,
    weekdayCount,
    weekendCount,
    peakDay
  };
}

export function calculateCategorySurge(
  transactions = [],
  currentMonth,
  previousMonth,
  categoryMap = {}
) {
  if (!currentMonth || !previousMonth) return null;

  const currentTotals = calculateCategoryExpenseTotals(transactions, currentMonth);
  const previousTotals = calculateCategoryExpenseTotals(transactions, previousMonth);

  let largestSurge = null;

  for (const [catId, currentAmt] of Object.entries(currentTotals)) {
    const prevAmt = previousTotals[catId] || 0;
    const diff = currentAmt - prevAmt;
    if (diff > 0 && currentAmt >= 500) {
      const isNew = prevAmt === 0;
      const percentIncrease = prevAmt > 0 ? (diff / prevAmt) * 100 : 100;
      if (!largestSurge || diff > largestSurge.diffAmount) {
        largestSurge = {
          categoryId: catId,
          categoryName: categoryMap[catId]?.name || 'Category',
          currentAmount: currentAmt,
          previousAmount: prevAmt,
          percentChange: percentIncrease,
          diffAmount: diff,
          isNew
        };
      }
    }
  }

  return largestSurge;
}

export function calculateFinancialHealthScore({
  totalSpent = 0,
  overallBudget = 0,
  daysElapsed = 1,
  daysInMonth = 30
}) {
  if (!overallBudget || overallBudget <= 0) {
    return { score: null, rating: 'No Budget Set', label: 'Set Budget' };
  }

  if (totalSpent > overallBudget) {
    const overPercent = ((totalSpent - overallBudget) / overallBudget) * 100;
    const score = Math.max(15, Math.round(50 - overPercent * 0.8));
    return { score, rating: 'Attention Needed' };
  }

  const timeElapsedRatio = daysElapsed / daysInMonth;
  const budgetSpentRatio = totalSpent / overallBudget;

  if (budgetSpentRatio <= timeElapsedRatio) {
    // Spending slower than or equal to time elapsed: High Score (80-100)
    const bonus = (timeElapsedRatio - budgetSpentRatio) * 30;
    const score = Math.min(100, Math.round(82 + bonus));
    return { score, rating: score >= 90 ? 'Excellent' : 'Good' };
  }

  // Spending faster than time elapsed: Moderate Score (50-79)
  const penalty = (budgetSpentRatio - timeElapsedRatio) * 60;
  const score = Math.max(45, Math.round(78 - penalty));
  return { score, rating: score >= 65 ? 'Good' : 'Fair' };
}

export function calculateAnalyticsOverview(transactions = [], {
  currentMonth = '',
  categoryMap = {},
  paymentMap = {}
} = {}) {
  let totalExpense = 0;
  let totalIncome = 0;
  let currentMonthExpense = 0;
  const categoryTotals = {};
  const paymentTotals = {};

  for (const tx of transactions) {
    const amount = Number(tx.amount || 0);
    if (tx.type === 'expense') {
      totalExpense += amount;
      if (currentMonth && tx.date?.startsWith(currentMonth)) {
        currentMonthExpense += amount;
        const catId = tx.categoryId || 'cat-other';
        categoryTotals[catId] = (categoryTotals[catId] || 0) + amount;
        const pmId = tx.paymentMethodId || 'pm-other';
        paymentTotals[pmId] = (paymentTotals[pmId] || 0) + amount;
      }
    } else if (tx.type === 'income') {
      totalIncome += amount;
    }
  }

  return {
    totalExpense,
    totalIncome,
    currentMonthExpense,
    categoryTotals,
    paymentTotals
  };
}
