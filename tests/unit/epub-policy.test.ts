import test from 'node:test';
import assert from 'node:assert/strict';

import type { CatalogBook } from '../../src/features/catalog/catalog-api.ts';
import {
  createGutenbergRightsNotice,
  getDownloadUrl,
  isEpubContainerHeader,
  MAX_EPUB_SIZE,
} from '../../src/domain/epub.ts';

const validBook: CatalogBook = {
  id: 11,
  title: 'Don Quijote',
  author: 'Miguel de Cervantes',
  language: 'es',
  subjects: [],
  coverUrl: null,
  epubUrl: 'https://www.gutenberg.org/cache/epub/11/pg11.epub',
  sourceUrl: 'https://www.gutenberg.org/ebooks/11',
};

test('requires the uncompressed mimetype entry at the start of an EPUB ZIP', () => {
  const validHeader = new Uint8Array(58);
  validHeader.set([0x50, 0x4b, 0x03, 0x04], 0);
  validHeader.set([20, 0], 18);
  validHeader.set([20, 0], 22);
  validHeader.set([8, 0], 26);
  validHeader.set([0x6d, 0x69, 0x6d, 0x65, 0x74, 0x79, 0x70, 0x65], 30);
  validHeader.set([0x61, 0x70, 0x70, 0x6c, 0x69, 0x63, 0x61, 0x74, 0x69, 0x6f,
    0x6e, 0x2f, 0x65, 0x70, 0x75, 0x62, 0x2b, 0x7a, 0x69, 0x70], 38);
  assert.equal(isEpubContainerHeader(validHeader), true);

  const arbitraryZip = validHeader.slice();
  arbitraryZip[30] = 0x62;
  assert.equal(isEpubContainerHeader(arbitraryZip), false);
  const compressedMimetype = validHeader.slice();
  compressedMimetype[8] = 8;
  assert.equal(isEpubContainerHeader(compressedMimetype), false);
  assert.equal(isEpubContainerHeader(validHeader.slice(0, 57)), false);
  const wrongMediaType = validHeader.slice();
  wrongMediaType[57] = 0;
  assert.equal(isEpubContainerHeader(wrongMediaType), false);
});

test('allows HTTPS EPUB downloads only from Project Gutenberg hosts', () => {
  assert.equal(getDownloadUrl(validBook), validBook.epubUrl);
  assert.throws(() => getDownloadUrl({ ...validBook, epubUrl: null }));
  assert.throws(() => getDownloadUrl({ ...validBook, epubUrl: 'http://www.gutenberg.org/book.epub' }));
  assert.throws(() => getDownloadUrl({ ...validBook, epubUrl: 'https://evil.example/book.epub' }));
  assert.throws(() => getDownloadUrl({ ...validBook, epubUrl: 'https://www.gutenberg.org/ebooks/11' }));
});

test('records source and territory limitation with each downloaded title', () => {
  const notice = createGutenbergRightsNotice(validBook);
  assert.match(notice, /Estados Unidos/);
  assert.match(notice, /territorios/);
  assert.match(notice, /www\.gutenberg\.org\/ebooks\/11/);
});

test('keeps a conservative maximum EPUB payload size', () => {
  assert.equal(MAX_EPUB_SIZE, 100 * 1024 * 1024);
});
