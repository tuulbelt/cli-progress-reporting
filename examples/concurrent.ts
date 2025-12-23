/**
 * Concurrent progress tracking example
 *
 * Shows how to track multiple independent progress states simultaneously.
 *
 * Run this example:
 *   npx tsx examples/concurrent.ts
 */

import { init, increment, get, finish, formatProgress, clear } from '../src/index.js';

console.log('=== CLI Progress Reporting - Concurrent Example ===\n');

// Simulate two concurrent tasks
const task1Config = { id: 'download-task' };
const task2Config = { id: 'upload-task' };

// Initialize both tasks
console.log('Initializing concurrent tasks...');
init(100, 'Downloading files', task1Config);
init(50, 'Uploading files', task2Config);
console.log();

// Simulate concurrent progress updates
console.log('Processing tasks concurrently...\n');

for (let i = 0; i < 10; i++) {
  // Update task 1 (faster)
  if (i * 10 < 100) {
    increment(10, `Downloaded file ${i + 1}`, task1Config);
  }

  // Update task 2 (slower)
  if (i * 5 < 50) {
    increment(5, `Uploaded file ${i + 1}`, task2Config);
  }

  // Check status of both tasks
  const status1 = get(task1Config);
  const status2 = get(task2Config);

  if (status1.ok && status2.ok) {
    console.log(`Step ${i + 1}:`);
    console.log(`  Download: ${formatProgress(status1.value)}`);
    console.log(`  Upload:   ${formatProgress(status2.value)}`);
    console.log();
  }
}

// Finish both tasks
console.log('Finishing tasks...');
finish('All downloads complete!', task1Config);
finish('All uploads complete!', task2Config);

const final1 = get(task1Config);
const final2 = get(task2Config);

if (final1.ok && final2.ok) {
  console.log('\nFinal Status:');
  console.log(`  Download: ${formatProgress(final1.value)}`);
  console.log(`  Upload:   ${formatProgress(final2.value)}`);
}

// Clean up
clear(task1Config);
clear(task2Config);
console.log('\nProgress files cleaned up');
