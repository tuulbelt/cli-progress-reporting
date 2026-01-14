#!/usr/bin/env -S npx tsx
/**
 * Multi-Stage Pipeline Example
 *
 * Demonstrates complex multi-stage data processing with concurrent
 * progress tracking for each stage using MultiProgress.
 */

import { MultiProgress, templates, createTemplateEngine } from '../src/index.js';

// =============================================================================
// Data Types
// =============================================================================

interface DataRecord {
  id: number;
  name: string;
  value: number;
  status?: 'pending' | 'downloaded' | 'parsed' | 'validated' | 'transformed' | 'uploaded';
}

interface PipelineConfig {
  downloadCount: number;
  parseCount: number;
  validateCount: number;
  transformCount: number;
  uploadCount: number;
}

// =============================================================================
// Example 1: Basic Multi-Stage Pipeline
// =============================================================================

async function basicPipeline() {
  console.log('\n📊 Example 1: Basic Multi-Stage Pipeline');
  console.log('==========================================\n');

  const multi = new MultiProgress({ id: 'basic-pipeline' });

  // Create trackers for each stage
  const download = multi.add({
    trackerId: 'download',
    total: 100,
    message: 'Downloading data',
  });

  const parse = multi.add({
    trackerId: 'parse',
    total: 100,
    message: 'Parsing data',
  });

  const validate = multi.add({
    trackerId: 'validate',
    total: 100,
    message: 'Validating data',
  });

  const transform = multi.add({
    trackerId: 'transform',
    total: 100,
    message: 'Transforming data',
  });

  const upload = multi.add({
    trackerId: 'upload',
    total: 100,
    message: 'Uploading results',
  });

  // Simulate stages
  const engine = createTemplateEngine();

  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 30));

    download.increment(1);
    if (i % 20 === 0) {
      const state = download.get();
      if (state.ok) {
        console.log(`  Download: ${engine.render(templates.minimal, state.value)}`);
      }
    }
  }
  download.done();
  console.log('  ✓ Download complete\n');

  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    parse.increment(1);
    if (i % 25 === 0) {
      const state = parse.get();
      if (state.ok) {
        console.log(`  Parse: ${engine.render(templates.minimal, state.value)}`);
      }
    }
  }
  parse.done();
  console.log('  ✓ Parse complete\n');

  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 15));
    validate.increment(1);
  }
  validate.done();
  console.log('  ✓ Validate complete\n');

  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    transform.increment(1);
  }
  transform.done();
  console.log('  ✓ Transform complete\n');

  for (let i = 0; i < 100; i++) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    upload.increment(1);
  }
  upload.done();
  console.log('  ✓ Upload complete\n');

  // Get final status
  const status = multi.status();
  if (status.ok) {
    console.log('📈 Final Status:');
    Object.entries(status.value.trackers).forEach(([id, state]) => {
      console.log(`  ${id}: ${state.percentage}% (${state.current}/${state.total})`);
    });
  }

  multi.clear();
  console.log('\n✓ Pipeline complete!\n');
}

// =============================================================================
// Example 2: Parallel Processing Pipeline
// =============================================================================

async function parallelPipeline() {
  console.log('📊 Example 2: Parallel Processing Pipeline');
  console.log('============================================\n');

  const multi = new MultiProgress({ id: 'parallel-pipeline' });
  const engine = createTemplateEngine();

  // Create multiple parallel workers
  const workers = [
    multi.add({ trackerId: 'worker-1', total: 50, message: 'Worker 1' }),
    multi.add({ trackerId: 'worker-2', total: 50, message: 'Worker 2' }),
    multi.add({ trackerId: 'worker-3', total: 50, message: 'Worker 3' }),
    multi.add({ trackerId: 'worker-4', total: 50, message: 'Worker 4' }),
  ];

  // Process in parallel
  const promises = workers.map(async (worker, index) => {
    for (let i = 0; i < 50; i++) {
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
      worker.increment(1);

      if (i % 10 === 0) {
        const state = worker.get();
        if (state.ok) {
          console.log(`  Worker ${index + 1}: ${engine.render(templates.minimal, state.value)}`);
        }
      }
    }
    worker.done();
    console.log(`  ✓ Worker ${index + 1} complete`);
  });

  await Promise.all(promises);

  multi.clear();
  console.log('\n✓ All workers complete!\n');
}

// =============================================================================
// Example 3: Dependency-Based Pipeline
// =============================================================================

async function dependencyPipeline() {
  console.log('📊 Example 3: Dependency-Based Pipeline');
  console.log('=========================================\n');

  const multi = new MultiProgress({ id: 'dependency-pipeline' });
  const records: DataRecord[] = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `Record ${i + 1}`,
    value: Math.random() * 100,
    status: 'pending',
  }));

  const stages: Array<{
    name: string;
    total: number;
    tracker: ReturnType<typeof multi.add>;
    process: (record: DataRecord) => Promise<void>;
  }> = [
    {
      name: 'download',
      total: records.length,
      tracker: multi.add({
        trackerId: 'download',
        total: records.length,
        message: 'Downloading',
      }),
      process: async (record) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        record.status = 'downloaded';
      },
    },
    {
      name: 'parse',
      total: records.length,
      tracker: multi.add({ trackerId: 'parse', total: records.length, message: 'Parsing' }),
      process: async (record) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        record.status = 'parsed';
      },
    },
    {
      name: 'validate',
      total: records.length,
      tracker: multi.add({ trackerId: 'validate', total: records.length, message: 'Validating' }),
      process: async (record) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        record.status = 'validated';
      },
    },
    {
      name: 'transform',
      total: records.length,
      tracker: multi.add({ trackerId: 'transform', total: records.length, message: 'Transforming' }),
      process: async (record) => {
        await new Promise((resolve) => setTimeout(resolve, 40));
        record.value = record.value * 2;
        record.status = 'transformed';
      },
    },
    {
      name: 'upload',
      total: records.length,
      tracker: multi.add({ trackerId: 'upload', total: records.length, message: 'Uploading' }),
      process: async (record) => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        record.status = 'uploaded';
      },
    },
  ];

  // Process each stage sequentially (each stage depends on previous)
  for (const stage of stages) {
    console.log(`\n🔄 Stage: ${stage.name}`);
    for (const record of records) {
      await stage.process(record);
      stage.tracker.increment(1);
    }
    stage.tracker.done();
    console.log(`✓ ${stage.name} complete`);
  }

  // Verify all records processed
  const allUploaded = records.every((r) => r.status === 'uploaded');
  console.log(`\n✓ All ${records.length} records processed: ${allUploaded ? 'YES' : 'NO'}\n`);

  multi.clear();
}

// =============================================================================
// Example 4: Real-World ETL Pipeline
// =============================================================================

async function etlPipeline() {
  console.log('📊 Example 4: Real-World ETL Pipeline');
  console.log('=======================================\n');

  const multi = new MultiProgress({ id: 'etl-pipeline' });
  const engine = createTemplateEngine();

  const config: PipelineConfig = {
    downloadCount: 200,
    parseCount: 200,
    validateCount: 200,
    transformCount: 200,
    uploadCount: 200,
  };

  console.log('🏗️  ETL Pipeline Configuration:');
  console.log(`  - Download: ${config.downloadCount} files`);
  console.log(`  - Parse: ${config.parseCount} records`);
  console.log(`  - Validate: ${config.validateCount} records`);
  console.log(`  - Transform: ${config.transformCount} records`);
  console.log(`  - Upload: ${config.uploadCount} records\n`);

  // Create trackers
  const trackers = {
    download: multi.add({ trackerId: 'download', total: config.downloadCount, message: 'Downloading' }),
    parse: multi.add({ trackerId: 'parse', total: config.parseCount, message: 'Parsing' }),
    validate: multi.add({ trackerId: 'validate', total: config.validateCount, message: 'Validating' }),
    transform: multi.add({ trackerId: 'transform', total: config.transformCount, message: 'Transforming' }),
    upload: multi.add({ trackerId: 'upload', total: config.uploadCount, message: 'Uploading' }),
  };

  // Run ETL stages
  const stages = Object.entries(trackers);

  for (const [name, tracker] of stages) {
    const total = config[`${name}Count` as keyof PipelineConfig];

    for (let i = 0; i < total; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      tracker.increment(1);

      // Log progress every 25%
      if (i > 0 && (i + 1) % Math.floor(total / 4) === 0) {
        const state = tracker.get();
        if (state.ok) {
          const progress = engine.render(templates.bar, state.value);
          console.log(`  ${progress}`);
        }
      }
    }

    tracker.done();
    console.log(`  ✓ ${name} complete\n`);
  }

  // Final summary
  const status = multi.status();
  if (status.ok) {
    console.log('📊 ETL Pipeline Summary:');
    console.log('========================');
    Object.entries(status.value.trackers).forEach(([id, state]) => {
      console.log(`  ${id.padEnd(12)}: ${state.current}/${state.total} (${state.percentage}%)`);
    });
  }

  multi.clear();
  console.log('\n✓ ETL pipeline complete!\n');
}

// =============================================================================
// Run Examples
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Multi-Stage Pipeline Examples                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  await basicPipeline();
  await parallelPipeline();
  await dependencyPipeline();
  await etlPipeline();

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  All examples completed!                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
