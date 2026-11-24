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
    fileSize: number,
  ): Promise<void>;
};

export function resolveArchiveEpubUrl(
  book: CatalogBook,
  payload: unknown,
): CatalogBook {
  if (book.sourceName !== 'Open Library') return book;
  const identifier = book.archiveIdentifier;
  if (!identifier || !/^[A-Za-z0-9._-]+$/.test(identifier)) {
    throw new Error('Open Library no proporcionó un archivo EPUB público verificable.');
  }
  if (!payload || typeof payload !== 'object') {
    throw new Error('Internet Archive devolvió metadatos no válidos.');
  }
  const metadata = (payload as { metadata?: unknown }).metadata;
  const restricted = metadata && typeof metadata === 'object'
    ? (metadata as Record<string, unknown>)['access-restricted-item']
    : undefined;
  if (restricted === true || restricted === 'true') {
    throw new Error('Este ebook está restringido y no se descargó.');
  }
  const files = (payload as { files?: unknown }).files;
  if (!Array.isArray(files)) throw new Error('Internet Archive no publicó la lista de archivos.');

  const epub = files.find((value) => {
    if (!value || typeof value !== 'object') return false;
    const file = value as Record<string, unknown>;
    return typeof file.name === 'string' &&
      file.name.toLowerCase().endsWith('.epub') &&
      !file.name.includes('/') && !file.name.includes('\\') &&
      !/[\u0000-\u001f]/.test(file.name) &&
      file.format === 'EPUB' &&
      !file.name.toLowerCase().includes('_lcp');
  }) as Record<string, unknown> | undefined;
  if (!epub || typeof epub.name !== 'string') {
    throw new Error('Este registro público no ofrece un EPUB descargable.');
  }
  const size = Number(epub.size);
  if (Number.isFinite(size) && size > MAX_EPUB_SIZE) {
    throw new Error('El archivo descargado supera el límite de 100 MB.');
  }

  return {
    ...book,
    epubUrl: `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(epub.name)}`,
  };
}

export async function downloadEpub(
  runtime: EpubDownloadRuntime,
  book: CatalogBook,
  signal: AbortSignal,
  onProgress: (fraction: number | null) => void,
): Promise<'downloaded' | 'already-downloaded'> {
  const bookId = book.publicationId ?? `gutenberg-${book.id}`;
  const existing = await runtime.findPublication(bookId);
  if (existing && runtime.fileExists(existing.localUri)) return 'already-downloaded';
  if (existing) await runtime.removePublication(bookId);

  const url = getDownloadUrl(book);
  runtime.prepareBooksDirectory();
  const partial = runtime.file(`${bookId}.part`);
  const published = runtime.file(`${bookId}.epub`);
  if (partial.exists) partial.delete();

  const transferController = new AbortController();
  let exceedsLimit = false;
  const cancelForCaller = () => transferController.abort(signal.reason);
  if (signal.aborted) cancelForCaller();
  else signal.addEventListener('abort', cancelForCaller, { once: true });

  try {
    const downloaded = await runtime.download(url, partial, transferController.signal, (bytesWritten, totalBytes) => {
      if (bytesWritten > MAX_EPUB_SIZE || totalBytes > MAX_EPUB_SIZE) {
        exceedsLimit = true;
        transferController.abort();
        return;
      }
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
      book.rightsNotice ?? createGutenbergRightsNotice(book),
      published.size,
    );
    onProgress(1);
    return 'downloaded';
  } catch (error) {
    if (published.exists) published.delete();
    if (exceedsLimit) {
      throw new Error('El archivo descargado supera el límite de 100 MB.');
    }
    if (signal.aborted) throw error;
    throw error instanceof Error
      ? error
      : new Error('No se pudo descargar el EPUB. Comprueba tu conexión e inténtalo otra vez.');
  } finally {
    signal.removeEventListener('abort', cancelForCaller);
    if (partial.exists) partial.delete();
  }
}
