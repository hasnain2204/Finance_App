-- Phase 5: optimistic revisions, a private idempotency ledger, and bounded pull RPCs.
-- This migration does not move or delete existing finance rows.

ALTER TABLE public.categories ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE public.payment_methods ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE public.transactions ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE public.budgets ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE public.budget_history ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);
ALTER TABLE public.preferences ADD COLUMN revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0);

-- Keep one live preferences row per account while allowing tombstoned identities
-- to remain available for conflict recovery.
ALTER TABLE public.preferences DROP CONSTRAINT IF EXISTS preferences_one_row_per_user;
CREATE UNIQUE INDEX IF NOT EXISTS preferences_one_active_row_per_user_idx
  ON public.preferences (user_id) WHERE deleted_at IS NULL;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE private.finance_sync_operations (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  idempotency_key uuid NOT NULL,
  request_hash text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  PRIMARY KEY (user_id, idempotency_key)
);
REVOKE ALL ON TABLE private.finance_sync_operations FROM PUBLIC, anon, authenticated;

-- Keep revisions and timestamps monotonic even for rapid successive edits.
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at := GREATEST(pg_catalog.clock_timestamp(), OLD.updated_at + INTERVAL '1 microsecond');
  RETURN NEW;
END;
$$;

-- Sync mutations go through this compare-and-swap RPC. Direct client writes are
-- removed so a browser cannot bypass revision checks or forge revision values.
REVOKE INSERT, UPDATE, DELETE ON TABLE
  public.categories,
  public.payment_methods,
  public.transactions,
  public.budgets,
  public.budget_history,
  public.preferences
FROM authenticated;
REVOKE INSERT (user_id, sync_id, name, type, created_at, deleted_at),
       UPDATE (name, type, deleted_at)
  ON TABLE public.categories FROM authenticated;
REVOKE INSERT (user_id, sync_id, name, created_at, deleted_at),
       UPDATE (name, deleted_at)
  ON TABLE public.payment_methods FROM authenticated;
REVOKE INSERT (user_id, sync_id, title, amount_paisa, type, category_sync_id,
               payment_method_sync_id, date, notes, created_at, deleted_at),
       UPDATE (title, amount_paisa, type, category_sync_id, payment_method_sync_id,
               date, notes, deleted_at)
  ON TABLE public.transactions FROM authenticated;
REVOKE INSERT (user_id, sync_id, month, category_sync_id, amount_paisa, created_at, deleted_at),
       UPDATE (month, category_sync_id, amount_paisa, deleted_at)
  ON TABLE public.budgets FROM authenticated;
REVOKE INSERT (user_id, sync_id, month, category_sync_id, date, previous_amount_paisa,
               amount_paisa, description, budget_category, entry_type, created_at, deleted_at),
       UPDATE (month, category_sync_id, date, previous_amount_paisa, amount_paisa,
               description, budget_category, entry_type, deleted_at)
  ON TABLE public.budget_history FROM authenticated;
REVOKE INSERT (user_id, sync_id, currency, light_mode, name, onboarding_completed,
               date_format, notifications_enabled, created_at, deleted_at),
       UPDATE (currency, light_mode, name, onboarding_completed, date_format,
               notifications_enabled, deleted_at)
  ON TABLE public.preferences FROM authenticated;

CREATE OR REPLACE FUNCTION public.pws_sync_preview()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;
  RETURN pg_catalog.jsonb_build_object(
    'categories', (SELECT count(*) FROM public.categories),
    'paymentMethods', (SELECT count(*) FROM public.payment_methods),
    'transactions', (SELECT count(*) FROM public.transactions),
    'budgets', (SELECT count(*) FROM public.budgets),
    'budgetHistory', (SELECT count(*) FROM public.budget_history),
    'preferences', (SELECT count(*) FROM public.preferences)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.pws_sync_apply(
  p_collection text,
  p_operation text,
  p_sync_id uuid,
  p_idempotency_key uuid,
  p_base_revision bigint,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_table text;
  v_revision bigint;
  v_record jsonb;
  v_result jsonb;
  v_request_hash text;
  v_saved_hash text;
  v_saved_response jsonb;
  v_payload jsonb := COALESCE(p_payload, '{}'::jsonb);
  v_now timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;
  IF p_sync_id IS NULL OR p_idempotency_key IS NULL OR p_operation NOT IN ('upsert', 'delete') THEN
    RAISE EXCEPTION 'Invalid sync operation.' USING ERRCODE = '22023';
  END IF;

  v_table := CASE p_collection
    WHEN 'categories' THEN 'categories'
    WHEN 'paymentMethods' THEN 'payment_methods'
    WHEN 'transactions' THEN 'transactions'
    WHEN 'budgets' THEN 'budgets'
    WHEN 'budgetHistory' THEN 'budget_history'
    WHEN 'preferences' THEN 'preferences'
    ELSE NULL
  END;
  IF v_table IS NULL THEN
    RAISE EXCEPTION 'Unsupported sync collection.' USING ERRCODE = '22023';
  END IF;
  IF p_collection = 'budgets' AND (v_payload ->> 'month' = 'all') THEN
    RAISE EXCEPTION 'The derived cumulative budget cannot be synchronized.' USING ERRCODE = '22023';
  END IF;
  IF p_operation = 'upsert' AND p_collection IN ('transactions', 'budgets')
     AND COALESCE(v_payload ->> 'amount_paisa', '') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Money values must be supplied as integer paisa.' USING ERRCODE = '22023';
  END IF;
  IF p_operation = 'upsert' AND p_collection = 'budgetHistory' AND (
    ((v_payload ->> 'previous_amount_paisa') IS NOT NULL AND (v_payload ->> 'previous_amount_paisa') !~ '^[0-9]+$') OR
    ((v_payload ->> 'amount_paisa') IS NOT NULL AND (v_payload ->> 'amount_paisa') !~ '^[0-9]+$')
  ) THEN
    RAISE EXCEPTION 'Budget history money values must be integer paisa.' USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent deliveries of the same user's idempotency key.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_idempotency_key::text, 0)
  );
  v_request_hash := pg_catalog.md5(
    p_collection || ':' || p_operation || ':' || p_sync_id::text || ':' ||
    COALESCE(p_base_revision::text, 'null') || ':' || v_payload::text
  );
  SELECT request_hash, response
    INTO v_saved_hash, v_saved_response
    FROM private.finance_sync_operations
    WHERE user_id = v_user_id AND idempotency_key = p_idempotency_key;
  IF FOUND THEN
    IF v_saved_hash <> v_request_hash THEN
      RAISE EXCEPTION 'An idempotency key was reused with a different request.' USING ERRCODE = '22023';
    END IF;
    RETURN v_saved_response;
  END IF;

  EXECUTE pg_catalog.format(
    'SELECT pg_catalog.to_jsonb(t), t.revision FROM public.%I AS t WHERE t.user_id = $1 AND t.sync_id = $2 FOR UPDATE',
    v_table
  ) INTO v_record, v_revision USING v_user_id, p_sync_id;

  IF v_record IS NOT NULL THEN
    IF p_base_revision IS NULL OR p_base_revision <> v_revision THEN
      v_result := pg_catalog.jsonb_build_object('status', 'conflict', 'record', v_record);
    ELSIF p_operation = 'delete' THEN
      EXECUTE pg_catalog.format(
        'UPDATE public.%I AS t SET deleted_at = pg_catalog.clock_timestamp(), revision = t.revision + 1 WHERE t.user_id = $1 AND t.sync_id = $2 RETURNING pg_catalog.to_jsonb(t)',
        v_table
      ) INTO v_record USING v_user_id, p_sync_id;
      v_result := pg_catalog.jsonb_build_object('status', 'applied', 'record', v_record);
    ELSE
      IF p_collection = 'categories' THEN
        UPDATE public.categories AS t
          SET name = v_payload ->> 'name', type = v_payload ->> 'type', deleted_at = NULL, revision = t.revision + 1
          WHERE t.user_id = v_user_id AND t.sync_id = p_sync_id RETURNING pg_catalog.to_jsonb(t) INTO v_record;
      ELSIF p_collection = 'paymentMethods' THEN
        UPDATE public.payment_methods AS t
          SET name = v_payload ->> 'name', deleted_at = NULL, revision = t.revision + 1
          WHERE t.user_id = v_user_id AND t.sync_id = p_sync_id RETURNING pg_catalog.to_jsonb(t) INTO v_record;
      ELSIF p_collection = 'transactions' THEN
        UPDATE public.transactions AS t SET
          title = v_payload ->> 'title', amount_paisa = (v_payload ->> 'amount_paisa')::bigint,
          type = v_payload ->> 'type', category_sync_id = (v_payload ->> 'category_sync_id')::uuid,
          payment_method_sync_id = (v_payload ->> 'payment_method_sync_id')::uuid,
          date = (v_payload ->> 'date')::date, notes = COALESCE(v_payload ->> 'notes', ''),
          deleted_at = NULL, revision = t.revision + 1
          WHERE t.user_id = v_user_id AND t.sync_id = p_sync_id RETURNING pg_catalog.to_jsonb(t) INTO v_record;
      ELSIF p_collection = 'budgets' THEN
        BEGIN
          UPDATE public.budgets AS t SET
            month = v_payload ->> 'month', category_sync_id = NULLIF(v_payload ->> 'category_sync_id', '')::uuid,
            amount_paisa = (v_payload ->> 'amount_paisa')::bigint,
            deleted_at = NULL, revision = t.revision + 1
            WHERE t.user_id = v_user_id AND t.sync_id = p_sync_id RETURNING pg_catalog.to_jsonb(t) INTO v_record;
        EXCEPTION WHEN unique_violation THEN
          SELECT pg_catalog.to_jsonb(t), t.revision INTO v_record, v_revision
            FROM public.budgets AS t
            WHERE t.user_id = v_user_id AND (
              t.sync_id = p_sync_id OR (
                t.sync_id <> p_sync_id AND t.deleted_at IS NULL AND t.month = v_payload ->> 'month'
                AND t.category_sync_id IS NOT DISTINCT FROM NULLIF(v_payload ->> 'category_sync_id', '')::uuid
              )
            );
          IF v_record IS NULL THEN RAISE; END IF;
          v_result := pg_catalog.jsonb_build_object('status', 'conflict', 'record', v_record);
        END;
      ELSIF p_collection = 'budgetHistory' THEN
        UPDATE public.budget_history AS t SET
          month = v_payload ->> 'month', category_sync_id = NULLIF(v_payload ->> 'category_sync_id', '')::uuid,
          date = (v_payload ->> 'date')::date,
          previous_amount_paisa = NULLIF(v_payload ->> 'previous_amount_paisa', '')::bigint,
          amount_paisa = NULLIF(v_payload ->> 'amount_paisa', '')::bigint,
          description = COALESCE(v_payload ->> 'description', ''), budget_category = v_payload ->> 'budget_category',
          entry_type = v_payload ->> 'entry_type', deleted_at = NULL, revision = t.revision + 1
          WHERE t.user_id = v_user_id AND t.sync_id = p_sync_id RETURNING pg_catalog.to_jsonb(t) INTO v_record;
      ELSE
        UPDATE public.preferences AS t SET
          currency = v_payload ->> 'currency', light_mode = NULLIF(v_payload ->> 'light_mode', '')::boolean,
          name = v_payload ->> 'name', onboarding_completed = NULLIF(v_payload ->> 'onboarding_completed', '')::boolean,
          date_format = v_payload ->> 'date_format',
          notifications_enabled = NULLIF(v_payload ->> 'notifications_enabled', '')::boolean,
          deleted_at = NULL, revision = t.revision + 1
          WHERE t.user_id = v_user_id AND t.sync_id = p_sync_id RETURNING pg_catalog.to_jsonb(t) INTO v_record;
      END IF;
      IF v_result IS NULL THEN
        v_result := pg_catalog.jsonb_build_object('status', 'applied', 'record', v_record);
      END IF;
    END IF;
  ELSIF p_operation = 'delete' AND COALESCE(p_base_revision, 0) = 0 THEN
    v_now := pg_catalog.clock_timestamp();
    v_result := pg_catalog.jsonb_build_object('status', 'applied', 'record', pg_catalog.jsonb_build_object(
      'user_id', v_user_id, 'sync_id', p_sync_id, 'revision', 0, 'updated_at', v_now, 'deleted_at', v_now
    ));
  ELSIF p_operation = 'upsert' AND COALESCE(p_base_revision, 0) = 0 THEN
    IF p_collection = 'categories' THEN
      INSERT INTO public.categories AS inserted (user_id, sync_id, name, type)
        VALUES (v_user_id, p_sync_id, v_payload ->> 'name', v_payload ->> 'type')
        RETURNING pg_catalog.to_jsonb(inserted) INTO v_record;
    ELSIF p_collection = 'paymentMethods' THEN
      INSERT INTO public.payment_methods AS inserted (user_id, sync_id, name)
        VALUES (v_user_id, p_sync_id, v_payload ->> 'name')
        RETURNING pg_catalog.to_jsonb(inserted) INTO v_record;
    ELSIF p_collection = 'transactions' THEN
      INSERT INTO public.transactions AS inserted (user_id, sync_id, title, amount_paisa, type, category_sync_id, payment_method_sync_id, date, notes)
        VALUES (v_user_id, p_sync_id, v_payload ->> 'title', (v_payload ->> 'amount_paisa')::bigint,
          v_payload ->> 'type', (v_payload ->> 'category_sync_id')::uuid,
          (v_payload ->> 'payment_method_sync_id')::uuid, (v_payload ->> 'date')::date, COALESCE(v_payload ->> 'notes', ''))
        RETURNING pg_catalog.to_jsonb(inserted) INTO v_record;
    ELSIF p_collection = 'budgets' THEN
      BEGIN
        INSERT INTO public.budgets AS inserted (user_id, sync_id, month, category_sync_id, amount_paisa)
          VALUES (v_user_id, p_sync_id, v_payload ->> 'month', NULLIF(v_payload ->> 'category_sync_id', '')::uuid,
            (v_payload ->> 'amount_paisa')::bigint)
          RETURNING pg_catalog.to_jsonb(inserted) INTO v_record;
      EXCEPTION WHEN unique_violation THEN
        SELECT pg_catalog.to_jsonb(t), t.revision INTO v_record, v_revision
          FROM public.budgets AS t
          WHERE t.user_id = v_user_id AND (
            t.sync_id = p_sync_id OR (
              t.sync_id <> p_sync_id AND t.deleted_at IS NULL AND t.month = v_payload ->> 'month'
              AND t.category_sync_id IS NOT DISTINCT FROM NULLIF(v_payload ->> 'category_sync_id', '')::uuid
            )
          );
        IF v_record IS NULL THEN RAISE; END IF;
        v_result := pg_catalog.jsonb_build_object('status', 'conflict', 'record', v_record);
      END;
    ELSIF p_collection = 'budgetHistory' THEN
      INSERT INTO public.budget_history AS inserted (user_id, sync_id, month, category_sync_id, date, previous_amount_paisa, amount_paisa, description, budget_category, entry_type)
        VALUES (v_user_id, p_sync_id, v_payload ->> 'month', NULLIF(v_payload ->> 'category_sync_id', '')::uuid,
          (v_payload ->> 'date')::date, NULLIF(v_payload ->> 'previous_amount_paisa', '')::bigint,
          NULLIF(v_payload ->> 'amount_paisa', '')::bigint, COALESCE(v_payload ->> 'description', ''),
          v_payload ->> 'budget_category', v_payload ->> 'entry_type')
        RETURNING pg_catalog.to_jsonb(inserted) INTO v_record;
    ELSE
      BEGIN
        INSERT INTO public.preferences AS inserted (user_id, sync_id, currency, light_mode, name, onboarding_completed, date_format, notifications_enabled)
          VALUES (v_user_id, p_sync_id, v_payload ->> 'currency', NULLIF(v_payload ->> 'light_mode', '')::boolean,
            v_payload ->> 'name', NULLIF(v_payload ->> 'onboarding_completed', '')::boolean,
            v_payload ->> 'date_format', NULLIF(v_payload ->> 'notifications_enabled', '')::boolean)
          RETURNING pg_catalog.to_jsonb(inserted) INTO v_record;
      EXCEPTION WHEN unique_violation THEN
        SELECT pg_catalog.to_jsonb(t), t.revision INTO v_record, v_revision
          FROM public.preferences AS t
          WHERE t.user_id = v_user_id AND t.deleted_at IS NULL;
        IF v_record IS NULL THEN RAISE; END IF;
        v_result := pg_catalog.jsonb_build_object('status', 'conflict', 'record', v_record);
      END;
    END IF;
    IF v_result IS NULL THEN
      v_result := pg_catalog.jsonb_build_object('status', 'applied', 'record', v_record);
    END IF;
  ELSE
    v_result := pg_catalog.jsonb_build_object(
      'status', 'conflict',
      'record', pg_catalog.jsonb_build_object('user_id', v_user_id, 'sync_id', p_sync_id, 'revision', 0, 'deleted_at', pg_catalog.clock_timestamp())
    );
  END IF;

  INSERT INTO private.finance_sync_operations (user_id, idempotency_key, request_hash, response)
    VALUES (v_user_id, p_idempotency_key, v_request_hash, v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.pws_sync_pull(p_cursor jsonb DEFAULT NULL, p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 200), 500));
  v_changes jsonb;
  v_next_cursor jsonb;
  v_has_more boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.' USING ERRCODE = '42501';
  END IF;

  WITH all_changes AS (
    SELECT 0 AS collection_order, t.updated_at, 'categories'::text AS collection,
      t.sync_id::text AS sync_text, t.revision, pg_catalog.to_jsonb(t) AS record
      FROM public.categories AS t
      WHERE t.user_id = v_user_id AND (
        p_cursor -> 'categories' IS NULL OR
        (t.updated_at, t.sync_id::text, t.revision) > (
          (p_cursor -> 'categories' ->> 'updated_at')::timestamptz,
          p_cursor -> 'categories' ->> 'sync_id',
          (p_cursor -> 'categories' ->> 'revision')::bigint
        )
      )
    UNION ALL
    SELECT 1, t.updated_at, 'paymentMethods'::text, t.sync_id::text, t.revision, pg_catalog.to_jsonb(t)
      FROM public.payment_methods AS t
      WHERE t.user_id = v_user_id AND (
        p_cursor -> 'paymentMethods' IS NULL OR
        (t.updated_at, t.sync_id::text, t.revision) > (
          (p_cursor -> 'paymentMethods' ->> 'updated_at')::timestamptz,
          p_cursor -> 'paymentMethods' ->> 'sync_id',
          (p_cursor -> 'paymentMethods' ->> 'revision')::bigint
        )
      )
    UNION ALL
    SELECT 2, t.updated_at, 'budgets'::text, t.sync_id::text, t.revision, pg_catalog.to_jsonb(t)
      FROM public.budgets AS t
      WHERE t.user_id = v_user_id AND (
        p_cursor -> 'budgets' IS NULL OR
        (t.updated_at, t.sync_id::text, t.revision) > (
          (p_cursor -> 'budgets' ->> 'updated_at')::timestamptz,
          p_cursor -> 'budgets' ->> 'sync_id',
          (p_cursor -> 'budgets' ->> 'revision')::bigint
        )
      )
    UNION ALL
    SELECT 3, t.updated_at, 'budgetHistory'::text, t.sync_id::text, t.revision, pg_catalog.to_jsonb(t)
      FROM public.budget_history AS t
      WHERE t.user_id = v_user_id AND (
        p_cursor -> 'budgetHistory' IS NULL OR
        (t.updated_at, t.sync_id::text, t.revision) > (
          (p_cursor -> 'budgetHistory' ->> 'updated_at')::timestamptz,
          p_cursor -> 'budgetHistory' ->> 'sync_id',
          (p_cursor -> 'budgetHistory' ->> 'revision')::bigint
        )
      )
    UNION ALL
    SELECT 4, t.updated_at, 'transactions'::text, t.sync_id::text, t.revision, pg_catalog.to_jsonb(t)
      FROM public.transactions AS t
      WHERE t.user_id = v_user_id AND (
        p_cursor -> 'transactions' IS NULL OR
        (t.updated_at, t.sync_id::text, t.revision) > (
          (p_cursor -> 'transactions' ->> 'updated_at')::timestamptz,
          p_cursor -> 'transactions' ->> 'sync_id',
          (p_cursor -> 'transactions' ->> 'revision')::bigint
        )
      )
    UNION ALL
    SELECT 5, t.updated_at, 'preferences'::text, t.sync_id::text, t.revision, pg_catalog.to_jsonb(t)
      FROM public.preferences AS t
      WHERE t.user_id = v_user_id AND (
        p_cursor -> 'preferences' IS NULL OR
        (t.updated_at, t.sync_id::text, t.revision) > (
          (p_cursor -> 'preferences' ->> 'updated_at')::timestamptz,
          p_cursor -> 'preferences' ->> 'sync_id',
          (p_cursor -> 'preferences' ->> 'revision')::bigint
        )
      )
  ), ranked AS (
    SELECT c.*, pg_catalog.row_number() OVER (
      ORDER BY c.collection_order, c.updated_at, c.collection, c.sync_text, c.revision
    ) AS row_number
    FROM all_changes AS c
    ORDER BY c.collection_order, c.updated_at, c.collection, c.sync_text, c.revision
    LIMIT v_limit + 1
  ), last_by_collection AS (
    SELECT DISTINCT ON (collection) collection, updated_at, sync_text, revision
      FROM ranked
      WHERE row_number <= v_limit
      ORDER BY collection, updated_at DESC, sync_text DESC, revision DESC
  ), cursor_updates AS (
    SELECT pg_catalog.jsonb_object_agg(collection, pg_catalog.jsonb_build_object(
      'updated_at', updated_at, 'sync_id', sync_text, 'revision', revision
    )) AS value
    FROM last_by_collection
  )
  SELECT
    COALESCE(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('collection', collection, 'record', record)
      ORDER BY collection_order, updated_at, collection, sync_text, revision)
      FILTER (WHERE row_number <= v_limit), '[]'::jsonb),
    COALESCE(p_cursor, '{}'::jsonb) || COALESCE((SELECT value FROM cursor_updates), '{}'::jsonb),
    EXISTS (SELECT 1 FROM ranked WHERE row_number > v_limit)
  INTO v_changes, v_next_cursor, v_has_more
  FROM ranked;

  RETURN pg_catalog.jsonb_build_object(
    'changes', v_changes,
    'next_cursor', v_next_cursor,
    'has_more', COALESCE(v_has_more, false)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pws_sync_preview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pws_sync_apply(text, text, uuid, uuid, bigint, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pws_sync_pull(jsonb, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pws_sync_preview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pws_sync_apply(text, text, uuid, uuid, bigint, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pws_sync_pull(jsonb, integer) TO authenticated;

COMMENT ON FUNCTION public.pws_sync_apply(text, text, uuid, uuid, bigint, jsonb) IS
  'Authenticated compare-and-swap sync mutation. All ownership, revision, and idempotency checks happen in one database transaction.';
COMMENT ON FUNCTION public.pws_sync_pull(jsonb, integer) IS
  'Returns only RLS-visible records for the caller, including soft-delete tombstones, with dependency-safe pagination.';
