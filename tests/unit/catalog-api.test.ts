import test from 'node:test';
import assert from 'node:assert/strict';

import { createCatalogUrl, createOpenLibrarySearchUrls, downloadedCatalogIds, getCatalogErrorMessage, mapCatalogResponse, mapOpenLibraryResponse, validateCatalogPageUrl } from '../../src/features/catalog/catalog-api.ts';

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

test('builds Open Library fallback searches for titles and a likely author suffix', () => {
  const urls = createOpenLibrarySearchUrls('hábitos atómicos de James Claire').map((value) => new URL(value));
  assert.equal(urls[0].searchParams.get('q'), 'hábitos atómicos de James Claire');
  assert.equal(urls[1].searchParams.get('title'), 'Atomic Habits');
  assert.ok(urls.some((url) => url.searchParams.get('title') === 'hábitos atómicos'));
  assert.ok(urls.every((url) => url.origin === 'https://openlibrary.org'));
  assert.ok(urls.every((url) => url.searchParams.get('limit') === '8'));
});

test('maps Open Library discovery metadata without granting a download right', () => {
  const books = mapOpenLibraryResponse({ docs: [
    { key: '/works/OL17930368W', title: 'Atomic Habits', author_name: ['James Clear'], first_publish_year: 2016, ebook_access: 'printdisabled' },
    { key: '/works/OL9766728W', title: 'La Ley Universal de La Atracción', author_name: ['Teresa Pimentel'], ebook_access: 'no_ebook' },
    { key: '/works/OL1W/../../evil', title: 'Injected URL', ebook_access: 'public' },
    { key: '/works/OL2W', title: 'Unknown access', ebook_access: 'unknown' },
    null,
  ] });

  assert.equal(books.length, 3);
  assert.deepEqual(books[0], {
    key: '/works/OL17930368W',
    title: 'Atomic Habits',
    authors: ['James Clear'],
    firstPublishYear: 2016,
    access: 'printdisabled',
    url: 'https://openlibrary.org/works/OL17930368W',
    downloadableBook: null,
  });
  assert.equal(books[1].access, 'no_ebook');
  assert.equal(books[2].access, 'no_ebook');
  assert.throws(() => mapOpenLibraryResponse({ docs: 'not an array' }), /Open Library/i);
});

test('only exposes an Open Library download for a public edition with a safe Archive identifier', () => {
  const [publicBook, unsafeBook, printDisabled] = mapOpenLibraryResponse({ docs: [
    {
      key: '/works/OL66554W', title: 'Pride and Prejudice', author_name: ['Jane Austen'],
      ebook_access: 'public', editions: { docs: [
        { key: '/books/OL50444320M', ebook_access: 'public', ia: ['bwb_KS-179-237'] },
      ] },
    },
    {
      key: '/works/OL4W', title: 'Unsafe identifier', ebook_access: 'public', editions: { docs: [
        { key: '/books/OL4M', ebook_access: 'public', ia: ['../secret'] },
      ] },
    },
    {
      key: '/works/OL5W', title: 'Restricted edition', ebook_access: 'printdisabled', editions: { docs: [
        { key: '/books/OL5M', ebook_access: 'printdisabled', ia: ['restricted-book'] },
      ] },
    },
  ] });

  assert.equal(publicBook.downloadableBook?.sourceName, 'Open Library');
  assert.equal(publicBook.downloadableBook?.archiveIdentifier, 'bwb_KS-179-237');
  assert.equal(publicBook.downloadableBook?.epubUrl, 'https://archive.org/download/bwb_KS-179-237/bwb_KS-179-237.epub');
  assert.equal(unsafeBook.downloadableBook, null);
  assert.equal(printDisabled.downloadableBook, null);
});

test('restores downloaded catalog ids from persisted Gutenberg publications', () => {
  assert.deepEqual(downloadedCatalogIds(['gutenberg-31', 'local-1', 'gutenberg-12', 'gutenberg-31', 'gutenberg-invalid']), [31, 12]);
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
