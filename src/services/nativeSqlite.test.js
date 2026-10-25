import { describe, expect, it } from 'vitest';
import { initializeNativeSqlite } from './nativeSqlite';
import {
  NATIVE_SQLITE_SCHEMA_VERSION,
  NATIVE_SQLITE_UPGRADES
} from './nativeSqliteSchema';

describe('native SQLite foundation', () => {
  it('declares a versioned schema for the six existing data collections', () => {
    expect(NATIVE_SQLITE_SCHEMA_VERSION).toBe(2);
    expect(NATIVE_SQLITE_UPGRADES).toHaveLength(2);
    expect(NATIVE_SQLITE_UPGRADES.map(({ toVersion }) => toVersion)).toEqual([1, NATIVE_SQLITE_SCHEMA_VERSION]);

    const tableStatements = NATIVE_SQLITE_UPGRADES[0].statements
      .filter((statement) => statement.startsWith('CREATE TABLE'));
    expect(tableStatements.map((statement) => statement.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1]))
      .toEqual([
        'categories',
        'payment_methods',
        'transactions',
        'budgets',
        'budget_history',
        'preferences'
      ]);

    for (const statement of tableStatements) {
      expect(statement).toContain('sync_id TEXT NOT NULL UNIQUE');
    }
    expect(tableStatements.find((statement) => statement.includes('CREATE TABLE IF NOT EXISTS transactions')))
      .toContain('category_sync_id TEXT');
    expect(tableStatements.find((statement) => statement.includes('CREATE TABLE IF NOT EXISTS transactions')))
      .toContain('payment_method_sync_id TEXT');
  });

  it('stores money as checked integer paisa and excludes the derived cumulative budget from source rows', () => {
    const statements = NATIVE_SQLITE_UPGRADES[0].statements.join('\n');
    expect(statements).toContain('amount_paisa INTEGER NOT NULL CHECK');
    expect(statements).toContain('previous_amount_paisa INTEGER CHECK');
    expect(statements).toContain('sync_role TEXT NOT NULL DEFAULT \'source\'');
    expect(statements).toContain("id <> 'budget-all-overall' AND sync_role <> 'derived'");
  });

  it('adds durable outbox, conflict, owner, and revision state in SQLite schema version 2', () => {
    const statements = NATIVE_SQLITE_UPGRADES[1].statements.join('\n');
    expect(statements).toContain('CREATE TABLE IF NOT EXISTS sync_outbox');
    expect(statements).toContain('idempotency_key TEXT NOT NULL UNIQUE');
    expect(statements).toContain('auth_user_at_write TEXT');
    expect(statements).toContain('CREATE TABLE IF NOT EXISTS sync_conflicts');
    expect(statements).toContain('CREATE TABLE IF NOT EXISTS sync_metadata');
    expect(statements).toContain('CREATE TABLE IF NOT EXISTS sync_entity_state');
    expect(statements).toContain('payload_json TEXT NOT NULL');
  });

  it('does not open the native database from the web platform', async () => {
    await expect(initializeNativeSqlite())
      .rejects.toThrow('Native SQLite is available only inside a native Capacitor app.');
  });
});
