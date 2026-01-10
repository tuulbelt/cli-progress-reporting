/**
 * Multi-Progress Tracking
 *
 * Manages multiple concurrent progress trackers with file-based state.
 */

import { writeFileSync, readFileSync, unlinkSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { ProgressTracker, type ProgressTrackerConfig } from './progress-tracker.js';
import type { ProgressState, Result } from './index.js';

/**
 * Multi-progress state stored in file
 */
export interface MultiProgressState {
  /** Map of tracker IDs to their progress states */
  trackers: Record<string, ProgressState>;
  /** Metadata about the multi-progress container */
  meta: {
    /** Timestamp when multi-progress was created */
    created: number;
    /** Timestamp of last update */
    updated: number;
  };
}

/**
 * Configuration for creating a tracker within MultiProgress
 */
export interface MultiProgressTrackerConfig {
  /** Total units of work for this tracker */
  total: number;
  /** User-friendly message describing this tracker */
  message: string;
  /** Optional unique ID for this tracker (auto-generated if not provided) */
  trackerId?: string;
}

/**
 * Configuration for MultiProgress container
 */
export interface MultiProgressConfig {
  /** Unique identifier for this multi-progress container (defaults to 'default') */
  id?: string;
  /** Custom file path (defaults to temp directory) */
  filePath?: string;
}

/**
 * MultiProgress class for managing multiple concurrent progress trackers
 */
export class MultiProgress {
  private readonly id: string;
  private readonly filePath: string;
  private trackers: Map<string, ProgressTracker> = new Map();

  /**
   * Create a new MultiProgress container
   */
  constructor(config: MultiProgressConfig = {}) {
    this.id = config.id || 'default';
    this.filePath = config.filePath || join(tmpdir(), `progress-multi-${this.id}.json`);

    // Initialize file if it doesn't exist
    if (!existsSync(this.filePath)) {
      const initialState: MultiProgressState = {
        trackers: {},
        meta: {
          created: Date.now(),
          updated: Date.now(),
        },
      };
      this.writeState(initialState);
    }
  }

  /**
   * Add a new progress tracker to this container
   */
  add(config: MultiProgressTrackerConfig): ProgressTracker {
    const trackerId = config.trackerId || this.generateTrackerId();

    // Create a unique progress tracker with this trackerId
    const tracker = new ProgressTracker({
      total: config.total,
      message: config.message,
      id: `${this.id}-${trackerId}`,
    });

    this.trackers.set(trackerId, tracker);

    // Update multi-progress state
    const stateResult = this.readState();
    if (stateResult.ok) {
      const trackerState = tracker.get();
      if (trackerState.ok) {
        stateResult.value.trackers[trackerId] = trackerState.value;
        stateResult.value.meta.updated = Date.now();
        this.writeState(stateResult.value);
      }
    }

    return tracker;
  }

  /**
   * Get a specific tracker by ID
   */
  get(trackerId: string): Result<ProgressTracker> {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      return { ok: false, error: `Tracker not found: ${trackerId}` };
    }
    return { ok: true, value: tracker };
  }

  /**
   * Get all trackers
   */
  getAll(): Result<Array<{ id: string; tracker: ProgressTracker }>> {
    const result: Array<{ id: string; tracker: ProgressTracker }> = [];
    for (const [id, tracker] of this.trackers.entries()) {
      result.push({ id, tracker });
    }
    return { ok: true, value: result };
  }

  /**
   * Get current state of all trackers
   */
  status(): Result<MultiProgressState> {
    return this.readState();
  }

  /**
   * Remove a tracker from this container
   */
  remove(trackerId: string): Result<void> {
    const tracker = this.trackers.get(trackerId);
    if (!tracker) {
      return { ok: false, error: `Tracker not found: ${trackerId}` };
    }

    // Clear the tracker's individual file
    tracker.clear();

    // Remove from our map
    this.trackers.delete(trackerId);

    // Update multi-progress state
    const stateResult = this.readState();
    if (stateResult.ok) {
      delete stateResult.value.trackers[trackerId];
      stateResult.value.meta.updated = Date.now();
      this.writeState(stateResult.value);
    }

    return { ok: true, value: undefined };
  }

  /**
   * Mark all trackers as complete
   */
  done(): Result<void> {
    for (const tracker of this.trackers.values()) {
      tracker.done();
    }

    // Update multi-progress state
    const stateResult = this.readState();
    if (stateResult.ok) {
      for (const [trackerId, tracker] of this.trackers.entries()) {
        const trackerState = tracker.get();
        if (trackerState.ok) {
          stateResult.value.trackers[trackerId] = trackerState.value;
        }
      }
      stateResult.value.meta.updated = Date.now();
      this.writeState(stateResult.value);
    }

    return { ok: true, value: undefined };
  }

  /**
   * Clear all trackers and remove the multi-progress file
   */
  clear(): Result<void> {
    // Clear all individual tracker files
    for (const tracker of this.trackers.values()) {
      tracker.clear();
    }

    // Clear our map
    this.trackers.clear();

    // Remove multi-progress file
    try {
      if (existsSync(this.filePath)) {
        unlinkSync(this.filePath);
      }
      return { ok: true, value: undefined };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to clear multi-progress: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Sync state from disk (reload all trackers)
   */
  sync(): Result<void> {
    const stateResult = this.readState();
    if (!stateResult.ok) {
      return stateResult;
    }

    // Update our internal tracker states
    for (const [trackerId, trackerState] of Object.entries(stateResult.value.trackers)) {
      const tracker = this.trackers.get(trackerId);
      if (tracker) {
        // Tracker exists, it will reload from its own file when queried
        continue;
      } else {
        // Tracker doesn't exist in memory, but exists in file
        // Create a new tracker instance for it
        const newTracker = new ProgressTracker({
          total: trackerState.total,
          message: trackerState.message,
          id: `${this.id}-${trackerId}`,
        });
        this.trackers.set(trackerId, newTracker);
      }
    }

    return { ok: true, value: undefined };
  }

  /**
   * Read multi-progress state from file
   */
  private readState(): Result<MultiProgressState> {
    try {
      if (!existsSync(this.filePath)) {
        return {
          ok: false,
          error: 'Multi-progress not initialized',
        };
      }

      const content = readFileSync(this.filePath, 'utf-8');
      const state = JSON.parse(content) as MultiProgressState;

      return { ok: true, value: state };
    } catch (error) {
      return {
        ok: false,
        error: `Failed to read multi-progress state: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Write multi-progress state to file (atomic write)
   */
  private writeState(state: MultiProgressState): void {
    const tempPath = `${this.filePath}.${randomBytes(8).toString('hex')}.tmp`;

    try {
      writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
      renameSync(tempPath, this.filePath);
    } catch (error) {
      // Clean up temp file if it exists
      if (existsSync(tempPath)) {
        unlinkSync(tempPath);
      }
      throw error;
    }
  }

  /**
   * Generate a unique tracker ID
   */
  private generateTrackerId(): string {
    return `tracker-${Date.now()}-${randomBytes(4).toString('hex')}`;
  }
}
