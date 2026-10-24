# Requirements

## Product summary
PWS V1 is a personal finance and expense-tracking PWA for Pakistan, designed for local-first mobile usage.

## Core product constraints
- Currency: PKR
- Light mode only
- Local-first storage using IndexedDB via Dexie.js
- React + JavaScript + Vite
- PWA first; Android packaging with Capacitor is a later phase
- Cloud sync is future phase only
- Search and Filter are excluded from V1
- The approved Finance App MVP section is the design source of truth

## In-scope V1 expectations
- Welcome/setup screen
- Home/overview dashboard
- Monthly expense total
- Weekly spending overview
- Recent transactions
- Add expense transactions only
- Transaction history
- Expense history
- Transaction details
- Edit and delete flows
- Expense analytics by week, month, and category
- Cumulative overall budget additions; previous additions remain in the total balance
- Category management
- Payment method management
- Backup/restore flows
- Preferences and support screens
- Responsive mobile-first behavior
- Offline/PWA-friendly behavior for installed app usage

## Explicit exclusions
- Search and filter
- Bank integrations
- Cloud sync / Supabase in V1
- Authentication/accounts requirement
- Investment tracking
- Multiple currencies
- AI financial advice
- Unapproved advanced reporting
- Unnecessary backend infrastructure

## Major unresolved items
- Final screen inventory and actual Figma review are currently blocked by access restrictions.
- Some product decisions must be confirmed by the user before feature-level implementation.

## Expense-only scope
- Income entry, income categories, and income history are excluded.
- Existing income transactions are removed when the local database upgrades to the expense-only version.
- Dashboard and analytics totals report expenses only.
