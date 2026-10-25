import { beforeEach, describe, expect, it, vi } from 'vitest';

const { initializeNativeSqlite, nativeDatabase } = vi.hoisted(() => {
  const connection = {
    beginTransaction: vi.fn(async () => ({})),
    commitTransaction: vi.fn(async () => ({})),
    rollbackTransaction: vi.fn(async () => ({})),
    run: vi.fn(async () => ({ changes: { lastId: 19 } })),
    query: vi.fn(async () => ({ values: [] }))
  };
  return {
    nativeDatabase: connection,
    initializeNativeSqlite: vi.fn(async () => ({ database: connection }))
  };
});

vi.mock('./nativeSqlite', () => ({ initializeNativeSqlite }));

import { createNativeSqliteAdapter } from './nativeSqliteAdapter';

describe('native SQLite Dexie adapter transaction bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits repository transaction callbacks through Capacitor SQLite', async () => {
    const database = createNativeSqliteAdapter();

    await database.transaction('rw', database.transactions, async () => {
      await database.transactions.clear();
    });

    expect(nativeDatabase.beginTransaction).toHaveBeenCalledOnce();
    expect(nativeDatabase.run).toHaveBeenCalledWith('DELETE FROM transactions', [], false, 'no');
    expect(nativeDatabase.commitTransaction).toHaveBeenCalledOnce();
    expect(nativeDatabase.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rolls back a failed repository transaction callback', async () => {
    const database = createNativeSqliteAdapter();
    const failure = new Error('write failed');

    await expect(database.transaction('rw', database.transactions, async () => {
      await database.transactions.clear();
      throw failure;
    })).rejects.toBe(failure);

    expect(nativeDatabase.beginTransaction).toHaveBeenCalledOnce();
    expect(nativeDatabase.rollbackTransaction).toHaveBeenCalledOnce();
    expect(nativeDatabase.commitTransaction).not.toHaveBeenCalled();
  });

  it('requests an inserted local ID for autoincrement collections', async () => {
    const database = createNativeSqliteAdapter();

    const id = await database.transactions.add({
      syncId: '88000000-0000-4000-8000-000000000001',
      title: 'Adapter check',
      amount: 100,
      type: 'expense',
      categoryId: 'cat-food',
      date: '2026-10-25'
    });

    expect(id).toBe(19);
    expect(nativeDatabase.run).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO transactions'),
      expect.any(Array),
      true,
      'last'
    );
  });
});
