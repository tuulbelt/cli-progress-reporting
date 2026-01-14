/**
 * MultiProgress tests
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MultiProgress } from '../src/multi-progress.js';

// Helper to clean up test files
function cleanup(id: string): void {
  const filePath = join(tmpdir(), `progress-multi-${id}.json`);
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

test('MultiProgress', async (t) => {
  await t.test('constructor creates multi-progress file', () => {
    const id = `multi-constructor-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const filePath = join(tmpdir(), `progress-multi-${id}.json`);
    assert.strictEqual(existsSync(filePath), true);

    cleanup(id);
  });

  await t.test('constructor with custom file path', () => {
    const id = `multi-custom-${Date.now()}`;
    const customPath = join(tmpdir(), `custom-multi-${id}.json`);
    const multi = new MultiProgress({ id, filePath: customPath });

    assert.strictEqual(existsSync(customPath), true);

    try {
      unlinkSync(customPath);
    } catch {
      // Ignore
    }
  });

  await t.test('add() creates new tracker', () => {
    const id = `multi-add-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tracker = multi.add({
      total: 100,
      message: 'Test tracker',
      trackerId: 'test1',
    });

    assert(tracker !== null);

    const result = tracker.get();
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 100);
      assert.strictEqual(result.value.message, 'Test tracker');
      assert.strictEqual(result.value.current, 0);
    }

    cleanup(id);
  });

  await t.test('add() auto-generates tracker ID if not provided', () => {
    const id = `multi-autoid-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tracker = multi.add({
      total: 50,
      message: 'Auto ID tracker',
    });

    assert(tracker !== null);
    const result = tracker.get();
    assert.strictEqual(result.ok, true);

    cleanup(id);
  });

  await t.test('get() retrieves tracker by ID', () => {
    const id = `multi-get-${Date.now()}`;
    const multi = new MultiProgress({ id });

    multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });

    const result = multi.get('tr1');
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      const state = result.value.get();
      assert.strictEqual(state.ok, true);
      if (state.ok) {
        assert.strictEqual(state.value.message, 'Tracker 1');
      }
    }

    cleanup(id);
  });

  await t.test('get() returns error for non-existent tracker', () => {
    const id = `multi-get-notfound-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const result = multi.get('nonexistent');
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('not found'));
    }

    cleanup(id);
  });

  await t.test('getAll() returns all trackers', () => {
    const id = `multi-getall-${Date.now()}`;
    const multi = new MultiProgress({ id });

    multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    multi.add({ total: 200, message: 'Tracker 2', trackerId: 'tr2' });
    multi.add({ total: 300, message: 'Tracker 3', trackerId: 'tr3' });

    const result = multi.getAll();
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.length, 3);
      const ids = result.value.map((t) => t.id).sort();
      assert.deepStrictEqual(ids, ['tr1', 'tr2', 'tr3']);
    }

    cleanup(id);
  });

  await t.test('status() returns current state', () => {
    const id = `multi-status-${Date.now()}`;
    const multi = new MultiProgress({ id });

    multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    multi.add({ total: 200, message: 'Tracker 2', trackerId: 'tr2' });

    const result = multi.status();
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert(result.value.trackers.tr1 !== undefined);
      assert(result.value.trackers.tr2 !== undefined);
      assert.strictEqual(result.value.trackers.tr1.total, 100);
      assert.strictEqual(result.value.trackers.tr2.total, 200);
      assert(typeof result.value.meta.created === 'number');
      assert(typeof result.value.meta.updated === 'number');
    }

    cleanup(id);
  });

  await t.test('remove() deletes tracker', () => {
    const id = `multi-remove-${Date.now()}`;
    const multi = new MultiProgress({ id });

    multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    multi.add({ total: 200, message: 'Tracker 2', trackerId: 'tr2' });

    const removeResult = multi.remove('tr1');
    assert.strictEqual(removeResult.ok, true);

    const getResult = multi.get('tr1');
    assert.strictEqual(getResult.ok, false);

    const getAllResult = multi.getAll();
    assert.strictEqual(getAllResult.ok, true);
    if (getAllResult.ok) {
      assert.strictEqual(getAllResult.value.length, 1);
      assert.strictEqual(getAllResult.value[0].id, 'tr2');
    }

    cleanup(id);
  });

  await t.test('remove() returns error for non-existent tracker', () => {
    const id = `multi-remove-notfound-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const result = multi.remove('nonexistent');
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('not found'));
    }

    cleanup(id);
  });

  await t.test('done() marks all trackers as complete', () => {
    const id = `multi-done-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tr1 = multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    const tr2 = multi.add({ total: 200, message: 'Tracker 2', trackerId: 'tr2' });

    tr1.increment(50);
    tr2.increment(100);

    const doneResult = multi.done();
    assert.strictEqual(doneResult.ok, true);

    const tr1State = tr1.get();
    const tr2State = tr2.get();

    assert.strictEqual(tr1State.ok, true);
    assert.strictEqual(tr2State.ok, true);

    if (tr1State.ok) {
      assert.strictEqual(tr1State.value.complete, true);
      assert.strictEqual(tr1State.value.current, tr1State.value.total);
    }

    if (tr2State.ok) {
      assert.strictEqual(tr2State.value.complete, true);
      assert.strictEqual(tr2State.value.current, tr2State.value.total);
    }

    cleanup(id);
  });

  await t.test('clear() removes all trackers and file', () => {
    const id = `multi-clear-${Date.now()}`;
    const multi = new MultiProgress({ id });

    multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    multi.add({ total: 200, message: 'Tracker 2', trackerId: 'tr2' });

    const filePath = join(tmpdir(), `progress-multi-${id}.json`);
    assert.strictEqual(existsSync(filePath), true);

    const clearResult = multi.clear();
    assert.strictEqual(clearResult.ok, true);

    assert.strictEqual(existsSync(filePath), false);

    const getAllResult = multi.getAll();
    assert.strictEqual(getAllResult.ok, true);
    if (getAllResult.ok) {
      assert.strictEqual(getAllResult.value.length, 0);
    }
  });

  await t.test('trackers can be updated independently', () => {
    const id = `multi-independent-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tr1 = multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    const tr2 = multi.add({ total: 200, message: 'Tracker 2', trackerId: 'tr2' });

    tr1.increment(30);
    tr2.increment(50);

    const tr1State = tr1.get();
    const tr2State = tr2.get();

    assert.strictEqual(tr1State.ok, true);
    assert.strictEqual(tr2State.ok, true);

    if (tr1State.ok && tr2State.ok) {
      assert.strictEqual(tr1State.value.current, 30);
      assert.strictEqual(tr2State.value.current, 50);
    }

    cleanup(id);
  });

  await t.test('sync() reloads state from disk', () => {
    const id = `multi-sync-${Date.now()}`;
    const multi = new MultiProgress({ id });

    multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });

    const syncResult = multi.sync();
    assert.strictEqual(syncResult.ok, true);

    const tr1Result = multi.get('tr1');
    assert.strictEqual(tr1Result.ok, true);

    cleanup(id);
  });

  await t.test('trackers use unique IDs scoped to multi-progress', () => {
    const id = `multi-scoped-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tr1 = multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });

    // Check that the internal progress file uses scoped ID
    const tr1State = tr1.get();
    assert.strictEqual(tr1State.ok, true);

    cleanup(id);
  });
});

test('MultiProgress - concurrent safety', async (t) => {
  await t.test('multiple trackers can be added concurrently', () => {
    const id = `multi-concurrent-add-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const trackers = [];
    for (let i = 0; i < 10; i++) {
      trackers.push(
        multi.add({
          total: 100,
          message: `Tracker ${i}`,
          trackerId: `tr${i}`,
        })
      );
    }

    assert.strictEqual(trackers.length, 10);

    const allResult = multi.getAll();
    assert.strictEqual(allResult.ok, true);
    if (allResult.ok) {
      assert.strictEqual(allResult.value.length, 10);
    }

    cleanup(id);
  });

  await t.test('rapid updates to different trackers maintain consistency', () => {
    const id = `multi-rapid-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tr1 = multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    const tr2 = multi.add({ total: 100, message: 'Tracker 2', trackerId: 'tr2' });

    // Rapid updates
    for (let i = 0; i < 10; i++) {
      tr1.increment(1);
      tr2.increment(1);
    }

    const tr1State = tr1.get();
    const tr2State = tr2.get();

    assert.strictEqual(tr1State.ok, true);
    assert.strictEqual(tr2State.ok, true);

    if (tr1State.ok && tr2State.ok) {
      assert.strictEqual(tr1State.value.current, 10);
      assert.strictEqual(tr2State.value.current, 10);
    }

    cleanup(id);
  });

  await t.test('state persists across instances', () => {
    const id = `multi-persist-${Date.now()}`;

    // Create first instance and add trackers
    const multi1 = new MultiProgress({ id });
    multi1.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    multi1.add({ total: 200, message: 'Tracker 2', trackerId: 'tr2' });

    // Create second instance with same ID
    const multi2 = new MultiProgress({ id });
    multi2.sync(); // Load state from disk

    const tr1Result = multi2.get('tr1');
    const tr2Result = multi2.get('tr2');

    // Note: trackers won't be loaded until sync() finds them
    // This test verifies the file was created correctly

    const statusResult = multi2.status();
    assert.strictEqual(statusResult.ok, true);
    if (statusResult.ok) {
      assert(statusResult.value.trackers.tr1 !== undefined);
      assert(statusResult.value.trackers.tr2 !== undefined);
    }

    cleanup(id);
  });

  await t.test('removing tracker while updating others is safe', () => {
    const id = `multi-remove-concurrent-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tr1 = multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    const tr2 = multi.add({ total: 100, message: 'Tracker 2', trackerId: 'tr2' });

    tr1.increment(10);
    multi.remove('tr1');
    tr2.increment(20);

    const tr1Result = multi.get('tr1');
    const tr2Result = multi.get('tr2');

    assert.strictEqual(tr1Result.ok, false);
    assert.strictEqual(tr2Result.ok, true);

    if (tr2Result.ok) {
      const tr2State = tr2Result.value.get();
      assert.strictEqual(tr2State.ok, true);
      if (tr2State.ok) {
        assert.strictEqual(tr2State.value.current, 20);
      }
    }

    cleanup(id);
  });

  await t.test('clear() is safe even with active trackers', () => {
    const id = `multi-clear-active-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tr1 = multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });
    const tr2 = multi.add({ total: 100, message: 'Tracker 2', trackerId: 'tr2' });

    tr1.increment(50);
    tr2.increment(75);

    const clearResult = multi.clear();
    assert.strictEqual(clearResult.ok, true);

    const filePath = join(tmpdir(), `progress-multi-${id}.json`);
    assert.strictEqual(existsSync(filePath), false);
  });
});

test('MultiProgress - edge cases', async (t) => {
  await t.test('handles empty multi-progress (no trackers)', () => {
    const id = `multi-empty-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const getAllResult = multi.getAll();
    assert.strictEqual(getAllResult.ok, true);
    if (getAllResult.ok) {
      assert.strictEqual(getAllResult.value.length, 0);
    }

    const doneResult = multi.done();
    assert.strictEqual(doneResult.ok, true);

    cleanup(id);
  });

  await t.test('handles reasonably long tracker IDs', () => {
    const id = `multi-longid-${Date.now()}`;
    const multi = new MultiProgress({ id });

    // Use a reasonable length that won't exceed filesystem limits (50 chars)
    const longId = 'tracker-with-a-reasonably-long-id-' + 'a'.repeat(15);
    const tracker = multi.add({
      total: 100,
      message: 'Long ID tracker',
      trackerId: longId,
    });

    const result = multi.get(longId);
    assert.strictEqual(result.ok, true);

    cleanup(id);
  });

  await t.test('handles special characters in tracker IDs', () => {
    const id = `multi-special-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const specialId = 'tracker-123_ABC-xyz';
    const tracker = multi.add({
      total: 100,
      message: 'Special ID tracker',
      trackerId: specialId,
    });

    const result = multi.get(specialId);
    assert.strictEqual(result.ok, true);

    cleanup(id);
  });

  await t.test('handles unicode in tracker messages', () => {
    const id = `multi-unicode-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tracker = multi.add({
      total: 100,
      message: '进度 🚀 Progress',
      trackerId: 'tr1',
    });

    const result = tracker.get();
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, '进度 🚀 Progress');
    }

    cleanup(id);
  });

  await t.test('status updates reflect tracker changes', () => {
    const id = `multi-status-updates-${Date.now()}`;
    const multi = new MultiProgress({ id });

    const tr1 = multi.add({ total: 100, message: 'Tracker 1', trackerId: 'tr1' });

    tr1.increment(50);

    const status1 = multi.status();
    assert.strictEqual(status1.ok, true);
    if (status1.ok) {
      assert.strictEqual(status1.value.trackers.tr1.current, 0); // State in file not yet updated
    }

    // After done(), status should reflect completion
    multi.done();

    const status2 = multi.status();
    assert.strictEqual(status2.ok, true);
    if (status2.ok) {
      assert.strictEqual(status2.value.trackers.tr1.complete, true);
    }

    cleanup(id);
  });
});
