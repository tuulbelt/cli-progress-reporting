#!/usr/bin/env node --import tsx
/**
 * CLI Progress Reporting Benchmarks
 *
 * Measures performance of core operations using tatami-ng for statistical rigor.
 *
 * Run: npm run bench
 *
 * See: /docs/BENCHMARKING_STANDARDS.md
 */

import { bench, baseline, group, run } from 'tatami-ng';
import { ProgressReporter, ProgressState } from '../src/index.ts';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Prevent dead code elimination
let result: ProgressReporter | ProgressState | undefined;
let tempDir: string;

// Setup/teardown
function setup() {
  tempDir = mkdtempSync(join(tmpdir(), 'prog-bench-'));
}

function teardown() {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

// ============================================================================
// Core Operations Benchmarks
// ============================================================================

group('Progress Reporter Creation', () => {
  setup();

  baseline('create: basic reporter', () => {
    result = new ProgressReporter({
      total: 100,
      stateDir: tempDir,
    });
  });

  bench('create: with custom message', () => {
    result = new ProgressReporter({
      total: 100,
      message: 'Processing files',
      stateDir: tempDir,
    });
  });

  teardown();
});

group('Progress Updates', () => {
  setup();
  const reporter = new ProgressReporter({
    total: 1000,
    stateDir: tempDir,
  });

  baseline('update: increment', () => {
    reporter.increment();
  });

  bench('update: set progress', () => {
    reporter.setProgress(500);
  });

  bench('update: with message', () => {
    reporter.setMessage('Step 500 of 1000');
  });

  teardown();
});

group('State Reading', () => {
  setup();
  const reporter = new ProgressReporter({
    total: 100,
    stateDir: tempDir,
  });
  reporter.setProgress(50);

  baseline('read: get state', () => {
    result = reporter.getState();
  });

  teardown();
});

// ============================================================================
// Run Benchmarks
// ============================================================================

await run({
  units: false,
  silent: false,
  json: false,
});
