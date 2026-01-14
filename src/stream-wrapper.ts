/**
 * Stream Wrapper - Node.js stream integration for progress tracking
 *
 * Provides automatic progress tracking for Node.js Readable streams.
 * Wraps streams and emits progress events as data flows through.
 */

import { Transform, type TransformCallback, type TransformOptions } from 'node:stream';
import type { ProgressState } from './index.js';
import { ProgressTracker, type ProgressTrackerConfig } from './progress-tracker.js';

/**
 * Configuration for attaching progress to a stream
 */
export interface StreamProgressConfig extends Omit<ProgressTrackerConfig, 'total'> {
  /** Total bytes expected to be processed */
  total: number;
  /** Update frequency in bytes (default: emit on every chunk) */
  updateInterval?: number;
}

/**
 * Progress-tracking Transform stream
 *
 * Extends Node.js Transform stream to track bytes processed and emit
 * progress events. Can be piped into existing stream pipelines.
 *
 * @example
 * ```typescript
 * import { createReadStream } from 'fs';
 * import { ProgressTransform } from 'cli-progress-reporting';
 *
 * const progress = new ProgressTransform({
 *   total: fileSize,
 *   message: 'Reading file'
 * });
 *
 * progress.on('progress', (state) => {
 *   console.log(`${state.percentage}% complete`);
 * });
 *
 * createReadStream('large-file.txt')
 *   .pipe(progress)
 *   .pipe(destinationStream);
 * ```
 */
export class ProgressTransform extends Transform {
  private readonly tracker: ProgressTracker;
  private readonly updateInterval: number;
  private bytesProcessed: number = 0;
  private lastEmittedBytes: number = 0;

  /**
   * Create a new ProgressTransform stream
   *
   * @param config - Configuration for progress tracking
   * @param options - Optional Transform stream options
   */
  constructor(config: StreamProgressConfig, options?: TransformOptions) {
    super(options);

    this.tracker = new ProgressTracker({
      total: config.total,
      message: config.message,
      id: config.id,
      filePath: config.filePath,
    });

    this.updateInterval = config.updateInterval ?? 0; // Default: emit on every chunk
  }

  /**
   * Transform implementation - tracks bytes and emits progress
   *
   * @param chunk - Data chunk being processed
   * @param encoding - Chunk encoding
   * @param callback - Callback to signal completion
   * @private
   */
  _transform(chunk: Buffer | string, encoding: BufferEncoding, callback: TransformCallback): void {
    // Calculate chunk size
    const chunkSize = Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, encoding);
    this.bytesProcessed += chunkSize;

    // Update progress
    const result = this.tracker.update(this.bytesProcessed);

    if (!result.ok) {
      return callback(new Error(`Progress tracking error: ${result.error}`));
    }

    // Emit progress event if update interval reached or on every chunk
    const bytesSinceLastEmit = this.bytesProcessed - this.lastEmittedBytes;
    if (this.updateInterval === 0 || bytesSinceLastEmit >= this.updateInterval) {
      this.emit('progress', result.value);
      this.lastEmittedBytes = this.bytesProcessed;
    }

    // Pass chunk through
    callback(null, chunk);
  }

  /**
   * Called when stream ends - marks progress as complete
   *
   * @param callback - Callback to signal completion
   * @private
   */
  _flush(callback: TransformCallback): void {
    const result = this.tracker.done();

    if (!result.ok) {
      return callback(new Error(`Failed to complete progress: ${result.error}`));
    }

    // Emit final progress state
    this.emit('progress', result.value);
    callback();
  }

  /**
   * Get current progress state
   *
   * @returns Current progress state or error
   */
  getProgress(): { ok: true; value: ProgressState } | { ok: false; error: string } {
    return this.tracker.get();
  }
}

/**
 * Factory function to create a ProgressTransform stream
 *
 * Convenience function for creating progress-tracking streams without using `new`.
 *
 * @param config - Configuration for progress tracking
 * @param options - Optional Transform stream options
 * @returns New ProgressTransform instance
 *
 * @example
 * ```typescript
 * import { createReadStream } from 'fs';
 * import { attachProgress } from 'cli-progress-reporting';
 *
 * const fileStream = createReadStream('data.csv');
 * const progressStream = attachProgress(fileStream, {
 *   total: fileSize,
 *   message: 'Reading file',
 *   updateInterval: 1024 * 100 // Emit every 100KB
 * });
 *
 * progressStream.on('progress', (state) => {
 *   process.stdout.write(`\r${state.percentage}% complete`);
 * });
 *
 * progressStream.on('end', () => {
 *   console.log('\n✓ Complete!');
 * });
 *
 * progressStream.pipe(destinationStream);
 * ```
 */
export function attachProgress(
  config: StreamProgressConfig,
  options?: TransformOptions
): ProgressTransform {
  return new ProgressTransform(config, options);
}

/**
 * Type guard to check if an object is a ProgressTransform
 *
 * @param stream - Stream to check
 * @returns True if stream is a ProgressTransform
 */
export function isProgressTransform(stream: unknown): stream is ProgressTransform {
  return stream instanceof ProgressTransform;
}
