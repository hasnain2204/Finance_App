-- Phase 4 foundation: per-user cloud tables and email/password Auth access.
-- Finance records are not copied here by this migration.

CREATE TABLE public.categories (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  sync_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  type text NOT NULL CHECK (type IN ('expense', 'income')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, sync_id)
);

CREATE TABLE public.payment_methods (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  sync_id uuid NOT NULL,
  name text NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, sync_id)
);

CREATE TABLE public.transactions (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  sync_id uuid NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  amount_paisa bigint NOT NULL CHECK (amount_paisa > 0),
  type text NOT NULL CHECK (type IN ('expense', 'income')),
  category_sync_id uuid NOT NULL,
  payment_method_sync_id uuid NOT NULL,
  date date NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, sync_id),
  CONSTRAINT transactions_category_owner_fk
    FOREIGN KEY (user_id, category_sync_id)
    REFERENCES public.categories (user_id, sync_id) ON DELETE RESTRICT,
  CONSTRAINT transactions_payment_method_owner_fk
    FOREIGN KEY (user_id, payment_method_sync_id)
    REFERENCES public.payment_methods (user_id, sync_id) ON DELETE RESTRICT
);

-- Only monthly source budgets belong here. The local derived row
-- budget-all-overall (month = 'all') is computed from source data and is not
-- stored as a separate budget contribution in PostgreSQL.
CREATE TABLE public.budgets (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  sync_id uuid NOT NULL,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  category_sync_id uuid,
  amount_paisa bigint NOT NULL CHECK (amount_paisa >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, sync_id),
  CONSTRAINT budgets_category_owner_fk
    FOREIGN KEY (user_id, category_sync_id)
    REFERENCES public.categories (user_id, sync_id) ON DELETE RESTRICT
);

CREATE TABLE public.budget_history (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  sync_id uuid NOT NULL,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  category_sync_id uuid,
  date date NOT NULL,
  previous_amount_paisa bigint CHECK (previous_amount_paisa IS NULL OR previous_amount_paisa >= 0),
  amount_paisa bigint CHECK (amount_paisa IS NULL OR amount_paisa >= 0),
  description text NOT NULL DEFAULT '',
  budget_category text,
  entry_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, sync_id),
  CONSTRAINT budget_history_category_owner_fk
    FOREIGN KEY (user_id, category_sync_id)
    REFERENCES public.categories (user_id, sync_id) ON DELETE RESTRICT
);

CREATE TABLE public.preferences (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  sync_id uuid NOT NULL,
  currency text CHECK (currency IS NULL OR currency = 'PKR'),
  light_mode boolean,
  name text,
  onboarding_completed boolean,
  date_format text CHECK (date_format IS NULL OR date_format IN ('DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD')),
  notifications_enabled boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, sync_id),
  CONSTRAINT preferences_one_row_per_user UNIQUE (user_id)
);

COMMENT ON TABLE public.budgets IS
  'Monthly source budgets only; the device-local derived budget-all-overall total is intentionally not stored.';

CREATE INDEX transactions_user_date_idx ON public.transactions (user_id, date DESC);
CREATE INDEX transactions_category_ref_idx ON public.transactions (user_id, category_sync_id);
CREATE INDEX transactions_payment_method_ref_idx ON public.transactions (user_id, payment_method_sync_id);
CREATE INDEX budgets_category_ref_idx ON public.budgets (user_id, category_sync_id) WHERE category_sync_id IS NOT NULL;
CREATE UNIQUE INDEX budgets_one_overall_per_month_idx
  ON public.budgets (user_id, month) WHERE category_sync_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX budgets_one_category_per_month_idx
  ON public.budgets (user_id, month, category_sync_id)
  WHERE category_sync_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX budget_history_user_date_idx ON public.budget_history (user_id, date DESC);
CREATE INDEX budget_history_category_ref_idx ON public.budget_history (user_id, category_sync_id) WHERE category_sync_id IS NOT NULL;

CREATE INDEX categories_user_updated_idx ON public.categories (user_id, updated_at);
CREATE INDEX payment_methods_user_updated_idx ON public.payment_methods (user_id, updated_at);
CREATE INDEX transactions_user_updated_idx ON public.transactions (user_id, updated_at);
CREATE INDEX budgets_user_updated_idx ON public.budgets (user_id, updated_at);
CREATE INDEX budget_history_user_updated_idx ON public.budget_history (user_id, updated_at);
CREATE INDEX preferences_user_updated_idx ON public.preferences (user_id, updated_at);

CREATE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER categories_set_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER payment_methods_set_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER budgets_set_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER budget_history_set_updated_at
  BEFORE UPDATE ON public.budget_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER preferences_set_updated_at
  BEFORE UPDATE ON public.preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
  public.categories,
  public.payment_methods,
  public.transactions,
  public.budgets,
  public.budget_history,
  public.preferences
FROM PUBLIC, anon, authenticated;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, DELETE ON TABLE
  public.categories,
  public.payment_methods,
  public.transactions,
  public.budgets,
  public.budget_history,
  public.preferences
TO authenticated;

-- Identity and ownership columns are immutable from normal client UPDATEs.
-- updated_at is maintained by the trigger; clients can write tombstones.
GRANT INSERT (user_id, sync_id, name, type, created_at, deleted_at)
  ON public.categories TO authenticated;
GRANT UPDATE (name, type, deleted_at) ON public.categories TO authenticated;

GRANT INSERT (user_id, sync_id, name, created_at, deleted_at)
  ON public.payment_methods TO authenticated;
GRANT UPDATE (name, deleted_at) ON public.payment_methods TO authenticated;

GRANT INSERT (
  user_id, sync_id, title, amount_paisa, type, category_sync_id,
  payment_method_sync_id, date, notes, created_at, deleted_at
) ON public.transactions TO authenticated;
GRANT UPDATE (
  title, amount_paisa, type, category_sync_id, payment_method_sync_id,
  date, notes, deleted_at
) ON public.transactions TO authenticated;

GRANT INSERT (
  user_id, sync_id, month, category_sync_id, amount_paisa, created_at, deleted_at
) ON public.budgets TO authenticated;
GRANT UPDATE (month, category_sync_id, amount_paisa, deleted_at)
  ON public.budgets TO authenticated;

GRANT INSERT (
  user_id, sync_id, month, category_sync_id, date,
  previous_amount_paisa, amount_paisa, description, budget_category,
  entry_type, created_at, deleted_at
) ON public.budget_history TO authenticated;
GRANT UPDATE (
  month, category_sync_id, date, previous_amount_paisa,
  amount_paisa, description, budget_category, entry_type, deleted_at
) ON public.budget_history TO authenticated;

GRANT INSERT (
  user_id, sync_id, currency, light_mode, name, onboarding_completed,
  date_format, notifications_enabled, created_at, deleted_at
) ON public.preferences TO authenticated;
GRANT UPDATE (
  currency, light_mode, name, onboarding_completed,
  date_format, notifications_enabled, deleted_at
) ON public.preferences TO authenticated;

CREATE POLICY categories_select_own ON public.categories
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY categories_insert_own ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY categories_update_own ON public.categories
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY categories_delete_own ON public.categories
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

CREATE POLICY payment_methods_select_own ON public.payment_methods
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY payment_methods_insert_own ON public.payment_methods
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY payment_methods_update_own ON public.payment_methods
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY payment_methods_delete_own ON public.payment_methods
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

CREATE POLICY transactions_select_own ON public.transactions
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY transactions_insert_own ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY transactions_update_own ON public.transactions
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY transactions_delete_own ON public.transactions
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

CREATE POLICY budgets_select_own ON public.budgets
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY budgets_insert_own ON public.budgets
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY budgets_update_own ON public.budgets
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY budgets_delete_own ON public.budgets
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

CREATE POLICY budget_history_select_own ON public.budget_history
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY budget_history_insert_own ON public.budget_history
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY budget_history_update_own ON public.budget_history
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY budget_history_delete_own ON public.budget_history
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));

CREATE POLICY preferences_select_own ON public.preferences
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY preferences_insert_own ON public.preferences
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY preferences_update_own ON public.preferences
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()))
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
CREATE POLICY preferences_delete_own ON public.preferences
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IS NOT NULL AND user_id = (SELECT auth.uid()));
