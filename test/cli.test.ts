/**
 * CLI Integration Tests
 *
 * Tests the actual CLI entry point by spawning processes.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { unlinkSync, existsSync } from 'node:fs';
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

describe('CLI - help', () => {
  test('shows help with --help flag', () => {
    const result = runCLI(['--help'], true);

    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('Usage:'));
    assert(result.stdout.includes('Commands:'));
    assert(result.stdout.includes('init'));
    assert(result.stdout.includes('increment'));
  });

  test('shows help with -h flag', () => {
    const result = runCLI(['-h'], true);

    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('Usage:'));
  });

  test('shows help with no arguments', () => {
    const result = runCLI([], true);

    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('Usage:'));
  });
});

describe('CLI - init', () => {
  test('initializes progress successfully', () => {
    const id = getTestId();
    const result = runCLI(['init', '--total', '10', '--message', 'Test', '--id', id]);

    assert.strictEqual(result.exitCode, 0);

    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.total, 10);
    assert.strictEqual(output.current, 0);
    assert.strictEqual(output.message, 'Test');

    cleanupTestFile(id);
  });

  test('fails without required --total', () => {
    const id = getTestId();
    const result = runCLI(['init', '--message', 'Test', '--id', id], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('requires --total'));

    cleanupTestFile(id);
  });

  test('fails without required --message', () => {
    const id = getTestId();
    const result = runCLI(['init', '--total', '10', '--id', id], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('requires --total and --message'));

    cleanupTestFile(id);
  });

  test('fails with zero total', () => {
    const id = getTestId();
    const result = runCLI(['init', '--total', '0', '--message', 'Test', '--id', id], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('greater than 0'));

    cleanupTestFile(id);
  });

  test('handles message with spaces', () => {
    const id = getTestId();
    const result = runCLI(['init', '--total', '5', '--message', 'Processing multiple files', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.message, 'Processing multiple files');

    cleanupTestFile(id);
  });

  test('handles message with special characters', () => {
    const id = getTestId();
    const result = runCLI(['init', '--total', '5', '--message', 'File: /tmp/test-[123].txt', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.message, 'File: /tmp/test-[123].txt');

    cleanupTestFile(id);
  });
});

describe('CLI - increment', () => {
  test('increments progress successfully', () => {
    const id = getTestId();

    // Initialize first
    runCLI(['init', '--total', '10', '--message', 'Start', '--id', id]);

    // Increment
    const result = runCLI(['increment', '--amount', '3', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 3);
    assert.strictEqual(output.percentage, 30);

    cleanupTestFile(id);
  });

  test('increments by 1 when --amount not specified', () => {
    const id = getTestId();

    runCLI(['init', '--total', '10', '--message', 'Start', '--id', id]);
    const result = runCLI(['increment', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 1);

    cleanupTestFile(id);
  });

  test('updates message when provided', () => {
    const id = getTestId();

    runCLI(['init', '--total', '10', '--message', 'Start', '--id', id]);
    const result = runCLI(['increment', '--amount', '1', '--message', 'Updated', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.message, 'Updated');

    cleanupTestFile(id);
  });

  test('fails when not initialized', () => {
    const id = getTestId();
    const result = runCLI(['increment', '--id', id], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('does not exist'));

    cleanupTestFile(id);
  });
});

describe('CLI - set', () => {
  test('sets absolute progress value', () => {
    const id = getTestId();

    runCLI(['init', '--total', '100', '--message', 'Start', '--id', id]);
    const result = runCLI(['set', '--current', '75', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 75);
    assert.strictEqual(output.percentage, 75);

    cleanupTestFile(id);
  });

  test('fails without --current', () => {
    const id = getTestId();

    runCLI(['init', '--total', '100', '--message', 'Start', '--id', id]);
    const result = runCLI(['set', '--id', id], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('requires --current'));

    cleanupTestFile(id);
  });
});

describe('CLI - get', () => {
  test('retrieves current progress', () => {
    const id = getTestId();

    runCLI(['init', '--total', '50', '--message', 'Testing', '--id', id]);
    runCLI(['increment', '--amount', '10', '--id', id]);

    const result = runCLI(['get', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.current, 10);
    assert.strictEqual(output.total, 50);

    cleanupTestFile(id);
  });

  test('fails when not initialized', () => {
    const id = getTestId();
    const result = runCLI(['get', '--id', id], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('does not exist'));

    cleanupTestFile(id);
  });
});

describe('CLI - finish', () => {
  test('marks progress as complete', () => {
    const id = getTestId();

    runCLI(['init', '--total', '20', '--message', 'Start', '--id', id]);
    const result = runCLI(['finish', '--message', 'Done!', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.complete, true);
    assert.strictEqual(output.current, 20);
    assert.strictEqual(output.percentage, 100);
    assert.strictEqual(output.message, 'Done!');

    cleanupTestFile(id);
  });

  test('works without message', () => {
    const id = getTestId();

    runCLI(['init', '--total', '10', '--message', 'Start', '--id', id]);
    const result = runCLI(['finish', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    const output = JSON.parse(result.stdout);
    assert.strictEqual(output.complete, true);

    cleanupTestFile(id);
  });
});

describe('CLI - clear', () => {
  test('removes progress file', () => {
    const id = getTestId();
    const filePath = join(tmpdir(), `progress-${id}.json`);

    runCLI(['init', '--total', '10', '--message', 'Test', '--id', id]);
    assert.strictEqual(existsSync(filePath), true);

    const result = runCLI(['clear', '--id', id]);

    assert.strictEqual(result.exitCode, 0);
    assert(result.stdout.includes('Success'));
    assert.strictEqual(existsSync(filePath), false);
  });

  test('succeeds even if file does not exist', () => {
    const id = getTestId();
    const result = runCLI(['clear', '--id', id]);

    assert.strictEqual(result.exitCode, 0);

    cleanupTestFile(id);
  });
});

describe('CLI - error handling', () => {
  test('handles unknown command', () => {
    const result = runCLI(['unknown-command'], false);

    assert.strictEqual(result.exitCode, 1);
    assert(result.stderr.includes('Unknown command'));
  });

  test('handles invalid number for --total', () => {
    const id = getTestId();
    const result = runCLI(['init', '--total', 'abc', '--message', 'Test', '--id', id], false);

    // parseInt('abc') returns NaN, which should fail validation
    assert.strictEqual(result.exitCode, 1);

    cleanupTestFile(id);
  });
});

describe('CLI - end-to-end workflow', () => {
  test('complete workflow: init -> increment -> set -> finish -> clear', () => {
    const id = getTestId();

    // Initialize
    let result = runCLI(['init', '--total', '100', '--message', 'Starting', '--id', id]);
    assert.strictEqual(result.exitCode, 0);

    // Increment
    result = runCLI(['increment', '--amount', '25', '--id', id]);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(JSON.parse(result.stdout).current, 25);

    // Set
    result = runCLI(['set', '--current', '75', '--id', id]);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(JSON.parse(result.stdout).current, 75);

    // Finish
    result = runCLI(['finish', '--message', 'Complete', '--id', id]);
    assert.strictEqual(result.exitCode, 0);
    assert.strictEqual(JSON.parse(result.stdout).complete, true);

    // Clear
    result = runCLI(['clear', '--id', id]);
    assert.strictEqual(result.exitCode, 0);
  });

  test('multiple increments in sequence', () => {
    const id = getTestId();

    runCLI(['init', '--total', '10', '--message', 'Start', '--id', id]);

    for (let i = 1; i <= 10; i++) {
      const result = runCLI(['increment', '--amount', '1', '--message', `Step ${i}`, '--id', id]);
      assert.strictEqual(result.exitCode, 0);

      const output = JSON.parse(result.stdout);
      assert.strictEqual(output.current, i);

      if (i === 10) {
        assert.strictEqual(output.complete, true);
      }
    }

    cleanupTestFile(id);
  });
});

describe('CLI - default ID behavior', () => {
  test('uses default ID when not specified', () => {
    // Clean up default first
    cleanupTestFile('default');

    const result = runCLI(['init', '--total', '5', '--message', 'Default test']);
    assert.strictEqual(result.exitCode, 0);

    const filePath = join(tmpdir(), 'progress-default.json');
    assert.strictEqual(existsSync(filePath), true);

    cleanupTestFile('default');
  });
});
