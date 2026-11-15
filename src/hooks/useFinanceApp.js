import { useEffect, useMemo, useRef, useState } from 'react';
import { financeRepository } from '../services/financeRepository';
import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';
import {
  buildMonthlyBudgetTrend,
  buildMonthlyExpenseTrend,
  buildWeeklyBudgetTrend,
  calculateCumulativeBudgetTotal,
  calculateCategoryExpenseTotals,
  calculateExpenseTotal,
  dateFormatOptions,
  formatDate,
  fromPaisa,
  getLocalDateString,
  parseBackupPayload,
  setGlobalCurrency,
  toPaisa,
  validateTransaction
} from '../lib/finance';

export const navItems = ['home', 'transactions', 'analytics', 'budget'];
export const budgetCategories = ['Salary', 'Freelance', 'Other'];
export const defaultBudgetTypes = [
  { id: 'bt-salary', name: 'Salary' },
  { id: 'bt-freelance', name: 'Freelance' },
  { id: 'bt-business', name: 'Business' },
  { id: 'bt-investment', name: 'Investment' },
  { id: 'bt-other', name: 'Other' }
];

const initialForm = {
  title: '',
  amount: '',
  categoryId: defaultCategories.find((category) => category.name === 'Other')?.id || defaultCategories[0].id,
  paymentMethodId: defaultPaymentMethods.find((method) => method.name === 'Cash')?.id || defaultPaymentMethods[0].id,
  date: getLocalDateString(),
  notes: ''
};

export function useFinanceApp(repository = financeRepository) {
  const [tab, setTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [paymentMethods, setPaymentMethods] = useState(defaultPaymentMethods);
  const [budgets, setBudgets] = useState([]);
  const [budgetForm, setBudgetForm] = useState({
    date: getLocalDateString(),
    budgetCategory: 'Salary',
    amount: '',
    description: ''
  });
  const [editingBudgetHistoryId, setEditingBudgetHistoryId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [categoryInput, setCategoryInput] = useState('');
  const [methodInput, setMethodInput] = useState('');
  const [preferences, setPreferences] = useState(null);
  const [preferenceDateFormatDraft, setPreferenceDateFormatDraft] = useState('DD MMM YYYY');
  const [preferenceNotificationsDraft, setPreferenceNotificationsDraft] = useState(false);
  const [preferenceSaveStatus, setPreferenceSaveStatus] = useState({ type: 'idle', message: '' });
  const [onboardingName, setOnboardingName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [focusBudgetAnalysis, setFocusBudgetAnalysis] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [categoryEditStatus, setCategoryEditStatus] = useState({ type: 'idle', message: '' });
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(null);
  const [paymentMethodNameDraft, setPaymentMethodNameDraft] = useState('');
  const [paymentMethodEditStatus, setPaymentMethodEditStatus] = useState({ type: 'idle', message: '' });
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState(null);
  const [showAddPaymentMethodForm, setShowAddPaymentMethodForm] = useState(false);
  const [budgetTypes, setBudgetTypes] = useState(defaultBudgetTypes);
  const [selectedBudgetTypeId, setSelectedBudgetTypeId] = useState(defaultBudgetTypes[0].id);
  const [budgetTypeNameDraft, setBudgetTypeNameDraft] = useState(defaultBudgetTypes[0].name);
  const [budgetTypeEditStatus, setBudgetTypeEditStatus] = useState({ type: 'idle', message: '' });
  const [budgetTypeInput, setBudgetTypeInput] = useState('');
  const [budgetTypeToDelete, setBudgetTypeToDelete] = useState(null);
  const [restoreCandidate, setRestoreCandidate] = useState(null);
  const [migrationReport, setMigrationReport] = useState(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [isPreparingRestore, setIsPreparingRestore] = useState(false);
  const fileInputRef = useRef(null);
  const budgetFormRef = useRef(null);
  const budgetAnalysisRef = useRef(null);

  const categoryMap = useMemo(
    () => Object.fromEntries(categories.map((category) => [category.id, category])),
    [categories]
  );

  const paymentMap = useMemo(
    () => Object.fromEntries(paymentMethods.map((method) => [method.id, method])),
    [paymentMethods]
  );

  const monthlyExpense = useMemo(
    () => calculateExpenseTotal(transactions, getLocalDateString().slice(0, 7)),
    [transactions]
  );

  const totalBudgetPaisa = useMemo(() => {
    return calculateCumulativeBudgetTotal(budgets, budgetHistory);
  }, [budgets, budgetHistory]);

  const filteredTransactions = useMemo(
    () => [...transactions].filter((tx) => tx.type === 'expense').sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [transactions]
  );

  const transactionHistory = useMemo(() => [
    ...filteredTransactions.map((transaction) => ({ ...transaction, historyType: 'expense' })),
    ...budgetHistory.map((entry) => ({ ...entry, historyType: 'budget' }))
  ].sort((a, b) => (
    String(b.date || '').localeCompare(String(a.date || '')) ||
    String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
  )), [filteredTransactions, budgetHistory]);

  const weeklySpending = useMemo(() => {
    return buildWeeklyBudgetTrend(
      transactions,
      budgets.some((budget) => budget.categoryId === 'overall') ? fromPaisa(totalBudgetPaisa) : null
    );
  }, [transactions, budgets, totalBudgetPaisa]);

  const categoryTotals = useMemo(() => {
    const totalsByCategory = calculateCategoryExpenseTotals(transactions, getLocalDateString().slice(0, 7));
    return Object.entries(totalsByCategory)
      .map(([categoryId, total]) => [categoryMap[categoryId]?.name || 'Unknown', total])
      .sort((a, b) => b[1] - a[1]);
  }, [transactions, categoryMap]);

  const paymentMethodTotals = useMemo(() => {
    const totals = transactions.reduce((result, transaction) => {
      if (!transaction.date?.startsWith(getLocalDateString().slice(0, 7))) return result;
      const methodId = transaction.paymentMethodId || 'unknown';
      result[methodId] = (result[methodId] || 0) + Number(transaction.amount || 0);
      return result;
    }, {});
    return Object.entries(totals)
      .map(([methodId, amount]) => ({
        label: paymentMap[methodId]?.name || 'Unknown',
        amount
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, paymentMap]);

  const monthlyExpenseTrend = useMemo(
    () => buildMonthlyExpenseTrend(transactions, 6),
    [transactions]
  );

  const monthlyBudgetTrend = useMemo(
    () => buildMonthlyBudgetTrend(transactions, budgets, budgetHistory, 6),
    [transactions, budgets, budgetHistory]
  );

  const loadData = async () => {
    try {
      const {
        transactions: allTx,
        categories: allCategories,
        paymentMethods: allMethods,
        budgets: allBudgets,
        budgetHistory: allBudgetHistory,
        preferences: appPreferences
      } = await repository.loadData();

      setTransactions(allTx.filter((tx) => tx.type === 'expense').map((tx) => ({ ...tx, amount: fromPaisa(Number(tx.amount || 0)) })));
      setBudgetHistory(allBudgetHistory);
      setCategories(allCategories.filter((category) => category.type === 'expense'));
      setPaymentMethods(allMethods.length ? allMethods : defaultPaymentMethods);
      if (Array.isArray(appPreferences?.budgetTypes) && appPreferences.budgetTypes.length > 0) {
        setBudgetTypes(appPreferences.budgetTypes);
        const defId = appPreferences.defaultBudgetTypeId || appPreferences.budgetTypes[0].id;
        setSelectedBudgetTypeId(defId);
        const defItem = appPreferences.budgetTypes.find((b) => b.id === defId) || appPreferences.budgetTypes[0];
        setBudgetTypeNameDraft(defItem.name);
      }
      setBudgets(allBudgets);
      const loadedPrefs = {
        id: 'app',
        currency: 'PKR',
        lightMode: true,
        dateFormat: 'DD MMM YYYY',
        notificationsEnabled: false,
        ...(appPreferences || {}),
        dateFormat: dateFormatOptions.includes(appPreferences?.dateFormat)
          ? appPreferences.dateFormat
          : 'DD MMM YYYY',
        notificationsEnabled: Boolean(appPreferences?.notificationsEnabled)
      };
      setPreferences(loadedPrefs);
      setGlobalCurrency(loadedPrefs.currency);
      return true;
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to load saved data.' });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (tab !== 'analytics' || !focusBudgetAnalysis) return;
    budgetAnalysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocusBudgetAnalysis(false);
  }, [tab, focusBudgetAnalysis]);

  const handleContinueOnboarding = async () => {
    const nextPreferences = {
      ...(preferences || { id: 'app', currency: 'PKR', lightMode: true }),
      name: onboardingName.trim(),
      onboardingCompleted: true
    };

    setIsLoading(true);
    try {
      await Promise.all([
        repository.savePreferences(nextPreferences),
        new Promise((resolve) => window.setTimeout(resolve, 1150))
      ]);
      setPreferences(nextPreferences);
    } catch (error) {
      setStatus({ type: 'error', message: 'Could not save setup. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const openPreferences = () => {
    setPreferenceDateFormatDraft(preferences?.dateFormat || 'DD MMM YYYY');
    setPreferenceNotificationsDraft(Boolean(preferences?.notificationsEnabled));
    setPreferenceSaveStatus({ type: 'idle', message: '' });
    setTab('preferences');
  };

  const handleSavePreferences = async (event) => {
    event.preventDefault();
    const nextPreferences = {
      ...(preferences || { id: 'app', currency: 'PKR', lightMode: true }),
      dateFormat: preferenceDateFormatDraft,
      notificationsEnabled: preferenceNotificationsDraft
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setPreferenceSaveStatus({ type: 'success', message: 'Preferences saved.' });
    } catch (error) {
      setPreferenceSaveStatus({ type: 'error', message: 'Could not save preferences. Please try again.' });
    }
  };

  const handleSaveCurrency = async (currencyCode) => {
    const nextPreferences = {
      ...(preferences || { id: 'app', lightMode: true, dateFormat: 'DD MMM YYYY' }),
      currency: currencyCode
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setGlobalCurrency(currencyCode);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not save currency preference.' };
    }
  };

  const handleSaveAppearance = async (isLightMode) => {
    const nextPreferences = {
      ...(preferences || { id: 'app', currency: 'PKR', dateFormat: 'DD MMM YYYY' }),
      lightMode: Boolean(isLightMode)
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not save appearance preference.' };
    }
  };

  const handleSaveDateFormat = async (dateFormat) => {
    const nextPreferences = {
      ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
      dateFormat
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setPreferenceDateFormatDraft(dateFormat);
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not save date format.' };
    }
  };

  const handleSaveNotifications = async (enabled) => {
    const nextPreferences = {
      ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
      notificationsEnabled: Boolean(enabled)
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setPreferenceNotificationsDraft(Boolean(enabled));
      return { success: true };
    } catch (error) {
      return { success: false, error: 'Could not save notification settings.' };
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setStatus({ type: 'idle', message: '' });
  };

  const handleBudgetFormChange = (event) => {
    const { name, value } = event.target;
    setBudgetForm((current) => ({ ...current, [name]: value }));
    setStatus({ type: 'idle', message: '' });
  };

  const handleSaveBudget = async (event) => {
    event.preventDefault();
    const { date, budgetCategory, amount, description } = budgetForm;
    const numericAmount = Number(amount);
    const parsedDate = new Date(`${date}T00:00:00`);
    const amountIsValid = (
      Number.isFinite(numericAmount) &&
      numericAmount > 0 &&
      /^\d+(\.\d{1,2})?$/.test(amount) &&
      Number.isSafeInteger(toPaisa(numericAmount))
    );
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(parsedDate.getTime()) ||
      parsedDate.getFullYear() !== Number(date.slice(0, 4)) ||
      parsedDate.getMonth() + 1 !== Number(date.slice(5, 7)) ||
      parsedDate.getDate() !== Number(date.slice(8, 10)) ||
      !amountIsValid
    ) {
      setStatus({ type: 'error', message: 'Enter a valid date and positive budget amount.' });
      return;
    }

    const month = date.slice(0, 7);
    const paisaAmount = toPaisa(numericAmount);
    const timestamp = new Date();
    try {
      await repository.saveBudgetHistory({
        id: editingBudgetHistoryId,
        month,
        budgetCategory,
        date,
        amount: paisaAmount,
        description,
        timestamp
      });
      await loadData();
      setEditingBudgetHistoryId(null);
      const defaultBudgetType = (preferences?.budgetTypes || budgetTypes).find(
        (b) => b.id === preferences?.defaultBudgetTypeId
      )?.name || budgetTypes[0]?.name || 'Salary';
      setBudgetForm({ date: getLocalDateString(), budgetCategory: defaultBudgetType, amount: '', description: '' });
      setSelectedTransaction(null);
      setStatus({ type: 'success', message: 'Budget saved.' });
      setTab('budget');
    } catch (error) {
      setStatus({ type: 'error', message: 'Could not save budget. Please try again.' });
    }
  };

  const openAddBudget = () => {
    setEditingBudgetHistoryId(null);
    const defaultBudgetType = (preferences?.budgetTypes || budgetTypes).find(
      (b) => b.id === preferences?.defaultBudgetTypeId
    )?.name || budgetTypes[0]?.name || 'Salary';
    setBudgetForm({
      date: getLocalDateString(),
      budgetCategory: defaultBudgetType,
      amount: '',
      description: ''
    });
    setStatus({ type: 'idle', message: '' });
    setTab('add-budget');
  };

  const openBudgetHistoryEditor = (entry) => {
    setEditingBudgetHistoryId(entry.id);
    setBudgetForm({
      date: entry.date,
      budgetCategory: entry.budgetCategory || 'Other',
      amount: entry.amount === null ? '' : String(fromPaisa(entry.amount)),
      description: entry.description || ''
    });
    setStatus({ type: 'idle', message: '' });
    setTab('add-budget');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateTransaction(form);
    if (!validation.isValid) {
      setStatus({ type: 'error', message: validation.errors[0] });
      return;
    }

    const defaultCategoryId = categories.find((category) => category.name === 'Other')?.id || categories[0]?.id || defaultCategories[0].id;
    const defaultPaymentMethodId = paymentMethods.find((method) => method.name === 'Cash')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id;
    const nextPayload = {
      title: form.title.trim(),
      amount: toPaisa(Number(form.amount)),
      type: 'expense',
      categoryId: form.categoryId || defaultCategoryId,
      paymentMethodId: form.paymentMethodId || defaultPaymentMethodId,
      date: form.date,
      notes: form.notes.trim(),
      createdAt: new Date().toISOString()
    };

    await repository.saveTransaction(editingTransactionId, nextPayload);
    setForm({
      ...initialForm,
      categoryId: categories.find((category) => category.name === 'Other')?.id || categories[0]?.id || defaultCategories[0].id,
      paymentMethodId: paymentMethods.find((method) => method.name === 'Cash')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id
    });
    setStatus({ type: 'idle', message: '' });
    setEditingTransactionId(null);
    setSelectedTransaction(null);
    loadData();
    setTab('transactions');
  };

  const handleDelete = async () => {
    if (!selectedTransaction?.id) return;
    await repository.deleteTransactionOrBudgetHistory(selectedTransaction);
    const destination = selectedTransaction.returnTab || 'transactions';
    setShowDeleteConfirm(false);
    setSelectedTransaction(null);
    setStatus({ type: 'idle', message: '' });
    await loadData();
    setTab(destination);
  };

  const handleAddCategory = async () => {
    const trimmed = categoryInput.trim();
    if (!trimmed) {
      setCategoryEditStatus({ type: 'error', message: 'Enter a category name.' });
      return;
    }
    if (categories.some((category) => category.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setCategoryEditStatus({ type: 'error', message: 'A category with this name already exists.' });
      return;
    }

    const category = { id: `cat-${Date.now()}`, name: trimmed, type: 'expense' };
    try {
      await repository.createCategory(category);
      setCategories((current) => [...current, category]);
      setCategoryInput('');
      setShowAddCategoryForm(false);
      setCategoryEditStatus({ type: 'success', message: 'Category added.' });
    } catch (error) {
      setCategoryEditStatus({ type: 'error', message: 'Could not add the category. Please try again.' });
    }
  };

  const handleAddMethod = async () => {
    const trimmed = methodInput.trim();
    if (!trimmed) {
      setPaymentMethodEditStatus({ type: 'error', message: 'Enter a payment method name.' });
      return;
    }
    if (paymentMethods.some((method) => method.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setPaymentMethodEditStatus({ type: 'error', message: 'A payment method with this name already exists.' });
      return;
    }

    const method = {
      id: `pm-${Date.now()}`,
      name: trimmed
    };
    try {
      await repository.createPaymentMethod(method);
      setPaymentMethods((current) => [...current, method].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedPaymentMethodId(method.id);
      setPaymentMethodNameDraft(method.name);
      setMethodInput('');
      setShowAddPaymentMethodForm(false);
      setPaymentMethodEditStatus({ type: 'success', message: 'Payment method added.' });
    } catch (error) {
      setPaymentMethodEditStatus({ type: 'error', message: 'Could not add the payment method. Please try again.' });
    }
  };

  const openAccount = (category = categories[0]) => {
    setSelectedCategoryId(category?.id || null);
    setCategoryNameDraft(category?.name || '');
    setShowAddCategoryForm(false);
    setCategoryEditStatus({ type: 'idle', message: '' });
    setTab('account');
  };

  const openPaymentMethods = (method = paymentMethods[0]) => {
    setSelectedPaymentMethodId(method?.id || null);
    setPaymentMethodNameDraft(method?.name || '');
    setShowAddPaymentMethodForm(false);
    setMethodInput('');
    setPaymentMethodEditStatus({ type: 'idle', message: '' });
    setTab('payment-methods');
  };

  const handleSelectPaymentMethod = (method) => {
    setSelectedPaymentMethodId(method.id);
    setPaymentMethodNameDraft(method.name);
    setPaymentMethodEditStatus({ type: 'idle', message: '' });
  };

  const handleSavePaymentMethod = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const methodName = paymentMethodNameDraft.trim();
    if (!selectedPaymentMethodId || !methodName) {
      setPaymentMethodEditStatus({ type: 'error', message: 'Enter a payment method name before saving.' });
      return;
    }
    if (paymentMethods.some((method) => (
      method.id !== selectedPaymentMethodId &&
      method.name.toLocaleLowerCase() === methodName.toLocaleLowerCase()
    ))) {
      setPaymentMethodEditStatus({ type: 'error', message: 'A payment method with this name already exists.' });
      return;
    }

    try {
      const updated = await repository.updatePaymentMethod(selectedPaymentMethodId, methodName);
      if (!updated) {
        setPaymentMethodEditStatus({ type: 'error', message: 'This payment method no longer exists. Reopen Payment Methods to refresh the list.' });
        return;
      }
      setPaymentMethods((current) => current
        .map((method) => method.id === selectedPaymentMethodId ? { ...method, name: methodName } : method)
        .sort((a, b) => a.name.localeCompare(b.name)));
      setPaymentMethodEditStatus({ type: 'success', message: 'Payment method updated.' });
    } catch (error) {
      setPaymentMethodEditStatus({ type: 'error', message: 'Could not update the payment method. Please try again.' });
    }
  };

  const handleSaveDefaultPaymentMethod = async (paymentMethodId) => {
    const nextPreferences = {
      ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
      defaultPaymentMethodId: paymentMethodId
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setPaymentMethodEditStatus({ type: 'success', message: 'Default payment method updated.' });
      return { success: true };
    } catch (error) {
      setPaymentMethodEditStatus({ type: 'error', message: 'Could not save default payment method.' });
      return { success: false };
    }
  };

  const handleDeletePaymentMethod = async () => {
    if (!paymentMethodToDelete) return;
    if (paymentMethods.length <= 1) {
      setPaymentMethodEditStatus({ type: 'error', message: 'At least one payment method must remain.' });
      setPaymentMethodToDelete(null);
      return;
    }

    try {
      const isInUse = !await repository.deletePaymentMethod(paymentMethodToDelete.id);

      if (isInUse) {
        setPaymentMethodEditStatus({
          type: 'error',
          message: 'This payment method is used by existing transactions and cannot be removed.'
        });
        setPaymentMethodToDelete(null);
        return;
      }

      const remainingMethods = paymentMethods.filter((method) => method.id !== paymentMethodToDelete.id);
      setPaymentMethods(remainingMethods);
      if (selectedPaymentMethodId === paymentMethodToDelete.id) {
        const nextMethod = remainingMethods[0];
        setSelectedPaymentMethodId(nextMethod?.id || null);
        setPaymentMethodNameDraft(nextMethod?.name || '');
      }
      setPaymentMethodEditStatus({ type: 'success', message: 'Payment method removed.' });
      setPaymentMethodToDelete(null);
    } catch (error) {
      setPaymentMethodEditStatus({ type: 'error', message: 'Could not remove the payment method. Please try again.' });
      setPaymentMethodToDelete(null);
    }
  };

  const handleSelectCategory = (category) => {
    setSelectedCategoryId(category.id);
    setCategoryNameDraft(category.name);
    setCategoryEditStatus({ type: 'idle', message: '' });
  };

  const handleSaveCategory = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const categoryName = categoryNameDraft.trim();
    if (!selectedCategoryId || !categoryName) {
      setCategoryEditStatus({ type: 'error', message: 'Enter a category name before saving.' });
      return;
    }
    if (categories.some((category) => (
      category.id !== selectedCategoryId &&
      category.name.toLocaleLowerCase() === categoryName.toLocaleLowerCase()
    ))) {
      setCategoryEditStatus({ type: 'error', message: 'A category with this name already exists.' });
      return;
    }

    try {
      const updated = await repository.updateCategory(selectedCategoryId, categoryName);
      if (!updated) {
        setCategoryEditStatus({ type: 'error', message: 'This category no longer exists. Reopen Categories to refresh the list.' });
        return;
      }
      setCategories((current) => current.map((category) => (
        category.id === selectedCategoryId ? { ...category, name: categoryName } : category
      )));
      setCategoryEditStatus({ type: 'success', message: 'Category updated.' });
    } catch (error) {
      setCategoryEditStatus({ type: 'error', message: 'Could not update the category. Please try again.' });
    }
  };

  const handleSaveDefaultCategory = async (categoryId) => {
    const nextPreferences = {
      ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
      defaultCategoryId: categoryId
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setCategoryEditStatus({ type: 'success', message: 'Default category updated.' });
      return { success: true };
    } catch (error) {
      setCategoryEditStatus({ type: 'error', message: 'Could not save default category.' });
      return { success: false };
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    if (categories.length <= 1) {
      setCategoryEditStatus({ type: 'error', message: 'At least one category must remain.' });
      setCategoryToDelete(null);
      return;
    }

    try {
      const isInUse = !await repository.deleteCategory(categoryToDelete.id);

      if (isInUse) {
        setCategoryEditStatus({
          type: 'error',
          message: 'This category is used by existing records and cannot be removed.'
        });
        setCategoryToDelete(null);
        return;
      }

      const remainingCategories = categories.filter((category) => category.id !== categoryToDelete.id);
      setCategories(remainingCategories);
      if (selectedCategoryId === categoryToDelete.id) {
        const nextCategory = remainingCategories[0];
        setSelectedCategoryId(nextCategory?.id || null);
        setCategoryNameDraft(nextCategory?.name || '');
      }
      setCategoryEditStatus({ type: 'success', message: 'Category removed.' });
      setCategoryToDelete(null);
    } catch (error) {
      setCategoryEditStatus({ type: 'error', message: 'Could not remove the category. Please try again.' });
      setCategoryToDelete(null);
    }
  };

  const openBudgetTypes = (type = budgetTypes[0]) => {
    setSelectedBudgetTypeId(type?.id || null);
    setBudgetTypeNameDraft(type?.name || '');
    setBudgetTypeInput('');
    setBudgetTypeEditStatus({ type: 'idle', message: '' });
    setTab('budget-types');
  };

  const handleSelectBudgetType = (type) => {
    setSelectedBudgetTypeId(type.id);
    setBudgetTypeNameDraft(type.name);
    setBudgetTypeEditStatus({ type: 'idle', message: '' });
  };

  const handleAddBudgetType = async () => {
    const trimmed = budgetTypeInput.trim();
    if (!trimmed) {
      setBudgetTypeEditStatus({ type: 'error', message: 'Enter a budget type name.' });
      return;
    }
    if (budgetTypes.some((bt) => bt.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setBudgetTypeEditStatus({ type: 'error', message: 'A budget type with this name already exists.' });
      return;
    }

    const newType = {
      id: `bt-${Date.now()}`,
      name: trimmed
    };
    const nextList = [...budgetTypes, newType];
    try {
      const nextPreferences = {
        ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
        budgetTypes: nextList
      };
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setBudgetTypes(nextList);
      setSelectedBudgetTypeId(newType.id);
      setBudgetTypeNameDraft(newType.name);
      setBudgetTypeInput('');
      setBudgetTypeEditStatus({ type: 'success', message: 'Budget type added.' });
    } catch (error) {
      setBudgetTypeEditStatus({ type: 'error', message: 'Could not add budget type. Please try again.' });
    }
  };

  const handleSaveBudgetType = async (event) => {
    if (event?.preventDefault) event.preventDefault();
    const typeName = budgetTypeNameDraft.trim();
    if (!selectedBudgetTypeId || !typeName) {
      setBudgetTypeEditStatus({ type: 'error', message: 'Enter a budget type name before saving.' });
      return;
    }
    if (budgetTypes.some((bt) => (
      bt.id !== selectedBudgetTypeId &&
      bt.name.toLocaleLowerCase() === typeName.toLocaleLowerCase()
    ))) {
      setBudgetTypeEditStatus({ type: 'error', message: 'A budget type with this name already exists.' });
      return;
    }

    const oldItem = budgetTypes.find((bt) => bt.id === selectedBudgetTypeId);
    const oldName = oldItem?.name;
    const nextList = budgetTypes.map((bt) => (
      bt.id === selectedBudgetTypeId ? { ...bt, name: typeName } : bt
    ));
    try {
      const nextPreferences = {
        ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
        budgetTypes: nextList
      };
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setBudgetTypes(nextList);
      if (budgetForm.budgetCategory === oldName) {
        setBudgetForm((current) => ({ ...current, budgetCategory: typeName }));
      }
      setBudgetTypeEditStatus({ type: 'success', message: 'Budget type updated.' });
    } catch (error) {
      setBudgetTypeEditStatus({ type: 'error', message: 'Could not update budget type. Please try again.' });
    }
  };

  const handleSaveDefaultBudgetType = async (budgetTypeId) => {
    const nextPreferences = {
      ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
      defaultBudgetTypeId: budgetTypeId
    };
    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      const chosen = budgetTypes.find((b) => b.id === budgetTypeId);
      if (chosen) {
        setBudgetForm((current) => ({ ...current, budgetCategory: chosen.name }));
      }
      setBudgetTypeEditStatus({ type: 'success', message: 'Default budget type updated.' });
      return { success: true };
    } catch (error) {
      setBudgetTypeEditStatus({ type: 'error', message: 'Could not save default budget type.' });
      return { success: false };
    }
  };

  const handleDeleteBudgetType = async () => {
    if (!budgetTypeToDelete) return;
    if (budgetTypes.length <= 1) {
      setBudgetTypeEditStatus({ type: 'error', message: 'At least one budget type must remain.' });
      setBudgetTypeToDelete(null);
      return;
    }

    const isUsed = budgetHistory.some(
      (entry) => entry.budgetCategory === budgetTypeToDelete.name
    );
    if (isUsed) {
      setBudgetTypeEditStatus({
        type: 'error',
        message: 'This budget type is used by existing budgets and cannot be removed.'
      });
      setBudgetTypeToDelete(null);
      return;
    }

    const nextList = budgetTypes.filter((bt) => bt.id !== budgetTypeToDelete.id);
    const nextPreferences = {
      ...(preferences || { id: 'app', lightMode: true, currency: 'PKR' }),
      budgetTypes: nextList,
      defaultBudgetTypeId: preferences?.defaultBudgetTypeId === budgetTypeToDelete.id
        ? nextList[0].id
        : preferences?.defaultBudgetTypeId
    };

    try {
      await repository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setBudgetTypes(nextList);
      const nextSelected = nextList[0];
      setSelectedBudgetTypeId(nextSelected.id);
      setBudgetTypeNameDraft(nextSelected.name);
      setBudgetTypeToDelete(null);
      setBudgetTypeEditStatus({ type: 'success', message: 'Budget type removed.' });
    } catch (error) {
      setBudgetTypeEditStatus({ type: 'error', message: 'Could not remove budget type. Please try again.' });
      setBudgetTypeToDelete(null);
    }
  };

  // JSON Backup Export (Currently disabled / inactive in UI in favor of PDF Statement)
  // Preserved for backend migration or future data recovery if needed.
  const handleExport = async () => {
    // Disabled in UI
    /*
    try {
      const payload = await repository.exportBackupPayload();
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'pws-v1-backup.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Backup exported' });
    } catch (error) {
      setStatus({ type: 'error', message: 'Could not export your backup. Please try again.' });
    }
    */
  };

  const handleExportPdf = async () => {
    try {
      const { exportFinancialReportPdf } = await import('../services/pdfExport');
      exportFinancialReportPdf({
        transactions,
        budgets,
        totalBudgetPaisa,
        categoryMap,
        paymentMap,
        preferences
      });
      setStatus({ type: 'success', message: 'PDF statement exported successfully.' });
    } catch (error) {
      console.error('Failed to export PDF:', error);
      setStatus({ type: 'error', message: 'Could not export your PDF statement. Please try again.' });
    }
  };

  const handleRestoreFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoreCandidate(null);
    setMigrationReport(null);
    setIsPreparingRestore(true);
    try {
      const text = await file.text();
      const restoreData = parseBackupPayload(text);

      setRestoreCandidate({
        fileName: file.name,
        fileDate: formatDate(new Date(file.lastModified), preferences?.dateFormat),
        backupText: text,
        restoreData
      });
      setShowRestoreConfirm(true);
      setStatus({ type: 'idle', message: '' });
    } catch (error) {
      setStatus({ type: 'error', message: 'The selected file is not a valid PWS backup.' });
    } finally {
      setIsPreparingRestore(false);
      event.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreCandidate) return;
    const { restoreData, backupText } = restoreCandidate;

    try {
      const restoreResult = await repository.restoreBackup(restoreData, {
        replaceExisting: true,
        sourceText: backupText
      });
      setMigrationReport(restoreResult?.migrationVerification || null);
      const refreshed = await loadData();
      if (!refreshed) {
        setStatus({
          type: 'error',
          message: 'Backup was restored, but the app could not reload the data. Restart the app to refresh it.'
        });
        return;
      }
      const notices = [...restoreData.warnings];
      if (restoreData.skippedIncomeCount) {
        notices.push(`${restoreData.skippedIncomeCount} income transaction(s) were not imported.`);
      }
      setStatus({
        type: 'success',
        message: notices.length
          ? `Backup restored. ${notices.join(' ')}`
          : 'Backup restored successfully.'
      });
    } catch (error) {
      setMigrationReport(error?.verificationReport || null);
      setStatus({
        type: 'error',
        message: error?.message || 'Could not restore the selected backup. Your current data was not changed.'
      });
    } finally {
      setShowRestoreConfirm(false);
    }
  };

  const openTransactionDetail = (transaction) => {
    setSelectedTransaction({ ...transaction, returnTab: tab });
    setShowDeleteConfirm(false);
    setTab('transaction-detail');
  };

  const openAddExpense = () => {
    setEditingTransactionId(null);
    setSelectedTransaction(null);
    const expenseCategory = preferences?.defaultCategoryId ||
      categories.find((category) => category.name === 'Other')?.id || categories[0]?.id || defaultCategories[0].id;
    const cashMethod = preferences?.defaultPaymentMethodId ||
      paymentMethods.find((method) => method.name === 'Cash')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id;
    setForm({
      ...initialForm,
      categoryId: expenseCategory,
      paymentMethodId: cashMethod
    });
    setTab('add-transaction');
  };

  const openTransactionEditor = () => {
    if (!selectedTransaction) return;
    setEditingTransactionId(selectedTransaction.id);
    setForm({
      ...initialForm,
      title: selectedTransaction.title || '',
      amount: String(selectedTransaction.amount || ''),
      categoryId: selectedTransaction.categoryId,
      paymentMethodId: selectedTransaction.paymentMethodId,
      date: selectedTransaction.date || getLocalDateString(),
      notes: selectedTransaction.notes || ''
    });
    setTab('add-transaction');
  };

  return {
    tab,
    setTab,
    isLoading,
    setIsLoading,
    preferences,
    setPreferences,
    status,
    setStatus,
    loadData,
    repository,
    onboardingName,
    setOnboardingName,
    handleContinueOnboarding,
    editingTransactionId,
    setEditingTransactionId,
    form,
    setForm,
    handleInputChange,
    handleSubmit,
    categories,
    setCategories,
    paymentMethods,
    setPaymentMethods,
    selectedTransaction,
    setSelectedTransaction,
    categoryMap,
    paymentMap,
    showDeleteConfirm,
    setShowDeleteConfirm,
    openAddBudget,
    openBudgetHistoryEditor,
    openTransactionEditor,
    handleDelete,
    selectedCategoryId,
    setSelectedCategoryId,
    categoryNameDraft,
    setCategoryNameDraft,
    categoryEditStatus,
    setCategoryEditStatus,
    showAddCategoryForm,
    setShowAddCategoryForm,
    categoryInput,
    setCategoryInput,
    categoryToDelete,
    setCategoryToDelete,
    handleSelectCategory,
    handleSaveCategory,
    handleAddCategory,
    handleDeleteCategory,
    selectedPaymentMethodId,
    setSelectedPaymentMethodId,
    paymentMethodNameDraft,
    setPaymentMethodNameDraft,
    paymentMethodEditStatus,
    setPaymentMethodEditStatus,
    showAddPaymentMethodForm,
    setShowAddPaymentMethodForm,
    methodInput,
    setMethodInput,
    paymentMethodToDelete,
    setPaymentMethodToDelete,
    handleSelectPaymentMethod,
    handleSavePaymentMethod,
    handleAddMethod,
    handleDeletePaymentMethod,
    preferenceDateFormatDraft,
    setPreferenceDateFormatDraft,
    preferenceNotificationsDraft,
    setPreferenceNotificationsDraft,
    preferenceSaveStatus,
    setPreferenceSaveStatus,
    handleSavePreferences,
    handleExport,
    handleExportPdf,
    fileInputRef,
    restoreCandidate,
    setRestoreCandidate,
    migrationReport,
    setMigrationReport,
    showRestoreConfirm,
    setShowRestoreConfirm,
    isPreparingRestore,
    setIsPreparingRestore,
    handleRestoreFileChange,
    handleConfirmRestore,
    focusBudgetAnalysis,
    setFocusBudgetAnalysis,
    budgets,
    setBudgets,
    totalBudgetPaisa,
    transactions,
    setTransactions,
    weeklySpending,
    transactionHistory,
    openAddExpense,
    openTransactionDetail,
    monthlyExpense,
    monthlyExpenseTrend,
    monthlyBudgetTrend,
    categoryTotals,
    paymentMethodTotals,
    budgetAnalysisRef,
    budgetFormRef,
    budgetForm,
    setBudgetForm,
    editingBudgetHistoryId,
    setEditingBudgetHistoryId,
    budgetHistory,
    setBudgetHistory,
    handleBudgetFormChange,
    handleSaveBudget,
    openAccount,
    openPaymentMethods,
    openBudgetTypes,
    openPreferences,
    budgetTypes,
    setBudgetTypes,
    selectedBudgetTypeId,
    setSelectedBudgetTypeId,
    budgetTypeNameDraft,
    setBudgetTypeNameDraft,
    budgetTypeEditStatus,
    setBudgetTypeEditStatus,
    budgetTypeInput,
    setBudgetTypeInput,
    budgetTypeToDelete,
    setBudgetTypeToDelete,
    handleSelectBudgetType,
    handleAddBudgetType,
    handleSaveBudgetType,
    handleSaveDefaultBudgetType,
    handleDeleteBudgetType,
    handleSaveCurrency,
    handleSaveAppearance,
    handleSaveDateFormat,
    handleSaveNotifications,
    handleSaveDefaultCategory,
    handleSaveDefaultPaymentMethod
  };
}
