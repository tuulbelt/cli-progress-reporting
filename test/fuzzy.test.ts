/**
 * Fuzzy/Property-Based Tests for CLI Progress Reporting
 *
 * Property-based testing with random input generation to verify invariants
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  init,
  increment,
  set,
  finish,
  get,
  clear,
  formatProgress,
  type ProgressState,
  type ProgressConfig,
} from '../src/index.js';

// Random generators
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Helper to generate unique test IDs
let testCounter = 0;
function getTestId(): string {
  return `fuzzy-${Date.now()}-${testCounter++}`;
}

// Helper to clean up test files
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

test('fuzzy - init invariants', async (t) => {
  await t.test('valid positive totals always succeed', () => {
    for (let i = 0; i < 50; i++) {
      const total = randomInt(1, 10000);
      const message = randomString(randomInt(5, 50));
      const config = { id: getTestId() };

      const result = init(total, message, config);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.total, total);
        assert.strictEqual(result.value.current, 0);
        assert.strictEqual(result.value.message, message);
        assert.strictEqual(result.value.percentage, 0);
        assert.strictEqual(result.value.complete, false);
      }

      cleanupTestFile(config);
    }
  });

  await t.test('zero and negative totals always fail', () => {
    const invalidTotals = [0, -1, -10, -100, -1000];

    for (const total of invalidTotals) {
      const config = { id: getTestId() };
      const result = init(total, 'Test', config);

      assert.strictEqual(result.ok, false,
        `Total ${total} should fail`);
      if (!result.ok) {
        assert(result.error.length > 0,
          'Error message should be present');
      }

      cleanupTestFile(config);
    }
  });

  await t.test('message can be any string', () => {
    const messages = [
      '',
      ' ',
      '   ',
      randomString(0),
      randomString(1),
      randomString(100),
      randomString(1000),
      'Special chars: !@#$%^&*()',
      'Unicode: 测试тестテスト🎉',
    ];

    for (const message of messages) {
      const config = { id: getTestId() };
      const result = init(10, message, config);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.message, message);
      }

      cleanupTestFile(config);
    }
  });

  await t.test('creates file that can be read back', () => {
    for (let i = 0; i < 20; i++) {
      const config = { id: getTestId() };
      const total = randomInt(1, 100);

      init(total, 'Test', config);

      const readResult = get(config);
      assert.strictEqual(readResult.ok, true);
      if (readResult.ok) {
        assert.strictEqual(readResult.value.total, total);
      }

      cleanupTestFile(config);
    }
  });
});

test('fuzzy - increment invariants', async (t) => {
  await t.test('current never exceeds total', () => {
    for (let i = 0; i < 50; i++) {
      const config = { id: getTestId() };
      const total = randomInt(10, 100);
      init(total, 'Test', config);

      // Increment way beyond total
      const increments = randomInt(total + 1, total * 2);
      for (let j = 0; j < increments; j++) {
        const amount = randomInt(1, 10);
        increment(amount, undefined, config);
      }

      const result = get(config);
      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert(result.value.current <= result.value.total,
          `Current ${result.value.current} should not exceed total ${result.value.total}`);
      }

      cleanupTestFile(config);
    }
  });

  await t.test('percentage is always between 0 and 100', () => {
    for (let i = 0; i < 50; i++) {
      const config = { id: getTestId() };
      const total = randomInt(10, 1000);
      init(total, 'Test', config);

      const operations = randomInt(1, total * 2);
      for (let j = 0; j < operations; j++) {
        increment(randomInt(1, total), undefined, config);

        const result = get(config);
        if (result.ok) {
          assert(result.value.percentage >= 0 && result.value.percentage <= 100,
            `Percentage ${result.value.percentage} should be 0-100`);
        }
      }

      cleanupTestFile(config);
    }
  });

  await t.test('increment is commutative for same total amount', () => {
    const total = 100;
    const config1 = { id: getTestId() };
    const config2 = { id: getTestId() };

    init(total, 'Test', config1);
    init(total, 'Test', config2);

    // Path 1: increment by 10, then 20, then 30
    increment(10, undefined, config1);
    increment(20, undefined, config1);
    increment(30, undefined, config1);

    // Path 2: increment by 30, then 10, then 20
    increment(30, undefined, config2);
    increment(10, undefined, config2);
    increment(20, undefined, config2);

    const result1 = get(config1);
    const result2 = get(config2);

    assert.strictEqual(result1.ok, true);
    assert.strictEqual(result2.ok, true);

    if (result1.ok && result2.ok) {
      assert.strictEqual(result1.value.current, result2.value.current,
        'Total increment should be same regardless of order');
      assert.strictEqual(result1.value.percentage, result2.value.percentage);
    }

    cleanupTestFile(config1);
    cleanupTestFile(config2);
  });

  await t.test('negative increments are rejected', () => {
    for (let i = 0; i < 20; i++) {
      const config = { id: getTestId() };
      init(100, 'Test', config);

      const negativeAmount = -randomInt(1, 100);
      const result = increment(negativeAmount, undefined, config);

      assert.strictEqual(result.ok, false,
        'Negative increment should fail');

      cleanupTestFile(config);
    }
  });
});

test('fuzzy - set invariants', async (t) => {
  await t.test('set clamps to [0, total] range', () => {
    for (let i = 0; i < 50; i++) {
      const config = { id: getTestId() };
      const total = randomInt(10, 100);
      init(total, 'Test', config);

      // Try setting way beyond range
      const values = [
        -1000,
        -10,
        -1,
        0,
        randomInt(0, total),
        total,
        total + 1,
        total + 100,
        total * 10,
      ];

      for (const value of values) {
        set(value, undefined, config);

        const result = get(config);
        if (result.ok) {
          assert(result.value.current >= 0 && result.value.current <= total,
            `Current ${result.value.current} should be in [0, ${total}]`);
        }
      }

      cleanupTestFile(config);
    }
  });

  await t.test('set to same value multiple times is idempotent', () => {
    const config = { id: getTestId() };
    init(100, 'Test', config);

    const value = randomInt(0, 100);

    set(value, 'First', config);
    const first = get(config);

    set(value, 'Second', config);
    const second = get(config);

    set(value, 'Third', config);
    const third = get(config);

    assert.strictEqual(first.ok, true);
    assert.strictEqual(second.ok, true);
    assert.strictEqual(third.ok, true);

    if (first.ok && second.ok && third.ok) {
      assert.strictEqual(first.value.current, value);
      assert.strictEqual(second.value.current, value);
      assert.strictEqual(third.value.current, value);
      assert.strictEqual(first.value.percentage, second.value.percentage);
      assert.strictEqual(second.value.percentage, third.value.percentage);
    }

    cleanupTestFile(config);
  });
});

test('fuzzy - percentage calculation invariants', async (t) => {
  await t.test('percentage matches current/total * 100', () => {
    for (let i = 0; i < 100; i++) {
      const config = { id: getTestId() };
      const total = randomInt(10, 1000);
      const current = randomInt(0, total);

      init(total, 'Test', config);
      set(current, undefined, config);

      const result = get(config);
      if (result.ok) {
        const expectedPercentage = Math.round((current / total) * 100);
        assert.strictEqual(result.value.percentage, expectedPercentage,
          `Percentage for ${current}/${total} should be ${expectedPercentage}`);
      }

      cleanupTestFile(config);
    }
  });

  await t.test('0% when current = 0', () => {
    for (let i = 0; i < 20; i++) {
      const config = { id: getTestId() };
      const total = randomInt(1, 1000);

      init(total, 'Test', config);

      const result = get(config);
      if (result.ok) {
        assert.strictEqual(result.value.percentage, 0);
      }

      cleanupTestFile(config);
    }
  });

  await t.test('100% when current = total', () => {
    for (let i = 0; i < 20; i++) {
      const config = { id: getTestId() };
      const total = randomInt(1, 1000);

      init(total, 'Test', config);
      set(total, undefined, config);

      const result = get(config);
      if (result.ok) {
        assert.strictEqual(result.value.percentage, 100);
      }

      cleanupTestFile(config);
    }
  });
});

test('fuzzy - finish invariants', async (t) => {
  await t.test('finish always sets complete=true and current=total', () => {
    for (let i = 0; i < 50; i++) {
      const config = { id: getTestId() };
      const total = randomInt(10, 1000);
      const current = randomInt(0, total - 1); // Not yet complete

      init(total, 'Test', config);
      set(current, undefined, config);

      const result = finish('Done', config);

      assert.strictEqual(result.ok, true);
      if (result.ok) {
        assert.strictEqual(result.value.complete, true);
        assert.strictEqual(result.value.current, total);
        assert.strictEqual(result.value.percentage, 100);
      }

      cleanupTestFile(config);
    }
  });

  await t.test('finish is idempotent', () => {
    const config = { id: getTestId() };
    init(100, 'Test', config);

    finish('First', config);
    const first = get(config);

    finish('Second', config);
    const second = get(config);

    finish('Third', config);
    const third = get(config);

    if (first.ok && second.ok && third.ok) {
      assert.strictEqual(first.value.complete, true);
      assert.strictEqual(second.value.complete, true);
      assert.strictEqual(third.value.complete, true);
      assert.strictEqual(first.value.current, 100);
      assert.strictEqual(second.value.current, 100);
      assert.strictEqual(third.value.current, 100);
    }

    cleanupTestFile(config);
  });
});

test('fuzzy - timestamp invariants', async (t) => {
  await t.test('timestamps are always valid numbers', () => {
    for (let i = 0; i < 50; i++) {
      const config = { id: getTestId() };
      init(100, 'Test', config);

      const operations = randomInt(1, 20);
      for (let j = 0; j < operations; j++) {
        const op = randomInt(0, 2);
        if (op === 0) increment(randomInt(1, 10), undefined, config);
        else if (op === 1) set(randomInt(0, 100), undefined, config);
        else finish('Done', config);

        const result = get(config);
        if (result.ok) {
          assert.strictEqual(typeof result.value.startTime, 'number');
          assert.strictEqual(typeof result.value.updatedTime, 'number');
          assert(result.value.startTime > 0);
          assert(result.value.updatedTime > 0);
          assert(result.value.updatedTime >= result.value.startTime,
            'Updated time should be >= start time');
        }
      }

      cleanupTestFile(config);
    }
  });

  await t.test('updatedTime increases with each operation', async () => {
    const config = { id: getTestId() };
    init(100, 'Test', config);

    let lastUpdatedTime = 0;

    for (let i = 0; i < 10; i++) {
      // Small delay to ensure timestamp changes
      const delay = new Promise(resolve => setTimeout(resolve, 2));
      await delay;

      increment(5, undefined, config);

      const result = get(config);
      if (result.ok) {
        if (lastUpdatedTime > 0) {
          assert(result.value.updatedTime >= lastUpdatedTime,
            'Updated time should monotonically increase');
        }
        lastUpdatedTime = result.value.updatedTime;
      }
    }

    cleanupTestFile(config);
  });
});

test('fuzzy - formatProgress invariants', async (t) => {
  await t.test('formatted output always contains percentage', () => {
    for (let i = 0; i < 50; i++) {
      const config = { id: getTestId() };
      const total = randomInt(10, 100);
      const current = randomInt(0, total);

      init(total, 'Test', config);
      set(current, undefined, config);

      const result = get(config);
      if (result.ok) {
        const formatted = formatProgress(result.value);
        assert(formatted.includes('%'),
          'Formatted output should contain percentage');
        assert(formatted.includes(result.value.percentage.toString()),
          'Formatted output should include actual percentage value');
      }

      cleanupTestFile(config);
    }
  });

  await t.test('formatted output contains message if present', () => {
    for (let i = 0; i < 20; i++) {
      const config = { id: getTestId() };
      const message = randomString(randomInt(5, 30));

      init(100, message, config);

      const result = get(config);
      if (result.ok) {
        const formatted = formatProgress(result.value);
        assert(formatted.includes(message),
          `Formatted output should contain message "${message}"`);
      }

      cleanupTestFile(config);
    }
  });
});

test('fuzzy - concurrent operations invariants', async (t) => {
  await t.test('multiple trackers with different IDs are independent', () => {
    const configs = Array.from({ length: 10 }, () => ({ id: getTestId() }));

    // Initialize all with different totals
    for (let i = 0; i < configs.length; i++) {
      const total = (i + 1) * 10;
      init(total, `Tracker ${i}`, configs[i]);
    }

    // Update each independently
    for (let i = 0; i < configs.length; i++) {
      const amount = (i + 1) * 5;
      increment(amount, undefined, configs[i]);
    }

    // Verify each has correct independent state
    for (let i = 0; i < configs.length; i++) {
      const result = get(configs[i]);
      if (result.ok) {
        const expectedTotal = (i + 1) * 10;
        const expectedCurrent = Math.min((i + 1) * 5, expectedTotal);
        assert.strictEqual(result.value.total, expectedTotal);
        assert.strictEqual(result.value.current, expectedCurrent);
      }
    }

    // Cleanup all
    configs.forEach(cleanupTestFile);
  });

  await t.test('rapid concurrent updates maintain consistency', async () => {
    const config = { id: getTestId() };
    const total = 1000;
    init(total, 'Concurrent test', config);

    // Fire off multiple increments without waiting
    const operations = Array.from({ length: 100 }, () =>
      increment(1, undefined, config)
    );

    // All should complete
    for (const op of operations) {
      assert.strictEqual(op.ok, true);
    }

    const result = get(config);
    if (result.ok) {
      assert(result.value.current <= total,
        'Current should not exceed total even with concurrent updates');
      assert(result.value.current >= 0,
        'Current should be non-negative');
      assert(result.value.percentage >= 0 && result.value.percentage <= 100,
        'Percentage should be in valid range');
    }

    cleanupTestFile(config);
  });
});

test('fuzzy - clear invariants', async (t) => {
  await t.test('clear removes file and subsequent get fails', () => {
    for (let i = 0; i < 20; i++) {
      const config = { id: getTestId() };
      init(100, 'Test', config);

      const clearResult = clear(config);
      assert.strictEqual(clearResult.ok, true);

      const filePath = join(tmpdir(), `progress-${config.id}.json`);
      assert.strictEqual(existsSync(filePath), false,
        'File should not exist after clear');

      const getResult = get(config);
      assert.strictEqual(getResult.ok, false,
        'Get should fail after clear');
    }
  });

  await t.test('clear is idempotent', () => {
    const config = { id: getTestId() };
    init(100, 'Test', config);

    const clear1 = clear(config);
    assert.strictEqual(clear1.ok, true);

    const clear2 = clear(config);
    assert.strictEqual(clear2.ok, true,
      'Second clear should also succeed');

    const clear3 = clear(config);
    assert.strictEqual(clear3.ok, true,
      'Third clear should also succeed');
  });
});
