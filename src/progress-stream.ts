/**
 * ProgressStream - Async generator integration for progress tracking
 *
 * Provides automatic progress tracking for async iterators and generators.
 * Each call to next() auto-increments progress and returns the current state.
 */

import type { ProgressState, Result } from './index.js';
import { ProgressTracker, type ProgressTrackerConfig } from './progress-tracker.js';

/**
 * Configuration for creating a ProgressStream
 */
export interface ProgressStreamConfig extends ProgressTrackerConfig {
  /** Amount to increment on each next() call (default: 1) */
  incrementAmount?: number;
}

/**
 * ProgressStream - AsyncIterableIterator for automatic progress tracking
 *
 * Implements AsyncIterableIterator<ProgressState> to provide seamless
 * integration with async generators and for-await-of loops.
 *
 * @example
 * ```typescript
 * async function* processItems(items: string[]) {
 *   const progress = new ProgressStream({
 *     total: items.length,
 *     message: 'Processing items'
 *   });
 *
 *   for (const item of items) {
 *     await processItem(item);
 *     yield await progress.next();
 *   }
 *
 *   await progress.return();
 * }
 *
 * // Usage
 * for await (const state of processItems(myItems)) {
 *   console.log(`${state.percentage}% complete`);
 * }
 * ```
 */
export class ProgressStream implements AsyncIterableIterator<ProgressState> {
  private readonly tracker: ProgressTracker;
  private readonly incrementAmount: number;
  private isDone: boolean = false;

  /**
   * Create a new ProgressStream
   *
   * @param config - Configuration for the progress stream
   */
  constructor(config: ProgressStreamConfig) {
    this.tracker = new ProgressTracker({
      total: config.total,
      message: config.message,
      id: config.id,
      filePath: config.filePath,
    });
    this.incrementAmount = config.incrementAmount ?? 1;
  }

  /**
   * Auto-increment progress and return current state
   *
   * This is called automatically when using for-await-of loops.
   * Each call increments the progress and returns the updated state.
   *
   * @param value - Optional value (unused, required by AsyncIterator interface)
   * @returns Promise resolving to IteratorResult with current state
   *
   * @example
   * ```typescript
   * const state = await stream.next();
   * console.log(state.value.percentage);
   * ```
   */
  async next(value?: unknown): Promise<IteratorResult<ProgressState>> {
    if (this.isDone) {
      return { done: true, value: undefined };
    }

    // Increment progress
    const result = this.tracker.increment(this.incrementAmount);

    if (!result.ok) {
      throw new Error(`Progress stream error: ${result.error}`);
    }

    return {
      done: false,
      value: result.value,
    };
  }

  /**
   * Mark progress as complete and clean up
   *
   * This should be called when iteration is complete to mark
   * the progress as done and clean up resources.
   *
   * @param value - Optional completion value
   * @returns Promise resolving to IteratorResult
   *
   * @example
   * ```typescript
   * await stream.return();
   * ```
   */
  async return(value?: ProgressState): Promise<IteratorResult<ProgressState>> {
    if (!this.isDone) {
      this.isDone = true;
      const result = this.tracker.done();
      if (!result.ok) {
        throw new Error(`Failed to complete progress: ${result.error}`);
      }
      return { done: true, value: value ?? result.value };
    }
    return { done: true, value };
  }

  /**
   * Handle errors during iteration
   *
   * Marks the progress as failed and cleans up resources.
   *
   * @param error - Error that occurred during iteration
   * @returns Promise resolving to IteratorResult
   *
   * @example
   * ```typescript
   * try {
   *   for await (const state of stream) {
   *     // Process...
   *   }
   * } catch (error) {
   *   await stream.throw(error);
   * }
   * ```
   */
  async throw(error?: unknown): Promise<IteratorResult<ProgressState>> {
    if (!this.isDone) {
      this.isDone = true;

      // Mark as failed with error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      const result = this.tracker.done(`Failed: ${errorMessage}`);

      if (!result.ok) {
        throw new Error(`Failed to mark progress as failed: ${result.error}`);
      }
    }

    throw error;
  }

  /**
   * Returns this iterator (required by AsyncIterable interface)
   *
   * This allows ProgressStream to be used directly in for-await-of loops.
   *
   * @returns This iterator instance
   */
  [Symbol.asyncIterator](): AsyncIterableIterator<ProgressState> {
    return this;
  }
}

/**
 * Factory function to create a ProgressStream
 *
 * Convenience function for creating progress streams without using `new`.
 *
 * @param config - Configuration for the progress stream
 * @returns New ProgressStream instance
 *
 * @example
 * ```typescript
 * const stream = createProgressStream({
 *   total: 100,
 *   message: 'Processing'
 * });
 *
 * for await (const state of stream) {
 *   console.log(state.percentage);
 *   if (state.current >= state.total) break;
 * }
 * ```
 */
export function createProgressStream(config: ProgressStreamConfig): ProgressStream {
  return new ProgressStream(config);
}
