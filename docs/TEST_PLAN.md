# Test Plan

## Scope
The V1 test plan covers local data flows, UI states, app usability, financial calculations, and offline behavior.

## Planned test categories
- Expense form validation and recording
- Edit and delete flows
- Empty and error states
- Persistence after reload
- Cumulative overall budget additions, expenses, edits, and deletions across dates
- Expense analytics logic
- Database migration removes existing income records
- PWA install/offline behavior
- Responsive mobile views

## Status
- Finance and budget-calculation tests are implemented and run in Vitest.
- UI, IndexedDB persistence, restore validation, and offline/PWA behavior are not yet covered.
- Design review remains blocked by Figma access; it is not a prerequisite for running code tests.
