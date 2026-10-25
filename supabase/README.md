# Supabase Phase 4 setup

This phase adds email/password authentication and a PostgreSQL schema foundation. It does not sync finance records. Local Dexie/SQLite behavior remains the source of finance data until a later sync phase.

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
6. Open **More → Cloud account** and test sign-up, email confirmation (if enabled), sign-in, session restoration, and sign-out. Cloud account state does not gate local finance features.

## Security and verification status

- RLS is the database boundary; the publishable key itself does not protect records. The SQL migration grants authenticated users only their permitted operations, and policies bind every row to `auth.uid()`.
- `user_id` and `sync_id` are not updateable by normal authenticated clients. The migration also restricts updates to data columns, while an update trigger maintains `updated_at`.
- Do not add service-role credentials to `.env.local`, any `VITE_*` variable, source code, or a shipped Android build.
- No real Supabase project has been configured or tested by this repository change. Apply the migration and perform the Dashboard/client checks above before treating cloud authentication or database policies as verified.
