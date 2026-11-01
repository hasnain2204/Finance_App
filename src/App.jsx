import { lazy, Suspense } from 'react';
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  Ellipsis,
  House,
  WalletCards
} from 'lucide-react';
import { useFinanceApp, navItems } from './hooks/useFinanceApp';
import { HomeScreen } from './features/dashboard/HomeScreen';
import { AnalyticsScreen } from './features/dashboard/AnalyticsScreen';
import { TransactionsScreen } from './features/transactions/TransactionsScreen';
import { AddTransactionScreen } from './features/transactions/AddTransactionScreen';
import { TransactionDetailScreen } from './features/transactions/TransactionDetailScreen';
import { BudgetScreen } from './features/budgets/BudgetScreen';
import { CategoriesScreen } from './features/categories/CategoriesScreen';
import { MoreScreen } from './features/settings/MoreScreen';
import { PreferencesScreen } from './features/settings/PreferencesScreen';
import { HelpScreen } from './features/settings/HelpScreen';
import { AboutScreen } from './features/settings/AboutScreen';
import { ExportDataScreen } from './features/settings/ExportDataScreen';
import { RestoreDataScreen } from './features/settings/RestoreDataScreen';
import { PaymentMethodsScreen } from './features/settings/PaymentMethodsScreen';
import { OnboardingScreen } from './features/settings/OnboardingScreen';

const CloudAccountPanel = lazy(() => import('./components/CloudAccountPanel'));

function App() {
  const app = useFinanceApp();
  const {
    tab,
    setTab,
    isLoading,
    preferences,
    status,
    setStatus,
    loadData,
    repository
  } = app;

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
      <OnboardingScreen
        onboardingName={app.onboardingName}
        setOnboardingName={app.setOnboardingName}
        status={status}
        onContinue={app.handleContinueOnboarding}
      />
    );
  }

  if (tab === 'add-transaction') {
    return (
      <AddTransactionScreen
        editingTransactionId={app.editingTransactionId}
        form={app.form}
        categories={app.categories}
        paymentMethods={app.paymentMethods}
        status={status}
        onBack={() => setTab(app.editingTransactionId ? 'transactions' : 'home')}
        onChange={app.handleInputChange}
        onSubmit={app.handleSubmit}
      />
    );
  }

  if (tab === 'transaction-detail') {
    return (
      <TransactionDetailScreen
        selectedTransaction={app.selectedTransaction}
        categoryMap={app.categoryMap}
        paymentMap={app.paymentMap}
        preferences={preferences}
        showDeleteConfirm={app.showDeleteConfirm}
        onBack={() => setTab(
          app.selectedTransaction?.historyType === 'budget'
            ? (app.selectedTransaction.returnTab || 'transactions')
            : 'transactions'
        )}
        onEditBudget={app.openBudgetHistoryEditor}
        onEditTransaction={app.openTransactionEditor}
        onRequestDelete={() => app.setShowDeleteConfirm(true)}
        onCancelDelete={() => app.setShowDeleteConfirm(false)}
        onConfirmDelete={app.handleDelete}
      />
    );
  }

  if (tab === 'account') {
    return (
      <CategoriesScreen
        categories={app.categories}
        selectedCategoryId={app.selectedCategoryId}
        categoryNameDraft={app.categoryNameDraft}
        setCategoryNameDraft={app.setCategoryNameDraft}
        categoryEditStatus={app.categoryEditStatus}
        setCategoryEditStatus={app.setCategoryEditStatus}
        showAddCategoryForm={app.showAddCategoryForm}
        setShowAddCategoryForm={app.setShowAddCategoryForm}
        categoryInput={app.categoryInput}
        setCategoryInput={app.setCategoryInput}
        categoryToDelete={app.categoryToDelete}
        setCategoryToDelete={app.setCategoryToDelete}
        onSelect={app.handleSelectCategory}
        onSave={app.handleSaveCategory}
        onAdd={app.handleAddCategory}
        onDelete={app.handleDeleteCategory}
        onBack={() => setTab('more')}
      />
    );
  }

  if (tab === 'cloud-account') {
    return (
      <Suspense fallback={<main className="account-shell" role="status">Loading account tools…</main>}>
        <CloudAccountPanel repository={repository} onDataChanged={loadData} onBack={() => setTab('more')} />
      </Suspense>
    );
  }

  if (tab === 'payment-methods') {
    return (
      <PaymentMethodsScreen
        paymentMethods={app.paymentMethods}
        selectedPaymentMethodId={app.selectedPaymentMethodId}
        paymentMethodNameDraft={app.paymentMethodNameDraft}
        setPaymentMethodNameDraft={app.setPaymentMethodNameDraft}
        paymentMethodEditStatus={app.paymentMethodEditStatus}
        setPaymentMethodEditStatus={app.setPaymentMethodEditStatus}
        showAddPaymentMethodForm={app.showAddPaymentMethodForm}
        setShowAddPaymentMethodForm={app.setShowAddPaymentMethodForm}
        methodInput={app.methodInput}
        setMethodInput={app.setMethodInput}
        paymentMethodToDelete={app.paymentMethodToDelete}
        setPaymentMethodToDelete={app.setPaymentMethodToDelete}
        onSelect={app.handleSelectPaymentMethod}
        onSave={app.handleSavePaymentMethod}
        onAdd={app.handleAddMethod}
        onDelete={app.handleDeletePaymentMethod}
        onBack={() => setTab('more')}
      />
    );
  }

  if (tab === 'preferences') {
    return (
      <PreferencesScreen
        preferenceDateFormatDraft={app.preferenceDateFormatDraft}
        setPreferenceDateFormatDraft={app.setPreferenceDateFormatDraft}
        preferenceNotificationsDraft={app.preferenceNotificationsDraft}
        setPreferenceNotificationsDraft={app.setPreferenceNotificationsDraft}
        preferenceSaveStatus={app.preferenceSaveStatus}
        setPreferenceSaveStatus={app.setPreferenceSaveStatus}
        onSave={app.handleSavePreferences}
        onBack={() => setTab('more')}
      />
    );
  }

  if (tab === 'help') {
    return <HelpScreen onBack={() => setTab('more')} />;
  }

  if (tab === 'about') {
    return <AboutScreen onBack={() => setTab('more')} />;
  }

  if (tab === 'export-data') {
    return (
      <ExportDataScreen
        status={status}
        onExport={app.handleExport}
        onBack={() => setTab('more')}
      />
    );
  }

  if (tab === 'restore-data') {
    return (
      <RestoreDataScreen
        fileInputRef={app.fileInputRef}
        status={status}
        setStatus={setStatus}
        restoreCandidate={app.restoreCandidate}
        setRestoreCandidate={app.setRestoreCandidate}
        migrationReport={app.migrationReport}
        showRestoreConfirm={app.showRestoreConfirm}
        setShowRestoreConfirm={app.setShowRestoreConfirm}
        isPreparingRestore={app.isPreparingRestore}
        onFileChange={app.handleRestoreFileChange}
        onConfirmRestore={app.handleConfirmRestore}
        onBack={() => setTab('more')}
      />
    );
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
                app.setFocusBudgetAnalysis(true);
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
        {tab === 'home' && (
          <HomeScreen
            preferences={preferences}
            budgets={app.budgets}
            totalBudgetPaisa={app.totalBudgetPaisa}
            transactions={app.transactions}
            weeklySpending={app.weeklySpending}
            transactionHistory={app.transactionHistory}
            categoryMap={app.categoryMap}
            paymentMap={app.paymentMap}
            onOpenAddExpense={app.openAddExpense}
            onOpenBudget={() => setTab('budget')}
            onOpenTransactions={() => setTab('transactions')}
            onOpenTransaction={app.openTransactionDetail}
          />
        )}
        {tab === 'transactions' && (
          <TransactionsScreen
            transactionHistory={app.transactionHistory}
            categoryMap={app.categoryMap}
            paymentMap={app.paymentMap}
            dateFormat={preferences?.dateFormat}
            onOpenAddExpense={app.openAddExpense}
            onOpenTransaction={app.openTransactionDetail}
          />
        )}
        {tab === 'analytics' && (
          <AnalyticsScreen
            transactions={app.transactions}
            totalBudgetPaisa={app.totalBudgetPaisa}
            monthlyExpense={app.monthlyExpense}
            monthlyExpenseTrend={app.monthlyExpenseTrend}
            monthlyBudgetTrend={app.monthlyBudgetTrend}
            categoryTotals={app.categoryTotals}
            paymentMethodTotals={app.paymentMethodTotals}
            budgetAnalysisRef={app.budgetAnalysisRef}
          />
        )}
        {tab === 'budget' && (
          <BudgetScreen
            budgetFormRef={app.budgetFormRef}
            budgetForm={app.budgetForm}
            editingBudgetHistoryId={app.editingBudgetHistoryId}
            status={status}
            budgetHistory={app.budgetHistory}
            categoryMap={app.categoryMap}
            paymentMap={app.paymentMap}
            dateFormat={preferences?.dateFormat}
            onFormChange={app.handleBudgetFormChange}
            onSave={app.handleSaveBudget}
            onOpenTransaction={app.openTransactionDetail}
          />
        )}
        {tab === 'more' && (
          <MoreScreen
            preferences={preferences}
            status={status}
            onOpenCloudAccount={() => setTab('cloud-account')}
            onOpenAccount={() => app.openAccount()}
            onOpenPaymentMethods={() => app.openPaymentMethods()}
            onOpenExport={() => {
              setStatus({ type: 'idle', message: '' });
              setTab('export-data');
            }}
            onOpenRestore={() => {
              app.setRestoreCandidate(null);
              setStatus({ type: 'idle', message: '' });
              setTab('restore-data');
            }}
            onOpenPreferences={app.openPreferences}
            onOpenHelp={() => setTab('help')}
            onOpenAbout={() => setTab('about')}
          />
        )}
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
