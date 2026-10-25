import {
  normalizeBackupData,
  parseBackupPayload
} from '../lib/finance';
import {
  addSyncIdentities,
  createSyncId,
  getCanonicalSyncId,
  isSyncId,
  syncIdentityStores
} from './syncIdentity';
import { createMigrationVerificationReport } from './migrationVerification';

const tableNames = [
  'transactions',
  'categories',
  'paymentMethods',
  'budgets',
  'budgetHistory',
  'preferences'
];

function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function deterministicUuid(value, collisionIndex = 0) {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof TextEncoder === 'undefined') {
    throw new Error('This device cannot generate stable IDs for a legacy backup. Use a current secure browser or Android WebView.');
  }
  const bytes = new Uint8Array(await cryptoApi.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`pws-v1-legacy-sync:${value}:${collisionIndex}`)
  ));
  const uuidBytes = bytes.slice(0, 16);
  uuidBytes[6] = (uuidBytes[6] & 0x0f) | 0x50;
  uuidBytes[8] = (uuidBytes[8] & 0x3f) | 0x80;
  const hex = [...uuidBytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

async function createLegacyIdentityGenerator(data) {
  const usedIds = new Set();
  const generated = [];
  const occurrences = new Map();
  for (const store of syncIdentityStores) {
    for (const record of data[store] || []) {
      let identity = record.syncId;
      if (!isSyncId(identity) || usedIds.has(identity)) identity = null;
      if (!identity) {
        const canonicalId = getCanonicalSyncId(store, record.id);
        if (canonicalId && !usedIds.has(canonicalId)) identity = canonicalId;
      }
      if (identity) {
        usedIds.add(identity);
        continue;
      }

      const stableKey = record.id !== undefined
        ? `id:${String(record.id)}`
        : `record:${stableSerialize(record)}`;
      const occurrenceKey = `${store}:${stableKey}`;
      const occurrence = occurrences.get(occurrenceKey) || 0;
      occurrences.set(occurrenceKey, occurrence + 1);
      let generatedId = await deterministicUuid(`${occurrenceKey}:${occurrence}`);
      let collisionIndex = 0;
      while (usedIds.has(generatedId)) {
        collisionIndex += 1;
        generatedId = await deterministicUuid(`${occurrenceKey}:${occurrence}`, collisionIndex);
      }
      usedIds.add(generatedId);
      generated.push(generatedId);
    }
  }

  let index = 0;
  return () => generated[index++] || createSyncId();
}

function prepareIdentityData(backup) {
  return {
    transactions: backup.transactions,
    categories: backup.categories,
    paymentMethods: backup.paymentMethods,
    budgets: backup.budgets,
    budgetHistory: backup.budgetHistory,
    preferences: backup.preferences || []
  };
}

function remapReference({ record, original, syncField, localField, targetBySyncId, targetByLocalId, label }) {
  const requestedSyncId = original[syncField];
  const target = requestedSyncId
    ? targetBySyncId.get(requestedSyncId)
    : targetByLocalId.get(original[localField]);
  if (!target) {
    const reference = requestedSyncId || original[localField] || '(missing)';
    throw new Error(`Cannot import ${label}: reference "${reference}" does not match a backup record.`);
  }
  return { ...record, [localField]: target.id, [syncField]: target.syncId };
}

function prepareNativeRecords(backup) {
  return createLegacyIdentityGenerator(prepareIdentityData(backup)).then((generateId) => {
    const identified = addSyncIdentities(prepareIdentityData(backup), generateId);
    const categoriesBySyncId = new Map(identified.categories.map((record) => [record.syncId, record]));
    const categoriesByLocalId = new Map(identified.categories.map((record) => [record.id, record]));
    const methodsBySyncId = new Map(identified.paymentMethods.map((record) => [record.syncId, record]));
    const methodsByLocalId = new Map(identified.paymentMethods.map((record) => [record.id, record]));

    const transactions = identified.transactions.map((record, index) => {
      const original = backup.transactions[index];
      const withCategory = remapReference({
        record,
        original,
        syncField: 'categorySyncId',
        localField: 'categoryId',
        targetBySyncId: categoriesBySyncId,
        targetByLocalId: categoriesByLocalId,
        label: `transaction ${record.id ?? record.syncId} category`
      });
      return remapReference({
        record: withCategory,
        original,
        syncField: 'paymentMethodSyncId',
        localField: 'paymentMethodId',
        targetBySyncId: methodsBySyncId,
        targetByLocalId: methodsByLocalId,
        label: `transaction ${record.id ?? record.syncId} payment method`
      });
    });

    const budgets = identified.budgets.map((record, index) => {
      const original = backup.budgets[index];
      if (original.categoryId === 'overall') {
        if (original.categorySyncId) {
          throw new Error(`Cannot import overall budget "${record.id}" with a category reference.`);
        }
        const { categorySyncId, ...overallBudget } = record;
        return { ...overallBudget, categoryId: 'overall' };
      }
      return remapReference({
        record,
        original,
        syncField: 'categorySyncId',
        localField: 'categoryId',
        targetBySyncId: categoriesBySyncId,
        targetByLocalId: categoriesByLocalId,
        label: `budget ${record.id} category`
      });
    });

    const budgetHistory = identified.budgetHistory.map((record, index) => {
      const original = backup.budgetHistory[index];
      if (!original.categoryId || original.categoryId === 'overall') {
        if (original.categorySyncId) {
          throw new Error(`Cannot import overall budget history entry "${record.id ?? record.syncId}" with a category reference.`);
        }
        const { categorySyncId, ...overallEntry } = record;
        return { ...overallEntry, categoryId: 'overall' };
      }
      return remapReference({
        record,
        original,
        syncField: 'categorySyncId',
        localField: 'categoryId',
        targetBySyncId: categoriesBySyncId,
        targetByLocalId: categoriesByLocalId,
        label: `budget history entry ${record.id ?? record.syncId} category`
      });
    });

    return {
      data: {
        transactions,
        categories: identified.categories,
        paymentMethods: identified.paymentMethods,
        budgets,
        budgetHistory,
        preferences: identified.preferences
      },
      syncIdentityReport: identified.syncIdentityReport
    };
  });
}

function createSourceData(backup, prepared) {
  return {
    ...prepared,
    // Legacy formats may not include preferences. Their established restore behavior
    // keeps the device's existing preferences, so do not compare that collection.
    preferences: backup.preferences === null ? null : prepared.preferences
  };
}

async function readDatabaseCollections(database) {
  return Object.fromEntries(await Promise.all(tableNames.map(async (name) => [
    name,
    await database[name].toArray()
  ])));
}

async function readDatabaseCounts(database) {
  return Object.fromEntries(await Promise.all(tableNames.map(async (name) => [
    name,
    await database[name].count()
  ])));
}

export async function importBackupToNativeSqlite(database, backupSource, { replaceExisting = false } = {}) {
  const backup = typeof backupSource === 'string'
    ? parseBackupPayload(backupSource)
    : normalizeBackupData(backupSource);
  const preparedResult = await prepareNativeRecords(backup);
  const prepared = preparedResult.data;
  const sourceData = createSourceData(backup, prepared);
  const warnings = [
    ...(backup.warnings || []),
    ...(preparedResult.syncIdentityReport.identityWarnings || []).map((warning) => (
      `${warning.store} record ${warning.id ?? ''} had its invalid or duplicate sync identity replaced.`.trim()
    ))
  ];

  let verificationReport;
  await database.transaction(
    'rw',
    ...tableNames.map((name) => database[name]),
    async () => {
      const existingCounts = await readDatabaseCounts(database);
      const existingRecordCount = Object.values(existingCounts).reduce((total, count) => total + count, 0);
      if (existingRecordCount > 0 && replaceExisting !== true) {
        throw new Error('SQLite already contains data. Review the restore confirmation and explicitly choose replacement before importing this backup.');
      }

      if (replaceExisting === true) {
        await database.transactions.clear();
        await database.budgetHistory.clear();
        await database.budgets.clear();
        await database.paymentMethods.clear();
        await database.categories.clear();
        if (backup.preferences !== null) await database.preferences.clear();
      }

      if (prepared.categories.length) await database.categories.bulkPut(prepared.categories);
      if (prepared.paymentMethods.length) await database.paymentMethods.bulkPut(prepared.paymentMethods);
      if (prepared.transactions.length) await database.transactions.bulkPut(prepared.transactions);
      if (prepared.budgets.length) await database.budgets.bulkPut(prepared.budgets);
      if (prepared.budgetHistory.length) await database.budgetHistory.bulkPut(prepared.budgetHistory);
      if (backup.preferences !== null && prepared.preferences.length) {
        await database.preferences.bulkPut(prepared.preferences);
      }

      const destinationData = await readDatabaseCollections(database);
      verificationReport = createMigrationVerificationReport({
        version: backup.version,
        sourceData,
        destinationData,
        skippedIncomeCount: backup.skippedIncomeCount,
        warnings
      });
      if (!verificationReport.verified) {
        const error = new Error('The imported data did not pass migration verification. The SQLite transaction was rolled back.');
        error.verificationReport = verificationReport;
        throw error;
      }
    }
  );

  return {
    migrationVerification: verificationReport,
    syncIdentityReport: preparedResult.syncIdentityReport
  };
}
