import { describe, it, expect } from 'vitest';
import { groupTransactionsByDateBuckets } from './TransactionsScreen';

describe('groupTransactionsByDateBuckets', () => {
  const baseNow = new Date('2026-11-16T12:00:00Z');

  it('correctly partitions transactions into the 4 buckets', () => {
    const items = [
      { id: 'tx-today', date: '2026-11-16', amount: 100 },
      { id: 'tx-3days', date: '2026-11-13', amount: 200 },
      { id: 'tx-2weeks', date: '2026-11-01', amount: 300 },
      { id: 'tx-old', date: '2026-09-10', amount: 400 }
    ];

    const groups = groupTransactionsByDateBuckets(items, baseNow);

    expect(groups.length).toBe(4);
    expect(groups[0].title).toBe('Last 24 Hours');
    expect(groups[0].items.map((i) => i.id)).toEqual(['tx-today']);

    expect(groups[1].title).toBe('Last 7 Days');
    expect(groups[1].items.map((i) => i.id)).toEqual(['tx-3days']);

    expect(groups[2].title).toBe('Last Month');
    expect(groups[2].items.map((i) => i.id)).toEqual(['tx-2weeks']);

    expect(groups[3].title).toBe('Older');
    expect(groups[3].items.map((i) => i.id)).toEqual(['tx-old']);
  });

  it('filters out empty date buckets', () => {
    const items = [
      { id: 'tx-today', date: '2026-11-16', amount: 100 }
    ];

    const groups = groupTransactionsByDateBuckets(items, baseNow);

    expect(groups.length).toBe(1);
    expect(groups[0].title).toBe('Last 24 Hours');
  });
});
