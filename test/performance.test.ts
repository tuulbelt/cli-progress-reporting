/**
 * Performance and Stress Tests
 *
 * Tests performance characteristics, scalability, and stress scenarios.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  init,
  increment,
  set,
  get,
  clear,
  type ProgressConfig,
} from '../src/index.js';

// Helper to generate unique test IDs
let testCounter = 0;
function getTestId(): string {
  return `perf-test-${Date.now()}-${testCounter++}`;
}

// Helper to clean up test file
function cleanupTestFile(config: ProgressConfig): void {
  try {
    const id = config.id || 'default';
    const filePath = join(tmpdir(), `progress-${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

describe('performance - large scale operations', () => {
  test('handles very large total values (1 billion)', () => {
    const id = getTestId();
    const largeTotal = 1_000_000_000;

    const start = performance.now();
    const result = init(largeTotal, 'Large scale test', { id });
    const elapsed = performance.now() - start;

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, largeTotal);
    }

    // Should complete in reasonable time
    assert(elapsed < 100, `Init took ${elapsed}ms, should be < 100ms`);

    cleanupTestFile({ id });
  });

  test('handles 1000 rapid increments', () => {
    const id = getTestId();
    const iterations = 1000;

    init(iterations, 'Stress test', { id });

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const result = increment(1, undefined, { id });
      assert.strictEqual(result.ok, true);
    }

    const elapsed = performance.now() - start;

    // Verify final state
    const finalResult = get({ id });
    assert.strictEqual(finalResult.ok, true);
    if (finalResult.ok) {
      assert.strictEqual(finalResult.value.current, iterations);
      assert.strictEqual(finalResult.value.complete, true);
    }

    // Performance assertion (should average < 5ms per operation)
    const avgTime = elapsed / iterations;
    assert(avgTime < 10, `Average time per increment: ${avgTime}ms (should be < 10ms)`);

    cleanupTestFile({ id });
  });

  test('handles large jumps in set operations', () => {
    const id = getTestId();
    const largeValue = 999_999_999;

    init(largeValue, 'Jump test', { id });

    const start = performance.now();
    const result = set(largeValue - 1, 'Near complete', { id });
    const elapsed = performance.now() - start;

    assert.strictEqual(result.ok, true);
    assert(elapsed < 50, `Set operation took ${elapsed}ms, should be < 50ms`);

    cleanupTestFile({ id });
  });
});

describe('performance - multiple trackers', () => {
  test('handles 100 concurrent progress trackers', () => {
    const trackers = Array.from({ length: 100 }, (_, i) => ({ id: `multi-${i}-${Date.now()}` }));

    const start = performance.now();

    // Initialize all trackers
    for (const config of trackers) {
      const result = init(100, `Tracker ${config.id}`, config);
      assert.strictEqual(result.ok, true);
    }

    // Update all trackers
    for (const config of trackers) {
      const result = increment(50, undefined, config);
      assert.strictEqual(result.ok, true);
    }

    // Read all trackers
    for (const config of trackers) {
      const result = get(config);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.current, 50);
      }
    }

    const elapsed = performance.now() - start;

    // Should handle 100 trackers efficiently
    assert(elapsed < 10000, `100 trackers took ${elapsed}ms, should be < 10s`);

    // Cleanup
    for (const config of trackers) {
      cleanupTestFile(config);
    }
  });

  test('isolated trackers do not interfere', () => {
    const trackers = Array.from({ length: 10 }, (_, i) => ({
      id: `isolated-${i}-${Date.now()}`,
      expectedValue: (i + 1) * 10,
    }));

    // Initialize with different values
    for (const { id, expectedValue } of trackers) {
      init(100, `Tracker ${id}`, { id });
      set(expectedValue, undefined, { id });
    }

    // Verify isolation
    for (const { id, expectedValue } of trackers) {
      const result = get({ id });
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.current, expectedValue);
      }
    }

    // Cleanup
    for (const { id } of trackers) {
      cleanupTestFile({ id });
    }
  });
});

describe('performance - rapid state changes', () => {
  test('handles rapid init/clear cycles', () => {
    const id = getTestId();
    const cycles = 100;

    const start = performance.now();

    for (let i = 0; i < cycles; i++) {
      const initResult = init(10, `Cycle ${i}`, { id });
      assert.strictEqual(initResult.ok, true);

      const clearResult = clear({ id });
      assert.strictEqual(clearResult.ok, true);
    }

    const elapsed = performance.now() - start;

    // Should handle rapid cycles efficiently
    const avgCycleTime = elapsed / cycles;
    assert(avgCycleTime < 10, `Average cycle time: ${avgCycleTime}ms (should be < 10ms)`);
  });

  test('handles rapid increment/get cycles', () => {
    const id = getTestId();
    const cycles = 200;

    init(cycles, 'Rapid cycles', { id });

    const start = performance.now();

    for (let i = 0; i < cycles; i++) {
      increment(1, undefined, { id });
      const getResult = get({ id });
      assert.strictEqual(getResult.ok, true);
    }

    const elapsed = performance.now() - start;

    const avgTime = elapsed / cycles;
    assert(avgTime < 15, `Average increment+get time: ${avgTime}ms (should be < 15ms)`);

    cleanupTestFile({ id });
  });
});

describe('performance - memory efficiency', () => {
  test('does not leak memory with repeated operations', () => {
    const id = getTestId();
    const iterations = 500;

    init(iterations, 'Memory test', { id });

    // Capture initial memory
    global.gc?.(); // Force GC if --expose-gc flag is set
    const initialMemory = process.memoryUsage().heapUsed;

    // Perform many operations
    for (let i = 0; i < iterations; i++) {
      increment(1, `Update ${i}`, { id });
      get({ id });
    }

    // Capture final memory
    global.gc?.();
    const finalMemory = process.memoryUsage().heapUsed;

    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

    // Memory increase should be minimal (< 10MB for 500 operations)
    assert(memoryIncrease < 10, `Memory increased by ${memoryIncrease.toFixed(2)}MB (should be < 10MB)`);

    cleanupTestFile({ id });
  });
});

describe('stress - edge case combinations', () => {
  test('handles maximum safe integer', () => {
    const id = getTestId();
    const maxSafeInt = Number.MAX_SAFE_INTEGER;

    const result = init(maxSafeInt, 'Max safe integer', { id });

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, maxSafeInt);
    }

    // Increment should work
    const incResult = increment(1, undefined, { id });
    assert.strictEqual(incResult.ok, true);

    cleanupTestFile({ id });
  });

  test('handles zero increments repeatedly', () => {
    const id = getTestId();

    init(100, 'Zero increments', { id });

    // Increment by 0 many times
    for (let i = 0; i < 50; i++) {
      const result = increment(0, `Zero increment ${i}`, { id });
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.current, 0);
      }
    }

    cleanupTestFile({ id });
  });

  test('handles setting to same value repeatedly', () => {
    const id = getTestId();

    init(100, 'Same value', { id });

    for (let i = 0; i < 100; i++) {
      const result = set(42, `Set ${i}`, { id });
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.current, 42);
      }
    }

    cleanupTestFile({ id });
  });
});

describe('stress - concurrent file operations', () => {
  test('handles rapid sequential updates without corruption', () => {
    const id = getTestId();
    const updates = 200;

    init(updates, 'Sequential stress', { id });

    // Rapidly update progress
    for (let i = 0; i < updates; i++) {
      const result = increment(1, `Update ${i}`, { id });
      assert.strictEqual(result.ok, true);

      // Every 10 updates, verify state
      if (i % 10 === 0) {
        const getResult = get({ id });
        assert.strictEqual(getResult.ok, true);
        if (getResult.ok) {
          assert.strictEqual(getResult.value.current, i + 1);
        }
      }
    }

    // Final verification
    const final = get({ id });
    assert.strictEqual(final.ok, true);
    if (final.ok) {
      assert.strictEqual(final.value.current, updates);
      assert.strictEqual(final.value.complete, true);
    }

    cleanupTestFile({ id });
  });
});

describe('stress - time-based scenarios', () => {
  test('handles operations spread over time', async () => {
    const id = getTestId();

    init(5, 'Timed test', { id });

    // Simulate operations with delays
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
      const result = increment(1, `Delayed ${i}`, { id });
      assert.strictEqual(result.ok, true);
    }

    const final = get({ id });
    if (final.ok) {
      assert.strictEqual(final.value.complete, true);
      // Elapsed time should be captured correctly
      const elapsed = final.value.updatedTime - final.value.startTime;
      assert(elapsed >= 40, `Elapsed time: ${elapsed}ms (should be >= 40ms)`);
    }

    cleanupTestFile({ id });
  });

  test('verifies timestamp accuracy', () => {
    const id = getTestId();
    const beforeInit = Date.now();

    init(10, 'Timestamp test', { id });

    const result = get({ id });
    const afterInit = Date.now();

    if (result.ok) {
      // Start time should be between before and after
      assert(result.value.startTime >= beforeInit);
      assert(result.value.startTime <= afterInit);

      // Updated time should match start time initially
      assert.strictEqual(result.value.startTime, result.value.updatedTime);
    }

    cleanupTestFile({ id });
  });
});
