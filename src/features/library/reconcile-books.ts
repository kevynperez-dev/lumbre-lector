import { Directory, File, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

/** Cleans abandoned catalog transfers without touching user-imported documents. */
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
    const orphanedCatalogBook =
      entry.name.startsWith('gutenberg-') &&
      entry.name.endsWith('.epub') &&
      !indexedUris.has(entry.uri);
    if (abandonedTransfer || orphanedCatalogBook) entry.delete();
  }
}
