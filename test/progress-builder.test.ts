/**
 * Tests for ProgressBuilder class (Phase 1 Multi-API Design)
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProgressBuilder } from '../src/progress-builder.js';

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

test('ProgressBuilder', async (t) => {
  await t.test('builds tracker with all options', () => {
    const id = `builder-full-${Date.now()}`;
    const tracker = new ProgressBuilder()
      .withTotal(100)
      .withMessage('Testing')
      .withId(id)
      .build();

    const result = tracker.get();
    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 100);
      assert.strictEqual(result.value.message, 'Testing');
    }

    cleanup(id);
  });

  await t.test('builds tracker with minimal options', () => {
    const id = `builder-minimal-${Date.now()}`;
    const tracker = new ProgressBuilder()
      .withTotal(50)
      .withMessage('Minimal')
      .build();

    const result = tracker.get();
    assert.strictEqual(result.ok, true);

    cleanup('default'); // Default ID is used
  });

  await t.test('throws error when total is missing', () => {
    assert.throws(
      () => new ProgressBuilder().withMessage('Missing total').build(),
      /total is required/
    );
  });

  await t.test('throws error when message is missing', () => {
    assert.throws(
      () => new ProgressBuilder().withTotal(100).build(),
      /message is required/
    );
  });

  await t.test('supports method chaining', () => {
    const id = `builder-chain-${Date.now()}`;
    const builder = new ProgressBuilder();

    // All methods should return the builder
    const result = builder
      .withTotal(100)
      .withMessage('Chaining')
      .withId(id);

    assert.strictEqual(result, builder);

    const tracker = result.build();
    assert.ok(tracker);

    cleanup(id);
  });

  await t.test('withFilePath sets custom path', () => {
    const customPath = join(tmpdir(), `builder-custom-${Date.now()}.json`);
    const tracker = new ProgressBuilder()
      .withTotal(100)
      .withMessage('Custom')
      .withFilePath(customPath)
      .build();

    const result = tracker.get();
    assert.strictEqual(result.ok, true);

    try {
      unlinkSync(customPath);
    } catch {
      // Ignore cleanup errors
    }
  });

  await t.test('can build multiple independent trackers', () => {
    const builder = new ProgressBuilder();

    const id1 = `builder-multi-1-${Date.now()}`;
    const id2 = `builder-multi-2-${Date.now()}`;

    const tracker1 = builder
      .withTotal(100)
      .withMessage('Tracker 1')
      .withId(id1)
      .build();

    // Reuse builder for second tracker
    const tracker2 = builder
      .withTotal(200)
      .withMessage('Tracker 2')
      .withId(id2)
      .build();

    const result1 = tracker1.get();
    const result2 = tracker2.get();

    assert.strictEqual(result1.ok, true);
    assert.strictEqual(result2.ok, true);

    if (result1.ok && result2.ok) {
      assert.strictEqual(result1.value.total, 100);
      assert.strictEqual(result2.value.total, 200);
    }

    cleanup(id1);
    cleanup(id2);
  });

  await t.test('preserves previously set values', () => {
    const id = `builder-preserve-${Date.now()}`;
    const builder = new ProgressBuilder();

    builder.withTotal(100);
    builder.withMessage('First');
    builder.withId(id);

    // Change total but keep message and id
    builder.withTotal(50);

    const tracker = builder.build();
    const result = tracker.get();

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 50); // Updated
      assert.strictEqual(result.value.message, 'First'); // Preserved
    }

    cleanup(id);
  });

  await t.test('built tracker is fully functional', () => {
    const id = `builder-functional-${Date.now()}`;
    const tracker = new ProgressBuilder()
      .withTotal(100)
      .withMessage('Functional test')
      .withId(id)
      .build();

    // Test all tracker methods work
    tracker.increment(25);
    tracker.update(50, 'Halfway');
    tracker.increment(10);
    const result = tracker.done('Complete!');

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.complete, true);
      assert.strictEqual(result.value.message, 'Complete!');
    }

    cleanup(id);
  });
});
