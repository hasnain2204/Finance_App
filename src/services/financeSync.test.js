import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFinanceRepository } from './financeRepository';
import { createFinanceSyncService } from './financeSync';
import {
  enqueueLocalMutation,
  calculateRetryDelayMs,
  getActiveAuthUserSnapshot,
  setActiveAuthUserSnapshot,
  setSyncMetadata
} from './financeSyncQueue';

const userA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const categoryId = '11111111-1111-4111-8111-111111111111';
const methodId = '22222222-2222-4222-8222-222222222222';

function makeTable(initial = [], key = 'id', auto = false) {
  let rows = structuredClone(initial);
  let nextId = Math.max(0, ...rows.map((row) => Number(row[key]) || 0)) + 1;
  const matches = (index, value) => rows.filter((row) => row[index] === value);
  const query = (getRows) => ({
    first: async () => getRows()[0],
    filter: (predicate) => query(() => getRows().filter(predicate)),
    toArray: async () => structuredClone(getRows()),
    delete: async () => {
      const ids = new Set(getRows().map((row) => row[key]));
      rows = rows.filter((row) => !ids.has(row[key]));
    }
  });
  const table = {
    add: async (row) => {
      const next = { ...row, ...(auto && row[key] === undefined ? { [key]: nextId++ } : {}) };
      if (rows.some((item) => item[key] === next[key])) throw new Error(`Duplicate key in ${key}.`);
      rows.push(next);
      return next[key];
    },
    bulkPut: async (items) => { for (const item of items) await table.put(item); },
    clear: async () => { rows = []; },
    count: async () => rows.length,
    delete: async (id) => { rows = rows.filter((row) => row[key] !== id); },
    get: async (id) => structuredClone(rows.find((row) => row[key] === id)),
    orderBy: (index) => ({
      reverse: () => ({ toArray: async () => [...rows].sort((a, b) => String(b[index] || '').localeCompare(String(a[index] || ''))) }),
      toArray: async () => [...rows].sort((a, b) => String(a[index] || '').localeCompare(String(b[index] || '')))
    }),
    put: async (row) => {
      const index = rows.findIndex((item) => item[key] === row[key]);
      if (index < 0) rows.push(structuredClone(row)); else rows[index] = structuredClone(row);
      return row[key];
    },
    toArray: async () => structuredClone(rows),
    update: async (id, changes) => {
      const index = rows.findIndex((row) => row[key] === id);
      if (index < 0) return 0;
      rows[index] = { ...rows[index], ...structuredClone(changes) };
      return 1;
    },
    where: (index) => ({ equals: (value) => query(() => matches(index, value)) }),
    snapshot: () => ({ rows: structuredClone(rows), nextId }),
    restore: (snapshot) => { rows = structuredClone(snapshot.rows); nextId = snapshot.nextId; },
    getRows: () => rows
  };
  return table;
}

function makeDatabase(initial = {}) {
  const database = {
    transactions: makeTable(initial.transactions, 'id', true),
    categories: makeTable(initial.categories),
    paymentMethods: makeTable(initial.paymentMethods),
    budgets: makeTable(initial.budgets),
    budgetHistory: makeTable(initial.budgetHistory, 'id', true),
    preferences: makeTable(initial.preferences),
    syncOutbox: makeTable(initial.syncOutbox),
    syncConflicts: makeTable(initial.syncConflicts),
    syncMetadata: makeTable(initial.syncMetadata, 'key'),
    syncEntityState: makeTable(initial.syncEntityState),
    adapterType: 'test'
  };
  database.transaction = async (...args) => {
    const callback = args.at(-1);
    const tables = Object.values(database).filter((value) => value?.snapshot);
    const snapshots = tables.map((table) => table.snapshot());
    try { return await callback(); }
    catch (error) {
      tables.forEach((table, index) => table.restore(snapshots[index]));
      throw error;
    }
  };
  return database;
}

function localTransaction(syncId = '33333333-3333-4333-8333-333333333333') {
  return {
    syncId, title: 'Lunch', amount: 25000, type: 'expense',
    categoryId: 'food', categorySyncId: categoryId,
    paymentMethodId: 'cash', paymentMethodSyncId: methodId,
    date: '2026-10-25', notes: ''
  };
}

function makeClient(rpcImplementation = async (name) => {
  if (name === 'pws_sync_preview') return { data: { categories: 0, paymentMethods: 0, transactions: 0, budgets: 0, budgetHistory: 0, preferences: 0 } };
  if (name === 'pws_sync_pull') return { data: { changes: [], next_cursor: null, has_more: false } };
  return { data: { status: 'applied', record: { user_id: userA, sync_id: '33333333-3333-4333-8333-333333333333', revision: 1, updated_at: '2026-10-26T00:00:00Z', deleted_at: null } } };
}) {
  return { rpc: vi.fn(async (name, args) => rpcImplementation(name, args)) };
}

async function bindUser(database, userId = userA) {
  await setSyncMetadata(database, 'ownerUserId', userId);
  await setSyncMetadata(database, 'activeAuthUserId', userId);
  await setSyncMetadata(database, 'initialSyncConfirmed', true);
}

describe('offline-first finance sync queue', () => {
  let database;

  beforeEach(() => {
    database = makeDatabase({
      categories: [{ id: 'food', syncId: categoryId, name: 'Food', type: 'expense' }],
      paymentMethods: [{ id: 'cash', syncId: methodId, name: 'Cash' }]
    });
  });

  it('queues a local create in the same transaction and remains pending offline and after service restart', async () => {
    await bindUser(database);
    const repository = createFinanceRepository(database, vi.fn());
    const id = await repository.saveTransaction(null, localTransaction());
    expect(database.transactions.getRows()).toHaveLength(1);
    expect(database.syncOutbox.getRows()).toHaveLength(1);
    expect(database.syncOutbox.getRows()[0]).toMatchObject({
      collection: 'transactions', syncId: localTransaction().syncId,
      ownerUserId: userA, operation: 'upsert', status: 'pending'
    });
    expect(database.transactions.getRows()[0].id).toBe(id);

    const offlineService = createFinanceSyncService({ repository, client: makeClient(), isOnline: () => false });
    expect((await offlineService.getStatus({ userId: userA })).status).toBe('offline');
    const restartedService = createFinanceSyncService({ repository, client: makeClient() });
    expect((await restartedService.getStatus({ userId: userA })).pending).toBe(1);
  });

  it('rolls back a finance write if durable outbox insertion fails', async () => {
    await bindUser(database);
    const originalAdd = database.syncOutbox.add;
    database.syncOutbox.add = async () => { throw new Error('simulated queue storage failure'); };
    const repository = createFinanceRepository(database, vi.fn());
    await expect(repository.saveTransaction(null, localTransaction())).rejects.toThrow('simulated queue storage failure');
    expect(database.transactions.getRows()).toEqual([]);
    database.syncOutbox.add = originalAdd;
  });

  it('uses bounded exponential backoff with jitter', () => {
    expect(calculateRetryDelayMs(1, () => 0)).toBe(500);
    expect(calculateRetryDelayMs(2, () => 1)).toBe(3000);
    expect(calculateRetryDelayMs(99, () => 1)).toBe(384000);
  });

  it('retries a delivered operation with the same idempotency key after a lost acknowledgement', async () => {
    await bindUser(database);
    await enqueueLocalMutation(database, { collection: 'transactions', operation: 'upsert', record: localTransaction() });
    const serverResults = new Map();
    let firstApply = true;
    const client = makeClient(async (name, args) => {
      if (name === 'pws_sync_preview') return { data: {} };
      if (name === 'pws_sync_pull') return { data: { changes: [], next_cursor: null, has_more: false } };
      const old = serverResults.get(args.p_idempotency_key);
      if (old) return { data: old };
      const response = { status: 'applied', record: { user_id: userA, sync_id: args.p_sync_id, revision: 1, updated_at: '2026-10-26T00:00:00Z', deleted_at: null } };
      serverResults.set(args.p_idempotency_key, response);
      if (firstApply) { firstApply = false; throw new Error('connection lost after server commit'); }
      return { data: response };
    });
    let time = new Date('2026-10-26T00:00:00Z');
    const service = createFinanceSyncService({ repository: createFinanceRepository(database, vi.fn()), client, now: () => time, random: () => 0 });

    await service.syncNow(userA);
    const entry = database.syncOutbox.getRows()[0];
    expect(entry.status).toBe('retry');
    time = new Date(new Date(entry.nextAttemptAt).getTime() + 1);
    await service.syncNow(userA);
    expect(database.syncOutbox.getRows()[0].status).toBe('synced');
    const applyCalls = client.rpc.mock.calls.filter(([name]) => name === 'pws_sync_apply');
    expect(applyCalls).toHaveLength(2);
    expect(applyCalls[0][1].p_idempotency_key).toBe(applyCalls[1][1].p_idempotency_key);
    expect(serverResults.size).toBe(1);
  });

  it('keeps local changes paused when the current or queued account does not match', async () => {
    await setSyncMetadata(database, 'ownerUserId', userA);
    await setSyncMetadata(database, 'activeAuthUserId', userB);
    await enqueueLocalMutation(database, { collection: 'transactions', operation: 'upsert', record: localTransaction() });
    expect(database.syncOutbox.getRows()[0]).toMatchObject({ ownerUserId: null, authUserAtWrite: userB });
    const client = makeClient();
    const service = createFinanceSyncService({ repository: createFinanceRepository(database, vi.fn()), client });
    await expect(service.syncNow(userB)).rejects.toThrow('bound to a different account');
    const preview = await service.getInitialSyncPreview(userA);
    expect(preview.foreignPendingCount).toBe(1);
    await expect(service.confirmInitialSync(userA)).rejects.toThrow('made under another signed-in account');
    expect(client.rpc.mock.calls.some(([name]) => name === 'pws_sync_apply')).toBe(false);
  });

  it('uses the immediate auth event snapshot instead of stale persisted account metadata', async () => {
    const previousSnapshot = getActiveAuthUserSnapshot();
    await bindUser(database, userA);
    setActiveAuthUserSnapshot(userB);
    try {
      await enqueueLocalMutation(database, { collection: 'transactions', operation: 'upsert', record: localTransaction() });
      expect(database.syncOutbox.getRows()[0]).toMatchObject({ ownerUserId: null, authUserAtWrite: userB });
    } finally {
      setActiveAuthUserSnapshot(previousSnapshot);
    }
  });

  it('previews collection counts without writing, then snapshots records only after confirmation', async () => {
    await setSyncMetadata(database, 'activeAuthUserId', userA);
    await database.transactions.put({ id: 1, ...localTransaction() });
    await database.preferences.put({ id: 'app', syncId: '88888888-8888-4888-8888-888888888888', currency: 'PKR' });
    const client = makeClient(async (name, args) => {
      if (name === 'pws_sync_preview') return { data: { categories: 3, paymentMethods: 2, transactions: 4, budgets: 1, budgetHistory: 1, preferences: 1 } };
      if (name === 'pws_sync_pull') return { data: { changes: [], next_cursor: null, has_more: false } };
      return { data: { status: 'applied', record: { user_id: userA, sync_id: args.p_sync_id, revision: 1, updated_at: '2026-10-26T00:00:00Z', deleted_at: null } } };
    });
    const repository = createFinanceRepository(database, vi.fn());
    const service = createFinanceSyncService({ repository, client });
    const preview = await service.getInitialSyncPreview(userA);
    expect(preview.localCounts).toMatchObject({ categories: 1, paymentMethods: 1, transactions: 1, preferences: 1 });
    expect(preview.remoteCounts.transactions).toBe(4);
    expect(database.syncOutbox.getRows()).toEqual([]);

    await service.confirmInitialSync(userA);
    expect(await database.syncMetadata.get('ownerUserId')).toMatchObject({ value: userA });
    expect(database.syncOutbox.getRows().every((entry) => entry.ownerUserId === userA)).toBe(true);
    expect(database.syncOutbox.getRows().some((entry) => entry.collection === 'transactions')).toBe(true);
    expect(database.syncOutbox.getRows().some((entry) => entry.collection === 'budgets' && entry.payload.month === 'all')).toBe(false);
  });

  it('queues local deletion as a durable tombstone before removing the local row', async () => {
    await bindUser(database);
    const row = { id: 7, ...localTransaction() };
    await database.transactions.put(row);
    const repository = createFinanceRepository(database, vi.fn());
    await repository.deleteTransactionOrBudgetHistory({ id: 7, historyType: 'transaction' });
    expect(database.transactions.getRows()).toEqual([]);
    expect(database.syncOutbox.getRows()[0]).toMatchObject({
      collection: 'transactions', operation: 'delete', syncId: row.syncId,
      ownerUserId: userA, payload: expect.objectContaining({ title: 'Lunch', amount: 25000 })
    });
  });

  it('preserves both versions and blocks last-write-wins on revision conflict', async () => {
    await bindUser(database);
    const local = { id: 4, ...localTransaction() };
    await database.transactions.put(local);
    await enqueueLocalMutation(database, { collection: 'transactions', operation: 'upsert', record: local });
    const client = makeClient(async (name, args) => {
      if (name === 'pws_sync_pull') return { data: { changes: [], next_cursor: null, has_more: false } };
      if (name === 'pws_sync_preview') return { data: {} };
      return { data: { status: 'conflict', record: {
        user_id: userA, sync_id: local.syncId, title: 'Remote lunch', amount_paisa: 35000,
        type: 'expense', category_sync_id: categoryId, payment_method_sync_id: methodId,
        date: '2026-10-25', notes: '', revision: 5,
        created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-26T00:00:00Z', deleted_at: null
      } } };
    });
    const service = createFinanceSyncService({ repository: createFinanceRepository(database, vi.fn()), client });
    await service.syncNow(userA);
    expect(database.syncConflicts.getRows()).toHaveLength(1);
    expect(database.syncConflicts.getRows()[0]).toMatchObject({
      localPayload: expect.objectContaining({ amount: 25000 }),
      remotePayload: expect.objectContaining({ amount_paisa: 35000, revision: 5 }),
      status: 'unresolved'
    });
    expect(database.syncOutbox.getRows()[0].status).toBe('conflict');
    expect(database.transactions.getRows()[0].amount).toBe(25000);
    expect((await service.getStatus({ userId: userA })).status).toBe('conflict-error');
  });

  it('resolves a revision conflict by rebasing the explicit local choice on the remote revision', async () => {
    await bindUser(database);
    const local = { id: 5, ...localTransaction() };
    await database.transactions.put(local);
    await enqueueLocalMutation(database, { collection: 'transactions', operation: 'upsert', record: local });
    let applyCount = 0;
    const client = makeClient(async (name, args) => {
      if (name === 'pws_sync_pull') return { data: { changes: [], next_cursor: null, has_more: false } };
      if (name === 'pws_sync_preview') return { data: {} };
      applyCount += 1;
      if (applyCount === 1) return { data: { status: 'conflict', record: {
        user_id: userA, sync_id: local.syncId, revision: 4, title: 'Remote value', amount_paisa: 35000,
        category_sync_id: categoryId, payment_method_sync_id: methodId, deleted_at: null
      } } };
      return { data: { status: 'applied', record: {
        user_id: userA, sync_id: args.p_sync_id, revision: 5, updated_at: '2026-10-26T00:00:01Z', deleted_at: null
      } } };
    });
    const service = createFinanceSyncService({ repository: createFinanceRepository(database, vi.fn()), client });
    await service.syncNow(userA);
    const conflict = database.syncConflicts.getRows()[0];
    await service.resolveConflict(conflict.id, 'local', userA);
    expect(database.syncConflicts.getRows()[0].status).toBe('resolved-local');
    expect(database.transactions.getRows()[0].amount).toBe(local.amount);
    expect(database.syncOutbox.getRows().map((entry) => entry.status).sort()).toEqual(['superseded', 'synced']);
    const calls = client.rpc.mock.calls.filter(([name]) => name === 'pws_sync_apply');
    expect(calls[1][1].p_base_revision).toBe(4);
  });

  it('resolves a unique monthly-budget identity collision without changing the local stable ID', async () => {
    await bindUser(database);
    const localId = '99999999-9999-4999-8999-999999999999';
    await database.budgets.put({
      id: 'budget-2026-10-food', syncId: localId, categoryId: 'food',
      categorySyncId: categoryId, month: '2026-10', amount: 30000, syncRole: 'source'
    });
    await enqueueLocalMutation(database, {
      collection: 'budgets', operation: 'upsert',
      record: await database.budgets.get('budget-2026-10-food')
    });
    const remoteId = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
    let firstBudgetCollision = true;
    const client = makeClient(async (name, args) => {
      if (name === 'pws_sync_pull') return { data: { changes: [], next_cursor: null, has_more: false } };
      if (name === 'pws_sync_preview') return { data: {} };
      if (firstBudgetCollision && args.p_operation === 'upsert' && args.p_sync_id === localId && !args.p_base_revision) {
        firstBudgetCollision = false;
        return { data: { status: 'conflict', record: {
          user_id: userA, sync_id: remoteId, revision: 1, month: '2026-10',
          category_sync_id: categoryId, amount_paisa: 25000, deleted_at: null
        } } };
      }
      return { data: { status: 'applied', record: {
        user_id: userA, sync_id: args.p_sync_id, revision: args.p_operation === 'delete' ? 2 : 1,
        updated_at: '2026-10-26T00:00:00Z', deleted_at: args.p_operation === 'delete' ? '2026-10-26T00:00:00Z' : null
      } } };
    });
    const service = createFinanceSyncService({ repository: createFinanceRepository(database, vi.fn()), client });
    await service.syncNow(userA);
    const conflict = database.syncConflicts.getRows()[0];
    expect(conflict.remotePayload.sync_id).toBe(remoteId);
    await service.resolveConflict(conflict.id, 'local', userA);
    expect(database.budgets.getRows()[0].syncId).toBe(localId);
    const calls = client.rpc.mock.calls.filter(([name]) => name === 'pws_sync_apply').map(([, args]) => args);
    expect(calls.slice(1).map(({ p_operation }) => p_operation)).toEqual(['delete', 'upsert']);
    expect(calls[1].p_sync_id).toBe(remoteId);
    expect(calls[2].p_sync_id).toBe(localId);
    expect(calls[2].p_base_revision).toBeNull();
  });

  it('continues independent queue work after a partial push failure', async () => {
    await bindUser(database);
    await enqueueLocalMutation(database, {
      collection: 'categories', operation: 'upsert',
      record: { id: 'custom', syncId: '44444444-4444-4444-8444-444444444444', name: 'Custom', type: 'expense' }
    });
    await enqueueLocalMutation(database, {
      collection: 'paymentMethods', operation: 'upsert',
      record: { id: 'wallet', syncId: '55555555-5555-4555-8555-555555555555', name: 'Wallet' }
    });
    const client = makeClient(async (name, args) => {
      if (name === 'pws_sync_pull') return { data: { changes: [], next_cursor: null, has_more: false } };
      if (args.p_collection === 'categories') throw new Error('temporary category service failure');
      return { data: { status: 'applied', record: { user_id: userA, sync_id: args.p_sync_id, revision: 1, updated_at: '2026-10-26T00:00:00Z', deleted_at: null } } };
    });
    const service = createFinanceSyncService({ repository: createFinanceRepository(database, vi.fn()), client, random: () => 0 });
    const result = await service.syncNow(userA);
    expect(result.push).toMatchObject({ retried: 1, pushed: 1 });
    expect(database.syncOutbox.getRows().map((entry) => entry.status).sort()).toEqual(['retry', 'synced']);
  });

  it('does not advance the pull cursor when a remote transaction has unresolved references', async () => {
    await bindUser(database);
    const client = makeClient(async (name) => {
      if (name === 'pws_sync_pull') return { data: {
        changes: [{ collection: 'transactions', record: {
          user_id: userA, sync_id: '66666666-6666-4666-8666-666666666666', revision: 1,
          title: 'Unlinked', amount_paisa: 100, type: 'expense',
          category_sync_id: '77777777-7777-4777-8777-777777777777',
          payment_method_sync_id: methodId, date: '2026-10-25', notes: '',
          created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-26T00:00:00Z', deleted_at: null
        } }], next_cursor: { updated_at: '2026-10-26T00:00:00Z' }, has_more: false
      } };
      return { data: {} };
    });
    const service = createFinanceSyncService({ repository: createFinanceRepository(database, vi.fn()), client });
    await expect(service.syncNow(userA)).rejects.toThrow('missing category or payment method');
    expect(await database.syncMetadata.get('pullCursor')).toBeUndefined();
    expect(database.transactions.getRows()).toEqual([]);
  });

  it('turns a remote deletion into a resolvable conflict and preserves the local row after acceptance', async () => {
    await bindUser(database);
    const local = { id: 9, ...localTransaction() };
    await database.transactions.put(local);
    const client = makeClient(async (name) => {
      if (name === 'pws_sync_pull') return { data: { changes: [{
        collection: 'transactions', record: {
        user_id: userA, sync_id: local.syncId, revision: 2, deleted_at: '2026-10-26T00:00:00Z',
          updated_at: '2026-10-26T00:00:00Z'
        }
      }], next_cursor: { revision: 2 }, has_more: false } };
      return { data: {} };
    });
    const repository = createFinanceRepository(database, vi.fn());
    const service = createFinanceSyncService({ repository, client });
    await service.syncNow(userA);
    const conflict = database.syncConflicts.getRows()[0];
    expect(conflict.status).toBe('unresolved');
    expect(database.transactions.getRows()).toHaveLength(1);
    await service.resolveConflict(conflict.id, 'remote', userA);
    expect(database.transactions.getRows()).toHaveLength(1);
    expect(database.syncEntityState.getRows()[0].deletedAt).toBe('2026-10-26T00:00:00Z');
  });
});
