import { test, describe, before, after } from 'node:test';
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

// Helper to generate unique test IDs
let testCounter = 0;
function getTestId(): string {
  return `test-${Date.now()}-${testCounter++}`;
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

describe('init', () => {
  test('creates progress with valid total and message', () => {
    const config = { id: getTestId() };
    const result = init(100, 'Processing files', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 100);
      assert.strictEqual(result.value.current, 0);
      assert.strictEqual(result.value.message, 'Processing files');
      assert.strictEqual(result.value.percentage, 0);
      assert.strictEqual(result.value.complete, false);
      assert.strictEqual(typeof result.value.startTime, 'number');
      assert.strictEqual(typeof result.value.updatedTime, 'number');
    }

    cleanupTestFile(config);
  });

  test('rejects total <= 0', () => {
    const config = { id: getTestId() };
    const result = init(0, 'Testing', config);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('greater than 0'));
    }

    cleanupTestFile(config);
  });

  test('rejects negative total', () => {
    const config = { id: getTestId() };
    const result = init(-10, 'Testing', config);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('greater than 0'));
    }

    cleanupTestFile(config);
  });

  test('creates file in temp directory', () => {
    const config = { id: getTestId() };
    const result = init(10, 'Test', config);

    assert.strictEqual(result.ok, true);

    const filePath = join(tmpdir(), `progress-${config.id}.json`);
    assert.strictEqual(existsSync(filePath), true);

    cleanupTestFile(config);
  });
});

describe('increment', () => {
  test('increments progress by default amount (1)', () => {
    const config = { id: getTestId() };
    init(10, 'Starting', config);

    const result = increment(1, undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 1);
      assert.strictEqual(result.value.percentage, 10);
    }

    cleanupTestFile(config);
  });

  test('increments progress by specified amount', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);

    const result = increment(25, undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 25);
      assert.strictEqual(result.value.percentage, 25);
    }

    cleanupTestFile(config);
  });

  test('updates message when provided', () => {
    const config = { id: getTestId() };
    init(10, 'Starting', config);

    const result = increment(1, 'Processing item 1', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, 'Processing item 1');
    }

    cleanupTestFile(config);
  });

  test('caps at total when incrementing beyond', () => {
    const config = { id: getTestId() };
    init(10, 'Starting', config);
    increment(8, undefined, config);

    const result = increment(5, undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 10);
      assert.strictEqual(result.value.percentage, 100);
      assert.strictEqual(result.value.complete, true);
    }

    cleanupTestFile(config);
  });

  test('marks complete when reaching total', () => {
    const config = { id: getTestId() };
    init(5, 'Starting', config);

    const result = increment(5, undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.complete, true);
    }

    cleanupTestFile(config);
  });

  test('rejects negative increment', () => {
    const config = { id: getTestId() };
    init(10, 'Starting', config);

    const result = increment(-1, undefined, config);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('non-negative'));
    }

    cleanupTestFile(config);
  });

  test('fails when progress not initialized', () => {
    const config = { id: getTestId() };

    const result = increment(1, undefined, config);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('does not exist'));
    }

    cleanupTestFile(config);
  });
});

describe('set', () => {
  test('sets progress to absolute value', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);

    const result = set(50, undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 50);
      assert.strictEqual(result.value.percentage, 50);
    }

    cleanupTestFile(config);
  });

  test('updates message when provided', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);

    const result = set(75, 'Almost done', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, 'Almost done');
    }

    cleanupTestFile(config);
  });

  test('caps at total when setting beyond', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);

    const result = set(150, undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 100);
      assert.strictEqual(result.value.percentage, 100);
      assert.strictEqual(result.value.complete, true);
    }

    cleanupTestFile(config);
  });

  test('rejects negative value', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);

    const result = set(-10, undefined, config);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('non-negative'));
    }

    cleanupTestFile(config);
  });

  test('sets to zero', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);
    increment(50, undefined, config);

    const result = set(0, 'Reset', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 0);
      assert.strictEqual(result.value.percentage, 0);
    }

    cleanupTestFile(config);
  });
});

describe('finish', () => {
  test('marks progress as complete', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);
    increment(50, undefined, config);

    const result = finish(undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 100);
      assert.strictEqual(result.value.percentage, 100);
      assert.strictEqual(result.value.complete, true);
    }

    cleanupTestFile(config);
  });

  test('updates message when provided', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);

    const result = finish('All done!', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, 'All done!');
    }

    cleanupTestFile(config);
  });

  test('works when already at total', () => {
    const config = { id: getTestId() };
    init(10, 'Starting', config);
    increment(10, undefined, config);

    const result = finish('Done', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.complete, true);
    }

    cleanupTestFile(config);
  });
});

describe('get', () => {
  test('retrieves current progress state', () => {
    const config = { id: getTestId() };
    init(100, 'Test message', config);
    increment(33, undefined, config);

    const result = get(config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 100);
      assert.strictEqual(result.value.current, 33);
      assert.strictEqual(result.value.message, 'Test message');
      assert.strictEqual(result.value.percentage, 33);
    }

    cleanupTestFile(config);
  });

  test('fails when progress not initialized', () => {
    const config = { id: getTestId() };

    const result = get(config);

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('does not exist'));
    }

    cleanupTestFile(config);
  });
});

describe('clear', () => {
  test('removes progress file', () => {
    const config = { id: getTestId() };
    init(100, 'Test', config);

    const filePath = join(tmpdir(), `progress-${config.id}.json`);
    assert.strictEqual(existsSync(filePath), true);

    const result = clear(config);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(existsSync(filePath), false);
  });

  test('succeeds when file does not exist', () => {
    const config = { id: getTestId() };

    const result = clear(config);

    assert.strictEqual(result.ok, true);

    cleanupTestFile(config);
  });
});

describe('formatProgress', () => {
  test('formats progress state as string', () => {
    const now = Date.now();
    const state: ProgressState = {
      total: 100,
      current: 50,
      message: 'Processing',
      percentage: 50,
      startTime: now - 5000, // 5 seconds ago
      updatedTime: now,
      complete: false,
    };

    const formatted = formatProgress(state);

    assert(formatted.includes('50%'));
    assert(formatted.includes('50/100'));
    assert(formatted.includes('Processing'));
    assert(formatted.includes('5s'));
  });

  test('shows 0 seconds for immediate update', () => {
    const now = Date.now();
    const state: ProgressState = {
      total: 10,
      current: 0,
      message: 'Starting',
      percentage: 0,
      startTime: now,
      updatedTime: now,
      complete: false,
    };

    const formatted = formatProgress(state);

    assert(formatted.includes('0s'));
  });
});

describe('concurrent safety', () => {
  test('handles multiple rapid updates', () => {
    const config = { id: getTestId() };
    init(100, 'Starting', config);

    // Rapidly increment multiple times
    for (let i = 0; i < 10; i++) {
      const result = increment(1, `Update ${i}`, config);
      assert.strictEqual(result.ok, true);
    }

    const final = get(config);
    assert.strictEqual(final.ok, true);
    if (final.ok) {
      assert.strictEqual(final.value.current, 10);
    }

    cleanupTestFile(config);
  });

  test('maintains separate progress for different IDs', () => {
    const config1 = { id: getTestId() };
    const config2 = { id: getTestId() };

    init(100, 'Project 1', config1);
    init(50, 'Project 2', config2);

    increment(25, undefined, config1);
    increment(10, undefined, config2);

    const result1 = get(config1);
    const result2 = get(config2);

    assert.strictEqual(result1.ok, true);
    assert.strictEqual(result2.ok, true);

    if (result1.ok && result2.ok) {
      assert.strictEqual(result1.value.current, 25);
      assert.strictEqual(result1.value.total, 100);
      assert.strictEqual(result2.value.current, 10);
      assert.strictEqual(result2.value.total, 50);
    }

    cleanupTestFile(config1);
    cleanupTestFile(config2);
  });
});

describe('edge cases', () => {
  test('handles very large totals', () => {
    const config = { id: getTestId() };
    const result = init(1000000, 'Large task', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.total, 1000000);
    }

    cleanupTestFile(config);
  });

  test('handles total of 1', () => {
    const config = { id: getTestId() };
    init(1, 'Single item', config);

    const result = increment(1, undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.percentage, 100);
      assert.strictEqual(result.value.complete, true);
    }

    cleanupTestFile(config);
  });

  test('handles zero increment', () => {
    const config = { id: getTestId() };
    init(10, 'Starting', config);

    const result = increment(0, 'No progress', config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 0);
      assert.strictEqual(result.value.message, 'No progress');
    }

    cleanupTestFile(config);
  });

  test('handles very long messages', () => {
    const config = { id: getTestId() };
    const longMessage = 'A'.repeat(1000);

    const result = init(10, longMessage, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, longMessage);
    }

    cleanupTestFile(config);
  });

  test('handles special characters in messages', () => {
    const config = { id: getTestId() };
    const specialMessage = 'Processing file: /tmp/test-[123].txt "quoted" \'single\'';

    const result = init(10, specialMessage, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, specialMessage);
    }

    cleanupTestFile(config);
  });

  test('handles unicode in messages', () => {
    const config = { id: getTestId() };
    const unicodeMessage = 'Processing 文件 🎉 café';

    const result = init(10, unicodeMessage, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, unicodeMessage);
    }

    cleanupTestFile(config);
  });
});

describe('percentage calculation', () => {
  test('rounds percentage correctly', () => {
    const config = { id: getTestId() };
    init(3, 'Test', config);

    increment(1, undefined, config);
    let result = get(config);
    if (result.ok) {
      assert.strictEqual(result.value.percentage, 33); // 1/3 = 33.33... → 33
    }

    increment(1, undefined, config);
    result = get(config);
    if (result.ok) {
      assert.strictEqual(result.value.percentage, 67); // 2/3 = 66.66... → 67
    }

    cleanupTestFile(config);
  });

  test('shows 100% when complete', () => {
    const config = { id: getTestId() };
    init(7, 'Test', config);

    const result = finish(undefined, config);

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.percentage, 100);
    }

    cleanupTestFile(config);
  });
});
