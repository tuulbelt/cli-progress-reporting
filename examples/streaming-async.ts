#!/usr/bin/env -S npx tsx
/**
 * Streaming API Example - Async Generator Integration
 *
 * Demonstrates using ProgressStream with async generators for
 * automatic progress tracking during asynchronous iteration.
 */

import { ProgressStream } from '../src/index.js';

// =============================================================================
// Example 1: Basic Async Generator with Progress
// =============================================================================

async function* processRecords(records: Array<{ id: number; data: string }>) {
  const stream = new ProgressStream({
    total: records.length,
    message: 'Processing records',
    id: 'async-example-1',
  });

  console.log('\n📊 Example 1: Basic Async Generator');
  console.log('=====================================\n');

  for (const record of records) {
    // Simulate async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Validate record
    if (!record.data || record.data.length === 0) {
      throw new Error(`Invalid record ${record.id}`);
    }

    // Auto-increment progress and yield state
    const result = await stream.next();
    if (!result.done && result.value) {
      const state = result.value;
      console.log(
        `✓ Record ${record.id}: ${state.current}/${state.total} (${state.percentage}%)`
      );
      yield state;
    }
  }

  await stream.return();
  console.log('✓ All records processed!\n');
}

// =============================================================================
// Example 2: Multi-Step Processing Pipeline
// =============================================================================

interface DataItem {
  id: number;
  value: string;
  processed?: boolean;
}

async function* dataPipeline(items: DataItem[]) {
  const stream = new ProgressStream({
    total: items.length * 3, // 3 steps per item
    message: 'Running pipeline',
    id: 'async-example-2',
    incrementAmount: 1,
  });

  console.log('📊 Example 2: Multi-Step Pipeline');
  console.log('===================================\n');

  for (const item of items) {
    // Step 1: Validate
    await new Promise((resolve) => setTimeout(resolve, 50));
    const validateResult = await stream.next();
    if (!validateResult.done && validateResult.value) {
      console.log(`  Validate ${item.id}: ${validateResult.value.percentage}%`);
    }

    // Step 2: Transform
    await new Promise((resolve) => setTimeout(resolve, 50));
    item.value = item.value.toUpperCase();
    const transformResult = await stream.next();
    if (!transformResult.done && transformResult.value) {
      console.log(`  Transform ${item.id}: ${transformResult.value.percentage}%`);
    }

    // Step 3: Save
    await new Promise((resolve) => setTimeout(resolve, 50));
    item.processed = true;
    const saveResult = await stream.next();
    if (!saveResult.done && saveResult.value) {
      console.log(`  Save ${item.id}: ${saveResult.value.percentage}%`);
      yield saveResult.value;
    }
  }

  await stream.return();
  console.log('\n✓ Pipeline complete!\n');
}

// =============================================================================
// Example 3: Error Handling in Async Generator
// =============================================================================

async function* processWithErrors(items: string[]) {
  const stream = new ProgressStream({
    total: items.length,
    message: 'Processing with error handling',
    id: 'async-example-3',
  });

  console.log('📊 Example 3: Error Handling');
  console.log('==============================\n');

  try {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Simulate error on 3rd item
      if (i === 2) {
        throw new Error('Processing failed for item 3');
      }

      const result = await stream.next();
      if (!result.done && result.value) {
        console.log(`✓ Processed: ${item} (${result.value.percentage}%)`);
        yield result.value;
      }
    }

    await stream.return();
  } catch (error) {
    // Handle error and mark progress as failed
    console.error(`\n❌ Error: ${error instanceof Error ? error.message : error}\n`);
    await stream.throw(error);
  }
}

// =============================================================================
// Example 4: Consuming Progress Stream
// =============================================================================

async function consumeProgressStream() {
  console.log('📊 Example 4: Consuming Progress Stream');
  console.log('=========================================\n');

  const data = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    value: `item-${i + 1}`,
  }));

  // Use for-await-of to consume the generator
  for await (const state of dataPipeline(data)) {
    // You can use the state for custom rendering, logging, etc.
    if (state.percentage % 20 === 0) {
      console.log(`\n  📈 Milestone: ${state.percentage}% complete\n`);
    }
  }

  console.log('✓ Stream consumed successfully!\n');
}

// =============================================================================
// Run Examples
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Streaming API - Async Generator Examples                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Example 1: Basic async generator
  const records = [
    { id: 1, data: 'record-1' },
    { id: 2, data: 'record-2' },
    { id: 3, data: 'record-3' },
    { id: 4, data: 'record-4' },
    { id: 5, data: 'record-5' },
  ];

  for await (const state of processRecords(records)) {
    // Stream consumed in for-await-of loop
  }

  // Example 2 & 4: Multi-step pipeline with consumer
  await consumeProgressStream();

  // Example 3: Error handling
  const items = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'];
  try {
    for await (const state of processWithErrors(items)) {
      // Process until error
    }
  } catch {
    // Error already handled in generator
  }

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  All examples completed!                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
