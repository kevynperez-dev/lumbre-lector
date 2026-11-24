import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Cleans interrupted transfers and orphan EPUBs from the app-owned books folder. */
export async function reconcileBookFiles(database: SQLiteDatabase): Promise<void> {
  const directory = new Directory(Paths.document, 'books');
  if (!directory.exists) return;

  const publications = await database.getAllAsync<{ local_uri: string; file_size: number }>(
    'SELECT local_uri, file_size FROM publications',
  );
  const indexedUris = new Map(publications.map(({ local_uri, file_size }) => [local_uri, file_size]));

  for (const entry of directory.list()) {
    if (!(entry instanceof File)) continue;
    const abandonedTransfer = entry.name.endsWith('.part');
    const indexedSize = indexedUris.get(entry.uri);
    const orphanedBook = entry.name.endsWith('.epub') && indexedSize === undefined;
    if (abandonedTransfer || orphanedBook) {
      entry.delete();
    } else if (entry.name.endsWith('.epub') && indexedSize !== undefined && indexedSize !== entry.size) {
      await database.runAsync('UPDATE publications SET file_size = ? WHERE local_uri = ?', entry.size, entry.uri);
    }
  }
}
