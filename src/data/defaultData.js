export const defaultCategories = [
  { id: 'cat-food', name: 'Food', type: 'expense' },
  { id: 'cat-transport', name: 'Transport', type: 'expense' },
  { id: 'cat-education', name: 'Education', type: 'expense' },
  { id: 'cat-bills', name: 'Bills', type: 'expense' },
  { id: 'cat-shopping', name: 'Shopping', type: 'expense' },
  { id: 'cat-health', name: 'Health', type: 'expense' },
  { id: 'cat-entertainment', name: 'Entertainment', type: 'expense' },
  { id: 'cat-other', name: 'Other', type: 'expense' },
  { id: 'cat-income', name: 'Income', type: 'income' }
];

export const defaultPaymentMethods = [
  { id: 'pm-cash', name: 'Cash' },
  { id: 'pm-bank', name: 'Bank' },
  { id: 'pm-card', name: 'Card' },
  { id: 'pm-easypaisa', name: 'Easypaisa' },
  { id: 'pm-jazzcash', name: 'JazzCash' },
  { id: 'pm-other', name: 'Other' }
];

export const defaultBudgets = [
  { id: 'budget-food', categoryId: 'cat-food', month: '2026-10', amount: 10000 },
  { id: 'budget-transport', categoryId: 'cat-transport', month: '2026-10', amount: 5000 },
  { id: 'budget-bills', categoryId: 'cat-bills', month: '2026-10', amount: 12000 }
];
