export const NATIVE_SQLITE_DATABASE_NAME = 'pws-v1-native';
export const NATIVE_SQLITE_SCHEMA_VERSION = 1;

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
  }
];
