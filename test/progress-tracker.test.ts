/**
 * Tests for ProgressTracker class (Phase 1 Multi-API Design)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProgressTracker } from '../src/progress-tracker.js';

// Helper to clean up test files
function cleanup(id: string): void {
  const filePath = join(tmpdir(), `progress-${id}.json`);
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

test('ProgressTracker', async (t) => {
  await t.test('constructor initializes progress', () => {
    const id = `test-tracker-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    const result = tracker.get();
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 100);
      assert.strictEqual(result.value.current, 0);
      assert.strictEqual(result.value.message, 'Testing');
      assert.strictEqual(result.value.percentage, 0);
      assert.strictEqual(result.value.complete, false);
    }

    cleanup(id);
  });

  await t.test('constructor throws on invalid total', () => {
    assert.throws(
      () => new ProgressTracker({ total: 0, message: 'Invalid' }),
      /greater than 0/
    );
  });

  await t.test('constructor throws on negative total', () => {
    assert.throws(
      () => new ProgressTracker({ total: -1, message: 'Invalid' }),
      /greater than 0/
    );
  });

  await t.test('update() sets absolute value', () => {
    const id = `test-update-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    const result = tracker.update(50, 'Halfway');
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 50);
      assert.strictEqual(result.value.percentage, 50);
      assert.strictEqual(result.value.message, 'Halfway');
    }

    cleanup(id);
  });

  await t.test('update() without message keeps previous message', () => {
    const id = `test-update-no-msg-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Initial',
      id,
    });

    tracker.update(25, 'Updated');
    const result = tracker.update(50);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, 'Updated');
    }

    cleanup(id);
  });

  await t.test('update() rejects negative values', () => {
    const id = `test-update-negative-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    const result = tracker.update(-5);
    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /non-negative/);
    }

    cleanup(id);
  });

  await t.test('increment() adds to current value', () => {
    const id = `test-increment-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    tracker.increment(5);
    const result = tracker.increment(10);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 15);
      assert.strictEqual(result.value.percentage, 15);
    }

    cleanup(id);
  });

  await t.test('increment() defaults to 1', () => {
    const id = `test-increment-default-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    tracker.increment();
    tracker.increment();
    const result = tracker.increment();

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 3);
    }

    cleanup(id);
  });

  await t.test('increment() with message updates message', () => {
    const id = `test-increment-msg-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Initial',
      id,
    });

    const result = tracker.increment(5, 'Updated message');

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, 'Updated message');
    }

    cleanup(id);
  });

  await t.test('done() marks progress as complete', () => {
    const id = `test-done-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    const result = tracker.done('Finished!');

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 100);
      assert.strictEqual(result.value.percentage, 100);
      assert.strictEqual(result.value.complete, true);
      assert.strictEqual(result.value.message, 'Finished!');
    }

    cleanup(id);
  });

  await t.test('done() without message keeps previous message', () => {
    const id = `test-done-no-msg-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Initial',
      id,
    });

    const result = tracker.done();

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, 'Initial');
      assert.strictEqual(result.value.complete, true);
    }

    cleanup(id);
  });

  await t.test('get() returns current state', () => {
    const id = `test-get-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    tracker.update(75, 'Almost done');
    const result = tracker.get();

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 75);
      assert.strictEqual(result.value.percentage, 75);
      assert.strictEqual(result.value.message, 'Almost done');
    }

    cleanup(id);
  });

  await t.test('clear() removes progress file', () => {
    const id = `test-clear-${Date.now()}`;
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Testing',
      id,
    });

    tracker.update(50);
    const clearResult = tracker.clear();
    assert.strictEqual(clearResult.ok, true);

    const getResult = tracker.get();
    assert.strictEqual(getResult.ok, false);
    if (!getResult.ok) {
      assert.match(getResult.error, /does not exist/);
    }

    cleanup(id);
  });

  await t.test('supports custom file path', () => {
    const customPath = join(tmpdir(), `custom-progress-${Date.now()}.json`);
    const tracker = new ProgressTracker({
      total: 100,
      message: 'Custom path',
      filePath: customPath,
    });

    const result = tracker.get();
    assert.strictEqual(result.ok, true);

    try {
      unlinkSync(customPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  await t.test('concurrent instances with different IDs', () => {
    const id1 = `concurrent-1-${Date.now()}`;
    const id2 = `concurrent-2-${Date.now()}`;

    const tracker1 = new ProgressTracker({
      total: 100,
      message: 'Tracker 1',
      id: id1,
    });

    const tracker2 = new ProgressTracker({
      total: 200,
      message: 'Tracker 2',
      id: id2,
    });

    tracker1.update(50);
    tracker2.update(100);

    const result1 = tracker1.get();
    const result2 = tracker2.get();

    assert.strictEqual(result1.ok, true);
    assert.strictEqual(result2.ok, true);

    if (result1.ok && result2.ok) {
      assert.strictEqual(result1.value.current, 50);
      assert.strictEqual(result2.value.current, 100);
      assert.strictEqual(result1.value.total, 100);
      assert.strictEqual(result2.value.total, 200);
    }

    cleanup(id1);
    cleanup(id2);
  });
});
