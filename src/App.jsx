import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CircleAlert,
  ChartNoAxesCombined,
  ChevronRight,
  Download,
  Ellipsis,
  FileUp,
  House,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  Utensils,
  WalletCards
} from 'lucide-react';
import { financeRepository } from './services/financeRepository';
import { defaultCategories, defaultPaymentMethods } from './data/defaultData';
import {
  buildMonthlyBudgetTrend,
  buildMonthlyExpenseTrend,
  buildWeeklyBudgetTrend,
  calculateCumulativeBudgetTotal,
  calculateCategoryExpenseTotals,
  calculateExpenseTotal,
  dateFormatOptions,
  formatDate,
  formatCurrency,
  fromPaisa,
  getLocalDateString,
  parseBackupPayload,
  toPaisa,
  validateTransaction
} from './lib/finance';

const initialForm = {
  title: '',
  amount: '',
  categoryId: defaultCategories.find((category) => category.name === 'Other')?.id || defaultCategories[0].id,
  paymentMethodId: defaultPaymentMethods.find((method) => method.name === 'Cash')?.id || defaultPaymentMethods[0].id,
  date: getLocalDateString(),
  notes: ''
};

const navItems = ['home', 'transactions', 'analytics', 'budget'];
const budgetCategories = ['Salary', 'Freelance', 'Other'];

function App() {
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
  const [restoreCandidate, setRestoreCandidate] = useState(null);
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
        financeRepository.savePreferences(nextPreferences),
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
      await financeRepository.savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setPreferenceSaveStatus({ type: 'success', message: 'Preferences saved.' });
    } catch (error) {
      setPreferenceSaveStatus({ type: 'error', message: 'Could not save preferences. Please try again.' });
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
      setStatus({ type: 'success', message: 'Budget saved.' });
    } catch (error) {
      setStatus({ type: 'error', message: 'Could not save budget. Please try again.' });
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
    setStatus({ type: 'idle', message: '' });
    setTab('budget');
    requestAnimationFrame(() => {
      budgetFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
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

    await financeRepository.saveTransaction(editingTransactionId, nextPayload);
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
    await financeRepository.deleteTransactionOrBudgetHistory(selectedTransaction);
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
      await financeRepository.createCategory(category);
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
      await financeRepository.createPaymentMethod(method);
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
    event.preventDefault();
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
      const updated = await financeRepository.updatePaymentMethod(selectedPaymentMethodId, methodName);
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

  const handleDeletePaymentMethod = async () => {
    if (!paymentMethodToDelete) return;
    if (paymentMethods.length <= 1) {
      setPaymentMethodEditStatus({ type: 'error', message: 'At least one payment method must remain.' });
      setPaymentMethodToDelete(null);
      return;
    }

    try {
      const isInUse = !await financeRepository.deletePaymentMethod(paymentMethodToDelete.id);

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
    event.preventDefault();
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
      const updated = await financeRepository.updateCategory(selectedCategoryId, categoryName);
      if (!updated) {
        setCategoryEditStatus({ type: 'error', message: 'This category no longer exists. Reopen Account to refresh the list.' });
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

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    if (categories.length <= 1) {
      setCategoryEditStatus({ type: 'error', message: 'At least one category must remain.' });
      setCategoryToDelete(null);
      return;
    }

    try {
      const isInUse = !await financeRepository.deleteCategory(categoryToDelete.id);

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
      setStatus({ type: 'success', message: 'Backup exported' });
    } catch (error) {
      setStatus({ type: 'error', message: 'Could not export your backup. Please try again.' });
    }
  };

  const handleRestoreFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setRestoreCandidate(null);
    setIsPreparingRestore(true);
    try {
      const text = await file.text();
      const restoreData = parseBackupPayload(text);

      setRestoreCandidate({
        fileName: file.name,
        fileDate: formatDate(new Date(file.lastModified), preferences?.dateFormat),
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
    const { restoreData } = restoreCandidate;

    try {
      await financeRepository.restoreBackup(restoreData);
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
      setStatus({ type: 'success', message: notices.length
        ? `Backup restored. ${notices.join(' ')}`
        : 'Backup restored successfully.'
      });
    } catch (error) {
      setStatus({ type: 'error', message: 'Could not restore the selected backup. Your current data was not changed.' });
    } finally {
      setShowRestoreConfirm(false);
    }
  };

  const openTransactionDetail = (transaction) => {
    setSelectedTransaction({ ...transaction, returnTab: tab });
    setShowDeleteConfirm(false);
    setTab('transaction-detail');
  };

  const renderHistoryItem = (entry) => {
    const isBudgetChange = entry.historyType === 'budget';
    const categoryId = entry.categoryId || 'overall';
    const isBudgetAddition = entry.entryType === 'addition';
    const budgetLabel = categoryId === 'overall'
      ? 'Overall budget'
      : `${categoryMap[categoryId]?.name || 'Category'} budget`;
    const budgetCategory = isBudgetAddition ? entry.budgetCategory || 'Other' : budgetLabel;
    const title = isBudgetChange
      ? isBudgetAddition
        ? budgetCategory
        : entry.amount === null
          ? `${budgetLabel} removed`
          : entry.previousAmount === null
            ? `${budgetLabel} set`
            : `${budgetLabel} updated`
      : entry.title;
    const descriptionPreview = isBudgetChange && entry.description
      ? entry.description.trim().replace(/\s+/g, ' ').split(' ').slice(0, 12).join(' ')
      : '';
    const subtitle = isBudgetChange
      ? descriptionPreview || 'Budget updated'
      : (() => {
          const paymentMethodLabel = paymentMap[entry.paymentMethodId]?.name || 'Cash';
          return entry.title ? `${paymentMethodLabel} · ${entry.title}` : paymentMethodLabel;
        })();
    const amount = isBudgetChange
      ? entry.amount === null
        ? 'Removed'
        : formatCurrency(fromPaisa(entry.amount))
      : formatCurrency(Number(entry.amount || 0));

    return (
      <button
        key={`${entry.historyType}-${entry.id}`}
        type="button"
        className="transaction-item transaction-row"
        onClick={() => openTransactionDetail(entry)}
        aria-label={`View ${title} transaction`}
      >
        <div className={`transaction-icon ${isBudgetChange ? 'budget-change' : 'expense'}`}>
          {isBudgetChange ? <WalletCards size={16} /> : <ArrowUpRight size={16} />}
        </div>
        <div className="transaction-copy">
          <strong>{isBudgetChange ? title : categoryMap[entry.categoryId]?.name || 'Other'}</strong>
          <span>{subtitle}</span>
        </div>
        <div className="transaction-meta align-right">
          <strong className={isBudgetChange ? 'budget-change-value' : 'expense'}>{amount}</strong>
          <span>{formatDate(entry.date, preferences?.dateFormat)}</span>
        </div>
      </button>
    );
  };

  const renderHome = () => {
    const hasBudget = budgets.some((budget) => budget.categoryId === 'overall');
    const overallBudgetAmount = hasBudget ? fromPaisa(totalBudgetPaisa) : null;
    const availableBalance = overallBudgetAmount === null
      ? null
      : overallBudgetAmount - calculateExpenseTotal(transactions);

    return (
      <div className="home-dashboard">
        <section className="home-heading-meta">
          <h2>{`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, ${preferences?.name || 'User'}`}</h2>
          <p>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
        </section>

        <section className="hero-panel home-summary-card">
          <div className="home-balance">
            <span>Available balance</span>
            {availableBalance === null ? (
              <button type="button" className="home-budget-prompt" onClick={() => setTab('budget')}>
                Add to budget
              </button>
            ) : (
              <strong className={availableBalance < 0 ? 'expense' : ''}>
                {formatCurrency(availableBalance)}
              </strong>
            )}
          </div>

          <div className="home-summary-metrics">
            <div className="home-summary-metric home-budget-metric">
              <span>Budget</span>
              <strong>{overallBudgetAmount === null ? 'Not set' : formatCurrency(overallBudgetAmount)}</strong>
            </div>
            <div className="home-summary-metric home-expense-metric">
              <span>Total expenses</span>
              <strong>{formatCurrency(calculateExpenseTotal(transactions))}</strong>
            </div>
          </div>

          <button type="button" className="primary-action full hero-add-button" onClick={openAddExpense}>
            <Plus size={16} /> Add Transaction
          </button>
        </section>

        <section className="panel home-chart-card">
          <div className="panel-header">
            <h2>Weekly expenses &amp; remaining budget</h2>
          </div>

          {(() => {
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
                        <title>{`${formatDate(day.isoDate, preferences?.dateFormat)}: ${formatCurrency(day.expenses)} spent`}</title>
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
                          <title>{`${formatDate(day.isoDate, preferences?.dateFormat)}: Overall expenses ${formatCurrency(day.totalExpenses)}`}</title>
                        </circle>
                        {hasBudget ? (
                          <circle className="weekly-budget-point" cx={x} cy={budgetY} r="3.5">
                            <title>{`${formatDate(day.isoDate, preferences?.dateFormat)}: Remaining budget ${formatCurrency(day.remainingBudget)}`}</title>
                          </circle>
                        ) : null}
                        <text className="weekly-chart-date" x={x} y="174" textAnchor="middle">
                          {formatDate(day.isoDate, preferences?.dateFormat)}
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
          })()}
          <p className="chart-footer">Bars show each day’s expenses; lines show cumulative expenses and remaining budget (PKR)</p>
        </section>

        <section className="panel home-recent-card">
          <div className="panel-header">
            <h2>Recent transactions</h2>
            <button type="button" className="link-button" onClick={() => setTab('transactions')}>View All</button>
          </div>

          <div className="transaction-list compact">
            {transactionHistory.length === 0 ? (
              <div className="empty-state">No transactions yet.</div>
            ) : (
              transactionHistory.slice(0, 4).map(renderHistoryItem)
            )}
          </div>
        </section>
      </div>
    );
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

  const renderTransactions = () => (
    <div className="stacked-blocks">
      
        <button type="button" className="primary-action full transaction-list-add-button" onClick={openAddExpense}>
          <Plus size={16} /> Add Expense
        </button>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Transaction history</h2>
          </div>
        </div>

        <div className="transaction-list">
          {transactionHistory.length === 0 ? (
            <div className="empty-state">No transactions yet.</div>
          ) : (
            transactionHistory.map(renderHistoryItem)
          )}
        </div>
      </section>
    </div>
  );

  const renderAddTransaction = () => (
    <main className="add-transaction-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab(editingTransactionId ? 'transactions' : 'home')} aria-label={editingTransactionId ? 'Back to transactions' : 'Back to home'}>
          <ArrowLeft size={20} />
        </button>
        <h1>{editingTransactionId ? 'Edit Expense' : 'Add Expense'}</h1>
      </header>

      <section className="add-transaction-content">
        <form className="transaction-form" onSubmit={handleSubmit}>
          <label htmlFor="transaction-amount">Amount (PKR)</label>
          <input id="transaction-amount" name="amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={handleInputChange} placeholder="Rs0" />

          <label htmlFor="transaction-category">Category</label>
          <select id="transaction-category" name="categoryId" value={form.categoryId} onChange={handleInputChange}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>

          <label htmlFor="transaction-title">Description</label>
          <input id="transaction-title" name="title" value={form.title} onChange={handleInputChange} placeholder="Description" />

          <label htmlFor="transaction-method">Payment Method</label>
          <select id="transaction-method" name="paymentMethodId" value={form.paymentMethodId} onChange={handleInputChange}>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>{method.name}</option>
            ))}
          </select>

          <label htmlFor="transaction-date">Date</label>
          <input id="transaction-date" name="date" type="date" value={form.date} onChange={handleInputChange} />

          <button className="primary-action full transaction-save-button" type="submit">
            {editingTransactionId ? 'Save Changes' : 'Save Expense'}
          </button>
        </form>

        {status.message ? (
          <p className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.message}
          </p>
        ) : null}

        <p className="transaction-device-note">Saved on this device.</p>
      </section>
    </main>
  );

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

  const renderTransactionDetail = () => {
    if (!selectedTransaction) return null;
    if (selectedTransaction.historyType === 'budget') {
      const date = new Date(`${selectedTransaction.date}T00:00:00`);
      const time = selectedTransaction.createdAt
        ? new Date(selectedTransaction.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })
        : '—';
      const isBudgetAddition = selectedTransaction.entryType === 'addition';
      const budgetLabel = !selectedTransaction.categoryId || selectedTransaction.categoryId === 'overall'
        ? 'Overall budget'
        : `${categoryMap[selectedTransaction.categoryId]?.name || 'Category'} budget`;

      return (
        <main className="detail-shell">
          <header className="add-transaction-header">
            <button
              type="button"
              className="back-button"
              onClick={() => setTab(selectedTransaction.returnTab || 'transactions')}
              aria-label="Back to budget history"
            >
              <ArrowLeft size={22} />
            </button>
            <h1>Budget Entry</h1>
          </header>

          <section className="detail-content">
            <div className="detail-summary">
              <span className="detail-icon budget-change"><WalletCards size={26} strokeWidth={1.7} /></span>
              <h2>{budgetLabel}</h2>
              <strong className="budget-change-value">
                {!isBudgetAddition && selectedTransaction.amount === null
                  ? 'Removed'
                  : formatCurrency(fromPaisa(selectedTransaction.amount))}
              </strong>
              <p>
                {isBudgetAddition
                  ? 'Added to your overall budget'
                  : selectedTransaction.amount === null
                    ? 'Budget limit removed'
                    : selectedTransaction.previousAmount === null
                      ? 'Budget limit set'
                      : 'Budget limit updated'}
              </p>
            </div>

            <section className="detail-card">
              <div><span>Date</span><strong>{formatDate(date, preferences?.dateFormat)}</strong></div>
              <div><span>Time</span><strong>{time}</strong></div>
              {isBudgetAddition ? (
                <>
                  <div>
                    <span>Balance before</span>
                    <strong>{formatCurrency(fromPaisa(selectedTransaction.previousAmount || 0))}</strong>
                  </div>
                  <div>
                    <span>Amount added</span>
                    <strong>{formatCurrency(fromPaisa(selectedTransaction.amount))}</strong>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <span>Previous limit</span>
                    <strong>{selectedTransaction.previousAmount === null ? 'Not set' : formatCurrency(fromPaisa(selectedTransaction.previousAmount))}</strong>
                  </div>
                  <div>
                    <span>New limit</span>
                    <strong>{selectedTransaction.amount === null ? 'Not set' : formatCurrency(fromPaisa(selectedTransaction.amount))}</strong>
                  </div>
                </>
              )}
              {selectedTransaction.description ? (
                <div><span>Description</span><strong>{selectedTransaction.description}</strong></div>
              ) : null}
            </section>

            <div className="detail-actions">
              {selectedTransaction.amount !== null ? (
                <button
                  type="button"
                  className="detail-edit-button"
                  onClick={() => openBudgetHistoryEditor(selectedTransaction)}
                >
                  Edit
                </button>
              ) : null}
              <button
                type="button"
                className="detail-delete-button"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 size={17} /> Delete
              </button>
            </div>
          </section>

          {showDeleteConfirm && (
            <div className="delete-overlay" role="presentation">
              <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-budget-title">
                <h2 id="delete-budget-title">Delete Budget History?</h2>
                <p>
                  {isBudgetAddition
                    ? 'This budget addition will be removed from your total balance.'
                    : 'This change will be removed and the previous budget value restored.'}
                </p>
                <div className="delete-dialog-actions">
                  <button type="button" className="dialog-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                  <button type="button" className="dialog-delete" onClick={handleDelete}><Trash2 size={17} /> Delete</button>
                </div>
              </section>
            </div>
          )}
        </main>
      );
    }

    const categoryName = categoryMap[selectedTransaction.categoryId]?.name || 'Other';
    const methodName = paymentMap[selectedTransaction.paymentMethodId]?.name || 'Other';
    const date = new Date(`${selectedTransaction.date}T00:00:00`);

    return (
      <main className="detail-shell">
        <header className="add-transaction-header">
          <button type="button" className="back-button" onClick={() => setTab('transactions')} aria-label="Back to transactions">
            <ArrowLeft size={22} />
          </button>
          <h1>Transaction Detail</h1>
        </header>

        <section className="detail-content">
          <div className="detail-summary">
            <span className="detail-icon expense"><Utensils size={26} strokeWidth={1.7} /></span>
            <h2>{categoryName}</h2>
            <strong className="expense">- {formatCurrency(Number(selectedTransaction.amount || 0))}</strong>
            <p>Expense</p>
          </div>

          <section className="detail-card">
            <div><span>Date</span><strong>{formatDate(date, preferences?.dateFormat)}</strong></div>
            <div><span>Time</span><strong>{selectedTransaction.createdAt ? new Date(selectedTransaction.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '02:30 PM'}</strong></div>
            <div><span>Payment Method</span><strong>{methodName}</strong></div>
            <div><span>Description</span><strong>{selectedTransaction.title || 'No description'}</strong></div>
          </section>

          <div className="detail-actions">
            <button type="button" className="detail-edit-button" onClick={openTransactionEditor}>Edit</button>
            <button type="button" className="detail-delete-button" onClick={() => setShowDeleteConfirm(true)}><Trash2 size={17} /> Delete</button>
          </div>
        </section>

        {showDeleteConfirm && (
          <div className="delete-overlay" role="presentation">
            <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title">
              <h2 id="delete-title">Delete Transaction?</h2>
              <p>This transaction will be permanently removed.</p>
              <div className="delete-dialog-actions">
                <button type="button" className="dialog-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button type="button" className="dialog-delete" onClick={handleDelete}><Trash2 size={17} /> Delete</button>
              </div>
            </section>
          </div>
        )}
      </main>
    );
  };

  const renderAnalytics = () => {
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

    return (
      <div className="stacked-blocks">
        <section className="panel analytics-overview">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Your finances</p>
              <h2>Spending overview</h2>
            </div>
            <TrendingUp size={18} />
          </div>

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
        </section>

        <section className="panel analytics-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Trend</p>
              <h2>Monthly spending</h2>
            </div>
          </div>
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
        </section>

        <section className="panel analytics-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">This month</p>
              <h2>Spending by category</h2>
            </div>
          </div>

          <div className="analytics-donut-layout">
            {categoryTotals.length === 0 ? (
              <div className="empty-state">No expense data is available yet.</div>
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
        </section>

        <section className="panel analytics-section">
          <div className="panel-header">
            <div>
              <p className="eyebrow">This month</p>
              <h2>Spending by payment method</h2>
            </div>
          </div>
          <div className="category-list">
            {paymentMethodTotals.length === 0 ? (
              <div className="empty-state">No expense data is available yet.</div>
            ) : (
              paymentMethodTotals.map(({ label, amount }) => (
                <div key={label} className="category-row">
                  <span>{label}</span>
                  <strong>{formatCurrency(amount)}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        <section ref={budgetAnalysisRef} className="panel budget-analytics-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Budget</p>
              <h2>Budget performance</h2>
            </div>
          </div>
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
            <div className="empty-state">Add a budget to see budget performance here.</div>
          )}
        </section>

        <section className="panel analytics-section analytics-budget-analysis">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Analysis</p>
              <h2>Budget vs. spending</h2>
            </div>
          </div>
          {(() => {
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
              <>
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
              </>
            );
          })()}
        </section>

        <p className="analytics-data-note">Income, cash-flow and savings-rate reports aren’t shown because this app currently records expenses only.</p>
      </div>
    );
  };

  const renderBudget = () => {
    const sortedBudgetHistory = [...budgetHistory]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return (
      <div className="stacked-blocks">
        <section className="panel">
          <form ref={budgetFormRef} className="budget-form" onSubmit={handleSaveBudget}>
            <div className="budget-entry-box">
              <div className="budget-field-row">
                <label htmlFor="budget-category">Category</label>
                <select
                  id="budget-category"
                  name="budgetCategory"
                  value={budgetForm.budgetCategory}
                  onChange={handleBudgetFormChange}
                  required
                >
                  {budgetCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="budget-field-row">
                <label htmlFor="budget-date">Date</label>
                <input
                  id="budget-date"
                  name="date"
                  type="date"
                  value={budgetForm.date}
                  onChange={handleBudgetFormChange}
                  required
                />
              </div>

              <div className="budget-field-row">
                <label htmlFor="budget-amount">Amount (Rs)</label>
                <input
                  id="budget-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Rs 2000"
                  value={budgetForm.amount}
                  onChange={handleBudgetFormChange}
                  required
                />
              </div>

              <div className="budget-field-row">
                <label htmlFor="budget-description">Description</label>
                <textarea
                  id="budget-description"
                  className="budget-description-field"
                  name="description"
                  value={budgetForm.description}
                  onChange={handleBudgetFormChange}
                  placeholder="(optional)"
                  rows="1"
                />
              </div>

              <button className="primary-action full" type="submit">
                {editingBudgetHistoryId ? 'Save Changes' : 'Save Budget'}
              </button>
          

            </div>

            {status.message ? (
              <p className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
                {status.message}
              </p>
            ) : null}

          </form>

        </section>

        <section className="panel budget-history-panel">
          <div className="panel-header">
            <h2>Budget history</h2>
          </div>
          <div className="transaction-list">
            {sortedBudgetHistory.length === 0 ? (
              <div className="empty-state">No budget history yet.</div>
            ) : (
              sortedBudgetHistory.map((entry) => renderHistoryItem({ ...entry, historyType: 'budget' }))
            )}
          </div>
        </section>
      </div>
    );
  };

  const renderMore = () => {
    return (
      <div className="more-page">
        <section className="more-group" aria-labelledby="more-account-heading">
          <h2 id="more-account-heading" className="more-group-title">Account</h2>
          <button
            type="button"
            className="more-row"
            onClick={() => openAccount()}
          >
            <span>Categories</span>
            <ChevronRight className="more-chevron" size={20} />
          </button>
          <button
            type="button"
            className="more-row"
            onClick={() => openPaymentMethods()}
          >
            <span>Payment Methods</span>
            <ChevronRight className="more-chevron" size={20} />
          </button>
        </section>

        <section className="more-group" aria-labelledby="more-data-heading">
          <h2 id="more-data-heading" className="more-group-title">Data &amp; Backup</h2>
          <button
            type="button"
            className="more-row"
            onClick={() => {
              setStatus({ type: 'idle', message: '' });
              setTab('export-data');
            }}
          >
            <span>Export Data</span>
            <ChevronRight className="more-chevron" size={20} />
          </button>
          <button
            type="button"
            className="more-row"
            onClick={() => {
              setRestoreCandidate(null);
              setStatus({ type: 'idle', message: '' });
              setTab('restore-data');
            }}
          >
            <span>Restore Data</span>
            <ChevronRight className="more-chevron" size={20} />
          </button>
          <div className="more-row more-row-muted">
            <span>Cloud Sync</span>
            <span className="more-row-value">Coming Later</span>
          </div>
          {status.message ? (
            <p className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>{status.message}</p>
          ) : null}
        </section>

        <section className="more-group" aria-labelledby="more-preferences-heading">
          <h2 id="more-preferences-heading" className="more-group-title">Preferences</h2>
          <div className="more-row more-row-muted">
            <span>Currency</span>
            <span className="more-row-value">PKR · Fixed</span>
          </div>
          <button type="button" className="more-row" onClick={openPreferences}>
            <span>Date Format</span>
            <span className="more-row-trailing">
              <span className="more-row-value">{preferences?.dateFormat || 'DD MMM YYYY'}</span>
              <ChevronRight className="more-chevron" size={20} />
            </span>
          </button>
          <button type="button" className="more-row" onClick={openPreferences}>
            <span>Notifications</span>
            <span className="more-row-trailing">
              <span className="more-row-value">{preferences?.notificationsEnabled ? 'Basic · On' : 'Basic · Off'}</span>
              <ChevronRight className="more-chevron" size={20} />
            </span>
          </button>
        </section>

        <section className="more-group" aria-labelledby="more-help-heading">
          <h2 id="more-help-heading" className="more-group-title">Help</h2>
          <button type="button" className="more-row" onClick={() => setTab('help')}>
            <span>Help &amp; FAQ</span>
            <ChevronRight className="more-chevron" size={20} />
          </button>
          <button type="button" className="more-row" onClick={() => setTab('about')}>
            <span>About</span>
            <ChevronRight className="more-chevron" size={20} />
          </button>
        </section>
      </div>
    );
  };

  const renderAbout = () => (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab('more')} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>About</h1>
      </header>

      <section className="about-content">
        <article className="about-intro-card">
          <WalletCards className="about-brand-icon" size={24} aria-hidden="true" />
          <h2>PWS V1</h2>
          <p className="about-tagline">Manage your money simply.</p>
          <p className="about-description">A simple personal finance tool for students and users in Pakistan.</p>
        </article>

        <div className="export-data-notice about-local-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Local-first &amp; offline friendly</strong>
            <p>No account required. Track income and expenses, understand your spending and set budgets in Pakistani Rupees.</p>
          </div>
        </div>

        <section className="more-group about-details" aria-label="App information">
          <div className="more-row">
            <span>Version</span>
            <span className="more-row-value">V1</span>
          </div>
          <div className="more-row">
            <span>Currency</span>
            <span className="more-row-value">PKR (Rs)</span>
          </div>
          <div className="more-row">
            <span>Appearance</span>
            <span className="more-row-value">Light</span>
          </div>
          <div className="more-row more-row-muted">
            <span>Cloud Sync</span>
            <span className="more-row-value">Coming Later</span>
          </div>
        </section>
      </section>
    </main>
  );

  const renderHelp = () => (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab('more')} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Help &amp; FAQ</h1>
      </header>

      <section className="help-faq-list" aria-label="Frequently asked questions">
        <article className="help-faq-item">
          <h2>How is my balance calculated?</h2>
          <p>Income − Expenses = Available Balance.</p>
        </article>
        <article className="help-faq-item">
          <h2>Can I use PWS offline?</h2>
          <p>Yes. Record transactions without an internet connection. Your data stays on this device.</p>
        </article>
        <article className="help-faq-item">
          <h2>How do I keep my data safe?</h2>
          <p>In More, choose Export Data. Keep your backup outside the app before clearing browser data.</p>
        </article>
        <article className="help-faq-item">
          <h2>Can I sync or change currency?</h2>
          <p>Cloud Sync is coming later. PWS V1 uses PKR only.</p>
        </article>
      </section>
    </main>
  );

  const renderPreferences = () => (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab('more')} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Preferences</h1>
      </header>

      <form className="preferences-content" onSubmit={handleSavePreferences}>
        <section className="preferences-currency-card">
          <h2>Currency</h2>
          <div className="preferences-currency-row">
            <span>Pakistani Rupees</span>
            <span>PKR · Fixed</span>
          </div>
          <p>All amounts use Rs. PWS V1 supports PKR only.</p>
        </section>

        <div className="preferences-date-field">
          <label htmlFor="date-format">Date Format</label>
          <select
            id="date-format"
            value={preferenceDateFormatDraft}
            onChange={(event) => {
              setPreferenceDateFormatDraft(event.target.value);
              setPreferenceSaveStatus({ type: 'idle', message: '' });
            }}
          >
            {dateFormatOptions.map((dateFormat) => (
              <option key={dateFormat} value={dateFormat}>{dateFormat}</option>
            ))}
          </select>
          <span className="preferences-date-example">
            Example: {formatDate(new Date(2026, 9, 3), preferenceDateFormatDraft)}
          </span>
        </div>

        <section className="preferences-notification-card">
          <h2>Notifications</h2>
          <div className="preferences-notification-row">
            <span>Basic notifications · {preferenceNotificationsDraft ? 'On' : 'Off'}</span>
            <button
              type="button"
              className="preferences-toggle"
              role="switch"
              aria-checked={preferenceNotificationsDraft}
              aria-label="Basic notifications"
              onClick={() => {
                setPreferenceNotificationsDraft((current) => !current);
                setPreferenceSaveStatus({ type: 'idle', message: '' });
              }}
            >
              <span />
            </button>
          </div>
          <p>Basic notifications only. No advanced alerts or predictions.</p>
        </section>

        <button type="submit" className="primary-action full preferences-save-button">
          Save preferences
        </button>
        {preferenceSaveStatus.message ? (
          <p className={`status ${preferenceSaveStatus.type}`} role={preferenceSaveStatus.type === 'error' ? 'alert' : 'status'}>
            {preferenceSaveStatus.message}
          </p>
        ) : null}
      </form>
    </main>
  );

  const renderAccount = () => (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab('more')} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Account</h1>
      </header>

      <section className="account-content">
        <div className="account-category-list" aria-label="Categories">
          {categories.map((category) => (
            <div className="account-category-row" key={category.id}>
              <span>{category.name}</span>
              <div className="account-category-actions">
                <button
                  type="button"
                  className="account-category-edit"
                  onClick={() => handleSelectCategory(category)}
                  aria-label={`Edit ${category.name}`}
                  aria-pressed={selectedCategoryId === category.id}
                >
                  <Pencil size={20} />
                </button>
                <button
                  type="button"
                  className="account-category-remove"
                  onClick={() => {
                    setCategoryEditStatus({ type: 'idle', message: '' });
                    setCategoryToDelete(category);
                  }}
                  aria-label={`Remove ${category.name}`}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {categoryEditStatus.message ? (
          <p className={`status ${categoryEditStatus.type}`} role={categoryEditStatus.type === 'error' ? 'alert' : 'status'}>
            {categoryEditStatus.message}
          </p>
        ) : null}

        <form className="account-category-form" onSubmit={handleSaveCategory}>
          <label htmlFor="account-category-name">Category Name</label>
          <input
            id="account-category-name"
            value={categoryNameDraft}
            onChange={(event) => {
              setCategoryNameDraft(event.target.value);
              setCategoryEditStatus({ type: 'idle', message: '' });
            }}
            aria-label="Category Name"
            disabled={!selectedCategoryId}
            required
          />
          <button className="primary-action full account-save-button" type="submit" disabled={!selectedCategoryId}>
            Save Changes
          </button>
        </form>
        <section className="account-add-category">
          <button
            type="button"
            className="secondary-button wide"
            onClick={() => {
              setShowAddCategoryForm((current) => !current);
              setCategoryInput('');
              setCategoryEditStatus({ type: 'idle', message: '' });
            }}
            aria-expanded={showAddCategoryForm}
            aria-controls="account-add-category-form"
          >
            Add Category
          </button>
          {showAddCategoryForm ? (
            <form
              id="account-add-category-form"
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddCategory();
              }}
            >
              <input
                value={categoryInput}
                onChange={(event) => {
                  setCategoryInput(event.target.value);
                  setCategoryEditStatus({ type: 'idle', message: '' });
                }}
                placeholder="Category name"
                aria-label="Category name"
                required
              />
              <button type="submit" className="secondary-button">Add</button>
            </form>
          ) : null}
        </section>
      </section>
      {categoryToDelete ? (
        <div className="delete-overlay" role="presentation">
          <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-category-title">
            <h2 id="delete-category-title">Remove Category?</h2>
            <p>
              Remove “{categoryToDelete.name}” from your categories? Categories used by existing expenses or budgets cannot be removed.
            </p>
            <div className="delete-dialog-actions">
              <button type="button" className="dialog-cancel" onClick={() => setCategoryToDelete(null)}>Cancel</button>
              <button type="button" className="dialog-delete" onClick={handleDeleteCategory}>
                <Trash2 size={17} /> Remove
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );

  const renderPaymentMethods = () => (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab('more')} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Payment Methods</h1>
      </header>

      <section className="account-content">
        <div className="account-category-list" aria-label="Payment methods">
          {paymentMethods.map((method) => (
            <div className="account-category-row" key={method.id}>
              <span>{method.name}</span>
              <div className="account-category-actions">
                <button
                  type="button"
                  className="account-category-edit"
                  onClick={() => handleSelectPaymentMethod(method)}
                  aria-label={`Edit ${method.name}`}
                  aria-pressed={selectedPaymentMethodId === method.id}
                >
                  <Pencil size={20} />
                </button>
                <button
                  type="button"
                  className="account-category-remove"
                  onClick={() => {
                    setPaymentMethodEditStatus({ type: 'idle', message: '' });
                    setPaymentMethodToDelete(method);
                  }}
                  aria-label={`Remove ${method.name}`}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
        {paymentMethodEditStatus.message ? (
          <p className={`status ${paymentMethodEditStatus.type}`} role={paymentMethodEditStatus.type === 'error' ? 'alert' : 'status'}>
            {paymentMethodEditStatus.message}
          </p>
        ) : null}

        <form className="account-category-form" onSubmit={handleSavePaymentMethod}>
          <label htmlFor="payment-method-name">Payment Method Name</label>
          <input
            id="payment-method-name"
            value={paymentMethodNameDraft}
            onChange={(event) => {
              setPaymentMethodNameDraft(event.target.value);
              setPaymentMethodEditStatus({ type: 'idle', message: '' });
            }}
            aria-label="Payment Method Name"
            disabled={!selectedPaymentMethodId}
            required
          />
          <button className="primary-action full account-save-button" type="submit" disabled={!selectedPaymentMethodId}>
            Save Changes
          </button>
        </form>
        <section className="account-add-category">
          <button
            type="button"
            className="secondary-button wide"
            onClick={() => {
              setShowAddPaymentMethodForm((current) => !current);
              setMethodInput('');
              setPaymentMethodEditStatus({ type: 'idle', message: '' });
            }}
            aria-expanded={showAddPaymentMethodForm}
            aria-controls="account-add-payment-method-form"
          >
            Add Payment Method
          </button>
          {showAddPaymentMethodForm ? (
            <form
              id="account-add-payment-method-form"
              className="inline-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddMethod();
              }}
            >
              <input
                value={methodInput}
                onChange={(event) => {
                  setMethodInput(event.target.value);
                  setPaymentMethodEditStatus({ type: 'idle', message: '' });
                }}
                placeholder="Payment method name"
                aria-label="Payment method name"
                required
              />
              <button type="submit" className="secondary-button">Add</button>
            </form>
          ) : null}
        </section>
      </section>
      {paymentMethodToDelete ? (
        <div className="delete-overlay" role="presentation">
          <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-payment-method-title">
            <h2 id="delete-payment-method-title">Remove Payment Method?</h2>
            <p>
              Remove “{paymentMethodToDelete.name}” from your payment methods? Methods used by existing transactions cannot be removed.
            </p>
            <div className="delete-dialog-actions">
              <button type="button" className="dialog-cancel" onClick={() => setPaymentMethodToDelete(null)}>Cancel</button>
              <button type="button" className="dialog-delete" onClick={handleDeletePaymentMethod}>
                <Trash2 size={17} /> Remove
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );

  const renderExportData = () => (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab('more')} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Export Data</h1>
      </header>

      <section className="export-data-content">
        <div className="export-data-notice">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Keep a copy of your data</strong>
            <p>PWS stores your records on this device. A backup protects them if you clear browser data or change your phone.</p>
          </div>
        </div>

        <section className="more-group export-data-card" aria-labelledby="local-backup-heading">
          <h2 id="local-backup-heading" className="more-group-title">Local backup</h2>
          <div className="more-row">
            <span>Transactions</span>
            <span className="more-row-value">Included</span>
          </div>
          <div className="more-row">
            <span>Budgets</span>
            <span className="more-row-value">Included</span>
          </div>
          <div className="more-row">
            <span>Categories &amp; methods</span>
            <span className="more-row-value">Included</span>
          </div>
          <p className="export-data-footnote">Export does not remove or change your data. Keep the downloaded file somewhere safe.</p>
        </section>

        <button type="button" className="primary-action full export-data-button" onClick={handleExport}>
          Export Data
        </button>
        {status.message ? (
          <p className={`export-data-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.type === 'success' ? <span aria-hidden="true">✓</span> : null}
            {status.message}
          </p>
        ) : null}
        <p className="export-data-disclaimer">No cloud account or bank connection is required.</p>
      </section>
    </main>
  );

  const renderRestoreData = () => (
    <main className="account-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab('more')} aria-label="Back to More">
          <ArrowLeft size={22} />
        </button>
        <h1>Restore Data</h1>
      </header>

      <section className="export-data-content">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={handleRestoreFileChange}
        />
        {status.type === 'success' ? (
          <>
            <div className="export-data-notice">
              <ShieldCheck size={20} aria-hidden="true" />
              <div>
                <strong>Your local records are ready</strong>
                <p>The selected backup has replaced the records on this device. No data was sent to a cloud account.</p>
              </div>
            </div>
            <p className="restore-complete-status" role="status">
              <span aria-hidden="true">✓</span>
              Data restored
            </p>
            <button type="button" className="restore-back-button" onClick={() => setTab('more')}>
              Back to More
            </button>
          </>
        ) : status.type === 'error' ? (
          <>
            <section className="restore-error-card" role="alert">
              <CircleAlert className="restore-error-icon" size={22} aria-hidden="true" />
              <h2>Unable to restore data</h2>
              <p>Choose a valid PWS backup and try again.</p>
              <strong>Your current data is unchanged.</strong>
            </section>
            <button
              type="button"
              className="primary-action full restore-retry-button"
              onClick={() => {
                setStatus({ type: 'idle', message: '' });
                setRestoreCandidate(null);
                setShowRestoreConfirm(false);
                fileInputRef.current?.click();
              }}
            >
              Choose another file
            </button>
            <button
              type="button"
              className="restore-back-button"
              onClick={() => {
                setStatus({ type: 'idle', message: '' });
                setRestoreCandidate(null);
                setShowRestoreConfirm(false);
                setTab('more');
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
        <div className="export-data-notice">
          {restoreCandidate ? <FileUp size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}
          <div>
            <strong>{restoreCandidate ? 'Backup ready to restore' : 'Back up before you restore'}</strong>
            <p>{restoreCandidate
              ? 'PWS backup selected. Confirmation required before replacing your local records.'
              : 'Restoring replaces the records currently on this device. Export a backup first so you can recover your existing data.'}</p>
          </div>
        </div>

        <section className="restore-file-card">
          {restoreCandidate ? (
            <button
              type="button"
              className="restore-selected-backup"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Choose a different backup file"
            >
              <strong>Selected backup</strong>
              <span>{`PWS backup · ${restoreCandidate.fileDate}`}</span>
            </button>
          ) : (
            <>
              <FileUp className="restore-file-icon" size={22} aria-hidden="true" />
              <h2>Choose a PWS backup</h2>
              <p>Use a backup previously exported from PWS.</p>
              <button
                type="button"
                className="restore-file-button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPreparingRestore}
              >
                {isPreparingRestore ? 'Checking backup…' : 'Choose backup file'}
              </button>
            </>
          )}
        </section>

        {restoreCandidate ? (
          <button
            type="button"
            className="primary-action full restore-data-button"
            onClick={() => setShowRestoreConfirm(true)}
          >
            Restore Data
          </button>
        ) : null}
        {status.message ? (
          <p className={`restore-data-status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
            {status.message}
          </p>
        ) : null}
        {!restoreCandidate ? (
          <p className="export-data-disclaimer">Select a valid backup to continue. Your current data stays unchanged until you confirm.</p>
        ) : null}
          </>
        )}
      </section>

      {showRestoreConfirm && restoreCandidate ? (
        <div className="delete-overlay" role="presentation">
          <section className="delete-dialog restore-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="restore-confirm-title">
            <h2 id="restore-confirm-title">Restore backup?</h2>
            <p>This will replace the data on this device. Export your current data first if you want to keep it.</p>
            <div className="delete-dialog-actions">
              <button type="button" className="dialog-cancel" onClick={() => setShowRestoreConfirm(false)}>Cancel</button>
              <button type="button" className="restore-confirm-button" onClick={handleConfirmRestore}>
                <Trash2 size={18} aria-hidden="true" />
                Restore
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );

  if (isLoading) {
    return (
      <main className="loading-shell" aria-live="polite" aria-busy="true">
        <h2 className="loading-title">Home</h2>
        <section className="loading-content">
          <div className="loading-card loading-card-wide">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-grid">
              <div className="skeleton-line" />
              <div className="skeleton-line" />
            </div>
          </div>

          <div className="loading-card loading-card-chart">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-bars">
              <span />
              <span />  
              <span />  
              <span />
              <span />
            </div>
          </div>

          <div className="loading-card loading-card-list">
            <div className="skeleton-line skeleton-line-lg" />
            <div className="skeleton-row"><span /><span /></div>
            <div className="skeleton-row"><span /><span /></div>
            <div className="skeleton-row">
              <span /><span />
            </div>
          </div>

        </section>
      </main>
    );
  }

  if (preferences && !preferences.onboardingCompleted) {
    return (
      <main className="onboarding-shell">
        <section className="onboarding-content">
          <div className="onboarding-hero">
            <span className="onboarding-icon"><WalletCards size={100} strokeWidth={1.75} /></span>
            <h1>Welcome to PWS</h1>
            <p>Manage your money here!</p>
          </div>

          <section className="onboarding-form">
            <h3>
              Basic setup
              <p className="onboarding-helper">Start now and make it yours!</p>
            </h3>

            <label htmlFor="onboarding-name">Your name</label>
            <input
              id="onboarding-name"
              value={onboardingName}
              onChange={(event) => setOnboardingName(event.target.value)}
              placeholder="Name (optional)"
              autoComplete="name"
            />

            <div className="privacy-note">
              <ShieldCheck size={24} />
              <div>
                <strong>Your data stays on this device</strong>
                <span>Works offline.</span>
              </div>
            </div>

            <button type="button" className="primary-action full onboarding-button" onClick={handleContinueOnboarding}>
              Continue
            </button>
            {status.message ? (
              <p className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
                {status.message}
              </p>
            ) : null}
            <p className="currency-label">(PKR) · Light mode</p>
          </section>
        </section>
      </main>
    );
  }

  if (tab === 'add-transaction') {
    return renderAddTransaction();
  }

  if (tab === 'transaction-detail') {
    return renderTransactionDetail();
  }

  if (tab === 'account') {
    return renderAccount();
  }

  if (tab === 'payment-methods') {
    return renderPaymentMethods();
  }

  if (tab === 'preferences') {
    return renderPreferences();
  }

  if (tab === 'help') {
    return renderHelp();
  }

  if (tab === 'about') {
    return renderAbout();
  }

  if (tab === 'export-data') {
    return renderExportData();
  }

  if (tab === 'restore-data') {
    return renderRestoreData();
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>{tab === 'transactions' ? 'Transactions' : tab === 'analytics' ? 'Analytics' : tab === 'budget' ? 'Budget' : tab === 'more' ? 'More' : 'Home'}</h1>
        {tab === 'home' ? (
          <div className="topbar-actions">
            <button
              type="button"
              className="more-button"
              onClick={() => setTab('more')}
              aria-label="More options"
              title="More"
            >
              <Ellipsis size={22} />
            </button>
          </div>
        ) : null}
        {tab === 'budget' ? (
          <div className="topbar-actions">
            <button
              type="button"
              className="more-button"
              onClick={() => {
                setFocusBudgetAnalysis(true);
                setTab('analytics');
              }}
              aria-label="View budget analysis"
              title="Budget analysis"
            >
              <ChartNoAxesCombined size={22} strokeWidth={1.9} />
            </button>
          </div>
        ) : null}
      </header>

      <main className="content">
        {tab === 'home' && renderHome()}
        {tab === 'transactions' && renderTransactions()}
        {tab === 'analytics' && renderAnalytics()}
        {tab === 'budget' && renderBudget()}
        {tab === 'more' && renderMore()}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map((name) => (
          <button
            key={name}
            type="button"
            className={tab === name ? 'nav-item active' : 'nav-item'}
            onClick={() => setTab(name)}
            aria-current={tab === name ? 'page' : undefined}
          >
            <span className="nav-icon" aria-hidden="true">
              {name === 'home' && <House size={20} strokeWidth={1.9} />}
              {name === 'transactions' && <ArrowLeftRight size={20} strokeWidth={1.9} />}
              {name === 'analytics' && <ChartNoAxesCombined size={20} strokeWidth={1.9} />}
              {name === 'budget' && <WalletCards size={20} strokeWidth={1.9} />}
            </span>
            <span>{name === 'home' ? 'Home' : name === 'transactions' ? 'Transactions' : name === 'analytics' ? 'Analytics' : 'Budget'}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
