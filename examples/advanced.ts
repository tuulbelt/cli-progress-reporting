/**
 * Example: Advanced Usage - Combining Features
 *
 * Demonstrates a realistic scenario combining MultiProgress,
 * TemplateEngine, and custom formatting for a multi-stage
 * data processing pipeline.
 *
 * Run: npx tsx examples/advanced.ts
 */

import { MultiProgress, TemplateEngine, templates, spinners } from '../src/index.js';

async function simulateWork(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log('Advanced Multi-Stage Pipeline Example\n');

  const multi = new MultiProgress();
  const engine = new TemplateEngine({
    spinnerFrames: spinners.dots,
    barWidth: 25,
  });

  // Create trackers for each pipeline stage
  const stages = {
    download: multi.create('download', 50, 'Downloading data files'),
    parse: multi.create('parse', 50, 'Parsing CSV data'),
    validate: multi.create('validate', 50, 'Validating records'),
    transform: multi.create('transform', 50, 'Transforming data'),
    upload: multi.create('upload', 50, 'Uploading results'),
  };

  console.log('Starting data pipeline...\n');

  // Stage 1: Download
  await processStage(stages.download, 50, 'Downloaded', engine, multi);

  // Stage 2: Parse
  await processStage(stages.parse, 50, 'Parsed', engine, multi);

  // Stage 3: Validate
  await processStage(stages.validate, 50, 'Validated', engine, multi);

  // Stage 4: Transform
  await processStage(stages.transform, 50, 'Transformed', engine, multi);

  // Stage 5: Upload
  await processStage(stages.upload, 50, 'Uploaded', engine, multi);

  // Summary
  console.log('\n\n=== Pipeline Complete ===\n');

  const finalStates = multi.getAll();
  if (finalStates.ok) {
    for (const [id, state] of Object.entries(finalStates.value)) {
      const elapsed = Math.floor((state.updatedTime - state.startTime) / 1000);
      console.log(
        `✅ ${id.padEnd(10)}: ${state.current} items in ${elapsed}s - ${state.message}`
      );
    }
  }

  // Clean up
  multi.clearAll();
}

async function processStage(
  tracker: any,
  total: number,
  verb: string,
  engine: TemplateEngine,
  multi: MultiProgress
): Promise<void> {
  for (let i = 1; i <= total; i++) {
    await simulateWork(50);

    tracker.increment(1, `${verb} ${i} records`);

    // Display all stages with different formats
    displayPipeline(multi, engine);
  }

  tracker.finish(`${verb} all ${total} records`);
}

function displayPipeline(multi: MultiProgress, engine: TemplateEngine): void {
  const allStates = multi.getAll();
  if (!allStates.ok) return;

  process.stdout.write('\x1b[H\x1b[2J'); // Clear screen
  console.log('Data Processing Pipeline\n');

  const stageOrder = ['download', 'parse', 'validate', 'transform', 'upload'];
  const stageEmoji = {
    download: '📥',
    parse: '📄',
    validate: '✓',
    transform: '⚙️',
    upload: '📤',
  };

  for (const id of stageOrder) {
    const state = allStates.value[id];
    if (!state) continue;

    const emoji = stageEmoji[id as keyof typeof stageEmoji] || '•';
    const status = state.complete ? '✅' : '⏳';

    // Use different template based on completion
    const template = state.complete ? templates.minimal : templates.full;
    const rendered = engine.render(template, state);

    console.log(`${status} ${emoji}  ${id.padEnd(10)} | ${rendered}`);
  }

  console.log();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
