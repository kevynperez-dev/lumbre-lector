import test from 'node:test';
import assert from 'node:assert/strict';

import type { CatalogBook } from '../../src/features/catalog/catalog-api.ts';
import {
  downloadEpub,
  resolveArchiveEpubUrl,
  type DownloadFile,
  type EpubDownloadRuntime,
} from '../../src/features/catalog/epub-download-core.ts';
import { getDownloadUrl, MAX_EPUB_SIZE } from '../../src/domain/epub.ts';

const book: CatalogBook = {
  id: 31,
  title: 'Libro de prueba',
  author: 'Autora',
  language: 'es',
  subjects: [],
  coverUrl: null,
  epubUrl: 'https://www.gutenberg.org/cache/epub/31/pg31.epub',
  sourceUrl: 'https://www.gutenberg.org/ebooks/31',
};

test('resolves only public, listed Internet Archive EPUB files within the size limit', () => {
  const publicBook: CatalogBook = {
    ...book,
    publicationId: 'openlibrary-OL50444320M',
    sourceName: 'Open Library',
    archiveIdentifier: 'bwb_KS-179-237',
    epubUrl: 'https://archive.org/download/bwb_KS-179-237/bwb_KS-179-237.epub',
  };
  const resolved = resolveArchiveEpubUrl(publicBook, {
    metadata: { 'access-restricted-item': false },
    files: [
      { name: 'book.pdf', format: 'PDF', size: '5000' },
      { name: 'libro público.epub', format: 'EPUB', size: '1400' },
    ],
  });
  assert.equal(resolved.epubUrl, 'https://archive.org/download/bwb_KS-179-237/libro%20p%C3%BAblico.epub');
  assert.equal(getDownloadUrl(resolved), resolved.epubUrl);
  assert.throws(() => resolveArchiveEpubUrl(publicBook, {
    metadata: { 'access-restricted-item': 'true' },
    files: [{ name: 'locked.epub', format: 'EPUB', size: '10' }],
  }), /restringido/i);
  assert.throws(() => resolveArchiveEpubUrl(publicBook, {
    metadata: {},
    files: [{ name: '../private.epub', format: 'EPUB', size: '10' }],
  }), /no ofrece un EPUB/i);
  assert.throws(() => resolveArchiveEpubUrl(publicBook, {
    metadata: {},
    files: [{ name: 'large.epub', format: 'EPUB', size: String(MAX_EPUB_SIZE + 1) }],
  }), /100 MB/i);
});

function validEpubHeader(): Uint8Array {
  const header = new Uint8Array(58);
  header.set([0x50, 0x4b, 0x03, 0x04]);
  header.set([20, 0], 18);
  header.set([20, 0], 22);
  header.set([8, 0], 26);
  header.set(new TextEncoder().encode('mimetype'), 30);
  header.set(new TextEncoder().encode('application/epub+zip'), 38);
  return header;
}

function fakeRuntime(options: { bytes?: Uint8Array; transferError?: Error } = {}) {
  const files = new Map<string, { bytes: Uint8Array | null }>();
  const publications = new Map<string, { localUri: string; rightsNotice: string; fileSize: number }>();
  const defaultBytes = options.bytes ?? validEpubHeader();

  function makeFile(name: string): DownloadFile {
    const uri = `file:///books/${name}`;
    if (!files.has(uri)) files.set(uri, { bytes: null });
    const entry = files.get(uri)!;
    return {
      uri,
      get exists() { return entry.bytes !== null; },
      get size() { return entry.bytes?.length ?? 0; },
      async readHeader(byteCount) { return entry.bytes?.slice(0, byteCount) ?? new Uint8Array(); },
      copyTo(destination) {
        const target = files.get(destination.uri);
        if (!target || !entry.bytes) throw new Error('missing copy source');
        target.bytes = entry.bytes.slice();
      },
      delete() { entry.bytes = null; },
    };
  }

  const runtime: EpubDownloadRuntime = {
    async findPublication(id) { return publications.get(id) ?? null; },
    fileExists(uri) { return files.get(uri)?.bytes !== null && files.has(uri); },
    async removePublication(id) { publications.delete(id); },
    prepareBooksDirectory() {},
    file(name) { return makeFile(name); },
    async download(_url, destination, signal, onProgress) {
      if (options.transferError) throw options.transferError;
      if (signal.aborted) throw new Error('transfer aborted');
      const entry = files.get(destination.uri)!;
      entry.bytes = defaultBytes.slice();
      onProgress(Math.floor(entry.bytes.length / 2), entry.bytes.length);
      onProgress(entry.bytes.length, entry.bytes.length);
      return destination;
    },
    async savePublication(id, _selectedBook, localUri, rightsNotice, fileSize) {
      publications.set(id, { localUri, rightsNotice, fileSize });
    },
  };
  return { runtime, files, publications };
}

test('downloads, validates, publishes transactionally, reports progress, and removes the partial', async () => {
  const fake = fakeRuntime();
  const progress: Array<number | null> = [];
  const result = await downloadEpub(fake.runtime, book, new AbortController().signal, (value) => progress.push(value));

  assert.equal(result, 'downloaded');
  assert.deepEqual(progress, [0.5, 1, 1]);
  assert.equal(fake.publications.get('gutenberg-31')?.localUri, 'file:///books/gutenberg-31.epub');
  assert.match(fake.publications.get('gutenberg-31')?.rightsNotice ?? '', /territorios/);
  assert.equal(fake.publications.get('gutenberg-31')?.fileSize, 58);
  assert.equal(fake.files.get('file:///books/gutenberg-31.part')?.bytes, null);
  assert.ok(fake.files.get('file:///books/gutenberg-31.epub')?.bytes);
});

test('does not publish a file whose EPUB container header is invalid', async () => {
  const fake = fakeRuntime({ bytes: new TextEncoder().encode('not an epub') });
  await assert.rejects(
    downloadEpub(fake.runtime, book, new AbortController().signal, () => undefined),
    /no entregó un EPUB válido/,
  );
  assert.equal(fake.publications.size, 0);
  assert.equal(fake.files.get('file:///books/gutenberg-31.epub')?.bytes, null);
  assert.equal(fake.files.get('file:///books/gutenberg-31.part')?.bytes, null);
});

test('removes the published file when saving its SQLite metadata fails', async () => {
  const fake = fakeRuntime();
  fake.runtime.savePublication = async () => { throw new Error('sqlite failure'); };
  await assert.rejects(
    downloadEpub(fake.runtime, book, new AbortController().signal, () => undefined),
    /sqlite failure/,
  );
  assert.equal(fake.files.get('file:///books/gutenberg-31.epub')?.bytes, null);
  assert.equal(fake.files.get('file:///books/gutenberg-31.part')?.bytes, null);
});

test('propagates cancellation and cleans the incomplete transfer', async () => {
  const cancellation = new Error('cancelled');
  const fake = fakeRuntime({ transferError: cancellation });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    downloadEpub(fake.runtime, book, controller.signal, () => undefined),
    (error) => error === cancellation,
  );
  assert.equal(fake.publications.size, 0);
  assert.equal(fake.files.get('file:///books/gutenberg-31.part')?.bytes, null);
});

test('aborts oversized downloads as soon as reported progress exceeds the limit', async () => {
  const fake = fakeRuntime();
  fake.runtime.download = async (_url, destination, signal, onProgress) => {
    onProgress(MAX_EPUB_SIZE + 1, MAX_EPUB_SIZE + 1);
    assert.equal(signal.aborted, true);
    throw new Error('transfer aborted');
  };
  await assert.rejects(
    downloadEpub(fake.runtime, book, new AbortController().signal, () => undefined),
    /supera el límite de 100 MB/,
  );
  assert.equal(fake.publications.size, 0);
  assert.equal(fake.files.get('file:///books/gutenberg-31.part')?.bytes, null);
  assert.equal(fake.files.get('file:///books/gutenberg-31.epub')?.bytes, null);
});

test('does not download an already stored publication again', async () => {
  const fake = fakeRuntime();
  const destination = fake.runtime.file('gutenberg-31.epub');
  const populated = fakeRuntime();
  await downloadEpub(populated.runtime, book, new AbortController().signal, () => undefined);
  const savedBytes = populated.files.get('file:///books/gutenberg-31.epub')?.bytes;
  assert.ok(savedBytes);
  const target = fake.files.get(destination.uri)!;
  target.bytes = savedBytes;
  fake.publications.set('gutenberg-31', { localUri: destination.uri, rightsNotice: '', fileSize: savedBytes.length });

  assert.equal(await downloadEpub(fake.runtime, book, new AbortController().signal, () => undefined), 'already-downloaded');
});
