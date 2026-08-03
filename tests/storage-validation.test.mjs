/**
 * Regression tests for LocalStorage task loading (Superpowers review Critical #1–2).
 * Run: node --test tests/storage-validation.test.mjs
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isValidTask, parseStoredTasks } from '../storage.js';

describe('isValidTask', () => {
  it('accepts a well-formed task', () => {
    assert.equal(
      isValidTask({ id: 'abc123', text: 'Buy milk', completed: false, createdAt: 1 }),
      true
    );
  });

  it('rejects ids that could break out of HTML attributes', () => {
    assert.equal(
      isValidTask({ id: '" onfocus="alert(1)', text: 'x', completed: false }),
      false
    );
  });

  it('rejects non-objects and wrong field types', () => {
    assert.equal(isValidTask(null), false);
    assert.equal(isValidTask('task'), false);
    assert.equal(isValidTask({ id: 1, text: 'x', completed: false }), false);
    assert.equal(isValidTask({ id: 'ok', text: 99, completed: false }), false);
    assert.equal(isValidTask({ id: 'ok', text: 'x', completed: 'yes' }), false);
  });
});

describe('parseStoredTasks', () => {
  it('marks missing key as first visit', () => {
    assert.deepEqual(parseStoredTasks(null), { tasks: [], missing: true });
  });

  it('returns empty tasks for corrupt non-array JSON without crashing', () => {
    assert.deepEqual(parseStoredTasks('{}'), { tasks: [], missing: false });
    assert.deepEqual(parseStoredTasks('null'), { tasks: [], missing: false });
    assert.deepEqual(parseStoredTasks('"x"'), { tasks: [], missing: false });
    assert.deepEqual(parseStoredTasks('{'), { tasks: [], missing: false });
  });

  it('filters out invalid task records from an array', () => {
    const raw = JSON.stringify([
      { id: 'good1', text: 'Keep me', completed: false },
      { id: '"><img src=x onerror=alert(1)>', text: 'drop', completed: false },
      { id: 'good2', text: 'Also keep', completed: true },
      { not: 'a task' },
    ]);
    const result = parseStoredTasks(raw);
    assert.equal(result.missing, false);
    assert.deepEqual(result.tasks.map((t) => t.id), ['good1', 'good2']);
  });
});
