import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createFinanceSyncService } = vi.hoisted(() => ({
  createFinanceSyncService: vi.fn()
}));

vi.mock('./financeSync', () => ({ createFinanceSyncService }));
vi.mock('./supabaseClient', () => ({ supabaseClient: {} }));

import { useFinanceSync } from './useFinanceSync';

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeRepository() {
  const values = new Map([['initialSyncConfirmed', true]]);
  return {
    syncStorage: {
      syncMetadata: {
        get: vi.fn(async (key) => values.has(key) ? { key, value: values.get(key) } : undefined),
        put: vi.fn(async (row) => { values.set(row.key, row.value); })
      }
    }
  };
}

describe('finance sync lifecycle triggers', () => {
  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    service = {
      getStatus: vi.fn(async () => ({ status: 'synced', ownerUserId: userId, pending: 0, conflicts: 0, errors: 0 })),
      getConflicts: vi.fn(async () => []),
      getOutbox: vi.fn(async () => []),
      syncNow: vi.fn(async () => ({ status: 'synced' })),
      retryFailed: vi.fn(async () => ({ status: 'synced' })),
      resolveConflict: vi.fn(async () => ({ status: 'synced' })),
      confirmInitialSync: vi.fn(async () => ({ status: 'synced' }))
    };
    createFinanceSyncService.mockReturnValue(service);
  });

  it('checks sync on reconnect and app resume, and supports an explicit manual sync', async () => {
    const repository = makeRepository();
    const auth = { loading: false, user: { id: userId } };
    const { result, unmount } = renderHook(() => useFinanceSync(repository, auth));

    await waitFor(() => expect(service.syncNow).toHaveBeenCalledTimes(1));

    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(service.syncNow).toHaveBeenCalledTimes(2));

    await act(async () => { window.dispatchEvent(new Event('pageshow')); });
    await waitFor(() => expect(service.syncNow).toHaveBeenCalledTimes(3));

    await act(async () => { await result.current.syncNow(); });
    expect(service.syncNow).toHaveBeenCalledTimes(4);
    expect(service.syncNow).toHaveBeenLastCalledWith(userId);
    unmount();
  });
});
