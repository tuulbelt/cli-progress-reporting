#!/usr/bin/env -S npx tsx
/**
 * CLI Integration Example
 *
 * Demonstrates integrating progress tracking into a real CLI tool
 * for processing files with various options and error handling.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { createProgress, templates, createTemplateEngine } from '../src/index.js';

// =============================================================================
// CLI Tool: File Processor
// =============================================================================

interface ProcessOptions {
  pattern?: string;
  verbose?: boolean;
  dryRun?: boolean;
  concurrent?: boolean;
}

interface FileStats {
  processed: number;
  failed: number;
  skipped: number;
  totalSize: number;
}

// =============================================================================
// Example 1: Basic CLI with Progress
// =============================================================================

async function processFiles(files: string[], options: ProcessOptions = {}): Promise<FileStats> {
  const stats: FileStats = {
    processed: 0,
    failed: 0,
    skipped: 0,
    totalSize: 0,
  };

  console.log(`\n📁 Processing ${files.length} files...\n`);

  const progress = createProgress({
    total: files.length,
    message: 'Processing files',
    id: 'cli-example-1',
  });

  const engine = createTemplateEngine();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    try {
      // Check if file exists
      if (!existsSync(file)) {
        stats.skipped++;
        progress.increment(1, `Skipped: ${basename(file)} (not found)`);
        continue;
      }

      // Get file stats
      const fileStat = statSync(file);
      stats.totalSize += fileStat.size;

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Read file (simulate processing)
      if (!options.dryRun) {
        readFileSync(file, 'utf-8');
      }

      stats.processed++;
      progress.increment(1, `Processed: ${basename(file)}`);

      // Show progress bar
      const state = progress.get();
      if (state.ok) {
        const bar = engine.render(templates.bar, state.value);
        process.stdout.write(`\r${bar}`);
      }

      if (options.verbose) {
        console.log(`\n  ✓ ${file} (${fileStat.size} bytes)`);
      }
    } catch (error) {
      stats.failed++;
      progress.increment(1, `Failed: ${basename(file)}`);

      if (options.verbose) {
        console.error(`\n  ❌ ${file}: ${error instanceof Error ? error.message : error}`);
      }
    }
  }

  progress.finish('Processing complete!');
  console.log('\n');

  return stats;
}

// =============================================================================
// Example 2: CLI with Pattern Matching
// =============================================================================

function findFiles(directory: string, pattern: string): string[] {
  const files: string[] = [];

  try {
    const entries = readdirSync(directory);

    for (const entry of entries) {
      const fullPath = join(directory, entry);
      const stat = statSync(fullPath);

      if (stat.isFile()) {
        // Simple pattern matching (*.ts, *.js, etc.)
        if (pattern === '*' || extname(entry) === `.${pattern}` || entry.endsWith(pattern)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error reading directory: ${error instanceof Error ? error.message : error}`);
  }

  return files;
}

async function processDirectory(directory: string, pattern: string = '*') {
  console.log(`\n📂 Scanning directory: ${directory}`);
  console.log(`🔍 Pattern: ${pattern}\n`);

  const files = findFiles(directory, pattern);

  if (files.length === 0) {
    console.log('⚠️  No files found matching pattern\n');
    return;
  }

  const stats = await processFiles(files, { verbose: false });

  console.log('📊 Summary:');
  console.log(`  ✓ Processed: ${stats.processed}`);
  console.log(`  ❌ Failed: ${stats.failed}`);
  console.log(`  ⊘ Skipped: ${stats.skipped}`);
  console.log(`  📦 Total size: ${(stats.totalSize / 1024).toFixed(2)} KB\n`);
}

// =============================================================================
// Example 3: CLI with Spinner
// =============================================================================

async function processWithSpinner(files: string[]) {
  console.log('\n🔄 Processing files with spinner...\n');

  const progress = createProgress({
    total: files.length,
    message: 'Processing',
    id: 'cli-example-3',
  });

  const engine = createTemplateEngine();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    progress.increment(1, `Processing ${basename(file)}`);

    const state = progress.get();
    if (state.ok) {
      const spinner = engine.render(templates.spinnerProgress, state.value);
      process.stdout.write(`\r${spinner}`);
    }
  }

  progress.finish('Complete!');
  console.log('\n');
}

// =============================================================================
// Example 4: CLI with Error Recovery
// =============================================================================

async function processWithRetry(files: string[], maxRetries: number = 3) {
  console.log(`\n🔄 Processing files with retry (max ${maxRetries} retries)...\n`);

  const progress = createProgress({
    total: files.length,
    message: 'Processing with retry',
    id: 'cli-example-4',
  });

  const engine = createTemplateEngine();
  const failed: Array<{ file: string; error: string }> = [];

  for (const file of files) {
    let attempts = 0;
    let success = false;

    while (attempts < maxRetries && !success) {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Simulate random failures (20% chance)
        if (Math.random() < 0.2 && attempts < maxRetries - 1) {
          throw new Error('Simulated processing error');
        }

        success = true;
        progress.increment(1, `Processed: ${basename(file)}`);
      } catch (error) {
        attempts++;
        if (attempts < maxRetries) {
          console.log(`\n  ⚠️  Retry ${attempts}/${maxRetries} for ${basename(file)}`);
        } else {
          failed.push({
            file: basename(file),
            error: error instanceof Error ? error.message : String(error),
          });
          progress.increment(1, `Failed: ${basename(file)}`);
        }
      }
    }

    const state = progress.get();
    if (state.ok) {
      const bar = engine.render(templates.detailed, state.value);
      process.stdout.write(`\r${bar}`);
    }
  }

  progress.finish('Processing complete!');
  console.log('\n');

  if (failed.length > 0) {
    console.log('❌ Failed files:');
    failed.forEach(({ file, error }) => {
      console.log(`  - ${file}: ${error}`);
    });
    console.log('');
  }
}

// =============================================================================
// Example 5: Concurrent Processing CLI
// =============================================================================

async function processConcurrently(files: string[], concurrency: number = 4) {
  console.log(`\n⚡ Processing files concurrently (${concurrency} workers)...\n`);

  const progress = createProgress({
    total: files.length,
    message: 'Concurrent processing',
    id: 'cli-example-5',
  });

  const engine = createTemplateEngine();

  // Split files into batches
  const batches: string[][] = [];
  for (let i = 0; i < files.length; i += concurrency) {
    batches.push(files.slice(i, i + concurrency));
  }

  for (const batch of batches) {
    // Process batch concurrently
    await Promise.all(
      batch.map(async (file) => {
        await new Promise((resolve) => setTimeout(resolve, 100 + Math.random() * 100));
        progress.increment(1, `Processed: ${basename(file)}`);

        const state = progress.get();
        if (state.ok) {
          const bar = engine.render(templates.bar, state.value);
          process.stdout.write(`\r${bar}`);
        }
      })
    );
  }

  progress.finish('All files processed!');
  console.log('\n');
}

// =============================================================================
// Run Examples
// =============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  CLI Integration Examples                                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  // Example 1: Basic file processing
  const testFiles = [
    './examples/basic.ts',
    './examples/advanced.ts',
    './examples/concurrent.ts',
    './examples/templates.ts',
    './examples/cli-usage.sh',
  ];

  await processFiles(testFiles, { verbose: true });

  // Example 2: Directory scanning with pattern
  await processDirectory('./examples', 'ts');

  // Example 3: Spinner progress
  await processWithSpinner(testFiles);

  // Example 4: Error recovery with retry
  await processWithRetry(testFiles, 3);

  // Example 5: Concurrent processing
  await processConcurrently(testFiles, 2);

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  All examples completed!                                   ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
