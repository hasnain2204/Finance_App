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
  toPaisa,
  validateTransaction
} from '../lib/finance';

export const initialForm = {
  title: '',
  amount: '',
  categoryId: defaultCategories.find((category) => category.name === 'Other')?.id || defaultCategories[0].id,
  paymentMethodId: defaultPaymentMethods.find((method) => method.name === 'Cash')?.id || defaultPaymentMethods[0].id,
  date: getLocalDateString(),
  notes: ''
};

export const navItems = ['home', 'transactions', 'analytics', 'budget'];
export const budgetCategories = ['Salary', 'Freelance', 'Other'];

export const statusIdle = () => ({ type: 'idle', message: '' });
export const statusOk = (message) => ({ type: 'success', message });
export const statusErr = (message) => ({ type: 'error', message });

export function createFormChangeHandler(setForm, clearStatus) {
  return (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    clearStatus();
  };
}

export function useFinanceApp() {
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
  const [status, setStatus] = useState(statusIdle());
  const [categoryInput, setCategoryInput] = useState('');
  const [methodInput, setMethodInput] = useState('');
  const [preferences, setPreferences] = useState(null);
  const [preferenceDateFormatDraft, setPreferenceDateFormatDraft] = useState('DD MMM YYYY');
  const [preferenceNotificationsDraft, setPreferenceNotificationsDraft] = useState(false);
  const [preferenceSaveStatus, setPreferenceSaveStatus] = useState(statusIdle());
  const [onboardingName, setOnboardingName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [focusBudgetAnalysis, setFocusBudgetAnalysis] = useState(false);
  const [showAddCategoryForm, setShowAddCategoryForm] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [categoryNameDraft, setCategoryNameDraft] = useState('');
  const [categoryEditStatus, setCategoryEditStatus] = useState(statusIdle());
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState(null);
  const [paymentMethodNameDraft, setPaymentMethodNameDraft] = useState('');
  const [paymentMethodEditStatus, setPaymentMethodEditStatus] = useState(statusIdle());
  const [paymentMethodToDelete, setPaymentMethodToDelete] = useState(null);
  const [showAddPaymentMethodForm, setShowAddPaymentMethodForm] = useState(false);
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
    () => [...transactions].filter((tx) => tx.type === 'expense').sort((a, b) => new Date(b.date) - new Date(a.date)),
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
      } = await financeRepository.loadData();

      setTransactions(allTx.filter((tx) => tx.type === 'expense').map((tx) => ({ ...tx, amount: fromPaisa(Number(tx.amount || 0)) })));
      setBudgetHistory(allBudgetHistory);
      setCategories(allCategories.filter((category) => category.type === 'expense'));
      setPaymentMethods(allMethods.length ? allMethods : defaultPaymentMethods);
      setBudgets(allBudgets);
      setPreferences({
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
      });
      return true;
    } catch (error) {
      setStatus(statusErr('Failed to load saved data.'));
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
      await financeRepository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
    } catch (error) {
      setStatus(statusErr('Could not save setup. Please try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const openPreferences = () => {
    setPreferenceDateFormatDraft(preferences?.dateFormat || 'DD MMM YYYY');
    setPreferenceNotificationsDraft(Boolean(preferences?.notificationsEnabled));
    setPreferenceSaveStatus(statusIdle());
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
      await financeRepository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setPreferenceSaveStatus(statusOk('Preferences saved.'));
    } catch (error) {
      setPreferenceSaveStatus(statusErr('Could not save preferences. Please try again.'));
    }
  };

  const clearStatus = () => setStatus(statusIdle());
  const handleInputChange = createFormChangeHandler(setForm, clearStatus);
  const handleBudgetFormChange = createFormChangeHandler(setBudgetForm, clearStatus);

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
      setStatus(statusErr('Enter a valid date and positive budget amount.'));
      return;
    }

    const month = date.slice(0, 7);
    const paisaAmount = toPaisa(numericAmount);
    const timestamp = new Date();
    try {
      await financeRepository.saveBudgetHistory({
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
      setBudgetForm({ date: getLocalDateString(), budgetCategory: 'Salary', amount: '', description: '' });
      setSelectedTransaction(null);
      setStatus(statusOk('Budget saved.'));
    } catch (error) {
      setStatus(statusErr('Could not save budget. Please try again.'));
    }
  };

  const openBudgetHistoryEditor = (entry) => {
    setEditingBudgetHistoryId(entry.id);
    setBudgetForm({
      date: entry.date,
      budgetCategory: entry.budgetCategory || 'Other',
      amount: entry.amount === null ? '' : String(fromPaisa(entry.amount)),
      description: entry.description || ''
    });
    setStatus(statusIdle());
    setTab('budget');
    requestAnimationFrame(() => {
      budgetFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateTransaction(form);
    if (!validation.isValid) {
      setStatus(statusErr(validation.errors[0]));
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

    await financeRepository.saveTransaction(editingTransactionId, nextPayload);
    setForm({
      ...initialForm,
      categoryId: categories.find((category) => category.name === 'Other')?.id || categories[0]?.id || defaultCategories[0].id,
      paymentMethodId: paymentMethods.find((method) => method.name === 'Cash')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id
    });
    setStatus(statusIdle());
    setEditingTransactionId(null);
    setSelectedTransaction(null);
    loadData();
    setTab('transactions');
  };

  const handleDelete = async () => {
    if (!selectedTransaction?.id) return;
    await financeRepository.deleteTransactionOrBudgetHistory(selectedTransaction);
    const destination = selectedTransaction.returnTab || 'transactions';
    setShowDeleteConfirm(false);
    setSelectedTransaction(null);
    setStatus(statusIdle());
    await loadData();
    setTab(destination);
  };

  const handleAddCategory = async () => {
    const trimmed = categoryInput.trim();
    if (!trimmed) {
      setCategoryEditStatus(statusErr('Enter a category name.'));
      return;
    }
    if (categories.some((category) => category.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setCategoryEditStatus(statusErr('A category with this name already exists.'));
      return;
    }

    const category = { id: `cat-${Date.now()}`, name: trimmed, type: 'expense' };
    try {
      await financeRepository.createCategory(category);
      setCategories((current) => [...current, category]);
      setCategoryInput('');
      setShowAddCategoryForm(false);
      setCategoryEditStatus(statusOk('Category added.'));
    } catch (error) {
      setCategoryEditStatus(statusErr('Could not add the category. Please try again.'));
    }
  };

  const handleAddMethod = async () => {
    const trimmed = methodInput.trim();
    if (!trimmed) {
      setPaymentMethodEditStatus(statusErr('Enter a payment method name.'));
      return;
    }
    if (paymentMethods.some((method) => method.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setPaymentMethodEditStatus(statusErr('A payment method with this name already exists.'));
      return;
    }

    const method = {
      id: `pm-${Date.now()}`,
      name: trimmed
    };
    try {
      await financeRepository.createPaymentMethod(method);
      setPaymentMethods((current) => [...current, method].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedPaymentMethodId(method.id);
      setPaymentMethodNameDraft(method.name);
      setMethodInput('');
      setShowAddPaymentMethodForm(false);
      setPaymentMethodEditStatus(statusOk('Payment method added.'));
    } catch (error) {
      setPaymentMethodEditStatus(statusErr('Could not add the payment method. Please try again.'));
    }
  };

  const openAccount = (category = categories[0]) => {
    setSelectedCategoryId(category?.id || null);
    setCategoryNameDraft(category?.name || '');
    setShowAddCategoryForm(false);
    setCategoryEditStatus(statusIdle());
    setTab('account');
  };

  const openPaymentMethods = (method = paymentMethods[0]) => {
    setSelectedPaymentMethodId(method?.id || null);
    setPaymentMethodNameDraft(method?.name || '');
    setShowAddPaymentMethodForm(false);
    setMethodInput('');
    setPaymentMethodEditStatus(statusIdle());
    setTab('payment-methods');
  };

  const handleSelectPaymentMethod = (method) => {
    setSelectedPaymentMethodId(method.id);
    setPaymentMethodNameDraft(method.name);
    setPaymentMethodEditStatus(statusIdle());
  };

  const handleSavePaymentMethod = async (event) => {
    event.preventDefault();
    const methodName = paymentMethodNameDraft.trim();
    if (!selectedPaymentMethodId || !methodName) {
      setPaymentMethodEditStatus(statusErr('Enter a payment method name before saving.'));
      return;
    }
    if (paymentMethods.some((method) => (
      method.id !== selectedPaymentMethodId &&
      method.name.toLocaleLowerCase() === methodName.toLocaleLowerCase()
    ))) {
      setPaymentMethodEditStatus(statusErr('A payment method with this name already exists.'));
      return;
    }

    try {
      const updated = await financeRepository.updatePaymentMethod(selectedPaymentMethodId, methodName);
      if (!updated) {
        setPaymentMethodEditStatus(statusErr('This payment method no longer exists. Reopen Payment Methods to refresh the list.'));
        return;
      }
      setPaymentMethods((current) => current
        .map((method) => method.id === selectedPaymentMethodId ? { ...method, name: methodName } : method)
        .sort((a, b) => a.name.localeCompare(b.name)));
      setPaymentMethodEditStatus(statusOk('Payment method updated.'));
    } catch (error) {
      setPaymentMethodEditStatus(statusErr('Could not update the payment method. Please try again.'));
    }
  };

  const handleDeletePaymentMethod = async () => {
    if (!paymentMethodToDelete) return;
    if (paymentMethods.length <= 1) {
      setPaymentMethodEditStatus(statusErr('At least one payment method must remain.'));
      setPaymentMethodToDelete(null);
      return;
    }

    try {
      const isInUse = !await financeRepository.deletePaymentMethod(paymentMethodToDelete.id);

      if (isInUse) {
        setPaymentMethodEditStatus(statusErr(
          'This payment method is used by existing transactions and cannot be removed.'
        ));
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
      setPaymentMethodEditStatus(statusOk('Payment method removed.'));
      setPaymentMethodToDelete(null);
    } catch (error) {
      setPaymentMethodEditStatus(statusErr('Could not remove the payment method. Please try again.'));
      setPaymentMethodToDelete(null);
    }
  };

  const handleSelectCategory = (category) => {
    setSelectedCategoryId(category.id);
    setCategoryNameDraft(category.name);
    setCategoryEditStatus(statusIdle());
  };

  const handleSaveCategory = async (event) => {
    event.preventDefault();
    const categoryName = categoryNameDraft.trim();
    if (!selectedCategoryId || !categoryName) {
      setCategoryEditStatus(statusErr('Enter a category name before saving.'));
      return;
    }
    if (categories.some((category) => (
      category.id !== selectedCategoryId &&
      category.name.toLocaleLowerCase() === categoryName.toLocaleLowerCase()
    ))) {
      setCategoryEditStatus(statusErr('A category with this name already exists.'));
      return;
    }

    try {
      const updated = await financeRepository.updateCategory(selectedCategoryId, categoryName);
      if (!updated) {
        setCategoryEditStatus(statusErr('This category no longer exists. Reopen Account to refresh the list.'));
        return;
      }
      setCategories((current) => current.map((category) => (
        category.id === selectedCategoryId ? { ...category, name: categoryName } : category
      )));
      setCategoryEditStatus(statusOk('Category updated.'));
    } catch (error) {
      setCategoryEditStatus(statusErr('Could not update the category. Please try again.'));
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    if (categories.length <= 1) {
      setCategoryEditStatus(statusErr('At least one category must remain.'));
      setCategoryToDelete(null);
      return;
    }

    try {
      const isInUse = !await financeRepository.deleteCategory(categoryToDelete.id);

      if (isInUse) {
        setCategoryEditStatus(statusErr(
          'This category is used by existing records and cannot be removed.'
        ));
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
      setCategoryEditStatus(statusOk('Category removed.'));
      setCategoryToDelete(null);
    } catch (error) {
      setCategoryEditStatus(statusErr('Could not remove the category. Please try again.'));
      setCategoryToDelete(null);
    }
  };

  const handleExport = async () => {
    try {
      const payload = await financeRepository.exportBackupPayload();
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'pws-v1-backup.json';
      anchor.click();
      URL.revokeObjectURL(url);
      setStatus(statusOk('Backup exported'));
    } catch (error) {
      setStatus(statusErr('Could not export your backup. Please try again.'));
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
      setStatus(statusIdle());
    } catch (error) {
      setStatus(statusErr('The selected file is not a valid PWS backup.'));
    } finally {
      setIsPreparingRestore(false);
      event.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!restoreCandidate) return;
    const { restoreData, backupText } = restoreCandidate;

    try {
      const restoreResult = await financeRepository.restoreBackup(restoreData, {
        replaceExisting: true,
        sourceText: backupText
      });
      setMigrationReport(restoreResult?.migrationVerification || null);
      const refreshed = await loadData();
      if (!refreshed) {
        setStatus(statusErr(
          'Backup was restored, but the app could not reload the data. Restart the app to refresh it.'
        ));
        return;
      }
      const notices = [...restoreData.warnings];
      if (restoreData.skippedIncomeCount) {
        notices.push(`${restoreData.skippedIncomeCount} income transaction(s) were not imported.`);
      }
      setStatus(statusOk(notices.length
        ? `Backup restored. ${notices.join(' ')}`
        : 'Backup restored successfully.'
      ));
    } catch (error) {
      setMigrationReport(error?.verificationReport || null);
      setStatus(statusErr(
        error?.message || 'Could not restore the selected backup. Your current data was not changed.'
      ));
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
    const expenseCategory = categories.find((category) => category.name === 'Other')?.id || categories[0]?.id || defaultCategories[0].id;
    const cashMethod = paymentMethods.find((method) => method.name === 'Cash')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id;
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
      date: selectedTransaction.date || new Date().toISOString().slice(0, 10),
      notes: selectedTransaction.notes || ''
    });
    setTab('add-transaction');
  };

  return {
    tab,
    setTab,
    transactions,
    budgetHistory,
    categories,
    paymentMethods,
    budgets,
    budgetForm,
    editingBudgetHistoryId,
    form,
    status,
    setStatus,
    categoryInput,
    setCategoryInput,
    methodInput,
    setMethodInput,
    preferences,
    preferenceDateFormatDraft,
    setPreferenceDateFormatDraft,
    preferenceNotificationsDraft,
    setPreferenceNotificationsDraft,
    preferenceSaveStatus,
    setPreferenceSaveStatus,
    onboardingName,
    setOnboardingName,
    isLoading,
    selectedTransaction,
    editingTransactionId,
    showDeleteConfirm,
    setShowDeleteConfirm,
    setFocusBudgetAnalysis,
    showAddCategoryForm,
    setShowAddCategoryForm,
    selectedCategoryId,
    categoryNameDraft,
    setCategoryNameDraft,
    categoryEditStatus,
    setCategoryEditStatus,
    categoryToDelete,
    setCategoryToDelete,
    selectedPaymentMethodId,
    paymentMethodNameDraft,
    setPaymentMethodNameDraft,
    paymentMethodEditStatus,
    setPaymentMethodEditStatus,
    paymentMethodToDelete,
    setPaymentMethodToDelete,
    showAddPaymentMethodForm,
    setShowAddPaymentMethodForm,
    restoreCandidate,
    setRestoreCandidate,
    migrationReport,
    showRestoreConfirm,
    setShowRestoreConfirm,
    isPreparingRestore,
    fileInputRef,
    budgetFormRef,
    budgetAnalysisRef,
    categoryMap,
    paymentMap,
    monthlyExpense,
    totalBudgetPaisa,
    transactionHistory,
    weeklySpending,
    categoryTotals,
    paymentMethodTotals,
    monthlyExpenseTrend,
    monthlyBudgetTrend,
    loadData,
    handleContinueOnboarding,
    openPreferences,
    handleSavePreferences,
    handleInputChange,
    handleBudgetFormChange,
    handleSaveBudget,
    openBudgetHistoryEditor,
    handleSubmit,
    handleDelete,
    handleAddCategory,
    handleAddMethod,
    openAccount,
    openPaymentMethods,
    handleSelectPaymentMethod,
    handleSavePaymentMethod,
    handleDeletePaymentMethod,
    handleSelectCategory,
    handleSaveCategory,
    handleDeleteCategory,
    handleExport,
    handleRestoreFileChange,
    handleConfirmRestore,
    openTransactionDetail,
    openAddExpense,
    openTransactionEditor,
    navItems,
    budgetCategories,
    repository: financeRepository
  };
}
