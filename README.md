# PWS V1

## Project status
The project is an early functional prototype, not a complete V1 release.

### Implemented
- Local-first React/Vite PWA scaffold with Dexie/IndexedDB persistence
- First-run onboarding and an expense-only dashboard with monthly and weekly spending views
- Expense history, details, edit, and delete flows
- One cumulative overall budget with dated additions and expense-adjusted balance
- Category/payment-method management and JSON backup/restore

### Incomplete or not yet verified
- Analytics are limited; weekly and category reporting need further validation.
- Settings and support screens are not implemented beyond onboarding preferences.
- Automated coverage is limited to finance utility tests; UI, persistence, backup/restore, and offline behavior need tests.
- PWA build configuration exists, but installation and offline behavior have not been manually verified.
- The approved Figma section remains inaccessible from this environment, so visual parity is unverified.

## Stack
- React
- JavaScript
- Vite
- Dexie.js
- IndexedDB
- PWA support

## Product constraints
- PKR currency
- Light mode only
- Local-first storage
- Search and filter excluded from V1
- Cloud sync deferred

## Structure
- public/ - PWA static assets and metadata
- src/ - application source
- src/app/ - app shell and routing composition
- src/components/ - shared UI primitives
- src/features/ - feature-based domains
- src/services/ - Dexie, persistence, and data access logic
- src/hooks/ - reusable hooks
- src/styles/ - light-theme design tokens and global styles
- src/utils/ - currency, date, and validation utilities
- src/data/ - local seed/default data and domain models

## Project docs
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/REQUIREMENTS.md](docs/REQUIREMENTS.md)
- [docs/TECH_STACK.md](docs/TECH_STACK.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- [docs/FIGMA_SCREEN_MAP.md](docs/FIGMA_SCREEN_MAP.md)
- [docs/TEST_PLAN.md](docs/TEST_PLAN.md)
- [docs/DECISIONS.md](docs/DECISIONS.md)
- [docs/SOURCES.md](docs/SOURCES.md)

## Important note
The approved Figma section is not currently accessible from this environment. Design review is therefore blocked pending access to the public/shared design or exported screens.
