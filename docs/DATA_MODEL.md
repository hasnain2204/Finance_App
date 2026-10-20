# Data Model

## Core entities
- Transactions
- Categories
- Budgets
- Payment methods
- User preferences

## Financial rule notes
- Transaction amounts should use a consistent financial representation to avoid floating-point errors.
- PKR is the canonical currency for V1.
- Transactions should be explicitly typed as income or expense.
- Calculation logic should be centralized rather than duplicated in UI components.

## Pending decisions
- Exact schema fields for transactions and categories remain subject to review against the approved design and requirements.
- Backup/restore behavior still requires confirmation on merge vs replace semantics.
