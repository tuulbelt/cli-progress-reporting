/**
 * Integration tests for createProgress factory and new API (Phase 1)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createProgress, ProgressBuilder, init, get, increment } from '../src/index.js';

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

test('createProgress factory', async (t) => {
  await t.test('creates functional tracker', () => {
    const id = `factory-${Date.now()}`;
    const tracker = createProgress({
      total: 100,
      message: 'Factory test',
      id,
    });

    const result = tracker.get();
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 100);
      assert.strictEqual(result.value.message, 'Factory test');
    }

    cleanup(id);
  });

  await t.test('supports minimal config', () => {
    const id = `factory-minimal-${Date.now()}`;
    const tracker = createProgress({
      total: 50,
      message: 'Minimal',
    });

    const result = tracker.get();
    assert.strictEqual(result.ok, true);

    cleanup('default');
  });

  await t.test('supports all config options', () => {
    const customPath = join(tmpdir(), `factory-custom-${Date.now()}.json`);
    const tracker = createProgress({
      total: 100,
      message: 'Full config',
      id: 'custom-id',
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

  await t.test('created tracker has all methods', () => {
    const id = `factory-methods-${Date.now()}`;
    const tracker = createProgress({
      total: 100,
      message: 'Methods test',
      id,
    });

    // Verify all methods exist
    assert.strictEqual(typeof tracker.update, 'function');
    assert.strictEqual(typeof tracker.increment, 'function');
    assert.strictEqual(typeof tracker.done, 'function');
    assert.strictEqual(typeof tracker.get, 'function');
    assert.strictEqual(typeof tracker.clear, 'function');

    cleanup(id);
  });

  await t.test('created tracker works end-to-end', () => {
    const id = `factory-e2e-${Date.now()}`;
    const tracker = createProgress({
      total: 100,
      message: 'End-to-end',
      id,
    });

    tracker.increment(10);
    tracker.update(50, 'Halfway');
    tracker.increment(25);
    const finalResult = tracker.done('Done!');

    assert.strictEqual(finalResult.ok, true);
    if (finalResult.ok) {
      assert.strictEqual(finalResult.value.current, 100);
      assert.strictEqual(finalResult.value.complete, true);
      assert.strictEqual(finalResult.value.message, 'Done!');
    }

    cleanup(id);
  });
});

test('API integration', async (t) => {
  await t.test('builder and factory create equivalent trackers', () => {
    const id1 = `equiv-builder-${Date.now()}`;
    const id2 = `equiv-factory-${Date.now()}`;

    const builderTracker = new ProgressBuilder()
      .withTotal(100)
      .withMessage('Test')
      .withId(id1)
      .build();

    const factoryTracker = createProgress({
      total: 100,
      message: 'Test',
      id: id2,
    });

    builderTracker.increment(50);
    factoryTracker.increment(50);

    const result1 = builderTracker.get();
    const result2 = factoryTracker.get();

    assert.strictEqual(result1.ok, true);
    assert.strictEqual(result2.ok, true);

    if (result1.ok && result2.ok) {
      assert.strictEqual(result1.value.current, result2.value.current);
      assert.strictEqual(result1.value.percentage, result2.value.percentage);
    }

    cleanup(id1);
    cleanup(id2);
  });

  await t.test('multiple trackers can coexist', () => {
    const ids = [
      `multi-1-${Date.now()}`,
      `multi-2-${Date.now()}`,
      `multi-3-${Date.now()}`,
    ];

    const trackers = ids.map((id, index) =>
      createProgress({
        total: (index + 1) * 100,
        message: `Tracker ${index + 1}`,
        id,
      })
    );

    // Update each tracker differently
    trackers[0].update(50);
    trackers[1].update(100);
    trackers[2].update(150);

    // Verify each tracker maintains independent state
    const results = trackers.map((t) => t.get());

    assert.strictEqual(results[0].ok, true);
    assert.strictEqual(results[1].ok, true);
    assert.strictEqual(results[2].ok, true);

    if (results.every((r) => r.ok)) {
      assert.strictEqual((results[0] as any).value.current, 50);
      assert.strictEqual((results[1] as any).value.current, 100);
      assert.strictEqual((results[2] as any).value.current, 150);
    }

    ids.forEach(cleanup);
  });

  await t.test('API consistency across different creation methods', () => {
    const id = `consistency-${Date.now()}`;

    // Test that all creation methods produce trackers with same interface
    const methods = [
      createProgress({ total: 100, message: 'Test', id }),
      new ProgressBuilder().withTotal(100).withMessage('Test').withId(id).build(),
    ];

    for (const tracker of methods) {
      const result = tracker.update(25);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.current, 25);
      }
    }

    cleanup(id);
  });
});

test('backward compatibility', async (t) => {
  await t.test('old functional API still works', async () => {
    const { init, increment, get, finish, clear } = await import('../src/index.js');
    const id = `compat-functional-${Date.now()}`;

    const initResult = init(100, 'Old API', { id });
    assert.strictEqual(initResult.ok, true);

    const incResult = increment(25, undefined, { id });
    assert.strictEqual(incResult.ok, true);

    const getResult = get({ id });
    assert.strictEqual(getResult.ok, true);
    if (getResult.ok) {
      assert.strictEqual(getResult.value.current, 25);
    }

    const finishResult = finish('Done', { id });
    assert.strictEqual(finishResult.ok, true);

    const clearResult = clear({ id });
    assert.strictEqual(clearResult.ok, true);

    cleanup(id);
  });

  await t.test('functional and class API can interoperate', () => {
    const id = `compat-interop-${Date.now()}`;

    // Initialize with functional API
    init(100, 'Interop test', { id });

    // Update with class API
    const tracker = createProgress({
      total: 100,
      message: 'Interop test',
      id,
    });

    // The tracker should read the same state
    const getResult1 = get({ id });
    const getResult2 = tracker.get();

    assert.strictEqual(getResult1.ok, true);
    assert.strictEqual(getResult2.ok, true);

    if (getResult1.ok && getResult2.ok) {
      assert.strictEqual(getResult1.value.current, getResult2.value.current);
    }

    // Update with functional API
    increment(50, undefined, { id });

    // Read with class API
    const getResult3 = tracker.get();
    assert.strictEqual(getResult3.ok, true);
    if (getResult3.ok) {
      assert.strictEqual(getResult3.value.current, 50);
    }

    cleanup(id);
  });

  await t.test('new API exports do not break existing imports', async () => {
    // Verify all old exports still exist
    const module = await import('../src/index.js');

    assert.strictEqual(typeof module.init, 'function');
    assert.strictEqual(typeof module.increment, 'function');
    assert.strictEqual(typeof module.set, 'function');
    assert.strictEqual(typeof module.finish, 'function');
    assert.strictEqual(typeof module.get, 'function');
    assert.strictEqual(typeof module.clear, 'function');
    assert.strictEqual(typeof module.formatProgress, 'function');

    // Verify new exports exist
    assert.strictEqual(typeof module.createProgress, 'function');
    assert.strictEqual(typeof module.ProgressTracker, 'function');
    assert.strictEqual(typeof module.ProgressBuilder, 'function');
  });

  await t.test('Result type remains compatible', () => {
    const id = `compat-result-${Date.now()}`;
    const tracker = createProgress({
      total: 100,
      message: 'Result type test',
      id,
    });

    const result = tracker.get();

    // Result should have ok property
    assert.ok('ok' in result);

    // Check type structure
    if (result.ok) {
      assert.ok('value' in result);
      assert.strictEqual(typeof result.value, 'object');
    } else {
      assert.ok('error' in result);
      assert.strictEqual(typeof result.error, 'string');
    }

    cleanup(id);
  });

  await t.test('ProgressState interface remains compatible', () => {
    const id = `compat-state-${Date.now()}`;
    const tracker = createProgress({
      total: 100,
      message: 'State test',
      id,
    });

    const result = tracker.get();
    assert.strictEqual(result.ok, true);

    if (result.ok) {
      const state = result.value;

      // Verify all expected properties exist
      assert.strictEqual(typeof state.total, 'number');
      assert.strictEqual(typeof state.current, 'number');
      assert.strictEqual(typeof state.message, 'string');
      assert.strictEqual(typeof state.percentage, 'number');
      assert.strictEqual(typeof state.startTime, 'number');
      assert.strictEqual(typeof state.updatedTime, 'number');
      assert.strictEqual(typeof state.complete, 'boolean');
    }

    cleanup(id);
  });
});
