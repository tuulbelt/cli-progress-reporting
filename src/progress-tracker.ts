/**
 * ProgressTracker - Instance-based progress tracking API
 *
 * Provides an object-oriented interface to progress tracking, wrapping
 * the functional API with a stateful instance that maintains configuration.
 */

import type { ProgressState, ProgressConfig, Result } from './index.js';
import { init, increment as incrementFn, set as setFn, finish as finishFn, get as getFn, clear as clearFn } from './index.js';

/**
 * Configuration for creating a ProgressTracker instance
 */
export interface ProgressTrackerConfig {
  /** Total units of work */
  total: number;
  /** Initial progress message */
  message: string;
  /** Unique identifier for this progress tracker (defaults to 'default') */
  id?: string;
  /** Custom progress file path (defaults to temp directory) */
  filePath?: string;
}

/**
 * ProgressTracker - Instance-based progress tracking
 *
 * Provides an object-oriented API for progress tracking where configuration
 * is maintained as instance state.
 *
 * @example
 * ```typescript
 * const tracker = new ProgressTracker({
 *   total: 100,
 *   message: 'Processing files'
 * });
 *
 * tracker.update(50);
 * tracker.done();
 * ```
 */
export class ProgressTracker {
  private readonly config: ProgressConfig;

  /**
   * Create a new ProgressTracker instance
   *
   * @param config - Configuration for the progress tracker
   */
  constructor(config: ProgressTrackerConfig) {
    this.config = {
      id: config.id,
      filePath: config.filePath,
    };

    // Initialize progress tracking
    const result = init(config.total, config.message, this.config);
    if (!result.ok) {
      throw new Error(`Failed to initialize progress tracker: ${result.error}`);
    }
  }

  /**
   * Update progress to an absolute value
   *
   * @param current - Current progress value
   * @param message - Optional new message
   * @returns Result with updated state
   *
   * @example
   * ```typescript
   * const result = tracker.update(50, 'Halfway done');
   * if (result.ok) {
   *   console.log(`Progress: ${result.value.percentage}%`);
   * }
   * ```
   */
  update(current: number, message?: string): Result<ProgressState> {
    return setFn(current, message, this.config);
  }

  /**
   * Increment progress by a specified amount
   *
   * @param amount - Amount to increment (default: 1)
   * @param message - Optional new message
   * @returns Result with updated state
   *
   * @example
   * ```typescript
   * tracker.increment(5, 'Processed 5 items');
   * ```
   */
  increment(amount: number = 1, message?: string): Result<ProgressState> {
    return incrementFn(amount, message, this.config);
  }

  /**
   * Mark progress as complete
   *
   * @param message - Optional completion message
   * @returns Result with final state
   *
   * @example
   * ```typescript
   * tracker.done('All tasks complete!');
   * ```
   */
  done(message?: string): Result<ProgressState> {
    return finishFn(message, this.config);
  }

  /**
   * Get current progress state
   *
   * @returns Result with current state
   *
   * @example
   * ```typescript
   * const state = tracker.get();
   * if (state.ok) {
   *   console.log(`Progress: ${state.value.percentage}%`);
   * }
   * ```
   */
  get(): Result<ProgressState> {
    return getFn(this.config);
  }

  /**
   * Clear progress file
   *
   * @returns Result indicating success or failure
   *
   * @example
   * ```typescript
   * tracker.clear();
   * ```
   */
  clear(): Result<void> {
    return clearFn(this.config);
  }
}
