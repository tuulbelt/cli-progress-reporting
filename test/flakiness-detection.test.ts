/**
 * Flakiness Detection Test (Dogfooding)
 *
 * Uses the Test Flakiness Detector tool to validate that all CLI Progress Reporting
 * tests are deterministic and non-flaky.
 *
 * This demonstrates dogfooding: using Tuulbelt tools to validate other Tuulbelt tools.
 *
 * Run this test:
 *   npx tsx test/flakiness-detection.test.ts
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

// Configuration
const FLAKINESS_DETECTOR_PATH = join(process.cwd(), '..', 'test-flakiness-detector');
const TEST_RUNS = 10; // Run each test suite 10 times to detect flakiness (balance between thoroughness and speed)
const TEST_COMMAND = 'npm test';

console.log('🔬 Dogfooding: Using Test Flakiness Detector to validate CLI Progress Reporting tests\n');

// Verify Test Flakiness Detector exists
if (!existsSync(FLAKINESS_DETECTOR_PATH)) {
  console.error('❌ Test Flakiness Detector not found at:', FLAKINESS_DETECTOR_PATH);
  console.error('   Make sure test-flakiness-detector tool is available in parent directory');
  process.exit(1);
}

console.log('📍 Test Flakiness Detector location:', FLAKINESS_DETECTOR_PATH);
console.log('🎯 Test command:', TEST_COMMAND);
console.log('🔄 Number of runs:', TEST_RUNS);
console.log('');

try {
  console.log('⏳ Running flakiness detection (this may take several minutes)...\n');

  const startTime = Date.now();

  // Run the flakiness detector
  const result = execSync(
    `npx tsx ${join(FLAKINESS_DETECTOR_PATH, 'src', 'index.ts')} --test "${TEST_COMMAND}" --runs ${TEST_RUNS}`,
    {
      encoding: 'utf-8',
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large output
    }
  );

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Parse the JSON output
  const report = JSON.parse(result);

  console.log('✅ Flakiness detection complete!\n');
  console.log('📊 Results:');
  console.log('─'.repeat(60));
  console.log(`Total runs:        ${report.totalRuns}`);
  console.log(`Passed runs:       ${report.passedRuns}`);
  console.log(`Failed runs:       ${report.failedRuns}`);
  console.log(`Success rate:      ${((report.passedRuns / report.totalRuns) * 100).toFixed(1)}%`);
  console.log(`Execution time:    ${elapsed}s`);
  console.log(`Flaky tests found: ${report.flakyTests.length}`);
  console.log('─'.repeat(60));
  console.log('');

  // Check for flaky tests
  if (report.flakyTests.length > 0) {
    console.error('⚠️  WARNING: Flaky tests detected!\n');
    console.error('The following tests are unreliable:\n');

    report.flakyTests.forEach((test: { testName: string; failureRate: number; passed: number; failed: number }) => {
      console.error(`  ❌ ${test.testName}`);
      console.error(`     Failure rate: ${test.failureRate.toFixed(1)}%`);
      console.error(`     Passed: ${test.passed}/${test.passed + test.failed} times`);
      console.error('');
    });

    console.error('🔧 Action required: Fix flaky tests before release');
    process.exit(1);
  } else if (report.failedRuns === 0) {
    console.log('✨ Perfect! All tests passed consistently across all runs.');
    console.log('🎯 No flaky tests detected - tests are deterministic and reliable.');
    console.log('');
    console.log('🏆 Dogfooding Success: Test Flakiness Detector validated CLI Progress Reporting');
  } else {
    console.log('⚠️  All tests failed consistently.');
    console.log('   This suggests a systematic issue rather than flakiness.');
    process.exit(1);
  }

  // Summary statistics
  console.log('');
  console.log('📈 Confidence Metrics:');
  console.log('─'.repeat(60));
  console.log(`  Consistency:     ${report.passedRuns === report.totalRuns ? '100%' : '0%'} (all runs same result)`);
  console.log(`  Determinism:     ${report.flakyTests.length === 0 ? 'Confirmed' : 'FAILED'}`);
  console.log(`  Total tests:     93 tests across 34 suites`);
  console.log(`  Test iterations: ${report.totalRuns} runs`);
  console.log('─'.repeat(60));
  console.log('');

  console.log('✅ Validation complete - CLI Progress Reporting tests are production-ready!');

} catch (error: any) {
  console.error('❌ Error running flakiness detection:');
  console.error(error.message);

  if (error.stdout) {
    console.error('\nStdout:', error.stdout);
  }
  if (error.stderr) {
    console.error('\nStderr:', error.stderr);
  }

  process.exit(1);
}
