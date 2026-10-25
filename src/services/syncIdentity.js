import { defaultCategories, defaultPaymentMethods } from '../data/defaultData';

export const syncIdentityStores = [
  'transactions',
  'categories',
  'paymentMethods',
  'budgets',
  'budgetHistory',
  'preferences'
];

const canonicalIdsByStore = {
  categories: new Map(defaultCategories.map(({ id, syncId }) => [id, syncId])),
  paymentMethods: new Map(defaultPaymentMethods.map(({ id, syncId }) => [id, syncId])),
  // A fresh device must start with the same account-preferences identity.
  // Existing valid IDs are preserved by addSyncIdentities and are never rewritten.
  preferences: new Map([['app', 'f1a00000-0000-4000-8000-00000000000f']])
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isSyncId(value) {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function getCanonicalSyncId(store, localId) {
  return canonicalIdsByStore[store]?.get(localId);
}

export function createSyncId() {
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function assignRecordSyncIds(data, generateId) {
  const usedIds = new Set();
  const warnings = [];
  const collections = Object.fromEntries(
    syncIdentityStores.map((store) => [store, (data[store] || []).map((record) => ({ ...record }))])
  );

  for (const store of syncIdentityStores) {
    const canonicalIds = canonicalIdsByStore[store];
    collections[store] = collections[store].map((record) => {
      const canonicalId = canonicalIds?.get(record.id);
      let syncId = record.syncId;
      let warning = null;
      if (syncId && !isSyncId(syncId)) {
        warning = 'invalid-sync-id-reassigned';
        syncId = null;
      }
      if (syncId && usedIds.has(syncId)) {
        warning = 'duplicate-sync-id-reassigned';
        syncId = null;
      }
      if (!syncId) {
        if (canonicalId && !usedIds.has(canonicalId)) syncId = canonicalId;
      }
      if (!syncId) {
        do {
          syncId = generateId();
        } while (!isSyncId(syncId) || usedIds.has(syncId));
      }
      usedIds.add(syncId);
      const syncIdentityWarnings = [...new Set([
        ...(Array.isArray(record.syncIdentityWarnings) ? record.syncIdentityWarnings : []),
        ...(warning ? [warning] : [])
      ])];
      if (warning) warnings.push({ store, id: record.id, code: warning });
      return {
        ...record,
        syncId,
        ...(syncIdentityWarnings.length ? { syncIdentityWarnings } : {})
      };
    });
  }
  return { collections, warnings };
}

function linkRelationships(collections) {
  const categoriesByLocalId = new Map(collections.categories.map((record) => [record.id, record.syncId]));
  const categoriesBySyncId = new Set(collections.categories.map((record) => record.syncId));
  const paymentMethodsByLocalId = new Map(collections.paymentMethods.map((record) => [record.id, record.syncId]));
  const paymentMethodsBySyncId = new Set(collections.paymentMethods.map((record) => record.syncId));

  collections.transactions = collections.transactions.map((record) => ({
    ...record,
    categorySyncId: categoriesByLocalId.get(record.categoryId) || record.categorySyncId || null,
    paymentMethodSyncId: paymentMethodsByLocalId.get(record.paymentMethodId) || record.paymentMethodSyncId || null
  }));
  collections.budgets = collections.budgets.map((record) => {
    if (record.categoryId === 'overall') {
      const { categorySyncId, ...budget } = record;
      return budget;
    }
    return {
      ...record,
      categorySyncId: categoriesByLocalId.get(record.categoryId) || record.categorySyncId || null
    };
  });
  collections.budgetHistory = collections.budgetHistory.map((record) => {
    if (!record.categoryId || record.categoryId === 'overall') {
      const { categorySyncId, ...entry } = record;
      return entry;
    }
    return {
      ...record,
      categorySyncId: categoriesByLocalId.get(record.categoryId) || record.categorySyncId || null
    };
  });

  return { categoriesBySyncId, paymentMethodsBySyncId };
}

export function getSyncIdentityReport(data) {
  const duplicateSyncIds = [];
  const identityWarnings = [];
  const seen = new Map();
  for (const store of syncIdentityStores) {
    for (const record of data[store] || []) {
      if (!isSyncId(record.syncId)) {
        identityWarnings.push({
          store,
          id: record.id,
          syncId: record.syncId || null,
          code: 'missing-or-invalid-sync-id'
        });
        continue;
      }
      const previous = seen.get(record.syncId);
      if (previous) {
        duplicateSyncIds.push({
          store,
          id: record.id,
          syncId: record.syncId,
          code: 'duplicate-sync-id',
          conflictsWith: previous
        });
      } else {
        seen.set(record.syncId, { store, id: record.id });
      }
      for (const code of record.syncIdentityWarnings || []) {
        identityWarnings.push({ store, id: record.id, syncId: record.syncId, code });
      }
    }
  }

  const categorySyncIds = new Set((data.categories || []).map((record) => record.syncId));
  const paymentMethodSyncIds = new Set((data.paymentMethods || []).map((record) => record.syncId));
  const unresolvedRelationships = [];
  for (const record of data.transactions || []) {
    if (!categorySyncIds.has(record.categorySyncId)) {
      unresolvedRelationships.push({
        store: 'transactions',
        id: record.id,
        field: 'categorySyncId',
        localReference: record.categoryId || null,
        syncReference: record.categorySyncId || null
      });
    }
    if (!paymentMethodSyncIds.has(record.paymentMethodSyncId)) {
      unresolvedRelationships.push({
        store: 'transactions',
        id: record.id,
        field: 'paymentMethodSyncId',
        localReference: record.paymentMethodId || null,
        syncReference: record.paymentMethodSyncId || null
      });
    }
  }
  for (const [store, records] of [
    ['budgets', data.budgets || []],
    ['budgetHistory', data.budgetHistory || []]
  ]) {
    for (const record of records) {
      if (record.categoryId && record.categoryId !== 'overall' && !categorySyncIds.has(record.categorySyncId)) {
        unresolvedRelationships.push({
          store,
          id: record.id,
          field: 'categorySyncId',
          localReference: record.categoryId,
          syncReference: record.categorySyncId || null
        });
      }
    }
  }
  return { duplicateSyncIds, identityWarnings, unresolvedRelationships };
}

export function addSyncIdentities(data, generateId = createSyncId) {
  const { collections, warnings } = assignRecordSyncIds(data, generateId);
  linkRelationships(collections);
  return {
    ...collections,
    syncIdentityReport: {
      ...getSyncIdentityReport(collections),
      reassignedIds: warnings
    }
  };
}

export async function migrateSyncIdentities(transaction) {
  const data = Object.fromEntries(await Promise.all(
    syncIdentityStores.map(async (store) => [store, await transaction.table(store).toArray()])
  ));
  const migrated = addSyncIdentities(data);
  await Promise.all(syncIdentityStores.map((store) => (
    transaction.table(store).bulkPut(migrated[store])
  )));
}
