import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { isEpubContainerHeader } from '../../src/domain/epub.ts';

test('the project-owned EPUB smoke fixture has the required first mimetype ZIP entry', async () => {
  const bytes = await readFile(new URL('../fixtures/lumbre-smoke.epub', import.meta.url));
  assert.equal(isEpubContainerHeader(bytes.subarray(0, 58)), true);
});
