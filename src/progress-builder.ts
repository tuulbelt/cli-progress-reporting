/**
 * ProgressBuilder - Fluent API for building ProgressTracker instances
 *
 * Provides a builder pattern for constructing ProgressTracker instances
 * with a chainable, fluent interface.
 */

import { ProgressTracker, type ProgressTrackerConfig } from './progress-tracker.js';

/**
 * ProgressBuilder - Fluent API for creating progress trackers
 *
 * Provides a chainable interface for building ProgressTracker instances.
 *
 * @example
 * ```typescript
 * const tracker = new ProgressBuilder()
 *   .withTotal(100)
 *   .withMessage('Processing files')
 *   .withId('my-task')
 *   .build();
 * ```
 */
export class ProgressBuilder {
  private config: Partial<ProgressTrackerConfig> = {};

  /**
   * Set the total units of work
   *
   * @param total - Total units of work (must be > 0)
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.withTotal(100);
   * ```
   */
  withTotal(total: number): this {
    this.config.total = total;
    return this;
  }

  /**
   * Set the initial progress message
   *
   * @param message - Initial progress message
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.withMessage('Processing files');
   * ```
   */
  withMessage(message: string): this {
    this.config.message = message;
    return this;
  }

  /**
   * Set the unique tracker ID
   *
   * @param id - Unique identifier for this progress tracker
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.withId('my-task');
   * ```
   */
  withId(id: string): this {
    this.config.id = id;
    return this;
  }

  /**
   * Set a custom file path for progress storage
   *
   * @param filePath - Custom file path
   * @returns this builder instance for chaining
   *
   * @example
   * ```typescript
   * builder.withFilePath('/tmp/my-progress.json');
   * ```
   */
  withFilePath(filePath: string): this {
    this.config.filePath = filePath;
    return this;
  }

  /**
   * Build the ProgressTracker instance
   *
   * @returns A new ProgressTracker instance
   * @throws Error if required fields (total, message) are not set
   *
   * @example
   * ```typescript
   * const tracker = new ProgressBuilder()
   *   .withTotal(100)
   *   .withMessage('Processing')
   *   .build();
   * ```
   */
  build(): ProgressTracker {
    if (typeof this.config.total !== 'number') {
      throw new Error('total is required (use withTotal)');
    }
    if (typeof this.config.message !== 'string') {
      throw new Error('message is required (use withMessage)');
    }

    return new ProgressTracker(this.config as ProgressTrackerConfig);
  }
}
