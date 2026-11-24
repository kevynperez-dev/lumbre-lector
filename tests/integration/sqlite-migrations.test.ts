import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import { DATABASE_MIGRATIONS } from '../../src/database/migrations.ts';

function migrate(database: DatabaseSync) {
  database.exec('PRAGMA foreign_keys = ON;');
  const version = Number(database.prepare('PRAGMA user_version').get()?.user_version ?? 0);
  for (const migration of DATABASE_MIGRATIONS) {
    if (version < migration.version) database.exec(migration.sql);
  }
}

test('migrates an empty database to the latest version with every app table', () => {
  const database = new DatabaseSync(':memory:');
  migrate(database);
  assert.equal(Number(database.prepare('PRAGMA user_version').get()?.user_version), 2);
  const names = database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
  assert.deepEqual(names.sort(), ['publications', 'reading_positions', 'reader_preferences'].sort());
  database.close();
});

test('upgrades version 1 to version 2 without losing stored publications', () => {
  const database = new DatabaseSync(':memory:');
  const versionOne = DATABASE_MIGRATIONS[0];
  database.exec(versionOne.sql);
  database.prepare(
    "INSERT INTO publications (id, title, format, local_uri) VALUES (?, ?, 'epub', ?)",
  ).run('local-1', 'Libro guardado', 'file:///books/1.epub');
  migrate(database);
  assert.equal(Number(database.prepare('PRAGMA user_version').get()?.user_version), 2);
  assert.equal(database.prepare('SELECT title FROM publications WHERE id = ?').get('local-1')?.title, 'Libro guardado');
  database.close();
});

test('enforces progress bounds and cascades deleted publication positions', () => {
  const database = new DatabaseSync(':memory:');
  migrate(database);
  database.prepare(
    "INSERT INTO publications (id, title, format, local_uri) VALUES ('book', 'Libro', 'epub', 'file:///book.epub')",
  ).run();
  database.prepare(
    "INSERT INTO reading_positions (publication_id, locator_json, progress) VALUES ('book', '{}', 0.42)",
  ).run();
  assert.throws(() => database.prepare(
    "UPDATE publications SET progress = 1.1 WHERE id = 'book'",
  ).run());
  database.prepare("DELETE FROM publications WHERE id = 'book'").run();
  assert.equal(database.prepare('SELECT count(*) AS total FROM reading_positions').get()?.total, 0);
  database.close();
});

test('persists reader preferences through conflict updates', () => {
  const database = new DatabaseSync(':memory:');
  migrate(database);
  const save = database.prepare(`
    INSERT INTO reader_preferences (preference_key, preference_value)
    VALUES ('reader', ?)
    ON CONFLICT(preference_key) DO UPDATE SET preference_value = excluded.preference_value
  `);
  save.run('{"theme":"sepia"}');
  save.run('{"theme":"dark","fontSize":1.2}');
  const result = database.prepare('SELECT preference_value FROM reader_preferences WHERE preference_key = ?').get('reader');
  assert.equal(result?.preference_value, '{"theme":"dark","fontSize":1.2}');
  database.close();
});

test('persists and advances a locator with its reading progression', () => {
  const database = new DatabaseSync(':memory:');
  migrate(database);
  database.prepare(
    "INSERT INTO publications (id, title, format, local_uri) VALUES ('book', 'Libro', 'epub', 'file:///book.epub')",
  ).run();
  const save = database.prepare(`
    INSERT INTO reading_positions (publication_id, locator_json, progress)
    VALUES ('book', ?, ?)
    ON CONFLICT(publication_id) DO UPDATE SET
      locator_json = excluded.locator_json,
      progress = excluded.progress,
      updated_at = CURRENT_TIMESTAMP
  `);
  save.run('{"href":"chapter-1.xhtml"}', 0.2);
  save.run('{"href":"chapter-2.xhtml"}', 0.7);
  const position = database.prepare(
    'SELECT locator_json, progress FROM reading_positions WHERE publication_id = ?',
  ).get('book');
  assert.equal(position?.locator_json, '{"href":"chapter-2.xhtml"}');
  assert.equal(position?.progress, 0.7);
  database.close();
});
