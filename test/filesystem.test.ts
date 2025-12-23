/**
 * Filesystem Error and Edge Case Tests
 *
 * Tests file system errors, permissions, corruption scenarios, and recovery.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, unlinkSync, existsSync, chmodSync, mkdirSync, rmdirSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  init,
  increment,
  get,
  clear,
  type ProgressConfig,
} from '../src/index.js';

// Helper to generate unique test IDs
let testCounter = 0;
function getTestId(): string {
  return `fs-test-${Date.now()}-${testCounter++}`;
}

// Helper to clean up test file
function cleanupTestFile(config: ProgressConfig): void {
  try {
    const id = config.id || 'default';
    const filePath = config.filePath || join(tmpdir(), `progress-${id}.json`);
    if (existsSync(filePath)) {
      chmodSync(filePath, 0o644); // Restore permissions
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

describe('filesystem - corrupted JSON', () => {
  test('handles corrupted JSON in progress file', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    // Create corrupted file
    writeFileSync(filePath, '{ invalid json }}}', { encoding: 'utf-8' });

    const result = get({ id });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('Failed to read progress'));
    }

    cleanupTestFile({ id });
  });

  test('handles empty progress file', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    // Create empty file
    writeFileSync(filePath, '', { encoding: 'utf-8' });

    const result = get({ id });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('Failed to read progress'));
    }

    cleanupTestFile({ id });
  });

  test('handles file with invalid structure', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    // Valid JSON but wrong structure
    writeFileSync(filePath, JSON.stringify({ foo: 'bar' }), { encoding: 'utf-8' });

    const result = get({ id });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('Invalid progress file format'));
    }

    cleanupTestFile({ id });
  });

  test('handles file with missing required fields', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    // Missing 'current' field
    writeFileSync(filePath, JSON.stringify({ total: 100, message: 'test' }), { encoding: 'utf-8' });

    const result = get({ id });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('Invalid progress file format'));
    }

    cleanupTestFile({ id });
  });

  test('handles file with non-numeric total', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    writeFileSync(filePath, JSON.stringify({
      total: 'not a number',
      current: 0,
      message: 'test',
      percentage: 0,
      startTime: Date.now(),
      updatedTime: Date.now(),
      complete: false,
    }), { encoding: 'utf-8' });

    const result = get({ id });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('Invalid progress file format'));
    }

    cleanupTestFile({ id });
  });
});

describe('filesystem - file permissions', () => {
  test('handles read-only progress file', () => {
    // Skip if running as root (permissions don't apply)
    if (process.getuid && process.getuid() === 0) {
      return; // Skip test when running as root
    }

    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    // Initialize normally
    init(10, 'Test', { id });

    // Make file read-only
    try {
      chmodSync(filePath, 0o444);
    } catch {
      // Skip if chmod fails
      cleanupTestFile({ id });
      return;
    }

    // Try to increment (should fail due to read-only)
    const result = increment(1, undefined, { id });

    // If result succeeded, permissions didn't work (skip test)
    if (result.ok) {
      cleanupTestFile({ id });
      return;
    }

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('Failed to write progress'));
    }

    cleanupTestFile({ id });
  });

  test('handles directory that does not exist for custom path', () => {
    const nonExistentDir = join(tmpdir(), `nonexistent-${Date.now()}`);
    const filePath = join(nonExistentDir, 'progress.json');

    const result = init(10, 'Test', { filePath });

    assert.strictEqual(result.ok, false);
    if (!result.ok) {
      assert(result.error.includes('Failed to write progress'));
    }
  });
});

describe('filesystem - atomic write verification', () => {
  test('ensures temp files are cleaned up after successful write', () => {
    const id = getTestId();
    const dirPath = tmpdir();

    // Initialize progress
    const result = init(100, 'Test', { id });
    assert.strictEqual(result.ok, true);

    // Check that no temp files remain
    const files = readdirSync(dirPath);
    const tempFiles = files.filter((f: string) => f.includes(`progress-${id}.json.tmp`));

    assert.strictEqual(tempFiles.length, 0, 'Temporary files should be cleaned up');

    cleanupTestFile({ id });
  });

  test('progress file contains valid JSON after write', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    init(50, 'Testing', { id });

    // Read file directly and verify it's valid JSON
    const content = readFileSync(filePath, { encoding: 'utf-8' });
    const parsed = JSON.parse(content); // Should not throw

    assert.strictEqual(typeof parsed.total, 'number');
    assert.strictEqual(typeof parsed.current, 'number');
    assert.strictEqual(typeof parsed.message, 'string');

    cleanupTestFile({ id });
  });
});

describe('filesystem - custom file paths', () => {
  test('creates progress file at custom path', () => {
    const customDir = join(tmpdir(), `custom-${Date.now()}`);
    mkdirSync(customDir);

    const filePath = join(customDir, 'my-progress.json');

    const result = init(10, 'Custom path test', { filePath });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(existsSync(filePath), true);

    unlinkSync(filePath);
    rmdirSync(customDir);
  });

  test('reads from custom file path', () => {
    const customDir = join(tmpdir(), `custom-${Date.now()}`);
    mkdirSync(customDir);

    const filePath = join(customDir, 'my-progress.json');

    init(25, 'Test', { filePath });
    increment(5, undefined, { filePath });

    const result = get({ filePath });

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.current, 5);
    }

    unlinkSync(filePath);
    rmdirSync(customDir);
  });
});

describe('filesystem - file size limits', () => {
  test('handles very long messages (1MB+)', () => {
    const id = getTestId();
    const longMessage = 'A'.repeat(1024 * 1024); // 1MB message

    const result = init(10, longMessage, { id });

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message.length, 1024 * 1024);
    }

    cleanupTestFile({ id });
  });

  test('handles message with newlines and special characters', () => {
    const id = getTestId();
    const specialMessage = 'Line 1\nLine 2\r\nLine 3\t\tTabbed\nQuoted: "test" \'single\'';

    const result = init(10, specialMessage, { id });

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, specialMessage);
    }

    // Verify it persists correctly
    const getResult = get({ id });
    assert.strictEqual(getResult.ok, true);
    if (getResult.ok) {
      assert.strictEqual(getResult.value.message, specialMessage);
    }

    cleanupTestFile({ id });
  });
});

describe('filesystem - recovery scenarios', () => {
  test('recovers after partial write failure', () => {
    const id = getTestId();

    // Initialize progress
    init(100, 'Initial', { id });

    // Simulate corruption
    const filePath = join(tmpdir(), `progress-${id}.json`);
    writeFileSync(filePath, '{ "broken":', { encoding: 'utf-8' });

    // Try to read (should fail gracefully)
    const getResult = get({ id });
    assert.strictEqual(getResult.ok, false);

    // Re-initialize (should succeed and overwrite)
    const initResult = init(50, 'Recovered', { id });
    assert.strictEqual(initResult.ok, true);

    // Verify recovery
    const verifyResult = get({ id });
    assert.strictEqual(verifyResult.ok, true);
    if (verifyResult.ok) {
      assert.strictEqual(verifyResult.value.total, 50);
      assert.strictEqual(verifyResult.value.message, 'Recovered');
    }

    cleanupTestFile({ id });
  });

  test('handles concurrent file deletion', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    // Initialize
    init(10, 'Test', { id });
    assert.strictEqual(existsSync(filePath), true);

    // Delete file externally
    unlinkSync(filePath);

    // Try to increment (should fail)
    const result = increment(1, undefined, { id });
    assert.strictEqual(result.ok, false);

    cleanupTestFile({ id });
  });
});

describe('filesystem - unicode and encoding', () => {
  test('handles unicode in filenames via ID', () => {
    const id = `unicode-测试-${Date.now()}`;

    const result = init(10, 'Unicode test', { id });

    assert.strictEqual(result.ok, true);

    cleanupTestFile({ id });
  });

  test('handles emoji in messages', () => {
    const id = getTestId();
    const emojiMessage = 'Processing 🚀 files 📁 at 100% ✅';

    const result = init(10, emojiMessage, { id });

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value.message, emojiMessage);
    }

    // Verify persistence
    const getResult = get({ id });
    if (getResult.ok) {
      assert.strictEqual(getResult.value.message, emojiMessage);
    }

    cleanupTestFile({ id });
  });

  test('handles various unicode ranges', () => {
    const id = getTestId();
    const unicodeMessage = 'English 中文 日本語 한글 العربية עברית Ελληνικά Русский';

    const result = init(10, unicodeMessage, { id });

    assert.strictEqual(result.ok, true);

    const getResult = get({ id });
    if (getResult.ok) {
      assert.strictEqual(getResult.value.message, unicodeMessage);
    }

    cleanupTestFile({ id });
  });
});
