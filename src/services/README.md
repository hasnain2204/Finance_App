# Services

`financeRepository.js` is the application persistence boundary. It routes web/PWA storage to Dexie/IndexedDB and native Capacitor storage to SQLite, and owns database reads, writes, and atomic multi-record operations. React components should use the repository rather than importing a database directly.

Local create, update, delete, and backup-restore operations enqueue durable outbox entries in the same local transaction. Dexie schema v6 and native SQLite schema v2 add the outbox, conflict records, account binding metadata, and per-record server revision state without rewriting the six finance tables. The derived `budget-all-overall` row remains device-local.

`financeSync.js` implements the explicit initial preview/confirmation flow, incremental push/pull RPCs, idempotent retries, owner checks, and revision conflicts. A local database binds to one authenticated account. Queue items also retain the account that was active when they were written; mismatched items stay paused. Reconnect, page resume/focus, and manual actions trigger retry checks. No browser Background Sync dependency is required.

Remote delete tombstones are presented as per-record conflicts when the device has a local row. Accepting the remote deletion hides that row from normal finance views while retaining the raw local row and backup copy for recovery. The sync outbox and account metadata are intentionally not included in JSON backups; restoring a finance backup queues a fresh, explicit merge.

Cloud sync remains gated until the Phase 4 and Phase 5 SQL migrations are applied to a real Supabase project and `.env.local` is configured. The current workspace has no Supabase project configuration, so no live RPC, RLS, or multi-device result is claimed.
