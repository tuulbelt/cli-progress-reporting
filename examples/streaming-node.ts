#!/usr/bin/env -S npx tsx
/**
 * Streaming API Example - Node.js Stream Integration
 *
 * Demonstrates using ProgressTransform with Node.js streams for
 * automatic progress tracking during stream processing.
 */

import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { Readable, Writable, Transform, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attachProgress, templates, createTemplateEngine } from '../src/index.js';

const pipelineAsync = promisify(pipeline);

// =============================================================================
// Example 1: File Processing with Progress
// =============================================================================

async function processFileWithProgress() {
  console.log('\n📊 Example 1: File Processing with Progress');
  console.log('=============================================\n');

  // Create a temporary test file
  const testFile = join(tmpdir(), 'test-input.txt');
  const outputFile = join(tmpdir(), 'test-output.txt');

  // Write test data (1000 lines)
  const testData = Array.from({ length: 1000 }, (_, i) => `Line ${i + 1}: Test data\n`).join('');
  createWriteStream(testFile).end(testData);

  // Wait for file to be written
  await new Promise((resolve) => setTimeout(resolve, 100));

  const fileSize = statSync(testFile).size;
  console.log(`📄 Processing file (${fileSize} bytes)...\n`);

  // Create read stream
  const readStream = createReadStream(testFile);

  // Attach progress tracking
  const progressStream = attachProgress({
    total: fileSize,
    message: 'Reading file',
    id: 'stream-example-1',
    updateInterval: fileSize / 10, // Update every 10%
  });

  // Create template engine for rendering
  const engine = createTemplateEngine();

  // Listen to progress events
  progressStream.on('progress', (state) => {
    const bar = engine.render(templates.bar, state);
    process.stdout.write(`\r${bar}`);
  });

  // Transform stream (uppercase conversion)
  const transformStream = new Transform({
    transform(chunk, encoding, callback) {
      callback(null, chunk.toString().toUpperCase());
    },
  });

  // Write stream
  const writeStream = createWriteStream(outputFile);

  // Pipe everything together
  await pipelineAsync(readStream, progressStream, transformStream, writeStream);

  console.log('\n\n✓ File processed successfully!\n');
}

// =============================================================================
// Example 2: Streaming Data Processing
// =============================================================================

async function streamingDataProcessing() {
  console.log('📊 Example 2: Streaming Data Processing');
  console.log('=========================================\n');

  // Create data chunks (100 chunks of 1KB each)
  const chunkSize = 1024;
  const chunkCount = 100;
  const totalSize = chunkSize * chunkCount;

  console.log(`📦 Processing ${chunkCount} chunks (${totalSize} bytes)...\n`);

  // Create readable stream
  let chunksEmitted = 0;
  const dataStream = new Readable({
    read() {
      if (chunksEmitted < chunkCount) {
        this.push(Buffer.alloc(chunkSize, 'x'));
        chunksEmitted++;
      } else {
        this.push(null); // End of stream
      }
    },
  });

  // Attach progress
  const progressStream = attachProgress({
    total: totalSize,
    message: 'Streaming data',
    id: 'stream-example-2',
    updateInterval: chunkSize * 5, // Update every 5 chunks
  });

  const engine = createTemplateEngine();
  let lastPercentage = -1;

  progressStream.on('progress', (state) => {
    if (state.percentage !== lastPercentage) {
      const progress = engine.render(templates.percentage, state);
      console.log(progress);
      lastPercentage = state.percentage;
    }
  });

  // Consuming writable stream
  let bytesReceived = 0;
  const consumeStream = new Writable({
    write(chunk, encoding, callback) {
      bytesReceived += chunk.length;
      callback();
    },
  });

  await pipelineAsync(dataStream, progressStream, consumeStream);

  console.log(`\n✓ Processed ${bytesReceived} bytes!\n`);
}

// =============================================================================
// Example 3: CSV Processing with Progress
// =============================================================================

async function csvProcessingWithProgress() {
  console.log('📊 Example 3: CSV Processing with Progress');
  console.log('===========================================\n');

  // Generate CSV data
  const csvFile = join(tmpdir(), 'data.csv');
  const lines = ['id,name,value'];
  for (let i = 1; i <= 500; i++) {
    lines.push(`${i},User ${i},${Math.random() * 100}`);
  }
  const csvData = lines.join('\n');
  createWriteStream(csvFile).end(csvData);

  await new Promise((resolve) => setTimeout(resolve, 100));

  const fileSize = statSync(csvFile).size;
  console.log(`📊 Processing CSV (${fileSize} bytes, ${lines.length} rows)...\n`);

  const readStream = createReadStream(csvFile);

  const progressStream = attachProgress({
    total: fileSize,
    message: 'Processing CSV',
    id: 'stream-example-3',
  });

  const engine = createTemplateEngine();

  progressStream.on('progress', (state) => {
    const detailed = engine.render(templates.detailed, state);
    process.stdout.write(`\r${detailed}`);
  });

  // Simple CSV parser (split by newline)
  let rowCount = 0;
  const parseStream = new Transform({
    transform(chunk, encoding, callback) {
      const lines = chunk.toString().split('\n');
      rowCount += lines.length;
      callback(null, chunk);
    },
  });

  const outputStream = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });

  await pipelineAsync(readStream, progressStream, parseStream, outputStream);

  console.log(`\n\n✓ Processed ${rowCount} rows!\n`);
}

// =============================================================================
// Example 4: Error Handling in Streams
// =============================================================================

async function streamErrorHandling() {
  console.log('📊 Example 4: Stream Error Handling');
  console.log('====================================\n');

  // Create a stream that will emit an error
  const errorStream = new Readable({
    read() {
      setTimeout(() => {
        this.emit('error', new Error('Simulated stream error'));
      }, 100);
    },
  });

  const progressStream = attachProgress({
    total: 1000,
    message: 'Processing with errors',
    id: 'stream-example-4',
  });

  progressStream.on('progress', (state) => {
    console.log(`Progress: ${state.percentage}%`);
  });

  const consumeStream = new Writable({
    write(chunk, encoding, callback) {
      callback();
    },
  });

  try {
    await pipelineAsync(errorStream, progressStream, consumeStream);
  } catch (error) {
    console.log(`\n❌ Caught error: ${error instanceof Error ? error.message : error}`);
    console.log('✓ Error handled gracefully!\n');
  }
}

// =============================================================================
// Run Examples
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Streaming API - Node.js Stream Examples                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await processFileWithProgress();
  await streamingDataProcessing();
  await csvProcessingWithProgress();
  await streamErrorHandling();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  All examples completed!                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
