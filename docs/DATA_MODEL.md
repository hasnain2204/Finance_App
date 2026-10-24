# Data Model

## Core entities
- Transactions
- Categories
- Budgets
- Overall budget change history
- Payment methods
- User preferences

## Financial rule notes
- Transaction amounts should use a consistent financial representation to avoid floating-point errors.
- PKR is the canonical currency for V1.
- Transactions are expenses only; amounts are stored in paisa.
- Budget amounts are stored in paisa. The `budget-all-overall` record stores the cumulative overall budget balance; older month-keyed budget records are retained for compatibility.
- New overall budget additions are stored in budget history as dated contributions, with the amount, balance before the addition, timestamp, and optional description. They appear in budget and transaction history and are separate from expense transactions.
- The available balance is the cumulative budget additions minus all recorded expenses, regardless of date or month. Editing or deleting an addition updates the cumulative balance.
- Calculation logic should be centralized rather than duplicated in UI components.

## Migration
- Database version 2 removes saved income transactions and income categories.
- Database version 3 adds the `budgetHistory` store for overall monthly limit changes.
- Database version 4 indexes budget history by category.
- Existing category budgets are converted from rupees to paisa; budgets for removed categories are discarded.
- Existing monthly overall budgets are combined into the cumulative balance when the app first loads the new budget model.
- Backup version 2 includes budgets and budget change history; version 1 backups remain importable and any income transactions are skipped.
