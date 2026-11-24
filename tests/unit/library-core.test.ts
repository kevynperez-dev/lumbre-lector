import test from 'node:test';
import assert from 'node:assert/strict';

import type { Publication } from '../../src/database/types.ts';
import { formatStorageSize, selectAndSortBooks } from '../../src/features/library/library-core.ts';

function book(overrides: Partial<Publication> = {}): Publication {
  return {
    id: 'one',
    title: 'Alba',
    author: 'Autora',
    language: 'es',
    format: 'epub',
    local_uri: 'file:///book.epub',
    cover_uri: null,
    source_name: 'Archivo local',
    rights_notice: null,
    added_at: '2026-01-01T00:00:00Z',
    last_opened_at: null,
    progress: 0.2,
    file_size: 1024,
    ...overrides,
  };
}

test('formats library storage size with readable units', () => {
  assert.equal(formatStorageSize(0), '0 B');
  assert.equal(formatStorageSize(1536), '1.5 KB');
  assert.equal(formatStorageSize(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatStorageSize(2 * 1024 * 1024 * 1024), '2.00 GB');
});

test('filters library books by title, author, and collection', () => {
  const books = [
    book({ id: 'one', title: 'Alba', collection_id: 'fiction' }),
    book({ id: 'two', title: 'Botánica', author: 'Alba Ruiz', collection_id: null }),
  ];
  assert.deepEqual(selectAndSortBooks(books, { search: ' RUIZ ', collectionId: null, sort: 'recent' }).map(({ id }) => id), ['two']);
  assert.deepEqual(selectAndSortBooks(books, { search: '', collectionId: 'fiction', sort: 'recent' }).map(({ id }) => id), ['one']);
  assert.deepEqual(selectAndSortBooks(books, { search: '', collectionId: 'uncategorized', sort: 'recent' }).map(({ id }) => id), ['two']);
});

test('sorts library titles alphabetically and by reading progress', () => {
  const books = [
    book({ id: 'one', title: 'Zeta', progress: 0.9 }),
    book({ id: 'two', title: 'Árbol', progress: 0.2 }),
    book({ id: 'three', title: 'Luna', progress: 0.6 }),
  ];
  assert.deepEqual(selectAndSortBooks(books, { search: '', collectionId: null, sort: 'title' }).map(({ id }) => id), ['two', 'three', 'one']);
  assert.deepEqual(selectAndSortBooks(books, { search: '', collectionId: null, sort: 'progress' }).map(({ id }) => id), ['one', 'three', 'two']);
});
