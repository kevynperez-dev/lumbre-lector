import { Directory, File, FileMode, Paths } from 'expo-file-system';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CatalogBook } from './catalog-api';
import {
  downloadEpub,
  type DownloadFile,
  type EpubDownloadRuntime,
} from './epub-download-core';

class NativeDownloadFile implements DownloadFile {
  constructor(readonly native: File) {}

  get uri() { return this.native.uri; }
  get exists() { return this.native.exists; }
  get size() { return this.native.size; }

  async readHeader(byteCount: number): Promise<Uint8Array> {
    const handle = this.native.open(FileMode.ReadOnly);
    try {
      return await handle.readBytes(byteCount);
    } finally {
      handle.close();
    }
  }

  copyTo(destination: DownloadFile): void {
    if (!(destination instanceof NativeDownloadFile)) {
      throw new Error('Destino de archivo incompatible.');
    }
    this.native.copy(destination.native);
  }

  delete(): void {
    this.native.delete();
  }
}

function nativeFile(file: DownloadFile): File {
  if (!(file instanceof NativeDownloadFile)) throw new Error('Archivo incompatible.');
  return file.native;
}

export async function downloadBook(
  database: SQLiteDatabase,
  book: CatalogBook,
  signal: AbortSignal,
  onProgress: (fraction: number | null) => void,
): Promise<'downloaded' | 'already-downloaded'> {
  let directory: Directory | undefined;
  const runtime: EpubDownloadRuntime = {
    async findPublication(id) {
      const row = await database.getFirstAsync<{ local_uri: string }>(
        'SELECT local_uri FROM publications WHERE id = ?',
        id,
      );
      return row ? { localUri: row.local_uri } : null;
    },
    fileExists(uri) { return new File(uri).exists; },
    async removePublication(id) {
      await database.runAsync('DELETE FROM publications WHERE id = ?', id);
    },
    prepareBooksDirectory() {
      directory = new Directory(Paths.document, 'books');
      directory.create({ idempotent: true, intermediates: true });
    },
    file(name) {
      if (!directory) throw new Error('No se preparó el directorio de libros.');
      return new NativeDownloadFile(new File(directory, name));
    },
    async download(url, destination, abortSignal, progress) {
      const result = await File.downloadFileAsync(url, nativeFile(destination), {
        idempotent: true,
        signal: abortSignal,
        headers: { Accept: 'application/epub+zip, application/octet-stream;q=0.9' },
        onProgress: ({ bytesWritten, totalBytes }) => progress(bytesWritten, totalBytes),
      });
      return new NativeDownloadFile(result);
    },
    async savePublication(id, selectedBook, localUri, rightsNotice, fileSize) {
      await database.withTransactionAsync(async () => {
        await database.runAsync(
          `INSERT INTO publications
            (id, title, author, language, format, local_uri, source_name, rights_notice, file_size)
           VALUES (?, ?, ?, ?, 'epub', ?, 'Project Gutenberg', ?, ?)`,
          id,
          selectedBook.title,
          selectedBook.author,
          selectedBook.language,
          localUri,
          rightsNotice,
          fileSize,
        );
      });
    },
  };

  return downloadEpub(runtime, book, signal, onProgress);
}
