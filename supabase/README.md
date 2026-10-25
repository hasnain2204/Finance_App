# Supabase setup: authentication and offline-first sync

The Phase 4 migration adds email/password authentication and the six user-owned PostgreSQL tables. The Phase 5 migration adds compare-and-swap revisions, idempotent sync RPCs, and tombstone-aware incremental pulls. Local Dexie/SQLite remains the source of finance data while the sync flow is unconfigured or not confirmed by the user.

## Apply the migration

1. Create or open the Supabase project you intend to use.
2. In the Dashboard, open **SQL Editor**, create a new query, paste the full contents of [`migrations/20261026000100_finance_auth_foundation.sql`](./migrations/20261026000100_finance_auth_foundation.sql), and run it once.
3. Confirm that the six tables exist under `public`: `transactions`, `categories`, `payment_methods`, `budgets`, `budget_history`, and `preferences`. Each table has RLS enabled, authenticated-only grants, and separate ownership policies for SELECT, INSERT, UPDATE, and DELETE.
4. The migration stores source monthly budgets only. It intentionally has no `month = 'all'` budget row, so the device-local derived `budget-all-overall` total cannot be uploaded as a second contribution.

To inspect RLS activation and policy operations in the Dashboard SQL Editor, run:

```sql
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_class AS c
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'transactions', 'categories', 'payment_methods',
    'budgets', 'budget_history', 'preferences'
  )
ORDER BY c.relname;

SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'transactions', 'categories', 'payment_methods',
    'budgets', 'budget_history', 'preferences'
  )
ORDER BY tablename, cmd;
```

The migration links transaction/category/payment references by `(user_id, sync_id)`. Composite foreign keys reject a reference to another user's category or payment method. Device-local numeric/text IDs are not cloud relationship keys.

## Configure email/password Auth

1. In the Dashboard, open **Authentication → Sign In / Providers → Email**. Keep email/password enabled and enable new sign-ups if the app should allow account creation.
2. Choose whether email confirmation is required. Hosted Supabase projects normally require confirmation by default. If enabled, verify the project's email delivery settings; the built-in test email service is rate-limited and best-effort, so configure SMTP before production use.
3. In **Authentication → URL Configuration**, set the Site URL to the app's real return address and add only the development/production origins you use to the Redirect URLs allowlist. For local browser testing, use the actual local origin (for example `http://localhost:5173`); a LAN device uses its current LAN origin. Native email-confirmation deep-link routing is not configured in this phase.
4. Open the project's **Connect** dialog or **Settings → API Keys** and copy the Project URL and a **publishable** key. A publishable key is expected to be visible in browser/mobile code; never use a `sb_secret_` or legacy `service_role` key here.
5. Copy `.env.example` to `.env.local`, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`, then restart Vite with `npm run dev`. `.env.local` is ignored by Git.
6. Open **More → Cloud account** and test sign-up, email confirmation (if enabled), sign-in, session restoration, and sign-out. Local finance remains available offline and while signed out.

## Apply Phase 5 sync migration

After applying and verifying the Phase 4 migration above:

1. In **SQL Editor**, run the complete contents of [`migrations/20261026000200_finance_sync_queue.sql`](./migrations/20261026000200_finance_sync_queue.sql) once. It is additive: it adds a `revision` column to the six existing tables, creates the unexposed `private.finance_sync_operations` idempotency ledger, and installs three RPCs. It does not copy, clear, or rewrite finance rows.
2. Confirm `revision` exists on all six public tables. Confirm RLS remains enabled and the existing authenticated owner policies remain present.
3. Confirm `pws_sync_preview`, `pws_sync_pull`, and `pws_sync_apply` are executable by `authenticated` and not by `anon` or `PUBLIC`. `pws_sync_apply` uses a pinned empty search path, checks `auth.uid()`, and handles writes and revisions in one database transaction.
4. Confirm authenticated users no longer have direct INSERT, UPDATE, or DELETE privileges on the six tables. Sync writes must go through `pws_sync_apply`; reads remain protected by the existing RLS policies.
5. Set the project URL and publishable key in `.env.local`, restart Vite, then sign in to the app. **Review initial sync** calls the remote preview and shows local/account counts. Nothing transfers until **Confirm merge and sync** is selected.
6. Test with a disposable account and non-financial sample rows first. Verify first upload, a second device pull, a concurrent edit conflict, selecting each conflict resolution, delete propagation, offline queueing/reconnect, retry after a forced network failure, and account switching. Verify each user's RPC results contain only that user's records.

Useful Dashboard checks after migration:

```sql
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'transactions', 'categories', 'payment_methods',
    'budgets', 'budget_history', 'preferences'
  )
  AND column_name = 'revision'
ORDER BY table_name;

SELECT p.proname, p.proconfig,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       EXISTS (
         SELECT 1
         FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS privilege
         WHERE privilege.grantee = 0 AND privilege.privilege_type = 'EXECUTE'
       ) AS public_can_execute
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('pws_sync_preview', 'pws_sync_pull', 'pws_sync_apply')
ORDER BY p.proname;
```

## Security and verification status

- RLS is the database boundary; the publishable key itself does not protect records. The SQL migration grants authenticated users only their permitted operations, and policies bind every row to `auth.uid()`.
- `user_id` and `sync_id` are not updateable by normal authenticated clients. The migration also restricts updates to data columns, while an update trigger maintains `updated_at`.
- Do not add service-role credentials to `.env.local`, any `VITE_*` variable, source code, or a shipped Android build.
- The local workspace currently has no `.env.local`, project URL, publishable key, or Supabase CLI project configuration. Live RPC, RLS, and two-device tests are therefore pending. Do not treat this foundation as production-verified until the Dashboard and disposable-account checks above pass.
