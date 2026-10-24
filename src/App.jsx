import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowLeftRight,
  CalendarDays,
  Clock3,
  ArrowUpRight,
  ChartNoAxesCombined,
  Download,
  Ellipsis,
  House,
  PiggyBank,
  Plus,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Upload,
  Utensils,
  WalletCards
} from 'lucide-react';
import { db, seedDatabase } from './db/db';
import { defaultBudgets, defaultCategories, defaultPaymentMethods } from './data/defaultData';
import {
  buildBackupPayload,
  calculateBalance,
  calculateMonthlySummary,
  formatCurrency,
  fromPaisa,
  toPaisa,
  validateTransaction
} from './lib/finance';

const initialForm = {
  title: '',
  amount: '',
  type: 'expense',
  categoryId: defaultCategories.find((category) => category.name === 'Other')?.id || defaultCategories[0].id,
  paymentMethodId: defaultPaymentMethods.find((method) => method.name === 'Other')?.id || defaultPaymentMethods[0].id,
  date: new Date().toISOString().slice(0, 10),
  notes: ''
};

const navItems = ['home', 'transactions', 'analytics', 'budget'];

function App() {
  const [tab, setTab] = useState('home');
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState(defaultCategories);
  const [paymentMethods, setPaymentMethods] = useState(defaultPaymentMethods);
  const [budgets, setBudgets] = useState(defaultBudgets);
  const [view, setView] = useState('all');
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: 'idle', message: '' });
  const [categoryInput, setCategoryInput] = useState('');
  const [methodInput, setMethodInput] = useState('');
  const [budgetInputs, setBudgetInputs] = useState({});
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

  const summary = useMemo(() => calculateBalance(transactions), [transactions]);
  const monthlySummary = useMemo(
    () => calculateMonthlySummary(transactions, new Date().toISOString().slice(0, 7)),
    [transactions]
  );

  const filteredTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .filter((tx) => (view === 'all' ? true : tx.type === view));
  }, [transactions, view]);

  const weeklySpending = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });

    return days.map((day) => {
      const iso = day.toISOString().slice(0, 10);
      const total = transactions
        .filter((tx) => tx.type === 'expense' && tx.date.startsWith(iso))
        .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

      return { label: day.toLocaleDateString('en-PK', { weekday: 'short' }), value: total };
    });
  }, [transactions]);

  const categoryTotals = useMemo(() => {
    const totals = {};

    transactions.forEach((tx) => {
      if (tx.type !== 'expense') return;
      const categoryName = categoryMap[tx.categoryId]?.name || 'Unknown';
      totals[categoryName] = (totals[categoryName] || 0) + Number(tx.amount || 0);
    });

    return Object.entries(totals).sort((a, b) => b[1] - a[1]);
  }, [transactions, categoryMap]);

  const loadData = async () => {
    try {
      await seedDatabase();
      const [allTx, allCategories, allMethods, allBudgets, appPreferences] = await Promise.all([
        db.transactions.orderBy('date').reverse().toArray(),
        db.categories.orderBy('name').toArray(),
        db.paymentMethods.orderBy('name').toArray(),
        db.budgets.toArray(),
        db.preferences.get('app')
      ]);

      setTransactions(allTx.map((tx) => ({ ...tx, amount: fromPaisa(Number(tx.amount || 0)) })));
      setCategories(allCategories.length ? allCategories : defaultCategories);
      setPaymentMethods(allMethods.length ? allMethods : defaultPaymentMethods);
      setBudgets(allBudgets.length ? allBudgets : defaultBudgets);
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

  const handleSubmit = async (event) => {
    event.preventDefault();

    const validation = validateTransaction(form);
    if (!validation.isValid) {
      setStatus({ type: 'error', message: validation.errors[0] });
      return;
    }

    const nextPayload = {
      title: form.title.trim(),
      amount: toPaisa(Number(form.amount)),
      type: form.type,
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
    await db.transactions.delete(selectedTransaction.id);
    setShowDeleteConfirm(false);
    setSelectedTransaction(null);
    setStatus({ type: 'idle', message: '' });
    await loadData();
    setTab('transactions');
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

  const handleBudgetChange = async (categoryId, value) => {
    const amount = Number(value || 0);
    await db.budgets.put({
      id: `budget-${categoryId}`,
      categoryId,
      month: new Date().toISOString().slice(0, 7),
      amount
    });
    loadData();
  };

  const handleExport = () => {
    const payload = buildBackupPayload({ transactions, categories, paymentMethods, budgets });
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
      if (!parsed || !Array.isArray(parsed.transactions)) {
        throw new Error('Invalid backup format');
      }

      await db.transaction('rw', db.transactions, db.categories, db.paymentMethods, db.budgets, async () => {
        await db.transactions.clear();
        await db.categories.clear();
        await db.paymentMethods.clear();
        await db.budgets.clear();

        if (Array.isArray(parsed.categories)) await db.categories.bulkPut(parsed.categories);
        if (Array.isArray(parsed.paymentMethods)) await db.paymentMethods.bulkPut(parsed.paymentMethods);
        if (Array.isArray(parsed.budgets)) await db.budgets.bulkPut(parsed.budgets);
        if (Array.isArray(parsed.transactions)) {
          await db.transactions.bulkPut(
            parsed.transactions.map((tx) => ({
              ...tx,
              amount: toPaisa(Number(tx.amount || 0))
            }))
          );
        }
      });

      setStatus({ type: 'success', message: 'Backup restored successfully.' });
      setTimeout(() => loadData(), 200);
    } catch (error) {
      setStatus({ type: 'error', message: 'The selected file could not be restored.' });
    } finally {
      event.target.value = '';
    }
  };

  const renderHome = () => (
    <>
      <section className="home-heading-meta">
        <h2>{`Good ${new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 18 ? 'Afternoon' : 'Evening'}, ${preferences?.name || 'User'}`}</h2>
        <p>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
      </section>

      <section className="hero-panel">
        <div className="hero-topline">
          <span className="muted-label">Available balance</span>
        </div>
        <div className="hero-amount">{formatCurrency(summary.balance)}</div>
        <div className="quick-metrics">
          <div className="quick-metrics_income">
            <span>Income</span>
            <strong className="income">{formatCurrency(summary.income)}</strong>
          </div>
          <div className="quick-metrics_expense">
            <span>Expense</span>
            <strong className="expense">{formatCurrency(summary.expense)}</strong>
          </div>
        </div>
        <button type="button" className="primary-action full hero-add-button" onClick={() => setTab('add-transaction')}>
          <Plus size={16} /> Add Transaction
        </button>
      </section>

      <section className="panel">
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

      <section className="panel">
        <div className="panel-header">
          <h2>Recent transactions</h2>
          <button type="button" className="link-button" onClick={() => setTab('transactions')}>View all</button>
        </div>

        <div className="transaction-list compact">
          {filteredTransactions.slice(0, 4).map((tx) => (
            <div key={tx.id} className="transaction-item">
              <div className={`transaction-icon ${tx.type}`}>
                {tx.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
              </div>
              <div className="transaction-copy">
                <strong>{tx.title}</strong>
                <span>{categoryMap[tx.categoryId]?.name || 'Category'}</span>
              </div>
              <div className="transaction-meta">
                <strong className={tx.type}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}</strong>
                <span>{new Date(tx.date).toLocaleDateString('en-PK')}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );

  const openAddTransactionFromFilter = () => {
    setEditingTransactionId(null);
    setSelectedTransaction(null);
    setForm((current) => {
      const expenseCategory = categories.find((category) => category.name === 'Other')?.id || categories[0]?.id || defaultCategories[0].id;
      const incomeCategory = categories.find((category) => category.type === 'income')?.id || expenseCategory;
      const otherMethod = paymentMethods.find((method) => method.name === 'Other')?.id || paymentMethods[0]?.id || defaultPaymentMethods[0].id;
      const type = view === 'all' ? 'expense' : view;

      return {
        ...initialForm,
        type,
        categoryId: type === 'income' ? incomeCategory : expenseCategory,
        paymentMethodId: otherMethod
      };
    });
    setTab('add-transaction');
  };

  const renderTransactions = () => (
    <div className="stacked-blocks">
      <section className="panel">
        <div className="panel-header">
          <h2>Transactions</h2>
        </div>

        <div className="segmented-control">
          {['all', 'income', 'expense'].map((item) => (
            <button
              key={item}
              type="button"
              className={view === item ? 'seg-button active' : 'seg-button'}
              onClick={() => setView(item)}
            >
              {item === 'all' ? 'All' : item === 'income' ? 'Income' : 'Expense'}
            </button>
          ))}
        </div>

        <button type="button" className="primary-action full transaction-list-add-button" onClick={openAddTransactionFromFilter}>
          <Plus size={16} /> {view === 'income' ? 'Add Income' : view === 'expense' ? 'Add Expense' : 'Add Transaction'}
        </button>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">History</p>
            <h2>Transaction list</h2>
          </div>
        </div>

        <div className="transaction-list">
          {filteredTransactions.length === 0 ? (
            <div className="empty-state">No transactions yet.</div>
          ) : (
            filteredTransactions.map((tx) => (
              <button
                key={tx.id}
                type="button"
                className="transaction-item transaction-row"
                onClick={() => {
                  setSelectedTransaction(tx);
                  setShowDeleteConfirm(false);
                  setTab('transaction-detail');
                }}
              >
                <div className={`transaction-icon ${tx.type}`}>
                  {tx.type === 'income' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </div>
                <div className="transaction-copy">
                  <strong>{tx.title}</strong>
                  <span>{categoryMap[tx.categoryId]?.name || 'Category'} · {paymentMap[tx.paymentMethodId]?.name || 'Method'}</span>
                </div>
                <div className="transaction-meta align-right">
                  <strong className={tx.type}>{tx.type === 'income' ? '+' : '-'}{formatCurrency(Number(tx.amount || 0))}</strong>
                  <span>{new Date(tx.date).toLocaleDateString('en-PK')}</span>
                </div>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );

  const renderAddTransaction = () => (
    <main className="add-transaction-shell">
      <header className="add-transaction-header">
        <button type="button" className="back-button" onClick={() => setTab(editingTransactionId ? 'transactions' : 'home')} aria-label={editingTransactionId ? 'Back to transactions' : 'Back to home'}>
          <ArrowLeft size={22} />
        </button>
        <h1>{editingTransactionId ? 'Edit Transaction' : 'Add Transaction'}</h1>
      </header>

      <section className="add-transaction-content">
        <div className="transaction-type-control" aria-label="Transaction type">
          <button
            type="button"
            className={form.type === 'income' ? 'active' : ''}
            onClick={() => setForm((current) => ({ ...current, type: 'income', categoryId: categories.find((category) => category.type === 'income')?.id || current.categoryId }))}
          >Income</button>
          <button
            type="button"
            className={form.type === 'expense' ? 'active' : ''}
            onClick={() => setForm((current) => ({ ...current, type: 'expense', categoryId: categories.find((category) => category.name === 'Other')?.id || current.categoryId }))}
          >Expense</button>
        </div>

        <form className="transaction-form" onSubmit={handleSubmit}>
          <label htmlFor="transaction-amount">Amount (PKR)</label>
          <input id="transaction-amount" name="amount" type="number" step="0.01" min="0.01" value={form.amount} onChange={handleInputChange} placeholder="Rs0" />

          {form.type === 'expense' ? (
            <>
              <label htmlFor="transaction-category">Category</label>
              <select id="transaction-category" name="categoryId" value={form.categoryId} onChange={handleInputChange}>
                {categories.filter((category) => category.type === 'expense').map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </>
          ) : null}

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
            {editingTransactionId ? 'Save Changes' : 'Save Transaction'}
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
      type: selectedTransaction.type || 'expense',
      categoryId: selectedTransaction.categoryId,
      paymentMethodId: selectedTransaction.paymentMethodId,
      date: selectedTransaction.date || new Date().toISOString().slice(0, 10),
      notes: selectedTransaction.notes || ''
    });
    setTab('add-transaction');
  };

  const renderTransactionDetail = () => {
    if (!selectedTransaction) return null;
    const categoryName = categoryMap[selectedTransaction.categoryId]?.name || 'Other';
    const methodName = paymentMap[selectedTransaction.paymentMethodId]?.name || 'Other';
    const date = new Date(selectedTransaction.date);

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
            <span className={`detail-icon ${selectedTransaction.type}`}><Utensils size={26} strokeWidth={1.7} /></span>
            <h2>{categoryName}</h2>
            <strong className={selectedTransaction.type}>{selectedTransaction.type === 'income' ? '+' : '-'} {formatCurrency(Number(selectedTransaction.amount || 0))}</strong>
            <p>{selectedTransaction.type === 'income' ? 'Income' : 'Expense'}</p>
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
            <span>Income</span>
            <strong>{formatCurrency(monthlySummary.income)}</strong>
          </div>
          <div className="metric-card">
            <span>Expense</span>
            <strong>{formatCurrency(monthlySummary.expense)}</strong>
          </div>
          <div className="metric-card accent">
            <span>Balance</span>
            <strong>{formatCurrency(monthlySummary.balance)}</strong>
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

  const renderBudget = () => (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Monthly</p>
          <h2>Budget planner</h2>
        </div>
        <PiggyBank size={18} />
      </div>

      <div className="budget-list">
        {categories.filter((category) => category.type === 'expense').map((category) => {
          const categoryBudget = budgets.find((item) => item.categoryId === category.id) || { amount: 0 };
          const spent = transactions
            .filter((tx) => tx.categoryId === category.id && tx.type === 'expense')
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

          return (
            <div key={category.id} className="budget-item">
              <div className="budget-row">
                <strong>{category.name}</strong>
                <span>{formatCurrency(Math.max(categoryBudget.amount - spent, 0))} left</span>
              </div>
              <div className="progress">
                <span style={{ width: `${Math.min(100, (spent / Math.max(categoryBudget.amount, 1)) * 100)}%` }} />
              </div>
              <div className="budget-row muted">
                <span>Spent {formatCurrency(spent)}</span>
                <input
                  className="budget-input"
                  type="number"
                  min="0"
                  value={budgetInputs[category.id] ?? categoryBudget.amount ?? 0}
                  onChange={(event) => {
                    const value = event.target.value;
                    setBudgetInputs((current) => ({ ...current, [category.id]: value }));
                    handleBudgetChange(category.id, value);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

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
        <div className="topbar-actions">
          <button
            type="button"
            className={tab === 'more' ? 'more-button active' : 'more-button'}
            onClick={() => setTab('more')}
            aria-label="More options"
            title="More"
          >
            <Ellipsis size={22} />
          </button>
        </div>
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
