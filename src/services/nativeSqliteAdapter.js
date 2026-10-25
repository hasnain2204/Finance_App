import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';
import { createSyncId } from './syncIdentity';
import { initializeNativeSqlite } from './nativeSqlite';

const stores = {
  transactions: {
    table: 'transactions',
    key: 'id',
    autoIncrement: true,
    fields: [
      ['id', 'id'], ['syncId', 'sync_id'], ['title', 'title'], ['amount', 'amount_paisa'],
      ['type', 'type'], ['categoryId', 'category_id'], ['categorySyncId', 'category_sync_id'],
      ['paymentMethodId', 'payment_method_id'], ['paymentMethodSyncId', 'payment_method_sync_id'],
      ['date', 'date'], ['notes', 'notes'], ['createdAt', 'created_at']
    ]
  },
  categories: {
    table: 'categories',
    key: 'id',
    fields: [['id', 'id'], ['syncId', 'sync_id'], ['name', 'name'], ['type', 'type']]
  },
  paymentMethods: {
    table: 'payment_methods',
    key: 'id',
    fields: [['id', 'id'], ['syncId', 'sync_id'], ['name', 'name']]
  },
  budgets: {
    table: 'budgets',
    key: 'id',
    fields: [
      ['id', 'id'], ['syncId', 'sync_id'], ['categoryId', 'category_id'],
      ['categorySyncId', 'category_sync_id'], ['month', 'month'], ['amount', 'amount_paisa'],
      ['syncRole', 'sync_role']
    ]
  },
  budgetHistory: {
    table: 'budget_history',
    key: 'id',
    autoIncrement: true,
    fields: [
      ['id', 'id'], ['syncId', 'sync_id'], ['month', 'month'], ['categoryId', 'category_id'],
      ['categorySyncId', 'category_sync_id'], ['date', 'date'], ['createdAt', 'created_at'],
      ['previousAmount', 'previous_amount_paisa'], ['amount', 'amount_paisa'],
      ['description', 'description'], ['budgetCategory', 'budget_category'], ['entryType', 'entry_type']
    ]
  },
  preferences: {
    table: 'preferences',
    key: 'id',
    fields: [
      ['id', 'id'], ['syncId', 'sync_id'], ['currency', 'currency'], ['lightMode', 'light_mode'],
      ['name', 'name'], ['onboardingCompleted', 'onboarding_completed'],
      ['dateFormat', 'date_format'], ['notificationsEnabled', 'notifications_enabled']
    ]
  }
};

const boolFields = new Set(['lightMode', 'onboardingCompleted', 'notificationsEnabled']);

function decodeRecord(storeName, row) {
  if (!row) return undefined;
  const config = stores[storeName];
  const record = {};
  for (const [property, column] of config.fields) {
    if (!(column in row)) continue;
    let value = row[column];
    if (boolFields.has(property)) value = value === null ? undefined : Boolean(value);
    if (value !== null || boolFields.has(property)) record[property] = value;
  }
  return record;
}

function encodeRecord(storeName, record, { omitAutoId = false } = {}) {
  const config = stores[storeName];
  const values = {};
  for (const [property, column] of config.fields) {
    if (omitAutoId && config.autoIncrement && property === config.key && record[property] === undefined) continue;
    let value = record[property];
    if (boolFields.has(property)) value = value === undefined || value === null ? null : Number(Boolean(value));
    if (value === undefined) value = null;
    values[column] = value;
  }
  if (storeName === 'budgetHistory' && values.category_id === null) values.category_id = 'overall';
  if (storeName === 'budgets') {
    values.sync_role = record.syncRole || (record.id === 'budget-all-overall' ? 'derived' : 'source');
  }
  return values;
}

function createNativeTable(storeName, getDatabase, getTransactionDepth) {
  const config = stores[storeName];
  const columnsByField = new Map(config.fields.map(([property, column]) => [property, column]));

  const run = async (statement, values = [], returnMode = 'no') => {
    const database = await getDatabase();
    return database.run(statement, values, getTransactionDepth() === 0, returnMode);
  };

  const selectAll = async (orderBy = null, direction = 'ASC') => {
    const database = await getDatabase();
    const order = orderBy ? ` ORDER BY ${orderBy} ${direction}` : '';
    const result = await database.query(`SELECT * FROM ${config.table}${order}`);
    return (result.values || []).map((row) => decodeRecord(storeName, row));
  };

  const insert = async (record, upsert) => {
    const sqlRecord = encodeRecord(storeName, record, { omitAutoId: true });
    const columns = Object.keys(sqlRecord);
    const placeholders = columns.map(() => '?').join(', ');
    const conflictClause = upsert
      ? ` ON CONFLICT(${config.key}) DO UPDATE SET ${columns
        .filter((column) => column !== config.key)
        .map((column) => `${column} = excluded.${column}`)
        .join(', ') || `${config.key} = excluded.${config.key}`}`
      : '';
    const result = await run(
      `INSERT INTO ${config.table} (${columns.join(', ')}) VALUES (${placeholders})${conflictClause}`,
      columns.map((column) => sqlRecord[column]),
      config.autoIncrement && record[config.key] === undefined ? 'last' : 'no'
    );
    return record[config.key] ?? result.changes?.lastId;
  };

  const makeQuery = (matches, predicates = []) => ({
    first: async () => (await makeQuery(matches, predicates).toArray())[0],
    filter: (predicate) => makeQuery(matches, [...predicates, predicate]),
    toArray: async () => (await selectAll()).filter((record) => matches(record) && predicates.every((predicate) => predicate(record))),
    delete: async () => {
      const rows = await makeQuery(matches, predicates).toArray();
      for (const record of rows) await run(`DELETE FROM ${config.table} WHERE ${config.key} = ?`, [record[config.key]]);
      return rows.length;
    }
  });

  let table;
  table = {
    add: (record) => insert(record, false),
    bulkPut: async (records) => {
      for (const record of records) await insert(record, true);
    },
    clear: () => run(`DELETE FROM ${config.table}`),
    count: async () => {
      const database = await getDatabase();
      const result = await database.query(`SELECT COUNT(*) AS count FROM ${config.table}`);
      return Number(result.values?.[0]?.count || 0);
    },
    delete: (id) => run(`DELETE FROM ${config.table} WHERE ${config.key} = ?`, [id]),
    get: async (id) => {
      const database = await getDatabase();
      const result = await database.query(
        `SELECT * FROM ${config.table} WHERE ${config.key} = ? LIMIT 1`,
        [id]
      );
      return decodeRecord(storeName, result.values?.[0]);
    },
    orderBy: (index) => {
      const column = columnsByField.get(index);
      if (!column) throw new Error(`Unsupported ${storeName} order index: ${index}`);
      let direction = 'ASC';
      const query = {
        reverse() { direction = 'DESC'; return query; },
        toArray: () => selectAll(column, direction)
      };
      return query;
    },
    put: (record) => insert(record, true),
    toArray: () => selectAll(),
    update: async (id, changes) => {
      const existing = await table.get(id);
      if (!existing) return 0;
      await insert({ ...existing, ...changes, [config.key]: id }, true);
      return 1;
    },
    where: (index) => {
      const column = columnsByField.get(index);
      if (!column) throw new Error(`Unsupported ${storeName} where index: ${index}`);
      return {
        equals: (value) => makeQuery((record) => record[index] === value)
      };
    }
  };
  return table;
}

export function createNativeSqliteAdapter() {
  let connectionPromise;
  let transactionDepth = 0;
  const getDatabase = async () => {
    connectionPromise ||= initializeNativeSqlite();
    return (await connectionPromise).database;
  };
  const database = { adapterType: 'native-sqlite' };

  for (const storeName of Object.keys(stores)) {
    database[storeName] = createNativeTable(storeName, getDatabase, () => transactionDepth);
  }

  database.transaction = async (...args) => {
    const callback = args.at(-1);
    if (typeof callback !== 'function') throw new Error('A database transaction callback is required.');
    if (transactionDepth > 0) return callback();
    const nativeDatabase = await getDatabase();
    await nativeDatabase.beginTransaction();
    transactionDepth += 1;
    try {
      const result = await callback();
      await nativeDatabase.commitTransaction();
      return result;
    } catch (error) {
      try {
        await nativeDatabase.rollbackTransaction();
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
      throw error;
    } finally {
      transactionDepth -= 1;
    }
  };

  return database;
}

export async function seedNativeSqliteDatabase(database) {
  if (await database.categories.count() === 0) {
    await database.categories.bulkPut(defaultCategories);
  }
  if (await database.paymentMethods.count() === 0) {
    await database.paymentMethods.bulkPut(defaultPaymentMethods);
  }
  if (await database.preferences.count() === 0) {
    await database.preferences.put({
      id: 'app',
      syncId: createSyncId(),
      currency: 'PKR',
      lightMode: true,
      dateFormat: 'DD MMM YYYY',
      notificationsEnabled: false
    });
  }
}
