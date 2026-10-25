export const NATIVE_SQLITE_DATABASE_NAME = 'pws-v1-native';
export const NATIVE_SQLITE_SCHEMA_VERSION = 2;

const schemaVersion1Statements = [
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    sync_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('expense', 'income'))
  );`,
  `CREATE TABLE IF NOT EXISTS payment_methods (
    id TEXT PRIMARY KEY NOT NULL,
    sync_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    amount_paisa INTEGER NOT NULL CHECK (typeof(amount_paisa) = 'integer' AND amount_paisa > 0),
    type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
    category_id TEXT NOT NULL,
    category_sync_id TEXT,
    payment_method_id TEXT,
    payment_method_sync_id TEXT,
    date TEXT NOT NULL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT,
    FOREIGN KEY (category_sync_id) REFERENCES categories(sync_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (payment_method_sync_id) REFERENCES payment_methods(sync_id) ON UPDATE CASCADE ON DELETE RESTRICT
  );`,
  `CREATE TABLE IF NOT EXISTS budgets (
    id TEXT PRIMARY KEY NOT NULL,
    sync_id TEXT NOT NULL UNIQUE,
    category_id TEXT NOT NULL,
    category_sync_id TEXT,
    month TEXT NOT NULL,
    amount_paisa INTEGER NOT NULL CHECK (typeof(amount_paisa) = 'integer' AND amount_paisa >= 0),
    sync_role TEXT NOT NULL DEFAULT 'source' CHECK (sync_role IN ('source', 'derived')),
    FOREIGN KEY (category_sync_id) REFERENCES categories(sync_id) ON UPDATE CASCADE ON DELETE RESTRICT
  );`,
  `CREATE TABLE IF NOT EXISTS budget_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sync_id TEXT NOT NULL UNIQUE,
    month TEXT NOT NULL,
    category_id TEXT NOT NULL DEFAULT 'overall',
    category_sync_id TEXT,
    date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    previous_amount_paisa INTEGER CHECK (
      previous_amount_paisa IS NULL OR
      (typeof(previous_amount_paisa) = 'integer' AND previous_amount_paisa >= 0)
    ),
    amount_paisa INTEGER CHECK (
      amount_paisa IS NULL OR
      (typeof(amount_paisa) = 'integer' AND amount_paisa >= 0)
    ),
    description TEXT NOT NULL DEFAULT '',
    budget_category TEXT,
    entry_type TEXT,
    FOREIGN KEY (category_sync_id) REFERENCES categories(sync_id) ON UPDATE CASCADE ON DELETE RESTRICT
  );`,
  `CREATE TABLE IF NOT EXISTS preferences (
    id TEXT PRIMARY KEY NOT NULL,
    sync_id TEXT NOT NULL UNIQUE,
    currency TEXT,
    light_mode INTEGER CHECK (light_mode IS NULL OR light_mode IN (0, 1)),
    name TEXT,
    onboarding_completed INTEGER CHECK (onboarding_completed IS NULL OR onboarding_completed IN (0, 1)),
    date_format TEXT,
    notifications_enabled INTEGER CHECK (notifications_enabled IS NULL OR notifications_enabled IN (0, 1))
  );`,
  'CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(date);',
  'CREATE INDEX IF NOT EXISTS transactions_category_sync_idx ON transactions(category_sync_id);',
  'CREATE INDEX IF NOT EXISTS transactions_payment_method_sync_idx ON transactions(payment_method_sync_id);',
  'CREATE INDEX IF NOT EXISTS budgets_category_month_idx ON budgets(category_sync_id, month);',
  'CREATE INDEX IF NOT EXISTS budget_history_category_month_idx ON budget_history(category_sync_id, month);',
  `CREATE VIEW IF NOT EXISTS budget_source_records AS
    SELECT * FROM budgets
    WHERE id <> 'budget-all-overall' AND sync_role <> 'derived';`
];

export const NATIVE_SQLITE_UPGRADES = [
  {
    toVersion: 1,
    statements: schemaVersion1Statements
  },
  {
    toVersion: 2,
    statements: [
      `CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        collection TEXT NOT NULL CHECK (collection IN ('transactions', 'categories', 'paymentMethods', 'budgets', 'budgetHistory', 'preferences')),
        sync_id TEXT NOT NULL,
        operation TEXT NOT NULL CHECK (operation IN ('upsert', 'delete')),
        owner_user_id TEXT,
        auth_user_at_write TEXT,
        base_revision INTEGER,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        next_attempt_at TEXT,
        status TEXT NOT NULL CHECK (status IN ('pending', 'retry', 'syncing', 'synced', 'conflict', 'error', 'superseded')),
        last_error TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY NOT NULL,
        collection TEXT NOT NULL CHECK (collection IN ('transactions', 'categories', 'paymentMethods', 'budgets', 'budgetHistory', 'preferences')),
        sync_id TEXT NOT NULL,
        owner_user_id TEXT NOT NULL,
        local_payload_json TEXT NOT NULL,
        remote_payload_json TEXT NOT NULL,
        base_revision INTEGER,
        remote_revision INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('unresolved', 'resolved-local', 'resolved-remote')),
        created_at TEXT NOT NULL,
        resolved_at TEXT
      );`,
      `CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );`,
      `CREATE TABLE IF NOT EXISTS sync_entity_state (
        id TEXT PRIMARY KEY NOT NULL,
        collection TEXT NOT NULL CHECK (collection IN ('transactions', 'categories', 'paymentMethods', 'budgets', 'budgetHistory', 'preferences')),
        sync_id TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0 CHECK (revision >= 0),
        updated_at TEXT,
        deleted_at TEXT,
        UNIQUE (collection, sync_id)
      );`,
      'CREATE INDEX IF NOT EXISTS sync_outbox_ready_idx ON sync_outbox(owner_user_id, status, next_attempt_at, created_at);',
      'CREATE INDEX IF NOT EXISTS sync_outbox_entity_idx ON sync_outbox(collection, sync_id, created_at);',
      'CREATE INDEX IF NOT EXISTS sync_conflicts_owner_status_idx ON sync_conflicts(owner_user_id, status);',
      'CREATE INDEX IF NOT EXISTS sync_entity_state_updated_idx ON sync_entity_state(updated_at);'
    ]
  }
];
