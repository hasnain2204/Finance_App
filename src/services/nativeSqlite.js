import { Capacitor } from '@capacitor/core';
import {
  NATIVE_SQLITE_DATABASE_NAME,
  NATIVE_SQLITE_SCHEMA_VERSION,
  NATIVE_SQLITE_UPGRADES
} from './nativeSqliteSchema';

let initializationPromise;

async function createNativeDatabaseConnection() {
  if (!Capacitor.isNativePlatform()) {
    throw new Error('Native SQLite is available only inside a native Capacitor app.');
  }

  const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
  const sqlite = new SQLiteConnection(CapacitorSQLite);
  const consistency = await sqlite.checkConnectionsConsistency();
  const connectionExists = await sqlite.isConnection(NATIVE_SQLITE_DATABASE_NAME, false);
  let database;

  if (consistency.result && connectionExists.result) {
    database = await sqlite.retrieveConnection(NATIVE_SQLITE_DATABASE_NAME, false);
    const currentVersion = await database.getVersion();
    if (Number(currentVersion.version || 0) >= NATIVE_SQLITE_SCHEMA_VERSION) {
      const isOpen = await database.isDBOpen();
      if (!isOpen.result) await database.open();
      await database.execute('PRAGMA foreign_keys = ON;');
      return { database, sqlite };
    }
    await sqlite.closeConnection(NATIVE_SQLITE_DATABASE_NAME, false);
  } else if (connectionExists.result) {
    await sqlite.closeConnection(NATIVE_SQLITE_DATABASE_NAME, false);
  }

  {
    await sqlite.addUpgradeStatement(NATIVE_SQLITE_DATABASE_NAME, NATIVE_SQLITE_UPGRADES);
    database = await sqlite.createConnection(
      NATIVE_SQLITE_DATABASE_NAME,
      false,
      'no-encryption',
      NATIVE_SQLITE_SCHEMA_VERSION,
      false
    );
  }

  const isOpen = await database.isDBOpen();
  if (!isOpen.result) await database.open();
  await database.execute('PRAGMA foreign_keys = ON;');
  return { database, sqlite };
}

export async function initializeNativeSqlite() {
  if (!initializationPromise) {
    initializationPromise = createNativeDatabaseConnection().catch((error) => {
      initializationPromise = undefined;
      throw error;
    });
  }
  return initializationPromise;
}
