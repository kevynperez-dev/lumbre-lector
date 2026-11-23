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
}
