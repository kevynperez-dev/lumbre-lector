import test from 'node:test';
import assert from 'node:assert/strict';

import { createAnnotation } from '../../src/features/reader/annotation-core.ts';

const locator = {
  href: 'chapter-1.xhtml',
  type: 'application/xhtml+xml',
  locations: { progression: 0.25, totalProgression: 0.1 },
};

test('creates a bounded note annotation tied to the selected passage locator', () => {
  const annotation = createAnnotation({
    id: 'note-1',
    publicationId: 'book-1',
    kind: 'note',
    locator,
    selectedText: '  fragmento seleccionado  ',
    noteText: '  idea personal  ',
    createdAt: '2026-11-24T00:00:00.000Z',
  });

  assert.ok(annotation);
  assert.equal(annotation.kind, 'note');
  assert.equal(annotation.selected_text, 'fragmento seleccionado');
  assert.equal(annotation.note_text, 'idea personal');
  assert.equal(annotation.color, '#9CCFB5');
  assert.deepEqual(JSON.parse(annotation.locator_json), {
    ...locator,
    text: { highlight: 'fragmento seleccionado' },
  });
});

test('creates a golden highlight and rejects empty selected text', () => {
  const annotation = createAnnotation({
    id: 'highlight-1',
    publicationId: 'book-1',
    kind: 'highlight',
    locator,
    selectedText: '  texto  ',
    createdAt: '2026-11-24T00:00:00.000Z',
  });
  assert.equal(annotation?.color, '#F3D879');
  assert.equal(createAnnotation({
    id: 'empty',
    publicationId: 'book-1',
    kind: 'note',
    locator,
    selectedText: '  ',
    createdAt: '2026-11-24T00:00:00.000Z',
  }), null);
});

test('caps selected passages and note text before storing them', () => {
  const annotation = createAnnotation({
    id: 'bounded',
    publicationId: 'book-1',
    kind: 'note',
    locator,
    selectedText: 'x'.repeat(4500),
    noteText: 'n'.repeat(2500),
    createdAt: '2026-11-24T00:00:00.000Z',
  });
  assert.equal(annotation?.selected_text.length, 4000);
  assert.equal(annotation?.note_text.length, 2000);
});
