# Decisions

## Confirmed decisions
- React + JavaScript + Vite is the official frontend approach.
- Dexie.js + IndexedDB is the approved local-first data layer.
- Light mode only is required.
- PKR currency is required.
- Search and filter are excluded from V1.
- Cloud sync is deferred to a future phase.
- Transaction entry, history, dashboard totals, and analytics are expense-only.
- Existing income records are removed during the database upgrade to the expense-only model.
- The budget is one cumulative overall balance; each dated addition remains in the total regardless of month, and expenses reduce the available balance.

## Pending decisions
- Final design-specific screen inventory
- Exact category/payment method behavior and management rules
- Backup/restore merge-vs-replace behavior
- Further product ambiguity requiring user confirmation
