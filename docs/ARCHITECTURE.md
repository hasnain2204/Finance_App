# Architecture

The comprehensive system architecture document for PWS V1 is located at:

👉 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**

### Quick Architecture Summary

* **Pattern:** Local-first, dual-persistence boundary with offline outbox synchronization.
* **Frontend:** React 19 + Vite 8.
* **Storage Engines:**
  * **Web / PWA:** Dexie.js (IndexedDB) with schema versions v1–v6.
  * **Android Native:** `@capacitor-community/sqlite` with schema v1–v2.
* **Persistence Boundary:** `src/services/financeRepository.js` provides an agnostic interface for UI components.
* **Currency & Precision:** PKR (₨) represented in integer paisas (`1 PKR = 100 Paisa`) to prevent floating-point drift.
* **Cloud Sync:** Outbox queue pattern with compare-and-swap (CAS) optimistic concurrency, idempotency ledger, and conflict detection via Supabase (PostgreSQL).

For full architectural diagrams, component responsibilities, sync sequence flows, and database schemas, please refer to **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.
