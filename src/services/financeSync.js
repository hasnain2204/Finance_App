import { createSyncId, getSyncIdentityReport } from './syncIdentity';
import { calculateCumulativeBudgetTotal } from '../lib/finance';
import {
  calculateRetryDelayMs,
  getSyncEntityStateId,
  getSyncMetadata,
  SYNC_COLLECTIONS,
  SYNC_MAX_AUTOMATIC_ATTEMPTS,
  setSyncMetadata
} from './financeSyncQueue';

const queueTableNames = ['syncOutbox', 'syncConflicts', 'syncMetadata', 'syncEntityState'];
const localStoreNames = [
  'transactions', 'categories', 'paymentMethods', 'budgets', 'budgetHistory', 'preferences'
];
const pushOrder = {
  categories: 0,
  paymentMethods: 1,
  budgets: 2,
  budgetHistory: 3,
  transactions: 4,
  preferences: 5
};

function integerPaisa(value, label, { allowNull = false, minimum = 0 } = {}) {
  if ((value === null || value === undefined) && allowNull) return null;
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount < minimum) {
    const error = new Error(`${label} must be an exact integer-paisa value.`);
    error.code = 'SYNC_VALIDATION';
    throw error;
  }
  return amount;
}

function collectionCountRows(collections) {
  return Object.fromEntries(SYNC_COLLECTIONS.map((name) => [
    name,
    (collections[name] || []).filter((record) => (
      name !== 'budgets' || (record.id !== 'budget-all-overall' && record.month !== 'all' && record.syncRole !== 'derived')
    )).length
  ]));
}

function toWireRecord(collection, row) {
  switch (collection) {
    case 'categories': return { name: row.name, type: row.type };
    case 'paymentMethods': return { name: row.name };
    case 'transactions': return {
      title: row.title,
      amount_paisa: integerPaisa(row.amount, 'Transaction amount', { minimum: 1 }),
      type: row.type,
      category_sync_id: row.categorySyncId,
      payment_method_sync_id: row.paymentMethodSyncId,
      date: row.date,
      notes: row.notes || ''
    };
    case 'budgets': return {
      month: row.month,
      category_sync_id: row.categoryId === 'overall' ? null : row.categorySyncId,
      amount_paisa: integerPaisa(row.amount, 'Budget amount'),
    };
    case 'budgetHistory': return {
      month: row.month,
      category_sync_id: !row.categoryId || row.categoryId === 'overall' ? null : row.categorySyncId,
      date: row.date,
      previous_amount_paisa: integerPaisa(row.previousAmount, 'Previous budget amount', { allowNull: true }),
      amount_paisa: integerPaisa(row.amount, 'Budget history amount', { allowNull: true }),
      description: row.description || '',
      budget_category: row.budgetCategory ?? null,
      entry_type: row.entryType ?? null
    };
    case 'preferences': return {
      currency: row.currency ?? null,
      light_mode: row.lightMode ?? null,
      name: row.name ?? null,
      onboarding_completed: row.onboardingCompleted ?? null,
      date_format: row.dateFormat ?? null,
      notifications_enabled: row.notificationsEnabled ?? null
    };
    default: throw new Error(`Unsupported sync collection: ${collection}`);
  }
}

function toRemoteWireRecord(collection, row) {
  if (collection === 'categories') return { name: row.name, type: row.type };
  if (collection === 'paymentMethods') return { name: row.name };
  if (collection === 'transactions') return {
    title: row.title, amount_paisa: Number(row.amount_paisa), type: row.type,
    category_sync_id: row.category_sync_id, payment_method_sync_id: row.payment_method_sync_id,
    date: row.date, notes: row.notes || ''
  };
  if (collection === 'budgets') return {
    month: row.month, category_sync_id: row.category_sync_id || null, amount_paisa: Number(row.amount_paisa)
  };
  if (collection === 'budgetHistory') return {
    month: row.month, category_sync_id: row.category_sync_id || null, date: row.date,
    previous_amount_paisa: row.previous_amount_paisa ?? null, amount_paisa: row.amount_paisa ?? null,
    description: row.description || '', budget_category: row.budget_category ?? null, entry_type: row.entry_type ?? null
  };
  if (collection === 'preferences') return {
    currency: row.currency ?? null, light_mode: row.light_mode ?? null, name: row.name ?? null,
    onboarding_completed: row.onboarding_completed ?? null, date_format: row.date_format ?? null,
    notifications_enabled: row.notifications_enabled ?? null
  };
  throw new Error(`Unsupported sync collection: ${collection}`);
}

function wireRecordsEqual(collection, local, remote) {
  const localWire = toWireRecord(collection, local);
  const remoteWire = toRemoteWireRecord(collection, remote);
  const keys = Object.keys(localWire).sort();
  return keys.every((key) => (localWire[key] ?? null) === (remoteWire[key] ?? null));
}

async function findBySyncId(database, collection, syncId) {
  return database[collection].where('syncId').equals(syncId).first();
}

async function fromWireRecord(database, collection, remote) {
  const existing = await findBySyncId(database, collection, remote.sync_id);
  if (collection === 'categories') {
    return { id: existing?.id ?? remote.sync_id, syncId: remote.sync_id, name: remote.name, type: remote.type };
  }
  if (collection === 'paymentMethods') {
    return { id: existing?.id ?? remote.sync_id, syncId: remote.sync_id, name: remote.name };
  }
  if (collection === 'transactions') {
    const category = await findBySyncId(database, 'categories', remote.category_sync_id);
    const paymentMethod = await findBySyncId(database, 'paymentMethods', remote.payment_method_sync_id);
    if (!category || !paymentMethod) {
      throw new Error(`Remote transaction ${remote.sync_id} has a missing category or payment method; pull cursor was not advanced.`);
    }
    const amount = Number(remote.amount_paisa);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`Remote transaction ${remote.sync_id} has an invalid integer-paisa amount.`);
    return {
      ...(existing ? { id: existing.id } : {}),
      syncId: remote.sync_id,
      title: remote.title,
      amount,
      type: remote.type,
      categoryId: category.id,
      categorySyncId: remote.category_sync_id,
      paymentMethodId: paymentMethod.id,
      paymentMethodSyncId: remote.payment_method_sync_id,
      date: remote.date,
      notes: remote.notes || '',
      createdAt: remote.created_at
    };
  }
  if (collection === 'budgets') {
    if (remote.month === 'all') throw new Error('The derived cumulative budget must never be stored remotely.');
    const category = remote.category_sync_id
      ? await findBySyncId(database, 'categories', remote.category_sync_id)
      : null;
    if (remote.category_sync_id && !category) {
      throw new Error(`Remote budget ${remote.sync_id} has a missing category; pull cursor was not advanced.`);
    }
    const amount = Number(remote.amount_paisa);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(`Remote budget ${remote.sync_id} has an invalid integer-paisa amount.`);
    const categoryId = category?.id || 'overall';
    return {
      id: existing?.id || `budget-${remote.month}-${categoryId}`,
      syncId: remote.sync_id,
      categoryId,
      categorySyncId: remote.category_sync_id || undefined,
      month: remote.month,
      amount,
      syncRole: 'source'
    };
  }
  if (collection === 'budgetHistory') {
    const category = remote.category_sync_id
      ? await findBySyncId(database, 'categories', remote.category_sync_id)
      : null;
    if (remote.category_sync_id && !category) {
      throw new Error(`Remote budget history ${remote.sync_id} has a missing category; pull cursor was not advanced.`);
    }
    const previousAmount = integerPaisa(remote.previous_amount_paisa, 'Remote previous budget amount', { allowNull: true });
    const historyAmount = integerPaisa(remote.amount_paisa, 'Remote budget history amount', { allowNull: true });
    return {
      ...(existing ? { id: existing.id } : {}),
      syncId: remote.sync_id,
      month: remote.month,
      categoryId: category?.id || 'overall',
      categorySyncId: remote.category_sync_id || undefined,
      date: remote.date,
      createdAt: remote.created_at,
      previousAmount,
      amount: historyAmount,
      description: remote.description || '',
      budgetCategory: remote.budget_category,
      entryType: remote.entry_type
    };
  }
  if (collection === 'preferences') {
    return {
      id: existing?.id || 'app',
      syncId: remote.sync_id,
      currency: remote.currency,
      lightMode: remote.light_mode,
      name: remote.name,
      onboardingCompleted: remote.onboarding_completed,
      dateFormat: remote.date_format,
      notificationsEnabled: remote.notifications_enabled
    };
  }
  throw new Error(`Unsupported sync collection: ${collection}`);
}

function unwrapRpcData(data) {
  if (Array.isArray(data) && data.length === 1) return data[0];
  return data;
}

export function createFinanceSyncService({
  repository,
  client,
  isOnline = () => globalThis.navigator?.onLine !== false,
  now = () => new Date(),
  random = Math.random
}) {
  const database = repository?.syncStorage || repository?.getSyncStorage?.();
  if (!database) throw new Error('Finance repository does not expose durable sync storage.');

  const transactionStores = [...localStoreNames, ...queueTableNames];
  const syncTransaction = (callback) => database.transaction(
    'rw', ...transactionStores.map((name) => database[name]), callback
  );

  const rpc = async (name, args) => {
    if (!client) throw new Error('Supabase is not configured; local finance remains available.');
    const { data, error } = await client.rpc(name, args);
    if (error) throw error;
    return unwrapRpcData(data);
  };

  const readLocalCollections = async () => Object.fromEntries(await Promise.all(
    localStoreNames.map(async (name) => [name, await database[name].toArray()])
  ));

  const getOwner = () => getSyncMetadata(database, 'ownerUserId');

  const assertOwner = async (userId, { allowUnbound = false } = {}) => {
    if (!userId) throw new Error('Sign in to sync this device.');
    const owner = await getOwner();
    if (owner && owner !== userId) {
      throw new Error('This local finance database is bound to a different account. Sign in with its owner before syncing.');
    }
    if (!owner && !allowUnbound) throw new Error('Review and confirm the initial sync before sending or receiving finance records.');
    return owner;
  };

  const getInitialSyncPreview = async (userId) => {
    await assertOwner(userId, { allowUnbound: true });
    const localCollections = await readLocalCollections();
    const local = collectionCountRows(localCollections);
    const identityReport = getSyncIdentityReport(localCollections);
    const identityIssueCount = identityReport.duplicateSyncIds.length +
      identityReport.identityWarnings.filter((warning) => warning.code === 'missing-or-invalid-sync-id').length +
      identityReport.unresolvedRelationships.length;
    const remote = await rpc('pws_sync_preview', {});
    const remoteCounts = Object.fromEntries(SYNC_COLLECTIONS.map((name) => [name, Number(remote?.[name] || 0)]));
    const outbox = await database.syncOutbox.toArray();
    return {
      ownerUserId: await getOwner(),
      userId,
      localCounts: local,
      identityIssueCount,
      remoteCounts,
      unboundPendingCount: outbox.filter((entry) => entry.ownerUserId == null && ['pending', 'retry', 'error'].includes(entry.status)).length,
      foreignPendingCount: outbox.filter((entry) => entry.authUserAtWrite && entry.authUserAtWrite !== userId &&
        ['pending', 'retry', 'error', 'syncing'].includes(entry.status)).length,
      totalLocal: Object.values(local).reduce((sum, value) => sum + value, 0),
      totalRemote: Object.values(remoteCounts).reduce((sum, value) => sum + value, 0),
      identityReport
    };
  };

  const addInitialSnapshotOperations = async (userId) => {
    const collections = await readLocalCollections();
    const outbox = await database.syncOutbox.toArray();
    const pendingKeys = new Set(outbox
      .filter((entry) => entry.ownerUserId === userId && ['pending', 'retry', 'error', 'syncing'].includes(entry.status))
      .map((entry) => `${entry.collection}:${entry.syncId}`));
    for (const collection of SYNC_COLLECTIONS) {
      for (const record of collections[collection]) {
        if (collection === 'budgets' && (record.id === 'budget-all-overall' || record.month === 'all' || record.syncRole === 'derived')) continue;
        const state = await database.syncEntityState.get(getSyncEntityStateId(collection, record.syncId));
        const key = `${collection}:${record.syncId}`;
        if (pendingKeys.has(key) || state?.revision > 0) continue;
        const operationId = createSyncId();
        const timestamp = now().toISOString();
        await database.syncOutbox.add({
          id: operationId,
          idempotencyKey: operationId,
          collection,
          syncId: record.syncId,
          operation: 'upsert',
          ownerUserId: userId,
          authUserAtWrite: null,
          baseRevision: null,
          payload: { ...record },
          createdAt: timestamp,
          updatedAt: timestamp,
          attempts: 0,
          nextAttemptAt: null,
          status: 'pending',
          lastError: null
        });
      }
    }
  };

  const setEntityState = async (collection, syncId, record) => {
    const revision = Number(record?.revision || 0);
    if (!Number.isSafeInteger(revision) || revision < 0) throw new Error(`Invalid server revision for ${collection} ${syncId}.`);
    await database.syncEntityState.put({
      id: getSyncEntityStateId(collection, syncId),
      collection,
      syncId,
      revision,
      updatedAt: record?.updated_at || now().toISOString(),
      deletedAt: record?.deleted_at || null
    });
  };

  const recalculateDerivedBudget = async () => {
    const [budgets, history, states] = await Promise.all([
      database.budgets.toArray(), database.budgetHistory.toArray(), database.syncEntityState.toArray()
    ]);
    const tombstoned = new Set(states.filter((state) => state.deletedAt).map((state) => `${state.collection}:${state.syncId}`));
    const sourceBudgets = budgets.filter((budget) => budget.id !== 'budget-all-overall' && budget.month !== 'all' &&
      budget.syncRole !== 'derived' && !tombstoned.has(`budgets:${budget.syncId}`));
    const sourceHistory = history.filter((entry) => !tombstoned.has(`budgetHistory:${entry.syncId}`));
    const total = calculateCumulativeBudgetTotal(sourceBudgets, sourceHistory);
    const existing = await database.budgets.get('budget-all-overall');
    if (!existing && total === 0) return;
    const derived = {
      ...existing,
      id: 'budget-all-overall',
      categoryId: 'overall',
      month: 'all',
      amount: total,
      syncId: existing?.syncId || createSyncId(),
      syncRole: 'derived'
    };
    if (!existing || existing.amount !== total) await database.budgets.put(derived);
  };

  const findActiveQueuedOperations = async (collection, syncId, ownerUserId) => (await database.syncOutbox.toArray())
    .filter((entry) => entry.collection === collection && entry.syncId === syncId && entry.ownerUserId === ownerUserId &&
      ['pending', 'retry', 'syncing', 'error', 'conflict'].includes(entry.status));

  const createConflict = async ({ collection, syncId, ownerUserId, localPayload, localOperation, baseRevision, remoteRecord }) => {
    const existing = (await database.syncConflicts.toArray()).find((conflict) => (
      conflict.collection === collection && conflict.syncId === syncId && conflict.ownerUserId === ownerUserId && conflict.status === 'unresolved'
    ));
    const conflict = existing || {
      id: createSyncId(), collection, syncId, ownerUserId,
      localPayload: { ...localPayload }, localOperation,
      baseRevision: baseRevision ?? null,
      createdAt: now().toISOString(), status: 'unresolved'
    };
    conflict.remotePayload = { ...remoteRecord };
    conflict.remoteRevision = Number(remoteRecord.revision);
    await database.syncConflicts.put(conflict);
    const queued = await findActiveQueuedOperations(collection, syncId, ownerUserId);
    for (const entry of queued) {
      await database.syncOutbox.update(entry.id, { status: 'conflict', lastError: 'Remote revision changed; both versions were preserved.', updatedAt: now().toISOString() });
    }
    return conflict;
  };

  const applyRemoteRecord = async ({ collection, remoteRecord, userId }) => {
    const syncId = remoteRecord.sync_id;
    if (!syncId) throw new Error(`Remote ${collection} row has no sync_id.`);
    if (remoteRecord.user_id !== userId) throw new Error(`Remote ${collection} row is not owned by the signed-in account.`);
    const local = await findBySyncId(database, collection, syncId);
    const pending = await findActiveQueuedOperations(collection, syncId, userId);
    if (collection === 'preferences') {
      const singleton = await database.preferences.get('app');
      if (singleton && singleton.syncId !== syncId) {
        const localPreferenceOperations = await findActiveQueuedOperations('preferences', singleton.syncId, userId);
        const collisionDeleteQueued = pending.some((entry) => entry.operation === 'delete' &&
          ['pending', 'retry', 'syncing', 'error', 'conflict'].includes(entry.status));
        if (!collisionDeleteQueued && localPreferenceOperations.some((entry) => ['pending', 'retry', 'syncing', 'error'].includes(entry.status))) {
          await createConflict({
            collection,
            syncId: singleton.syncId,
            ownerUserId: userId,
            localPayload: singleton,
            localOperation: localPreferenceOperations[0].operation,
            baseRevision: localPreferenceOperations[0].baseRevision,
            remoteRecord
          });
          await setEntityState(collection, remoteRecord.sync_id, remoteRecord);
          return 'conflict';
        }
      }
    }
    const stateId = getSyncEntityStateId(collection, syncId);
    const state = await database.syncEntityState.get(stateId);
    const writablePending = pending.filter((entry) => ['pending', 'retry', 'syncing', 'error'].includes(entry.status));
    const latestPending = [...writablePending].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).at(-1);
    const converged = latestPending && (
      (latestPending.operation === 'delete' && Boolean(remoteRecord.deleted_at)) ||
      (latestPending.operation === 'upsert' && !remoteRecord.deleted_at && wireRecordsEqual(collection, latestPending.payload, remoteRecord))
    );
    if (converged) {
      await syncTransaction(async () => {
        await setEntityState(collection, syncId, remoteRecord);
        for (const entry of writablePending) await database.syncOutbox.update(entry.id, {
          status: 'synced', baseRevision: Number(remoteRecord.revision), nextAttemptAt: null,
          lastError: null, updatedAt: now().toISOString()
        });
      });
      return 'unchanged';
    }
    if (writablePending.length && Number(remoteRecord.revision) !== Number(state?.revision || 0)) {
      const firstOperation = writablePending[0];
      await createConflict({
        collection,
        syncId,
        ownerUserId: userId,
        localPayload: local || firstOperation.payload,
        localOperation: firstOperation.operation,
        baseRevision: state?.revision ?? firstOperation.baseRevision,
        remoteRecord
      });
      await setEntityState(collection, syncId, remoteRecord);
      return 'conflict';
    }
    if (state && Number(remoteRecord.revision) <= Number(state.revision)) return 'unchanged';
    if (remoteRecord.deleted_at && local) {
      await syncTransaction(async () => {
        await createConflict({
          collection,
          syncId,
          ownerUserId: userId,
          localPayload: local,
          localOperation: 'upsert',
          baseRevision: state?.revision ?? null,
          remoteRecord
        });
        await setEntityState(collection, syncId, remoteRecord);
      });
      return 'conflict';
    }
    await syncTransaction(async () => {
      if (!remoteRecord.deleted_at) {
        const mapped = await fromWireRecord(database, collection, remoteRecord);
        await database[collection].put(mapped);
      }
      await setEntityState(collection, syncId, remoteRecord);
    });
    return 'applied';
  };

  const pullChanges = async (userId) => {
    const cursor = await getSyncMetadata(database, 'pullCursor') || null;
    let currentCursor = cursor;
    let pages = 0;
    let applied = 0;
    let conflicts = 0;
    while (pages < 100) {
      const page = await rpc('pws_sync_pull', { p_cursor: currentCursor, p_limit: 200 });
      const changes = Array.isArray(page?.changes) ? page.changes : [];
      for (const change of changes) {
        if (!SYNC_COLLECTIONS.includes(change.collection) || !change.record) {
          throw new Error('The server returned an invalid sync change. Pull cursor was not advanced.');
        }
        const result = await applyRemoteRecord({ collection: change.collection, remoteRecord: change.record, userId });
        if (result === 'applied') applied += 1;
        if (result === 'conflict') conflicts += 1;
      }
      currentCursor = page?.next_cursor || currentCursor;
      if (page?.next_cursor) await setSyncMetadata(database, 'pullCursor', page.next_cursor, now());
      pages += 1;
      if (!page?.has_more || !changes.length) break;
    }
    if (pages >= 100) throw new Error('Sync pull stopped after 100 pages; run sync again to continue safely.');
    await syncTransaction(recalculateDerivedBudget);
    return { applied, conflicts, cursor: currentCursor };
  };

  const recoverInterrupted = async () => {
    const entries = await database.syncOutbox.toArray();
    for (const entry of entries.filter((item) => item.status === 'syncing')) {
      await database.syncOutbox.update(entry.id, {
        status: 'retry',
        nextAttemptAt: now().toISOString(),
        lastError: 'Sync was interrupted; the same idempotency key will be retried.',
        updatedAt: now().toISOString()
      });
    }
  };

  const pushPending = async (userId) => {
    const all = await database.syncOutbox.toArray();
    const pending = all.filter((entry) => entry.ownerUserId === userId && ['pending', 'retry'].includes(entry.status))
      .sort((a, b) => (pushOrder[a.collection] ?? 99) - (pushOrder[b.collection] ?? 99) ||
        String(a.createdAt).localeCompare(String(b.createdAt)));
    const failedEntities = new Set();
    const result = { pushed: 0, conflicts: 0, retried: 0, errors: 0 };
    for (const entry of pending) {
      const entityKey = `${entry.collection}:${entry.syncId}`;
      if (failedEntities.has(entityKey)) continue;
      const nextAttemptAt = entry.nextAttemptAt ? new Date(entry.nextAttemptAt).getTime() : 0;
      if (entry.status === 'retry' && nextAttemptAt > now().getTime()) continue;
      if (entry.attempts >= SYNC_MAX_AUTOMATIC_ATTEMPTS && entry.status !== 'pending') {
        await database.syncOutbox.update(entry.id, { status: 'error', updatedAt: now().toISOString() });
        result.errors += 1;
        failedEntities.add(entityKey);
        continue;
      }
      const unresolvedConflict = (await database.syncConflicts.toArray()).some((conflict) => (
        conflict.collection === entry.collection && conflict.syncId === entry.syncId && conflict.ownerUserId === userId && conflict.status === 'unresolved'
      ));
      if (unresolvedConflict) {
        await database.syncOutbox.update(entry.id, { status: 'conflict' });
        result.conflicts += 1;
        failedEntities.add(entityKey);
        continue;
      }
      const attempts = Number(entry.attempts || 0) + 1;
      await database.syncOutbox.update(entry.id, {
        status: 'syncing', attempts, lastError: entry.lastError || null, updatedAt: now().toISOString()
      });
      try {
        const state = await database.syncEntityState.get(getSyncEntityStateId(entry.collection, entry.syncId));
        const baseRevision = state?.revision ?? entry.baseRevision ?? null;
        const response = await rpc('pws_sync_apply', {
          p_collection: entry.collection,
          p_operation: entry.operation,
          p_sync_id: entry.syncId,
          p_idempotency_key: entry.idempotencyKey,
          p_base_revision: baseRevision,
          p_payload: entry.operation === 'delete' ? {} : toWireRecord(entry.collection, entry.payload)
        });
        if (response?.status === 'conflict' && response.record) {
          const identityCollisionAllowed = ['budgets', 'preferences'].includes(entry.collection);
          if (response.record.user_id !== userId ||
            (response.record.sync_id !== entry.syncId && !identityCollisionAllowed)) {
            throw new Error('The server conflict response did not match the signed-in owner and expected stable identity.');
          }
          await createConflict({
            collection: entry.collection,
            syncId: entry.syncId,
            ownerUserId: userId,
            localPayload: entry.payload,
            localOperation: entry.operation,
            baseRevision,
            remoteRecord: response.record
          });
          await setEntityState(entry.collection, response.record.sync_id, response.record);
          result.conflicts += 1;
          failedEntities.add(entityKey);
          continue;
        }
        if (response?.status !== 'applied' || !response.record) throw new Error('The server returned an incomplete sync acknowledgement.');
        if (response.record.user_id !== userId || response.record.sync_id !== entry.syncId) {
          throw new Error('The server acknowledgement did not match the signed-in owner and stable record ID.');
        }
        await setEntityState(entry.collection, entry.syncId, response.record);
        await database.syncOutbox.update(entry.id, {
          status: 'synced', baseRevision: Number(response.record.revision), nextAttemptAt: null,
          lastError: null, updatedAt: now().toISOString()
        });
        result.pushed += 1;
      } catch (error) {
        const message = error?.message || 'Sync request failed.';
        const permanentFailure = error?.code === 'SYNC_VALIDATION' || /^(22|23)/.test(error?.code || '');
        const exhausted = permanentFailure || attempts >= SYNC_MAX_AUTOMATIC_ATTEMPTS;
        await database.syncOutbox.update(entry.id, {
          status: exhausted ? 'error' : 'retry',
          nextAttemptAt: exhausted ? null : new Date(now().getTime() + calculateRetryDelayMs(attempts, random)).toISOString(),
          lastError: message,
          updatedAt: now().toISOString()
        });
        result[exhausted ? 'errors' : 'retried'] += 1;
        failedEntities.add(entityKey);
      }
    }
    return result;
  };

  const getStatus = async ({ userId } = {}) => {
    const entries = await database.syncOutbox.toArray();
    const conflicts = await database.syncConflicts.toArray();
    const ownerUserId = await getOwner();
    if (!isOnline()) return { status: 'offline', ownerUserId, pending: entries.filter((e) => ['pending', 'retry'].includes(e.status)).length, conflicts: conflicts.filter((c) => c.status === 'unresolved').length };
    if (!ownerUserId) return {
      status: 'pending', ownerUserId: null,
      pending: entries.filter((entry) => ['pending', 'retry'].includes(entry.status)).length,
      conflicts: conflicts.filter((conflict) => conflict.status === 'unresolved').length,
      message: 'Review the initial sync preview before transferring local records.'
    };
    const foreignPending = entries.filter((entry) => entry.authUserAtWrite && userId && entry.authUserAtWrite !== userId &&
      ['pending', 'retry', 'error', 'syncing'].includes(entry.status)).length;
    if (foreignPending) return {
      status: 'error', ownerUserId,
      pending: entries.filter((entry) => ['pending', 'retry'].includes(entry.status)).length,
      conflicts: 0, errors: foreignPending,
      message: `${foreignPending} queued change(s) were made under another signed-in account. They are paused.`
    };
    if (userId && ownerUserId && userId !== ownerUserId) return { status: 'error', ownerUserId, pending: 0, conflicts: 0, message: 'This device is bound to another account.' };
    const unresolved = conflicts.filter((conflict) => conflict.status === 'unresolved').length;
    const errors = entries.filter((entry) => entry.status === 'error').length;
    if (unresolved || errors) return { status: 'conflict-error', ownerUserId, pending: entries.filter((e) => ['pending', 'retry'].includes(e.status)).length, conflicts: unresolved, errors };
    const pending = entries.filter((entry) => ['pending', 'retry', 'syncing'].includes(entry.status)).length;
    return { status: pending ? 'pending' : 'synced', ownerUserId, pending, conflicts: 0, errors: 0 };
  };

  const confirmInitialSync = async (userId) => {
    if (!isOnline()) throw new Error('Connect to the internet before reviewing the remote sync preview.');
    const preview = await getInitialSyncPreview(userId);
    if (preview.ownerUserId && preview.ownerUserId !== userId) {
      throw new Error('This local finance database is bound to another account.');
    }
    if (preview.foreignPendingCount) {
      throw new Error(`${preview.foreignPendingCount} queued change(s) were made under another signed-in account. They remain paused and cannot be assigned to this account.`);
    }
    if (preview.identityIssueCount) {
      throw new Error(`${preview.identityIssueCount} local sync identity or relationship issue(s) must be resolved before initial sync.`);
    }
    await syncTransaction(async () => {
      await setSyncMetadata(database, 'ownerUserId', userId, now());
      await setSyncMetadata(database, 'initialSyncConfirmed', true, now());
      const entries = await database.syncOutbox.toArray();
      for (const entry of entries.filter((item) => item.ownerUserId == null &&
        (!item.authUserAtWrite || item.authUserAtWrite === userId) && ['pending', 'retry', 'error'].includes(item.status))) {
        await database.syncOutbox.update(entry.id, { ownerUserId: userId, updatedAt: now().toISOString() });
      }
      await addInitialSnapshotOperations(userId);
    });
    return { preview, ...(await syncNow(userId)) };
  };

  const syncNow = async (userId) => {
    await assertOwner(userId);
    if (!isOnline()) throw new Error('You are offline. Local changes are saved and will sync after reconnecting.');
    await recoverInterrupted();
    const pull = await pullChanges(userId);
    const push = await pushPending(userId);
    return { pull, push, status: await getStatus({ userId }) };
  };

  const retryFailed = async (userId) => {
    await assertOwner(userId);
    const entries = await database.syncOutbox.toArray();
    for (const entry of entries.filter((item) => item.ownerUserId === userId && item.status === 'error')) {
      await database.syncOutbox.update(entry.id, { status: 'pending', nextAttemptAt: null, updatedAt: now().toISOString() });
    }
    return syncNow(userId);
  };

  const applyResolvedRemote = async (conflict, userId) => {
    const remote = conflict.remotePayload;
    if (!remote.deleted_at) {
      const mapped = await fromWireRecord(database, conflict.collection, remote);
      await database[conflict.collection].put(mapped);
    }
    await setEntityState(conflict.collection, remote.sync_id, remote);
    const entries = await findActiveQueuedOperations(conflict.collection, conflict.syncId, userId);
    for (const entry of entries) {
      if (entry.status === 'conflict') await database.syncOutbox.update(entry.id, { status: 'superseded', updatedAt: now().toISOString() });
    }
  };

  const resolveConflict = async (conflictId, resolution, userId) => {
    await assertOwner(userId);
    if (!['local', 'remote'].includes(resolution)) throw new Error('Choose either the local or remote version.');
    const conflict = await database.syncConflicts.get(conflictId);
    if (!conflict || conflict.status !== 'unresolved' || conflict.ownerUserId !== userId) {
      throw new Error('This unresolved conflict is not available for the signed-in account.');
    }
    await syncTransaction(async () => {
      if (resolution === 'remote') {
        await applyResolvedRemote(conflict, userId);
        await database.syncConflicts.update(conflict.id, { status: 'resolved-remote', resolvedAt: now().toISOString() });
        return;
      }
      const identityCollision = conflict.syncId !== conflict.remotePayload.sync_id;
      const oldOperations = await findActiveQueuedOperations(conflict.collection, conflict.syncId, userId);
      for (const entry of oldOperations) {
        if (entry.status === 'conflict') await database.syncOutbox.update(entry.id, {
          status: 'superseded', updatedAt: now().toISOString()
        });
      }
      if (identityCollision) {
        await setEntityState(conflict.collection, conflict.remotePayload.sync_id, conflict.remotePayload);
        const deleteId = createSyncId();
        const deleteTime = now();
        await database.syncOutbox.add({
          id: deleteId, idempotencyKey: deleteId, collection: conflict.collection,
          syncId: conflict.remotePayload.sync_id, operation: 'delete', ownerUserId: userId,
          authUserAtWrite: userId, baseRevision: conflict.remoteRevision,
          payload: { ...conflict.remotePayload }, createdAt: deleteTime.toISOString(),
          updatedAt: deleteTime.toISOString(), attempts: 0, nextAttemptAt: null,
          status: 'pending', lastError: null
        });
        const localId = createSyncId();
        const localTime = new Date(deleteTime.getTime() + 1).toISOString();
        await database.syncOutbox.add({
          id: localId, idempotencyKey: localId, collection: conflict.collection,
          syncId: conflict.syncId, operation: 'upsert', ownerUserId: userId,
          authUserAtWrite: userId, baseRevision: null,
          payload: { ...conflict.localPayload }, createdAt: localTime,
          updatedAt: localTime, attempts: 0, nextAttemptAt: null,
          status: 'pending', lastError: null
        });
      } else {
        await setEntityState(conflict.collection, conflict.syncId, conflict.remotePayload.deleted_at
          ? { ...conflict.remotePayload, deleted_at: null }
          : conflict.remotePayload);
        const id = createSyncId();
        const timestamp = now().toISOString();
        await database.syncOutbox.add({
          id, idempotencyKey: id, collection: conflict.collection, syncId: conflict.syncId,
          operation: conflict.localOperation || 'upsert', ownerUserId: userId,
          authUserAtWrite: userId, baseRevision: conflict.remoteRevision, payload: { ...conflict.localPayload },
          createdAt: timestamp, updatedAt: timestamp, attempts: 0, nextAttemptAt: null,
          status: 'pending', lastError: null
        });
      }
      await database.syncConflicts.update(conflict.id, { status: 'resolved-local', resolvedAt: now().toISOString() });
    });
    return syncNow(userId);
  };

  return {
    getInitialSyncPreview,
    confirmInitialSync,
    syncNow,
    retryFailed,
    getStatus,
    resolveConflict,
    getConflicts: () => database.syncConflicts.toArray(),
    getOutbox: () => database.syncOutbox.toArray()
  };
}
