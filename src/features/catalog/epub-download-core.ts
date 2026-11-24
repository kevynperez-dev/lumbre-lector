import {
  createGutenbergRightsNotice,
  getDownloadUrl,
  isEpubContainerHeader,
  MAX_EPUB_SIZE,
} from '../../domain/epub.ts';
import type { CatalogBook } from './catalog-api';

export type DownloadFile = {
  readonly uri: string;
  readonly exists: boolean;
  readonly size: number;
  readHeader(byteCount: number): Promise<Uint8Array>;
  copyTo(destination: DownloadFile): void;
  delete(): void;
};

export type EpubDownloadRuntime = {
  findPublication(id: string): Promise<{ localUri: string } | null>;
  fileExists(uri: string): boolean;
  removePublication(id: string): Promise<void>;
  prepareBooksDirectory(): void;
  file(name: string): DownloadFile;
  download(
    url: string,
    destination: DownloadFile,
    signal: AbortSignal,
    onProgress: (bytesWritten: number, totalBytes: number) => void,
  ): Promise<DownloadFile>;
  savePublication(
    id: string,
    book: CatalogBook,
    localUri: string,
    rightsNotice: string,
  ): Promise<void>;
};

export async function downloadEpub(
  runtime: EpubDownloadRuntime,
  book: CatalogBook,
  signal: AbortSignal,
  onProgress: (fraction: number | null) => void,
): Promise<'downloaded' | 'already-downloaded'> {
  const bookId = `gutenberg-${book.id}`;
  const existing = await runtime.findPublication(bookId);
  if (existing && runtime.fileExists(existing.localUri)) return 'already-downloaded';
  if (existing) await runtime.removePublication(bookId);

  const url = getDownloadUrl(book);
  runtime.prepareBooksDirectory();
  const partial = runtime.file(`${bookId}.part`);
  const published = runtime.file(`${bookId}.epub`);
  if (partial.exists) partial.delete();

  try {
    const downloaded = await runtime.download(url, partial, signal, (bytesWritten, totalBytes) => {
      onProgress(totalBytes > 0 ? Math.min(1, bytesWritten / totalBytes) : null);
    });

    if (!downloaded.exists || downloaded.size <= 0 || downloaded.size > MAX_EPUB_SIZE) {
      throw new Error('El archivo descargado está vacío o supera el límite de 100 MB.');
    }
    if (!isEpubContainerHeader(await downloaded.readHeader(58))) {
      throw new Error('La fuente no entregó un EPUB válido. No se guardó en la biblioteca.');
    }

    downloaded.copyTo(published);
    await runtime.savePublication(
      bookId,
      book,
      published.uri,
      createGutenbergRightsNotice(book),
    );
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
