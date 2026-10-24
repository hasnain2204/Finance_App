# PWS V1 Roadmap

## Status
- Phase 0: Partially complete; design access is still blocked
- Phase 1: Specification drafted; design-dependent decisions remain open
- Phase 2: Early implementation in progress
- Application implementation: Functional prototype; not release-ready

## Current findings
- A React/Vite PWA is implemented with local Dexie/IndexedDB storage and core transaction flows.
- Expense-only dashboard and monthly-summary analytics are present; a cumulative overall budget balance is implemented.
- Category/payment-method management and JSON backup/restore are present; settings/support flows are not complete.
- The Figma section link returned HTTP 403 from this environment, so visual parity and the full screen inventory remain unverified.
- Automated tests currently cover finance utilities only; UI, database, restore, and offline behavior lack coverage.

## Phase 0 — Workspace, requirements, and design audit
Status: Partially complete

### Objectives
- Verify workspace contents and project initialization state.
- Review existing instructions and agent definition.
- Identify access limitations affecting design review.
- Record unresolved requirements and decision points.

### Acceptance criteria
- Workspace state is verified.
- Design access status is documented.
- Missing data and blockers are explicitly listed.

## Phase 1 — Project specification and architecture
Status: Partially complete

### Objectives
- Finalize the product scope and exclusions.
- Document the selected stack and architecture.
- Draft the data model and financial rules.
- Prepare implementation planning artifacts.

### Acceptance criteria
- Requirements are reconciled with the approved design source as far as access allows.
- Missing technical decisions are clearly identified.
- Roadmap and documentation are prepared for approval.

## Phase 2 — Core application implementation
Status: Early implementation in progress

### Implemented
- Local persistence, first-run onboarding, dashboard, transaction CRUD, and monthly totals
- Cumulative overall budget additions
- Category/payment-method management and JSON backup/restore
- PWA build configuration

### Remaining
- Complete weekly/monthly/category analytics, settings, and support requirements.
- Add UI/database/backup/offline tests and verify install/offline behavior.
- Review visual parity after Figma access is available.

## Dependency notes
- Design access is a prerequisite for visual parity review and final screen-by-screen scope confirmation.
- The React + JavaScript + Vite stack is implemented as the current baseline.
- Dexie.js + IndexedDB are approved for local-first storage.
- Search, filter, and cloud sync remain excluded from V1.

## Next actions
1. Obtain design access or exported frames for the approved Finance App MVP section.
2. Confirm whether budgets remain part of V1 and complete remaining settings/support/reporting flows.
3. Add UI/database/restore tests and verify PWA install/offline behavior.
