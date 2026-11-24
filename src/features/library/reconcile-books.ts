import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Cleans interrupted transfers and orphan EPUBs from the app-owned books folder. */
export async function reconcileBookFiles(database: SQLiteDatabase): Promise<void> {
  const directory = new Directory(Paths.document, 'books');
  if (!directory.exists) return;

  const publications = await database.getAllAsync<{ local_uri: string }>(
    'SELECT local_uri FROM publications',
  );
  const indexedUris = new Set(publications.map(({ local_uri }) => local_uri));

  for (const entry of directory.list()) {
    if (!(entry instanceof File)) continue;
    const abandonedTransfer = entry.name.endsWith('.part');
    const orphanedBook = entry.name.endsWith('.epub') && !indexedUris.has(entry.uri);
    if (abandonedTransfer || orphanedBook) entry.delete();
  }
}
