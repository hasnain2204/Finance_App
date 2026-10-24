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
import { db, seedDatabase } from './db/db';
import { defaultCategories, defaultPaymentMethods } from './data/defaultData';
import {
  buildBackupPayload,
  calculateCumulativeBudgetTotal,
  calculateCategoryExpenseTotals,
  calculateExpenseTotal,
  createBudgetHistoryEntry,
  dateFormatOptions,
  formatDate,
  formatCurrency,
  fromPaisa,
  getLocalDateString,
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
  const [isLoading, setIsLoading] = useState(false);
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
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    return days.map((day) => {
      const iso = getLocalDateString(day);
      const total = transactions
        .filter((tx) => tx.type === 'expense' && tx.date.startsWith(iso))
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      return { label: day.toLocaleDateString('en-PK', { weekday: 'short' }), value: total };
    });
  }, [transactions]);

  const categoryTotals = useMemo(() => {
    const totalsByCategory = calculateCategoryExpenseTotals(transactions, getLocalDateString().slice(0, 7));
    return Object.entries(totalsByCategory)
      .map(([categoryId, total]) => [categoryMap[categoryId]?.name || 'Unknown', total])
      .sort((a, b) => b[1] - a[1]);
  }, [transactions, categoryMap]);

  const loadData = async () => {
    try {
      await seedDatabase();
      const [allTx, allCategories, allMethods, loadedBudgets, allBudgetHistory, appPreferences] = await Promise.all([
        db.transactions.orderBy('date').reverse().toArray(),
        db.categories.orderBy('name').toArray(),
        db.paymentMethods.orderBy('name').toArray(),
        db.budgets.toArray(),
        db.budgetHistory.toArray(),
        db.preferences.get('app')
      ]);
      let allBudgets = loadedBudgets;
      if (!allBudgets.some((budget) => budget.id === 'budget-all-overall')) {
        const total = calculateCumulativeBudgetTotal(allBudgets, allBudgetHistory);
        if (total > 0) {
          const cumulativeBudget = {
            id: 'budget-all-overall',
            categoryId: 'overall',
            month: 'all',
            amount: total
          };
          await db.budgets.put(cumulativeBudget);
          allBudgets = [...allBudgets, cumulativeBudget];
        }
      }

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
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to load saved data.' });
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
    await Promise.all([
      db.preferences.put(nextPreferences),
      new Promise((resolve) => window.setTimeout(resolve, 1150))
    ]);
    setPreferences(nextPreferences);
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
      await db.preferences.put(nextPreferences);
      setPreferences(nextPreferences);
      setPreferenceSaveStatus({ type: 'success', message: 'Preferences saved.' });
    } catch (error) {
      setPreferenceSaveStatus({ type: 'error', message: 'Could not save preferences. Please try again.' });
    }
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleBudgetFormChange = (event) => {
    const { name, value } = event.target;
    setBudgetForm((current) => ({ ...current, [name]: value }));
    setStatus({ type: 'idle', message: '' });
  };

  const setActiveBudget = async (month, categoryId, amount) => {
    const id = `budget-${month}-${categoryId}`;
    if (amount === null) {
      await db.budgets.delete(id);
    } else {
      await db.budgets.put({ id, categoryId, month, amount });
    }
  };

  const recalculateCumulativeBudget = async () => {
    const [allBudgets, allHistory] = await Promise.all([
      db.budgets.toArray(),
      db.budgetHistory.toArray()
    ]);
    const total = calculateCumulativeBudgetTotal(
      allBudgets.filter((budget) => budget.id !== 'budget-all-overall'),
      allHistory
    );
    await db.budgets.put({
      id: 'budget-all-overall',
      categoryId: 'overall',
      month: 'all',
      amount: total
    });
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
      await db.transaction('rw', db.budgets, db.budgetHistory, async () => {
        const existingHistory = editingBudgetHistoryId
          ? await db.budgetHistory.get(editingBudgetHistoryId)
          : null;
        if (editingBudgetHistoryId && !existingHistory) {
          throw new Error('Budget history entry no longer exists.');
        }

        if (existingHistory && existingHistory.entryType !== 'addition') {
          const oldMonth = existingHistory.month;
          const categoryId = existingHistory.categoryId || 'overall';
          const oldMonthBudget = await db.budgets.get(`budget-${oldMonth}-${categoryId}`);
          const historyEntry = {
            ...existingHistory,
            month,
            date,
            amount: paisaAmount,
            description: description.trim(),
            createdAt: timestamp.toISOString()
          };
          if (oldMonth !== month) {
            const oldMonthHistory = await db.budgetHistory
              .where('month').equals(oldMonth)
              .filter((entry) => entry.id !== existingHistory.id && (entry.categoryId || 'overall') === categoryId && entry.entryType !== 'addition')
              .toArray();
            oldMonthHistory.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
            await setActiveBudget(
              oldMonth,
              categoryId,
              oldMonthHistory.length ? oldMonthHistory[0].amount : existingHistory.previousAmount ?? null
            );
          }
          historyEntry.previousAmount = oldMonth === month ? oldMonthBudget?.amount ?? null : null;
          await db.budgetHistory.put(historyEntry);
          await setActiveBudget(month, categoryId, paisaAmount);
          await recalculateCumulativeBudget();
        } else {
          const cumulativeBudget = await db.budgets.get('budget-all-overall');
          const allBudgets = await db.budgets.toArray();
          const allHistory = await db.budgetHistory.toArray();
          const currentTotal = cumulativeBudget?.amount ?? calculateCumulativeBudgetTotal(allBudgets, allHistory);
          const addition = existingHistory
            ? paisaAmount - Number(existingHistory.amount || 0)
            : paisaAmount;
          const entryTotal = existingHistory
            ? currentTotal - Number(existingHistory.amount || 0)
            : currentTotal;
          const historyEntry = existingHistory
            ? {
                ...existingHistory,
                month,
                categoryId: 'overall',
                date,
                budgetCategory,
                previousAmount: entryTotal,
                amount: paisaAmount,
                description: description.trim(),
                createdAt: timestamp.toISOString(),
                entryType: 'addition'
              }
            : {
                ...createBudgetHistoryEntry(month, 'overall', currentTotal, paisaAmount, description, date, timestamp),
                budgetCategory,
                entryType: 'addition'
              };
          await db.budgetHistory[existingHistory ? 'put' : 'add'](historyEntry);
          await db.budgets.put({
            id: 'budget-all-overall',
            categoryId: 'overall',
            month: 'all',
            amount: currentTotal + addition
          });
        }
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

    if (editingTransactionId) {
      await db.transactions.update(editingTransactionId, nextPayload);
    } else {
      await db.transactions.add(nextPayload);
    }
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
    if (selectedTransaction.historyType === 'budget') {
      const entry = selectedTransaction;
      const month = entry.month;
      const categoryId = entry.categoryId || 'overall';
      await db.transaction('rw', db.budgets, db.budgetHistory, async () => {
        if (entry.entryType !== 'addition') {
          const remainingHistory = await db.budgetHistory
            .where('month').equals(month)
            .filter((historyEntry) => (
              historyEntry.id !== entry.id &&
              historyEntry.entryType !== 'addition' &&
              (historyEntry.categoryId || 'overall') === categoryId
            ))
            .toArray();
          remainingHistory.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
          await setActiveBudget(
            month,
            categoryId,
            remainingHistory.length ? remainingHistory[0].amount : entry.previousAmount ?? null
          );
        }
        await db.budgetHistory.delete(entry.id);
        await recalculateCumulativeBudget();
      });
    } else {
      await db.transactions.delete(selectedTransaction.id);
    }
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
      await db.categories.put(category);
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
      await db.paymentMethods.put(method);
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
      const updated = await db.paymentMethods.update(selectedPaymentMethodId, { name: methodName });
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
      let isInUse = false;
      await db.transaction('rw', db.paymentMethods, db.transactions, async () => {
        const transaction = await db.transactions.where('paymentMethodId').equals(paymentMethodToDelete.id).first();
        if (transaction) {
          isInUse = true;
          return;
        }
        await db.paymentMethods.delete(paymentMethodToDelete.id);
      });

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
      const updated = await db.categories.update(selectedCategoryId, { name: categoryName });
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
      let isInUse = false;
      await db.transaction('rw', db.categories, db.transactions, db.budgetHistory, db.budgets, async () => {
        const [transaction, historyEntry, budget] = await Promise.all([
          db.transactions.where('categoryId').equals(categoryToDelete.id).first(),
          db.budgetHistory.where('categoryId').equals(categoryToDelete.id).first(),
          db.budgets.where('categoryId').equals(categoryToDelete.id).first()
        ]);
        if (transaction || historyEntry || budget) {
          isInUse = true;
          return;
        }
        await db.categories.delete(categoryToDelete.id);
      });

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

  const handleExport = () => {
    try {
      const payload = buildBackupPayload({ transactions, categories, paymentMethods, budgets, budgetHistory });
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
      const parsed = JSON.parse(text);
      if (!parsed || ![1, 2].includes(parsed.version) || !Array.isArray(parsed.transactions)) {
        throw new Error('Invalid backup format');
      }

      const restoredCategories = Array.isArray(parsed.categories)
        ? parsed.categories.filter((category) => category.type === 'expense')
        : defaultCategories;
      const restoredCategoryIds = new Set(restoredCategories.map((category) => category.id));
      const restoredTransactions = parsed.transactions
        .filter((tx) => tx.type === 'expense')
        .map((tx) => ({
          ...tx,
          amount: toPaisa(Number(tx.amount || 0))
        }));
      const restoredBudgets = Array.isArray(parsed.budgets)
        ? parsed.budgets
            .filter((budget) =>
              budget.categoryId === 'overall' || restoredCategoryIds.has(budget.categoryId)
            )
            .map((budget) => ({
              ...budget,
              amount: parsed.version === 1 ? toPaisa(Number(budget.amount || 0)) : Number(budget.amount)
            }))
        : [];
      const restoredBudgetHistory = Array.isArray(parsed.budgetHistory)
        ? parsed.budgetHistory.map((entry) => {
            const validAmount = (amount) => amount === null || (Number.isSafeInteger(amount) && amount >= 0);
            if (
              !entry ||
              !/^\d{4}-\d{2}$/.test(entry.month) ||
              !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) ||
              typeof entry.createdAt !== 'string' ||
              Number.isNaN(new Date(entry.createdAt).getTime()) ||
              (entry.categoryId !== undefined && (typeof entry.categoryId !== 'string' || !entry.categoryId)) ||
              (entry.budgetCategory !== undefined && (typeof entry.budgetCategory !== 'string' || !entry.budgetCategory)) ||
              (entry.description !== undefined && typeof entry.description !== 'string') ||
              !validAmount(entry.previousAmount) ||
              !validAmount(entry.amount)
            ) {
              throw new Error('Invalid budget history in backup');
            }
            return { ...entry };
          })
        : [];

      setRestoreCandidate({
        fileName: file.name,
        fileDate: formatDate(new Date(file.lastModified), preferences?.dateFormat),
        parsed,
        restoredCategories,
        restoredTransactions,
        restoredBudgets,
        restoredBudgetHistory
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
    const {
      parsed,
      restoredCategories,
      restoredTransactions,
      restoredBudgets,
      restoredBudgetHistory
    } = restoreCandidate;

    try {
      await db.transaction('rw', db.transactions, db.categories, db.paymentMethods, db.budgets, db.budgetHistory, async () => {
        await db.transactions.clear();
        await db.categories.clear();
        await db.paymentMethods.clear();
        await db.budgets.clear();
        await db.budgetHistory.clear();

        if (restoredCategories.length) await db.categories.bulkPut(restoredCategories);
        if (Array.isArray(parsed.paymentMethods)) await db.paymentMethods.bulkPut(parsed.paymentMethods);
        if (restoredTransactions.length) await db.transactions.bulkPut(restoredTransactions);
        if (restoredBudgets.length) await db.budgets.bulkPut(restoredBudgets);
        if (restoredBudgetHistory.length) await db.budgetHistory.bulkPut(restoredBudgetHistory);
      });

      await loadData();
      setStatus({
        type: 'success',
        message: parsed.transactions.some((tx) => tx.type === 'income')
          ? 'Backup restored. Income transactions were not imported.'
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
            <h2>Weekly spending</h2>
          </div>

          <div className="chart-bars" aria-label="Weekly spending chart">
            {weeklySpending.map((day) => {
              const max = Math.max(...weeklySpending.map((item) => item.value), 1);
              return (
                <div key={day.label} className="bar-column">
                  <span className="bar-value">{Math.round(day.value).toLocaleString('en-PK')}</span>
                  <span className="bar" style={{ height: `${Math.max(18, (day.value / max) * 100)}%` }} />
                  <small>{day.label.slice(0, 3)}</small>
                </div>
              );
            })}
          </div>
          <p className="chart-footer">Expenses in PKR (Rs)</p>
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

    return (
      <div className="stacked-blocks">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Monthly</p>
              <h2>Analytics</h2>
            </div>
            <TrendingUp size={18} />
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <span>Expenses this month</span>
              <strong>{formatCurrency(monthlyExpense)}</strong>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Categories</p>
              <h2>Top spending</h2>
            </div>
          </div>

          <div className="category-list">
            {categoryTotals.length === 0 ? (
              <div className="empty-state">No expense data is available yet.</div>
            ) : (
              categoryTotals.map(([label, total]) => (
                <div key={label} className="category-row">
                  <span>{label}</span>
                  <strong>{formatCurrency(total)}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        <section ref={budgetAnalysisRef} className="panel budget-analytics-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Budget</p>
              <h2>Total budget balance</h2>
            </div>
          </div>
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
                <span>{remainingBalance < 0 ? 'Spent over budget' : 'Available balance'}</span>
                <strong className={remainingBalance < 0 ? 'expense' : ''}>
                  {formatCurrency(Math.abs(remainingBalance))}
                </strong>
              </div>
            </div>
            <div
              className={`budget-progress${remainingBalance < 0 ? ' over-budget' : ''}`}
              role="progressbar"
              aria-label="Overall budget spent"
              aria-valuemin="0"
              aria-valuemax={overallBudget || undefined}
              aria-valuenow={overallBudget ? Math.min(totalSpent, overallBudget) : totalSpent}
              aria-valuetext={`${Math.round(spendingPercent)}% used`}
            >
              <span style={{ width: `${Math.min(spendingPercent, 100)}%` }} />
            </div>
          </section>
        </section>
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
