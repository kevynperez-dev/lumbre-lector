import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CatalogBook } from './catalog-api';
import { createGutenbergRightsNotice, getDownloadUrl, isEpubContainerHeader, MAX_EPUB_SIZE } from '../../domain/epub';

export async function downloadBook(
  database: SQLiteDatabase,
  book: CatalogBook,
  signal: AbortSignal,
  onProgress: (fraction: number | null) => void,
): Promise<'downloaded' | 'already-downloaded'> {
  const bookId = `gutenberg-${book.id}`;
  const existing = await database.getFirstAsync<{ id: string; local_uri: string }>(
    'SELECT id FROM publications WHERE id = ?',
    bookId,
  );
  if (existing && new File(existing.local_uri).exists) return 'already-downloaded';
  if (existing) {
    await database.runAsync('DELETE FROM publications WHERE id = ?', bookId);
  }

  const url = getDownloadUrl(book);
  const directory = new Directory(Paths.document, 'books');
  directory.create({ idempotent: true, intermediates: true });
  const partial = new File(directory, `${bookId}.part`);
  const published = new File(directory, `${bookId}.epub`);
  if (partial.exists) partial.delete();

  try {
    const downloaded = await File.downloadFileAsync(url, partial, {
      idempotent: true,
      signal,
      headers: { Accept: 'application/epub+zip, application/octet-stream;q=0.9' },
      onProgress: ({ bytesWritten, totalBytes }) => {
        onProgress(totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : null);
      },
    });

    if (!downloaded.exists || downloaded.size <= 0 || downloaded.size > MAX_EPUB_SIZE) {
      throw new Error('El archivo descargado está vacío o supera el límite de 100 MB.');
    }

    const handle = downloaded.open(FileMode.ReadOnly);
    let signature: Uint8Array;
    try {
      signature = await handle.readBytes(58);
    } finally {
      handle.close();
    }
    if (!isEpubContainerHeader(signature)) {
      throw new Error('La fuente no entregó un EPUB válido. No se guardó en la biblioteca.');
    }

    downloaded.copy(published);
    await database.withTransactionAsync(async () => {
      await database.runAsync(
        `INSERT INTO publications
          (id, title, author, language, format, local_uri, source_name, rights_notice)
         VALUES (?, ?, ?, ?, 'epub', ?, 'Project Gutenberg', ?)` ,
        bookId,
        book.title,
        book.author,
        book.language,
        published.uri,
        createGutenbergRightsNotice(book),
      );
    });
    onProgress(1);
    return 'downloaded';
  } catch (error) {
    if (published.exists) published.delete();
    if (signal.aborted) throw error;
    throw error instanceof Error
      ? error
      : new Error('No se pudo descargar el EPUB. Comprueba tu conexión e inténtalo otra vez.');
  } finally {
    if (partial.exists) partial.delete();
  }
}
