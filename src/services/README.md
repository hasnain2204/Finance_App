# Services

`financeRepository.js` is the application persistence boundary. It routes web/PWA storage to Dexie/IndexedDB and native Capacitor storage to SQLite, and owns database reads, writes, and atomic multi-record operations. React components should use the repository rather than importing a database directly.

Supabase email/password authentication is implemented separately from finance persistence. The Phase 4 PostgreSQL schema is a foundation only: the app does not read, write, or synchronize finance records with Supabase yet. A later sync phase must preserve stable sync IDs and use the owner-scoped SQL relationships and RLS policies in `supabase/migrations/`.
