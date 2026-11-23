import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const result = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    await database.withTransactionAsync(async () => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS publications (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          author TEXT NOT NULL DEFAULT '',
          language TEXT NOT NULL DEFAULT 'und',
          format TEXT NOT NULL,
          local_uri TEXT NOT NULL,
          cover_uri TEXT,
          source_name TEXT,
          rights_notice TEXT,
          added_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          last_opened_at TEXT,
          progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1)
        );

        CREATE INDEX IF NOT EXISTS idx_publications_last_opened
        ON publications(last_opened_at DESC);

        PRAGMA user_version = 1;
      `);
    });
  }

  if (currentVersion < 2) {
    await database.withTransactionAsync(async () => {
      await database.execAsync(`
        CREATE TABLE IF NOT EXISTS reading_positions (
          publication_id TEXT PRIMARY KEY NOT NULL REFERENCES publications(id) ON DELETE CASCADE,
          locator_json TEXT NOT NULL,
          progress REAL NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 1),
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reader_preferences (
          preference_key TEXT PRIMARY KEY NOT NULL,
          preference_value TEXT NOT NULL,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        PRAGMA user_version = 2;
      `);
    });
  }
}
