#!/usr/bin/env -S npx tsx
/**
 * Performance Benchmarks for CLI Progress Reporting
 *
 * Uses tatami-ng for statistical rigor (criterion-equivalent for Node.js)
 */

import { bench, baseline, group, run } from 'tatami-ng';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createProgress,
  MultiProgress,
  templates,
  createTemplateEngine,
  ProgressStream,
  ProgressTransform,
  type ProgressState,
} from '../src/index.js';
import { Readable, Writable, pipeline } from 'node:stream';
import { promisify } from 'node:util';

const pipelineAsync = promisify(pipeline);

// Prevent dead code elimination
let result: any;

// Generate unique IDs for concurrent tests
let benchCounter = 0;
function getBenchId(): string {
  return `bench-${Date.now()}-${benchCounter++}`;
}

// =============================================================================
// Single Progress Operations
// =============================================================================

group('Single Progress Operations', () => {
  baseline('init + increment + done', () => {
    const id = getBenchId();
    const progress = createProgress({
      total: 100,
      message: 'Processing',
      id,
    });
    progress.increment(1);
    result = progress.done();
  });

  bench('init + update + done', () => {
    const id = getBenchId();
    const progress = createProgress({
      total: 100,
      message: 'Processing',
      id,
    });
    progress.update(50);
    result = progress.done();
  });

  bench('init + get + done', () => {
    const id = getBenchId();
    const progress = createProgress({
      total: 100,
      message: 'Processing',
      id,
    });
    result = progress.get();
    progress.done();
  });

  bench('init + update message + done', () => {
    const id = getBenchId();
    const progress = createProgress({
      total: 100,
      message: 'Processing',
      id,
    });
    progress.increment(1, 'Updated message');
    result = progress.done();
  });

  bench('init + multiple increments (10) + done', () => {
    const id = getBenchId();
    const progress = createProgress({
      total: 100,
      message: 'Processing',
      id,
    });
    for (let i = 0; i < 10; i++) {
      progress.increment(1);
    }
    result = progress.done();
  });
});

// =============================================================================
// Multi-Progress Operations
// =============================================================================

group('Multi-Progress Operations', () => {
  baseline('create MultiProgress + add 1 tracker', () => {
    const id = getBenchId();
    const multi = new MultiProgress({ id });
    result = multi.add({ trackerId: 'tracker-1', total: 100, message: 'Task 1' });
  });

  bench('create MultiProgress + add 5 trackers', () => {
    const id = getBenchId();
    const multi = new MultiProgress({ id });
    for (let i = 0; i < 5; i++) {
      multi.add({ trackerId: `tracker-${i}`, total: 100, message: `Task ${i}` });
    }
    result = multi;
  });

  bench('create MultiProgress + add 10 trackers', () => {
    const id = getBenchId();
    const multi = new MultiProgress({ id });
    for (let i = 0; i < 10; i++) {
      multi.add({ trackerId: `tracker-${i}`, total: 100, message: `Task ${i}` });
    }
    result = multi;
  });

  bench('MultiProgress.status() with 5 trackers', () => {
    const id = getBenchId();
    const multi = new MultiProgress({ id });
    for (let i = 0; i < 5; i++) {
      const tracker = multi.add({ trackerId: `tracker-${i}`, total: 100, message: `Task ${i}` });
      tracker.increment(50);
    }
    result = multi.status();
  });

  bench('MultiProgress.clear() with 5 trackers', () => {
    const id = getBenchId();
    const multi = new MultiProgress({ id });
    for (let i = 0; i < 5; i++) {
      multi.add({ trackerId: `tracker-${i}`, total: 100, message: `Task ${i}` });
    }
    result = multi.clear();
  });
});

// =============================================================================
// Template Rendering Performance
// =============================================================================

group('Template Rendering', () => {
  const engine = createTemplateEngine();
  const state: ProgressState = {
    current: 50,
    total: 100,
    percentage: 50,
    message: 'Processing files',
    complete: false,
    startTime: Date.now(),
    id: 'test',
  };

  baseline('render bar template', () => {
    result = engine.render(templates.bar, state);
  });

  bench('render spinner template', () => {
    result = engine.render(templates.spinner, state);
  });

  bench('render percentage template', () => {
    result = engine.render(templates.percentage, state);
  });

  bench('render minimal template', () => {
    result = engine.render(templates.minimal, state);
  });

  bench('render detailed template', () => {
    result = engine.render(templates.detailed, state);
  });

  bench('render custom template', () => {
    const customTemplate = '{{message}}: {{current}}/{{total}} ({{percentage}}%)';
    result = engine.render(customTemplate, state);
  });
});

// =============================================================================
// Streaming API Performance
// =============================================================================

group('Streaming API - Async Generators', () => {
  baseline('ProgressStream: create + 10 iterations', async () => {
    const id = getBenchId();
    const stream = new ProgressStream({
      total: 10,
      message: 'Processing',
      id,
      incrementAmount: 1,
    });

    for (let i = 0; i < 10; i++) {
      result = await stream.next();
    }
    await stream.return();
  });

  bench('ProgressStream: create + 50 iterations', async () => {
    const id = getBenchId();
    const stream = new ProgressStream({
      total: 50,
      message: 'Processing',
      id,
      incrementAmount: 1,
    });

    for (let i = 0; i < 50; i++) {
      result = await stream.next();
    }
    await stream.return();
  });

  bench('ProgressStream: for-await-of (10 items)', async () => {
    const id = getBenchId();

    async function* processItems() {
      const stream = new ProgressStream({
        total: 10,
        message: 'Processing',
        id,
      });

      for (let i = 0; i < 10; i++) {
        const res = await stream.next();
        if (!res.done && res.value) {
          yield res.value;
        }
      }

      await stream.return();
    }

    for await (const state of processItems()) {
      result = state;
    }
  });
});

group('Streaming API - Node.js Streams', () => {
  baseline('ProgressTransform: 1KB data', async () => {
    const id = getBenchId();
    const data = Buffer.alloc(1024, 'x');

    const progressTransform = new ProgressTransform({
      total: data.length,
      message: 'Processing',
      id,
    });

    const readable = Readable.from([data]);
    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);
    result = progressTransform.getProgress();
  });

  bench('ProgressTransform: 10KB data', async () => {
    const id = getBenchId();
    const data = Buffer.alloc(10 * 1024, 'x');

    const progressTransform = new ProgressTransform({
      total: data.length,
      message: 'Processing',
      id,
    });

    const readable = Readable.from([data]);
    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);
    result = progressTransform.getProgress();
  });

  bench('ProgressTransform: 100 small chunks', async () => {
    const id = getBenchId();
    const chunks = Array.from({ length: 100 }, () => Buffer.alloc(100, 'x'));
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    const progressTransform = new ProgressTransform({
      total: totalSize,
      message: 'Processing',
      id,
    });

    const readable = Readable.from(chunks);
    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);
    result = progressTransform.getProgress();
  });

  bench('ProgressTransform: with updateInterval throttling', async () => {
    const id = getBenchId();
    const chunks = Array.from({ length: 100 }, () => Buffer.alloc(100, 'x'));
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);

    const progressTransform = new ProgressTransform({
      total: totalSize,
      message: 'Processing',
      id,
      updateInterval: 1000, // Emit every 1000 bytes
    });

    const readable = Readable.from(chunks);
    const writable = new Writable({
      write(chunk, encoding, callback) {
        callback();
      },
    });

    await pipelineAsync(readable, progressTransform, writable);
    result = progressTransform.getProgress();
  });
});

// =============================================================================
// Run Benchmarks
// =============================================================================

await run({
  units: false,        // Don't show unit reference
  silent: false,       // Show progress
  json: false,         // Human-readable output
  samples: 256,        // More samples = more stable results
  time: 2_000_000_000, // 2 seconds per benchmark
  warmup: true,        // Enable warm-up iterations for JIT
  latency: true,       // Show time per iteration
  throughput: true,    // Show operations per second
});
