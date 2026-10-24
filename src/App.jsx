import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Download,
  Ellipsis,
  House,
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
  paymentMethodId: defaultPaymentMethods.find((method) => method.name === 'Other')?.id || defaultPaymentMethods[0].id,
  date: getLocalDateString(),
  notes: ''
};

const navItems = ['home', 'transactions', 'analytics', 'budget'];

function App() {
  const [tab, setTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [budgetHistory, setBudgetHistory] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [paymentMethods, setPaymentMethods] = useState(defaultPaymentMethods);
  const [budgets, setBudgets] = useState([]);
  const [budgetForm, setBudgetForm] = useState({
    date: getLocalDateString(),
    amount: '',
    description: ''
  });
  const [editingBudgetHistoryId, setEditingBudgetHistoryId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [categoryInput, setCategoryInput] = useState('');
  const [methodInput, setMethodInput] = useState('');
  const [preferences, setPreferences] = useState(null);
  const [onboardingName, setOnboardingName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [editingTransactionId, setEditingTransactionId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef(null);

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
      setPreferences(appPreferences || { id: 'app', currency: 'PKR', lightMode: true });
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to load saved data.' });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
    const { date, amount, description } = budgetForm;
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
                previousAmount: entryTotal,
                amount: paisaAmount,
                description: description.trim(),
                createdAt: timestamp.toISOString(),
                entryType: 'addition'
              }
            : {
                ...createBudgetHistoryEntry(month, 'overall', currentTotal, paisaAmount, description, date, timestamp),
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
      setBudgetForm({ date: getLocalDateString(), amount: '', description: '' });
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
      amount: entry.amount === null ? '' : String(fromPaisa(entry.amount)),
      description: entry.description || ''
    });
    setStatus({ type: 'idle', message: '' });
    setTab('budget');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateTransaction(form);
    if (!validation.isValid) {
      setStatus({ type: 'error', message: validation.errors[0] });
      return;
    }

    const highestNumber = transactions.reduce((highest, tx) => {
      const match = String(tx.title || '').match(/^Expense(\d+)$/i);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0);
    const defaultTitle = `Expense${highestNumber + 1}`;
    const nextPayload = {
      title: form.title.trim() || defaultTitle,
      amount: toPaisa(Number(form.amount)),
      type: 'expense',
      categoryId: form.categoryId,
      paymentMethodId: form.paymentMethodId,
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
      paymentMethodId: paymentMethods.find((method) => method.name === 'Other')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id
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
    if (!trimmed) return;

    await db.categories.put({
      id: `cat-${Date.now()}`,
      name: trimmed,
      type: 'expense'
    });
    setCategoryInput('');
    loadData();
  };

  const handleAddMethod = async () => {
    const trimmed = methodInput.trim();
    if (!trimmed) return;

    await db.paymentMethods.put({
      id: `pm-${Date.now()}`,
      name: trimmed
    });
    setMethodInput('');
    loadData();
  };

  const handleExport = () => {
    const payload = buildBackupPayload({ transactions, categories, paymentMethods, budgets, budgetHistory });
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'pws-v1-backup.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus({ type: 'success', message: 'Backup exported successfully.' });
  };

  const handleRestore = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
              (entry.description !== undefined && typeof entry.description !== 'string') ||
              !validAmount(entry.previousAmount) ||
              !validAmount(entry.amount)
            ) {
              throw new Error('Invalid budget history in backup');
            }
            return { ...entry };
          })
        : [];

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
      setStatus({ type: 'error', message: 'The selected file could not be restored.' });
    } finally {
      event.target.value = '';
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
    const title = isBudgetChange
      ? isBudgetAddition
        ? 'Budget added'
        : entry.amount === null
          ? `${budgetLabel} removed`
          : entry.previousAmount === null
            ? `${budgetLabel} set`
            : `${budgetLabel} updated`
      : entry.title;
    const subtitle = isBudgetChange
      ? isBudgetAddition
        ? 'Added to overall budget'
        : `${budgetLabel} · ${new Date(`${entry.month}-01T00:00:00`).toLocaleDateString('en-PK', { month: 'short', year: 'numeric' })}`
      : `${categoryMap[entry.categoryId]?.name || 'Category'} · ${paymentMap[entry.paymentMethodId]?.name || 'Method'}`;
    const amount = isBudgetChange
      ? entry.amount === null
        ? 'Removed'
        : formatCurrency(fromPaisa(entry.amount))
      : `-${formatCurrency(Number(entry.amount || 0))}`;

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
          <strong>{title}</strong>
          <span>{subtitle}</span>
          {isBudgetChange && entry.description ? <span>{entry.description}</span> : null}
        </div>
        <div className="transaction-meta align-right">
          <strong className={isBudgetChange ? 'budget-change-value' : 'expense'}>{amount}</strong>
          <span>{new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-PK')}</span>
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
    setForm((current) => {
      const expenseCategory = categories.find((category) => category.name === 'Other')?.id || categories[0]?.id || defaultCategories[0].id;
      const otherMethod = paymentMethods.find((method) => method.name === 'Other')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id;

      return {
        ...initialForm,
        categoryId: expenseCategory,
        paymentMethodId: otherMethod
      };
    });
    setTab('add-transaction');
  };

  const renderTransactions = () => (
    <div className="stacked-blocks">
      <section className="panel">
        <div className="panel-header">
          <h2>Expenses</h2>
        </div>

        <button type="button" className="primary-action full transaction-list-add-button" onClick={openAddExpense}>
          <Plus size={16} /> Add Expense
        </button>
      </section>

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
              <div><span>Date</span><strong>{date.toLocaleDateString('en-PK')}</strong></div>
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
            <div><span>Date</span><strong>{date.toLocaleDateString('en-PK')}</strong></div>
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

  const renderAnalytics = () => (
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
    </div>
  );

  const renderBudget = () => {
    const overallBudget = fromPaisa(totalBudgetPaisa);
    const totalSpent = calculateExpenseTotal(transactions);
    const remainingBalance = overallBudget - totalSpent;
    const spendingPercent = overallBudget > 0 ? (totalSpent / overallBudget) * 100 : 0;
    const sortedBudgetHistory = [...budgetHistory]
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return (
      <div className="stacked-blocks">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Overall budget</p>
              <h2>Add to budget</h2>
            </div>
          </div>

          <form className="budget-form" onSubmit={handleSaveBudget}>
            <div className="budget-entry-box">
              <label htmlFor="budget-date">Date</label>
              <input
                id="budget-date"
                name="date"
                type="date"
                value={budgetForm.date}
                onChange={handleBudgetFormChange}
                required
              />

              <label htmlFor="budget-amount">Amount (PKR)</label>
              <input
                id="budget-amount"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                placeholder="Rs0"
                value={budgetForm.amount}
                onChange={handleBudgetFormChange}
                required
              />

              <label htmlFor="budget-description">Description (optional)</label>
              <textarea
                id="budget-description"
                name="description"
                value={budgetForm.description}
                onChange={handleBudgetFormChange}
                placeholder="Add a note"
                rows="3"
              />
            </div>

            {status.message ? (
              <p className={`status ${status.type}`} role={status.type === 'error' ? 'alert' : 'status'}>
                {status.message}
              </p>
            ) : null}

            <button className="primary-action full" type="submit">
              {editingBudgetHistoryId ? 'Update Budget' : 'Save Budget'}
            </button>
            {editingBudgetHistoryId ? (
              <button
                className="secondary-button wide"
                type="button"
                onClick={() => {
                  setEditingBudgetHistoryId(null);
                  setBudgetForm({ date: getLocalDateString(), amount: '', description: '' });
                  setSelectedTransaction(null);
                  setStatus({ type: 'idle', message: '' });
                }}
              >
                Cancel editing
              </button>
            ) : null}
          </form>

          <section className="budget-overall-summary">
            <h3 className="budget-section-title">Total budget balance</h3>
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

        <section className="panel budget-history-panel">
          <div className="panel-header">
            <h2>Budget history</h2>
          </div>
          <div className="budget-history-list">
            {sortedBudgetHistory.length === 0 ? (
              <div className="empty-state">No budget history yet.</div>
            ) : (
              sortedBudgetHistory.map((entry) => {
                const isBudgetAddition = entry.entryType === 'addition';
                const previousAmount = entry.previousAmount === null || entry.previousAmount === undefined
                  ? 'Not set'
                  : formatCurrency(fromPaisa(entry.previousAmount));
                const amount = entry.amount === null
                  ? 'Removed'
                  : formatCurrency(fromPaisa(entry.amount));

                return (
                  <article className="budget-history-entry" key={entry.id}>
                    <div className="budget-history-heading">
                      <strong>{isBudgetAddition ? 'Budget added' : 'Previous budget entry'}</strong>
                      <span>{entry.amount === null ? 'Removed' : isBudgetAddition ? 'Added' : entry.previousAmount === null ? 'Set' : 'Updated'}</span>
                    </div>
                    <p className="budget-history-amount">
                      {isBudgetAddition ? `+${amount}` : <>{previousAmount} <span aria-hidden="true">→</span> {amount}</>}
                    </p>
                    <time dateTime={entry.createdAt}>
                      {new Date(`${entry.date}T00:00:00`).toLocaleDateString('en-PK', { dateStyle: 'medium' })}
                      {' · '}
                      {new Date(entry.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </time>
                    {entry.description ? <p className="budget-history-description">{entry.description}</p> : null}
                    <div className="budget-history-actions">
                      {entry.amount !== null ? (
                        <button
                          type="button"
                          className="detail-edit-button"
                          onClick={() => openBudgetHistoryEditor(entry)}
                        >
                          Edit
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="detail-delete-button"
                        onClick={() => {
                          setSelectedTransaction({ ...entry, historyType: 'budget', returnTab: 'budget' });
                          setShowDeleteConfirm(true);
                        }}
                      >
                        <Trash2 size={16} /> Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {showDeleteConfirm && selectedTransaction?.historyType === 'budget' && selectedTransaction.returnTab === 'budget' ? (
          <div className="delete-overlay" role="presentation">
            <section className="delete-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-budget-history-title">
              <h2 id="delete-budget-history-title">Delete Budget History?</h2>
              <p>
                {selectedTransaction.entryType === 'addition'
                  ? 'This budget addition will be removed from your total balance.'
                  : 'This previous budget entry will be removed.'}
              </p>
              <div className="delete-dialog-actions">
                <button type="button" className="dialog-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                <button type="button" className="dialog-delete" onClick={handleDelete}><Trash2 size={17} /> Delete</button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    );
  };

  const renderMore = () => (
    <div className="stacked-blocks">
      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Manage</p>
            <h2>Categories</h2>
          </div>
        </div>

        <div className="inline-form">
          <input value={categoryInput} onChange={(event) => setCategoryInput(event.target.value)} placeholder="Add category" />
          <button type="button" className="secondary-button" onClick={handleAddCategory}>Add</button>
        </div>

        <div className="chip-list">
          {categories.map((category) => (
            <span key={category.id} className="chip">{category.name}</span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Manage</p>
            <h2>Payment methods</h2>
          </div>
        </div>

        <div className="inline-form">
          <input value={methodInput} onChange={(event) => setMethodInput(event.target.value)} placeholder="Add payment method" />
          <button type="button" className="secondary-button" onClick={handleAddMethod}>Add</button>
        </div>

        <div className="chip-list">
          {paymentMethods.map((method) => (
            <span key={method.id} className="chip">{method.name}</span>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Data</p>
            <h2>Backup & restore</h2>
          </div>
        </div>

        <div className="inline-form stacked">
          <button type="button" className="secondary-button wide" onClick={handleExport}>
            <Download size={16} /> Export backup
          </button>
          <button type="button" className="secondary-button wide" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} /> Restore backup
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" hidden onChange={handleRestore} />
        </div>
      </section>
    </div>
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
