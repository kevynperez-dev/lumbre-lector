import test from 'node:test';
import assert from 'node:assert/strict';

import { createCatalogUrl, getCatalogErrorMessage, mapCatalogResponse, validateCatalogPageUrl } from '../../src/features/catalog/catalog-api.ts';

const book = (overrides: Record<string, unknown> = {}) => ({
  id: 11,
  title: '  Don Quijote  ',
  authors: [{ name: 'Miguel de Cervantes' }],
  languages: ['es'],
  subjects: ['Novela'],
  copyright: false,
  formats: {
    'application/epub+zip': 'https://www.gutenberg.org/cache/epub/11/pg11.epub',
    'image/jpeg': 'https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg',
  },
  ...overrides,
});

test('maps only explicitly US-unrestricted records with EPUB metadata', () => {
  const page = mapCatalogResponse({ count: 3, next: null, results: [book()] });
  assert.equal(page.books.length, 1);
  assert.equal(page.books[0].title, 'Don Quijote');
  assert.equal(page.books[0].author, 'Miguel de Cervantes');
  assert.equal(page.books[0].language, 'es');
  assert.equal(page.books[0].epubUrl, 'https://www.gutenberg.org/cache/epub/11/pg11.epub');
  assert.equal(page.books[0].sourceUrl, 'https://www.gutenberg.org/ebooks/11');
});

test('excludes restricted, unknown, malformed, and non-EPUB entries', () => {
  const page = mapCatalogResponse({
    results: [
      book({ id: 1, copyright: true }),
      book({ id: 2, copyright: null }),
      book({ id: 3, formats: {} }),
      book({ id: 'bad' }),
      null,
    ],
  });
  assert.deepEqual(page.books, []);
});

test('excludes records when their image or download host is unsafe', () => {
  const page = mapCatalogResponse({
    results: [book({ formats: {
      'application/epub+zip': 'https://evil.example/book.epub',
      'image/jpeg': 'http://www.gutenberg.org/cover.jpg',
    } })],
  });
  assert.equal(page.books.length, 0);
});

test('builds encoded, constrained Spanish EPUB search URLs', () => {
  const url = new URL(createCatalogUrl('niños & poesía', 2));
  assert.equal(url.origin, 'https://gutendex.com');
  assert.equal(url.searchParams.get('copyright'), 'false');
  assert.equal(url.searchParams.get('mime_type'), 'application/epub+zip');
  assert.equal(url.searchParams.get('languages'), 'es');
  assert.equal(url.searchParams.get('search'), 'niños & poesía');
  assert.equal(url.searchParams.get('page'), '2');
  assert.equal(new URL(createCatalogUrl('', -8)).searchParams.get('page'), '1');
});

test('adds validated language and encoded subject filters to catalog searches', () => {
  const url = new URL(createCatalogUrl('poesía', 1, { language: 'fr', topic: 'poésie & théâtre' }));
  assert.equal(url.searchParams.get('languages'), 'fr');
  assert.equal(url.searchParams.get('topic'), 'poésie & théâtre');
  const allLanguages = new URL(createCatalogUrl('', 1, { language: 'all' }));
  assert.equal(allLanguages.searchParams.has('languages'), false);
  const invalidLanguage = new URL(createCatalogUrl('', 1, { language: '../' }));
  assert.equal(invalidLanguage.searchParams.get('languages'), 'es');
});

test('accepts only Gutendex books pagination links', () => {
  assert.equal(
    validateCatalogPageUrl('https://gutendex.com/books/?page=2'),
    'https://gutendex.com/books/?page=2',
  );
  assert.throws(() => validateCatalogPageUrl('https://evil.example/books/?page=2'));
  assert.throws(() => validateCatalogPageUrl('http://gutendex.com/books/?page=2'));
  assert.throws(() => validateCatalogPageUrl('https://gutendex.com/other/'));
});

test('rejects non-object catalog responses', () => {
  assert.throws(() => mapCatalogResponse(null), /respuesta del catálogo/i);
});

test('shows network failures in clear, recoverable language', () => {
  assert.match(getCatalogErrorMessage(new Error('fetch failed: UnknownHostException')), /Comprueba tu conexión/);
  assert.equal(getCatalogErrorMessage(new Error('El catálogo respondió con el código 503.')), 'El catálogo respondió con el código 503.');
  assert.match(getCatalogErrorMessage('unknown error'), /No se pudo cargar el catálogo/);
});
