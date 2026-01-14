/**
 * Tests for Streaming API (ProgressStream and stream wrapper)
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync, unlinkSync } from 'node:fs';
import { ProgressStream, createProgressStream, attachProgress, ProgressTransform } from '../src/index.js';

const pipelineAsync = promisify(pipeline);

// Test helper: Generate unique test ID
let testCounter = 0;
function getTestId(): string {
  return `streaming-test-${Date.now()}-${testCounter++}`;
}

// Test helper: Clean up progress files
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

// =============================================================================
// Async Generator Tests (ProgressStream) - 8 tests
// =============================================================================

describe('ProgressStream - Async Generator Integration', () => {
  test('creates ProgressStream with required config', () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 100,
      message: 'Test progress',
      id,
    });

    assert(stream);
    assert(typeof stream.next === 'function');
    assert(typeof stream.return === 'function');
    assert(typeof stream.throw === 'function');

    cleanupTestFile(id);
  });

  test('createProgressStream factory works', () => {
    const id = getTestId();
    const stream = createProgressStream({
      total: 50,
      message: 'Factory test',
      id,
    });

    assert(stream instanceof ProgressStream);
    cleanupTestFile(id);
  });

  test('ProgressStream auto-increments on next()', async () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 10,
      message: 'Counting',
      id,
      incrementAmount: 2,
    });

    // First next()
    const result1 = await stream.next();
    assert.strictEqual(result1.done, false);
    assert.strictEqual(result1.value?.current, 2);
    assert.strictEqual(result1.value?.percentage, 20);

    // Second next()
    const result2 = await stream.next();
    assert.strictEqual(result2.done, false);
    assert.strictEqual(result2.value?.current, 4);
    assert.strictEqual(result2.value?.percentage, 40);

    await stream.return();
    cleanupTestFile(id);
  });

  test('ProgressStream works in for-await-of loop', async () => {
    const id = getTestId();
    const items = ['a', 'b', 'c', 'd', 'e'];

    async function* processItems() {
      const stream = new ProgressStream({
        total: items.length,
        message: 'Processing items',
        id,
      });

      for (const item of items) {
        const result = await stream.next();
        if (!result.done && result.value) {
          yield result.value; // Yield the ProgressState, not IteratorResult
        }
      }

      await stream.return();
    }

    let iterations = 0;
    for await (const state of processItems()) {
      iterations++;
      assert.strictEqual(state.current, iterations);
      assert.strictEqual(state.total, 5);
    }

    assert.strictEqual(iterations, 5);
    cleanupTestFile(id);
  });

  test('ProgressStream return() marks as complete', async () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 100,
      message: 'Test',
      id,
    });

    await stream.next();
    await stream.next();

    const result = await stream.return();
    assert.strictEqual(result.done, true);
    assert.strictEqual(result.value?.complete, true);

    // Subsequent next() should return done
    const result2 = await stream.next();
    assert.strictEqual(result2.done, true);

    cleanupTestFile(id);
  });

  test('ProgressStream throw() handles errors', async () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 100,
      message: 'Test',
      id,
    });

    await stream.next();

    const error = new Error('Test error');
    try {
      await stream.throw(error);
      assert.fail('Should have thrown error');
    } catch (err) {
      assert.strictEqual(err, error);
    }

    cleanupTestFile(id);
  });

  test('ProgressStream tracks percentage correctly', async () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 200,
      message: 'Percentage test',
      id,
      incrementAmount: 50,
    });

    const r1 = await stream.next();
    assert.strictEqual(r1.value?.percentage, 25);

    const r2 = await stream.next();
    assert.strictEqual(r2.value?.percentage, 50);

    const r3 = await stream.next();
    assert.strictEqual(r3.value?.percentage, 75);

    const r4 = await stream.next();
    assert.strictEqual(r4.value?.percentage, 100);

    await stream.return();
    cleanupTestFile(id);
  });

  test('ProgressStream custom incrementAmount works', async () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 100,
      message: 'Custom increment',
      id,
      incrementAmount: 10,
    });

    const r1 = await stream.next();
    assert.strictEqual(r1.value?.current, 10);

    const r2 = await stream.next();
    assert.strictEqual(r2.value?.current, 20);

    await stream.return();
    cleanupTestFile(id);
  });
});

// =============================================================================
// Stream Integration Tests (ProgressTransform) - 7 tests
// =============================================================================

describe('ProgressTransform - Node.js Stream Integration', () => {
  test('creates ProgressTransform with required config', () => {
    const id = getTestId();
    const transform = new ProgressTransform({
      total: 1000,
      message: 'Stream test',
      id,
    });

    assert(transform);
    assert(typeof transform.pipe === 'function');

    cleanupTestFile(id);
  });

  test('attachProgress factory works', () => {
    const id = getTestId();
    const transform = attachProgress({
      total: 500,
      message: 'Factory test',
      id,
    });

    assert(transform instanceof ProgressTransform);
    cleanupTestFile(id);
  });

  test('ProgressTransform tracks bytes through stream', async () => {
    const id = getTestId();
    const data = Buffer.from('Hello, World!'); // 13 bytes
    const totalSize = data.length;

    const progressTransform = new ProgressTransform({
      total: totalSize,
      message: 'Processing',
      id,
    });

    const progressEvents: number[] = [];
    progressTransform.on('progress', (state) => {
      progressEvents.push(state.current);
    });

    // Create readable stream from data
    const readable = Readable.from([data]);

    // Pipe through progress transform to writable
    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk, encoding, callback) {
        chunks.push(chunk);
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);

    // Verify data passed through
    const result = Buffer.concat(chunks).toString();
    assert.strictEqual(result, 'Hello, World!');

    // Verify progress was tracked
    assert(progressEvents.length > 0);
    assert.strictEqual(progressEvents[progressEvents.length - 1], totalSize);

    cleanupTestFile(id);
  });

  test('ProgressTransform emits progress events', async () => {
    const id = getTestId();
    const chunks = [Buffer.from('chunk1'), Buffer.from('chunk2'), Buffer.from('chunk3')];
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    const progressTransform = new ProgressTransform({
      total: totalSize,
      message: 'Chunks',
      id,
    });

    let progressEventCount = 0;
    let lastState: any = null;

    progressTransform.on('progress', (state) => {
      progressEventCount++;
      lastState = state;
    });

    const readable = Readable.from(chunks);
    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);

    assert(progressEventCount > 0);
    assert.strictEqual(lastState.complete, true);
    assert.strictEqual(lastState.current, totalSize);

    cleanupTestFile(id);
  });

  test('ProgressTransform updateInterval throttles events', async () => {
    const id = getTestId();
    const chunks = Array.from({ length: 10 }, (_, i) => Buffer.from(`chunk${i}`)); // 10 small chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    const progressTransform = new ProgressTransform({
      total: totalSize,
      message: 'Throttled',
      id,
      updateInterval: 1000, // Only emit when 1000+ bytes accumulated
    });

    let progressEventCount = 0;
    progressTransform.on('progress', () => {
      progressEventCount++;
    });

    const readable = Readable.from(chunks);
    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);

    // Should have fewer events than chunks due to throttling
    // (Final event always emitted on flush)
    assert(progressEventCount >= 1); // At least the final event
    assert(progressEventCount <= chunks.length); // Not more than chunks

    cleanupTestFile(id);
  });

  test('ProgressTransform getProgress() returns current state', async () => {
    const id = getTestId();
    const data = Buffer.from('test data');

    const progressTransform = new ProgressTransform({
      total: data.length,
      message: 'State check',
      id,
    });

    // Initial state (0 bytes processed)
    const initialState = progressTransform.getProgress();
    assert.strictEqual(initialState.ok, true);
    if (initialState.ok) {
      assert.strictEqual(initialState.value.current, 0);
    }

    // Process data
    const readable = Readable.from([data]);
    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);

    // Final state (all bytes processed)
    const finalState = progressTransform.getProgress();
    assert.strictEqual(finalState.ok, true);
    if (finalState.ok) {
      assert.strictEqual(finalState.value.current, data.length);
      assert.strictEqual(finalState.value.complete, true);
    }

    cleanupTestFile(id);
  });

  test('ProgressTransform handles large data streams', async () => {
    const id = getTestId();
    const chunkSize = 1024; // 1KB chunks
    const chunkCount = 100; // 100KB total
    const totalSize = chunkSize * chunkCount;

    const chunks = Array.from({ length: chunkCount }, () => Buffer.alloc(chunkSize, 'x'));

    const progressTransform = new ProgressTransform({
      total: totalSize,
      message: 'Large stream',
      id,
      updateInterval: chunkSize * 10, // Emit every 10 chunks
    });

    let bytesReceived = 0;
    const writable = new Writable({
      write(chunk, encoding, callback) {
        bytesReceived += chunk.length;
        callback();
      },
    });

    const readable = Readable.from(chunks);
    await pipelineAsync(readable, progressTransform, writable);

    assert.strictEqual(bytesReceived, totalSize);

    cleanupTestFile(id);
  });
});

// =============================================================================
// Error Handling Tests - 5 tests
// =============================================================================

describe('Streaming API - Error Handling', () => {
  test('ProgressStream throws on increment error', async () => {
    const id = getTestId();
    // Create with negative total to trigger error during construction
    try {
      const stream = new ProgressStream({
        total: -10,
        message: 'Invalid total',
        id,
      });
      assert.fail('Should have thrown error during construction');
    } catch (err) {
      assert(err instanceof Error);
      assert(err.message.includes('Failed to initialize progress tracker'));
    }

    cleanupTestFile(id);
  });

  test('ProgressStream return() after error still works', async () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 10,
      message: 'Test',
      id,
    });

    // Manually trigger error via throw
    try {
      await stream.throw(new Error('Test error'));
    } catch {
      // Expected
    }

    // return() should still work
    const result = await stream.return();
    assert.strictEqual(result.done, true);

    cleanupTestFile(id);
  });

  test('ProgressTransform handles stream errors gracefully', async () => {
    const id = getTestId();

    const progressTransform = new ProgressTransform({
      total: 100,
      message: 'Error test',
      id,
    });

    // Create a readable that emits an error
    const readable = new Readable({
      read() {
        this.emit('error', new Error('Stream error'));
      },
    });

    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    try {
      await pipelineAsync(readable, progressTransform, writable);
      assert.fail('Should have thrown error');
    } catch (err) {
      assert(err instanceof Error);
      assert.strictEqual(err.message, 'Stream error');
    }

    cleanupTestFile(id);
  });

  test('ProgressStream handles multiple return() calls safely', async () => {
    const id = getTestId();
    const stream = new ProgressStream({
      total: 10,
      message: 'Multiple returns',
      id,
    });

    await stream.next();

    const result1 = await stream.return();
    assert.strictEqual(result1.done, true);

    const result2 = await stream.return();
    assert.strictEqual(result2.done, true);

    const result3 = await stream.return();
    assert.strictEqual(result3.done, true);

    cleanupTestFile(id);
  });

  test('ProgressTransform handles backpressure correctly', async () => {
    const id = getTestId();
    const chunks = Array.from({ length: 50 }, (_, i) => Buffer.from(`chunk${i}`));
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    const progressTransform = new ProgressTransform({
      total: totalSize,
      message: 'Backpressure test',
      id,
    });

    // Slow writable stream to create backpressure
    const receivedChunks: Buffer[] = [];
    const slowWritable = new Writable({
      highWaterMark: 5, // Low watermark to trigger backpressure
      write(chunk, encoding, callback) {
        receivedChunks.push(chunk);
        // Simulate slow processing
        setTimeout(() => callback(), 5);
      },
    });

    const readable = Readable.from(chunks);
    await pipelineAsync(readable, progressTransform, slowWritable);

    assert.strictEqual(receivedChunks.length, chunks.length);

    cleanupTestFile(id);
  });
});
