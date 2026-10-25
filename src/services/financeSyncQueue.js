import { createSyncId, isSyncId } from './syncIdentity';

export const SYNC_COLLECTIONS = Object.freeze([
  'categories',
  'paymentMethods',
  'transactions',
  'budgets',
  'budgetHistory',
  'preferences'
]);

export const SYNC_MAX_AUTOMATIC_ATTEMPTS = 8;

let activeAuthUserSnapshot;

export function setActiveAuthUserSnapshot(userId) {
  activeAuthUserSnapshot = userId === undefined ? undefined : userId || null;
}

export function getActiveAuthUserSnapshot() {
  return activeAuthUserSnapshot;
}

export function getSyncEntityStateId(collection, syncId) {
  return `${collection}:${syncId}`;
}

export function calculateRetryDelayMs(attempt, random = Math.random) {
  const exponent = Math.max(0, Math.min(8, Number(attempt || 1) - 1));
  const boundedBase = Math.min(5 * 60 * 1000, 1000 * (2 ** exponent));
  const jitter = 0.5 + Math.max(0, Math.min(1, Number(random())));
  return Math.round(boundedBase * jitter);
}

export async function enqueueLocalMutation(database, { collection, operation, record, now = new Date() }) {
  if (!SYNC_COLLECTIONS.includes(collection)) throw new Error(`Unsupported sync collection: ${collection}`);
  if (!['upsert', 'delete'].includes(operation)) throw new Error(`Unsupported sync operation: ${operation}`);
  if (!record || !isSyncId(record.syncId)) {
    throw new Error(`Cannot queue ${collection} ${operation}: a valid stable syncId is required.`);
  }

  const owner = await database.syncMetadata.get('ownerUserId');
  const activeAuthUser = await database.syncMetadata.get('activeAuthUserId');
  const authUserAtWrite = activeAuthUserSnapshot === undefined
    ? activeAuthUser?.value || null
    : activeAuthUserSnapshot;
  const entityStateId = getSyncEntityStateId(collection, record.syncId);
  const entityState = await database.syncEntityState.get(entityStateId);
  const timestamp = now.toISOString();
  const operationId = createSyncId();
  await database.syncOutbox.add({
    id: operationId,
    idempotencyKey: operationId,
    collection,
    syncId: record.syncId,
    operation,
    ownerUserId: owner?.value && owner.value === authUserAtWrite ? owner.value : null,
    authUserAtWrite,
    baseRevision: entityState?.revision ?? null,
    payload: { ...record },
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: 0,
    nextAttemptAt: null,
    status: 'pending',
    lastError: null
  });
  return operationId;
}

export async function setSyncMetadata(database, key, value, now = new Date()) {
  await database.syncMetadata.put({ key, value, updatedAt: now.toISOString() });
}

export async function getSyncMetadata(database, key) {
  const row = await database.syncMetadata.get(key);
  return row?.value;
}

export async function enqueueRestoreDiff(database, before, after, now = new Date()) {
  for (const collection of SYNC_COLLECTIONS) {
    const shouldSync = (record) => collection !== 'budgets' || (
      record.id !== 'budget-all-overall' && record.month !== 'all' && record.syncRole !== 'derived'
    );
    const nextRecords = [];
    for (const record of (after[collection] || []).filter(shouldSync)) {
      const identified = isSyncId(record.syncId) ? record : { ...record, syncId: createSyncId() };
      if (identified !== record) await database[collection].put(identified);
      nextRecords.push(identified);
    }
    const nextIds = new Set(nextRecords.map((record) => record.syncId));
    for (const previous of (before[collection] || []).filter(shouldSync)) {
      const retainedByLocalId = previous.id !== undefined && nextRecords.some((record) => record.id === previous.id);
      if (isSyncId(previous.syncId) ? !nextIds.has(previous.syncId) : !retainedByLocalId) {
        const deletable = isSyncId(previous.syncId) ? previous : { ...previous, syncId: createSyncId() };
        await enqueueLocalMutation(database, { collection, operation: 'delete', record: deletable, now });
      }
    }
    for (const record of nextRecords) {
      await enqueueLocalMutation(database, { collection, operation: 'upsert', record, now });
    }
  }
}
