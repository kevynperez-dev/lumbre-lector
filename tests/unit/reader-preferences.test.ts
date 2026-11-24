import test from 'node:test';
import assert from 'node:assert/strict';

import { readerPreferenceKey, selectReaderPreferenceValue } from '../../src/features/reader/reader-preferences.ts';

test('uses stable, separate preference keys per publication', () => {
  assert.equal(readerPreferenceKey('book-a'), 'reader:book-a');
  assert.notEqual(readerPreferenceKey('book-a'), readerPreferenceKey('book-b'));
});

test('prefers book-specific settings while keeping global and legacy fallbacks', () => {
  assert.equal(selectReaderPreferenceValue('book', 'default', 'legacy'), 'book');
  assert.equal(selectReaderPreferenceValue(null, 'default', 'legacy'), 'default');
  assert.equal(selectReaderPreferenceValue(undefined, null, 'legacy'), 'legacy');
  assert.equal(selectReaderPreferenceValue(null, null, undefined), undefined);
});
