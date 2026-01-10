/**
 * Example: Using the Fluent Builder API
 *
 * Demonstrates the modern, chainable builder pattern for creating
 * progress trackers with clean, readable syntax.
 *
 * Run: npx tsx examples/builder-api.ts
 */

import { createProgress } from '../src/index.js';

async function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Builder API Example\n');

  // Create a progress tracker using the fluent builder API
  const progress = createProgress()
    .id('builder-demo')
    .total(10)
    .message('Processing items with builder API')
    .build();

  console.log('Starting processing...\n');

  // Process items
  for (let i = 1; i <= 10; i++) {
    await simulateWork(200);

    const result = progress.increment(1, `Processed item ${i}`);

    if (result.ok) {
      const { percentage, current, total, message } = result.value;
      console.log(`[${percentage}%] ${current}/${total} - ${message}`);
    }
  }

  // Mark as finished
  const finishResult = progress.finish('All items processed!');

  if (finishResult.ok) {
    const { message, complete } = finishResult.value;
    console.log(`\n✅ ${message} (complete: ${complete})`);
  }

  // Clean up
  progress.clear();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
