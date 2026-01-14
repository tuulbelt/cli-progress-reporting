/**
 * CLI Integration Tests for Nested Command Structure (v0.3.0)
 *
 * Tests the actual CLI entry point by spawning processes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { unlinkSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI_PATH = join(process.cwd(), 'src', 'index.ts');

// Helper to run CLI command
function runCLI(args: string[], expectSuccess = true): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync('npx', ['tsx', CLI_PATH, ...args], {
    encoding: 'utf-8',
    timeout: 10000,
  });

  const exitCode = result.status ?? 1;

  if (expectSuccess && exitCode !== 0) {
    console.error('CLI failed:', result.stderr);
  }

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    exitCode,
  };
}

// Helper to generate unique test IDs
let testCounter = 0;
function getTestId(): string {
  return `cli-test-${Date.now()}-${testCounter++}`;
}

// Helper to clean up test file
function cleanupTestFile(id: string): void {
  try {
    const filePath = join(tmpdir(), `progress-${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// Helper to clean up multi-progress file
function cleanupMultiFile(id: string): void {
  try {
    const filePath = join(tmpdir(), `progress-multi-${id}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// Parser Tests (10 tests)
// =============================================================================

describe('CLI Parser - Single Commands', () => {
  test('parses init command with required args', () => {
    const id = getTestId();
    const result = runCLI([id, 'init', '100', '--message', 'Test']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.total, 100);
    assert.strictEqual(output.message, 'Test');

    cleanupTestFile(id);
  });

  test('parses inc command with optional amount', () => {
    const id = getTestId();

    runCLI([id, 'init', '10', '--message', 'Start']);
    const result = runCLI([id, 'inc', '3']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 3);

    cleanupTestFile(id);
  });

  test('parses inc command without amount (defaults to 1)', () => {
    const id = getTestId();

    runCLI([id, 'init', '10', '--message', 'Start']);
    const result = runCLI([id, 'inc']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 1);

    cleanupTestFile(id);
  });

  test('parses set command with current value', () => {
    const id = getTestId();

    runCLI([id, 'init', '100', '--message', 'Start']);
    const result = runCLI([id, 'set', '75', '--message', 'Updated']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 75);
    assert.strictEqual(output.message, 'Updated');

    cleanupTestFile(id);
  });

  test('parses get command', () => {
    const id = getTestId();

    runCLI([id, 'init', '50', '--message', 'Testing']);
    const result = runCLI([id, 'get']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.total, 50);

    cleanupTestFile(id);
  });

  test('parses done command with optional message', () => {
    const id = getTestId();

    runCLI([id, 'init', '20', '--message', 'Start']);
    const result = runCLI([id, 'done', 'Finished!']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.complete, true);
    assert.strictEqual(output.message, 'Finished!');

    cleanupTestFile(id);
  });

  test('parses clear command', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    runCLI([id, 'init', '10', '--message', 'Test']);
    assert.strictEqual(existsSync(filePath), true);

    const result = runCLI([id, 'clear']);

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(existsSync(filePath), false);
  });
});

describe('CLI Parser - Multi Commands', () => {
  test('parses multi init command', () => {
    const id = getTestId();
    const result = runCLI(['multi', id, 'init']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert(output.trackers);
    assert.strictEqual(Object.keys(output.trackers).length, 0);

    cleanupMultiFile(id);
  });

  test('parses multi add command', () => {
    const multiId = getTestId();

    runCLI(['multi', multiId, 'init']);
    const result = runCLI(['multi', multiId, 'add', 'task1', '50', '--message', 'First task']);

    assert.strictEqual(result.exitCode, 0);

    cleanupMultiFile(multiId);
    cleanupTestFile(`${multiId}-task1`);
  });

  test('parses multi status command', () => {
    const multiId = getTestId();

    runCLI(['multi', multiId, 'init']);
    runCLI(['multi', multiId, 'add', 'task1', '10', '--message', 'Task']);

    const result = runCLI(['multi', multiId, 'status']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(Object.keys(output.trackers).length, 1);

    cleanupMultiFile(multiId);
    cleanupTestFile(`${multiId}-task1`);
  });
});

describe('CLI Parser - Global Commands', () => {
  test('parses help command', () => {
    const result = runCLI(['help']);

    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('Usage:'));
    assert(result.stdout.includes('prog <command>'));
  });

  test('parses version command', () => {
    const result = runCLI(['version']);

    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('0.'));
  });

  test('parses list command', () => {
    const id = getTestId();

    // Create a tracker first
    runCLI([id, 'init', '10', '--message', 'Test']);

    const result = runCLI(['list']);

    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('Active Progress Trackers'));

    cleanupTestFile(id);
  });
});

// =============================================================================
// Execution Tests (10 tests)
// =============================================================================

describe('CLI Execution - Single Progress', () => {
  test('executes init successfully', () => {
    const id = getTestId();
    const result = runCLI([id, 'init', '100', '--message', 'Processing files']);

    assert.strictEqual(result.exitCode, 0);

    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.total, 100);
    assert.strictEqual(output.current, 0);
    assert.strictEqual(output.message, 'Processing files');
    assert.strictEqual(output.percentage, 0);

    cleanupTestFile(id);
  });

  test('executes inc with message update', () => {
    const id = getTestId();

    runCLI([id, 'init', '50', '--message', 'Start']);
    const result = runCLI([id, 'inc', '5', '--message', 'Step 1']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 5);
    assert.strictEqual(output.message, 'Step 1');

    cleanupTestFile(id);
  });

  test('executes set to specific value', () => {
    const id = getTestId();

    runCLI([id, 'init', '100', '--message', 'Start']);
    const result = runCLI([id, 'set', '80']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 80);
    assert.strictEqual(output.percentage, 80);

    cleanupTestFile(id);
  });

  test('executes get and returns current state', () => {
    const id = getTestId();

    runCLI([id, 'init', '30', '--message', 'Testing']);
    runCLI([id, 'inc', '10']);

    const result = runCLI([id, 'get']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 10);
    assert.strictEqual(output.total, 30);

    cleanupTestFile(id);
  });

  test('executes done and marks complete', () => {
    const id = getTestId();

    runCLI([id, 'init', '20', '--message', 'Start']);
    const result = runCLI([id, 'done', 'All done!']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.complete, true);
    assert.strictEqual(output.current, 20);
    assert.strictEqual(output.percentage, 100);
    assert.strictEqual(output.message, 'All done!');

    cleanupTestFile(id);
  });

  test('executes clear and removes file', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    runCLI([id, 'init', '10', '--message', 'Test']);
    assert.strictEqual(existsSync(filePath), true);

    const result = runCLI([id, 'clear']);

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(existsSync(filePath), false);
  });
});

describe('CLI Execution - Multi Progress', () => {
  test('executes multi init', () => {
    const multiId = getTestId();
    const result = runCLI(['multi', multiId, 'init']);

    assert.strictEqual(result.exitCode, 0);

    cleanupMultiFile(multiId);
  });

  test('executes multi add and creates tracker', () => {
    const multiId = getTestId();

    runCLI(['multi', multiId, 'init']);
    const result = runCLI(['multi', multiId, 'add', 'frontend', '100', '--message', 'Building']);

    assert.strictEqual(result.exitCode, 0);

    cleanupMultiFile(multiId);
    cleanupTestFile(`${multiId}-frontend`);
  });

  test('executes multi status with multiple trackers', () => {
    const multiId = getTestId();

    runCLI(['multi', multiId, 'init']);
    runCLI(['multi', multiId, 'add', 'task1', '50', '--message', 'Task 1']);
    runCLI(['multi', multiId, 'add', 'task2', '30', '--message', 'Task 2']);

    const result = runCLI(['multi', multiId, 'status']);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(Object.keys(output.trackers).length, 2);

    cleanupMultiFile(multiId);
    cleanupTestFile(`${multiId}-task1`);
    cleanupTestFile(`${multiId}-task2`);
  });

  test('executes multi clear', () => {
    const multiId = getTestId();
    const filePath = join(tmpdir(), `progress-multi-${multiId}.json`);

    runCLI(['multi', multiId, 'init']);
    assert.strictEqual(existsSync(filePath), true);

    const result = runCLI(['multi', multiId, 'clear']);

    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(existsSync(filePath), false);
  });
});

// =============================================================================
// Error Handling Tests (5 tests)
// =============================================================================

describe('CLI Error Handling', () => {
  test('fails with invalid tracker ID (special characters)', () => {
    const result = runCLI(['my@project', 'init', '10'], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('Invalid tracker ID'));
  });

  test('fails when init requires total argument', () => {
    const id = getTestId();
    const result = runCLI([id, 'init'], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('init requires <total>'));

    cleanupTestFile(id);
  });

  test('fails when set requires current argument', () => {
    const id = getTestId();

    runCLI([id, 'init', '100', '--message', 'Start']);
    const result = runCLI([id, 'set'], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('set requires <current>'));

    cleanupTestFile(id);
  });

  test('fails when accessing non-existent tracker', () => {
    const id = getTestId();
    const result = runCLI([id, 'get'], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('does not exist'));

    cleanupTestFile(id);
  });

  test('fails with invalid total (negative number)', () => {
    const id = getTestId();
    const result = runCLI([id, 'init', '-10', '--message', 'Test'], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('positive number'));

    cleanupTestFile(id);
  });
});

// =============================================================================
// End-to-End Workflows
// =============================================================================

describe('CLI End-to-End Workflows', () => {
  test('complete single progress workflow', () => {
    const id = getTestId();

    // Initialize
    let result = runCLI([id, 'init', '100', '--message', 'Starting']);
    assert.strictEqual(result.exitCode, 0);

    // Increment
    result = runCLI([id, 'inc', '25']);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(JSON.parse(result.stdout).current, 25);

    // Set
    result = runCLI([id, 'set', '75']);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(JSON.parse(result.stdout).current, 75);

    // Done
    result = runCLI([id, 'done', 'Complete']);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(JSON.parse(result.stdout).complete, true);

    // Clear
    result = runCLI([id, 'clear']);
    assert.strictEqual(result.exitCode, 0);
  });

  test('multi-progress workflow with parallel tasks', () => {
    const multiId = getTestId();

    // Initialize multi-progress
    let result = runCLI(['multi', multiId, 'init']);
    assert.strictEqual(result.exitCode, 0);

    // Add multiple tasks
    runCLI(['multi', multiId, 'add', 'frontend', '50', '--message', 'Building frontend']);
    runCLI(['multi', multiId, 'add', 'backend', '30', '--message', 'Building backend']);
    runCLI(['multi', multiId, 'add', 'tests', '20', '--message', 'Running tests']);

    // Check status
    result = runCLI(['multi', multiId, 'status']);
    assert.strictEqual(result.exitCode, 0);
    const status = JSON.parse(result.stdout);
    assert.strictEqual(Object.keys(status.trackers).length, 3);

    // Clean up
    result = runCLI(['multi', multiId, 'clear']);
    assert.strictEqual(result.exitCode, 0);

    cleanupTestFile(`${multiId}-frontend`);
    cleanupTestFile(`${multiId}-backend`);
    cleanupTestFile(`${multiId}-tests`);
  });

  test('sequential increments reach completion', () => {
    const id = getTestId();

    runCLI([id, 'init', '10', '--message', 'Start']);

    for (let i = 1; i <= 10; i++) {
      const result = runCLI([id, 'inc', '1', '--message', `Step ${i}`]);
      assert.strictEqual(result.exitCode, 0);

      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.current, i);

      if (i === 10) {
        assert.strictEqual(output.complete, true);
        assert.strictEqual(output.percentage, 100);
      }
    }

    cleanupTestFile(id);
  });
});
