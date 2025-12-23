/**
 * Basic usage example for CLI Progress Reporting
 *
 * Run this example:
 *   npx tsx examples/basic.ts
 */

import { init, increment, get, finish, formatProgress, clear } from '../src/index.js';

const config = { id: 'basic-example' };

console.log('=== CLI Progress Reporting - Basic Example ===\n');

// Example 1: Initialize progress
console.log('Example 1: Initialize progress');
const initResult = init(10, 'Processing items', config);
if (initResult.ok) {
  console.log('Initialized:', formatProgress(initResult.value));
} else {
  console.error('Error:', initResult.error);
}
console.log();

// Example 2: Increment progress
console.log('Example 2: Increment progress');
for (let i = 1; i <= 5; i++) {
  const result = increment(1, `Processing item ${i}`, config);
  if (result.ok) {
    console.log(`  ${formatProgress(result.value)}`);
  }
}
console.log();

// Example 3: Get current progress
console.log('Example 3: Get current progress');
const getResult = get(config);
if (getResult.ok) {
  console.log('Current state:', formatProgress(getResult.value));
}
console.log();

// Example 4: Finish progress
console.log('Example 4: Finish progress');
const finishResult = finish('All items processed!', config);
if (finishResult.ok) {
  console.log('Final state:', formatProgress(finishResult.value));
}
console.log();

// Clean up
clear(config);
console.log('Progress file cleaned up');
