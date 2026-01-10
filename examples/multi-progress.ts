/**
 * Example: Managing Multiple Progress Trackers
 *
 * Demonstrates tracking multiple independent progress states
 * simultaneously using the MultiProgress API.
 *
 * Run: npx tsx examples/multi-progress.ts
 */

import { MultiProgress } from '../src/index.js';

async function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('MultiProgress Example\n');

  const multi = new MultiProgress();

  // Create multiple trackers for different tasks
  const downloads = multi.create('downloads', 20, 'Downloading files');
  const uploads = multi.create('uploads', 15, 'Uploading results');
  const processing = multi.create('processing', 30, 'Processing data');

  console.log('Starting multiple tasks...\n');

  // Simulate concurrent progress updates
  for (let i = 0; i < 30; i++) {
    await simulateWork(100);

    // Update different trackers at different rates
    if (i < 20) {
      downloads.increment(1, `Downloaded file ${i + 1}`);
    }
    if (i < 15) {
      uploads.increment(1, `Uploaded result ${i + 1}`);
    }
    processing.increment(1, `Processed item ${i + 1}`);

    // Display all progress states
    const allStates = multi.getAll();
    if (allStates.ok) {
      console.clear();
      console.log('MultiProgress Status:\n');

      for (const [id, state] of Object.entries(allStates.value)) {
        const bar = createSimpleBar(state.percentage);
        console.log(
          `${id.padEnd(12)} ${bar} ${state.percentage.toFixed(0)}% - ${state.message}`
        );
      }
    }
  }

  // Finish all trackers
  console.log('\n\nFinalizing...\n');
  downloads.finish('All files downloaded');
  uploads.finish('All results uploaded');
  processing.finish('All items processed');

  // Display final status
  const finalStates = multi.getAll();
  if (finalStates.ok) {
    console.log('Final Status:\n');
    for (const [id, state] of Object.entries(finalStates.value)) {
      console.log(
        `✅ ${id.padEnd(12)} - ${state.message} (${state.current}/${state.total})`
      );
    }
  }

  // Clean up all trackers
  multi.clearAll();
}

function createSimpleBar(percentage: number): string {
  const width = 20;
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
