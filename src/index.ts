#!/usr/bin/env -S npx tsx
/**
 * CLI Progress Reporting
 *
 * Concurrent-safe progress reporting for CLI tools using file-based atomic writes.
 */

import { writeFileSync, readFileSync, unlinkSync, renameSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * Progress state stored in file
 */
export interface ProgressState {
  /** Total units of work */
  total: number;
  /** Current units completed */
  current: number;
  /** User-friendly message describing progress */
  message: string;
  /** Percentage complete (0-100) */
  percentage: number;
  /** Timestamp when progress started (milliseconds since epoch) */
  startTime: number;
  /** Timestamp of last update (milliseconds since epoch) */
  updatedTime: number;
  /** Whether progress is complete */
  complete: boolean;
}

/**
 * Configuration for progress tracking
 */
export interface ProgressConfig {
  /** Unique identifier for this progress tracker (defaults to 'default') */
  id?: string;
  /** Custom progress file path (defaults to temp directory) */
  filePath?: string;
}

/**
 * Result type for operations
 */
export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

// =============================================================================
// Security Helpers
// =============================================================================

/**
 * Maximum allowed message length to prevent DoS via large messages
 */
const MAX_MESSAGE_LENGTH = 10000;

/**
 * Validate that an ID is safe from path traversal attacks
 * Only allows alphanumeric characters, hyphens, and underscores
 */
function validateId(id: string): Result<string> {
  if (!id || id.length === 0) {
    return { ok: false, error: 'ID cannot be empty' };
  }

  if (id.length > 255) {
    return { ok: false, error: 'ID exceeds maximum length (255 characters)' };
  }

  // Only allow safe characters: alphanumeric, hyphen, underscore
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return {
      ok: false,
      error: 'ID must contain only alphanumeric characters, hyphens, and underscores',
    };
  }

  return { ok: true, value: id };
}

/**
 * Validate that a custom file path is safe
 * Allows custom paths but warns about security implications
 *
 * @param filePath - The custom file path to validate
 * @returns Result with the validated path or an error
 */
function validateFilePath(filePath: string): Result<string> {
  if (!filePath || filePath.length === 0) {
    return { ok: false, error: 'File path cannot be empty' };
  }

  // Prevent null bytes
  if (filePath.includes('\0')) {
    return { ok: false, error: 'File path contains null byte' };
  }

  // Warn about path traversal sequences (but allow them for legitimate use)
  // Note: Users may legitimately want to use absolute paths or relative paths
  // This is a conscious trade-off between security and usability

  return { ok: true, value: filePath };
}

/**
 * Validate message length to prevent DoS
 */
function validateMessage(message: string): Result<string> {
  if (message.length > MAX_MESSAGE_LENGTH) {
    return {
      ok: false,
      error: `Message exceeds maximum length (${MAX_MESSAGE_LENGTH} characters)`,
    };
  }
  return { ok: true, value: message };
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Get the file path for storing progress
 */
function getProgressFilePath(config: ProgressConfig): Result<string> {
  if (config.filePath) {
    const validation = validateFilePath(config.filePath);
    if (!validation.ok) {
      return validation;
    }
    return { ok: true, value: config.filePath };
  }

  const id = config.id || 'default';
  const idValidation = validateId(id);
  if (!idValidation.ok) {
    return idValidation;
  }

  return { ok: true, value: join(tmpdir(), `progress-${id}.json`) };
}

/**
 * Atomically write progress state to file
 * Uses write-then-rename pattern for atomic updates
 */
function writeProgressAtomic(filePath: string, state: ProgressState): Result<void> {
  try {
    const tempPath = `${filePath}.tmp.${randomBytes(8).toString('hex')}`;
    const json = JSON.stringify(state, null, 2);

    // Write to temp file
    writeFileSync(tempPath, json, { encoding: 'utf-8', mode: 0o644 });

    // Atomic rename
    renameSync(tempPath, filePath);

    return { ok: true, value: undefined };
  } catch (error: unknown) {
    const err = error as Error;
    return { ok: false, error: `Failed to write progress: ${err.message}` };
  }
}

/**
 * Read progress state from file
 */
function readProgress(filePath: string): Result<ProgressState> {
  try {
    if (!existsSync(filePath)) {
      return { ok: false, error: 'Progress file does not exist' };
    }

    const json = readFileSync(filePath, { encoding: 'utf-8' });
    const state = JSON.parse(json) as ProgressState;

    // Validate structure
    if (typeof state.total !== 'number' || typeof state.current !== 'number') {
      return { ok: false, error: 'Invalid progress file format' };
    }

    return { ok: true, value: state };
  } catch (error: unknown) {
    const err = error as Error;
    return { ok: false, error: `Failed to read progress: ${err.message}` };
  }
}

/**
 * Initialize progress tracking
 *
 * @param total - Total units of work
 * @param message - Initial progress message
 * @param config - Configuration options
 * @returns Result indicating success or failure
 */
export function init(
  total: number,
  message: string,
  config: ProgressConfig = {}
): Result<ProgressState> {
  if (isNaN(total) || total <= 0) {
    return { ok: false, error: 'Total must be a valid number greater than 0' };
  }

  const now = Date.now();
  const state: ProgressState = {
    total,
    current: 0,
    message,
    percentage: 0,
    startTime: now,
    updatedTime: now,
    complete: false,
  };

  const filePathResult = getProgressFilePath(config);
  if (!filePathResult.ok) {
    return filePathResult as Result<ProgressState>;
  }

  const writeResult = writeProgressAtomic(filePathResult.value, state);

  if (!writeResult.ok) {
    return writeResult as Result<ProgressState>;
  }

  return { ok: true, value: state };
}

/**
 * Increment progress by a specified amount
 *
 * @param amount - Amount to increment (default: 1)
 * @param message - Optional new message
 * @param config - Configuration options
 * @returns Result with updated state
 */
export function increment(
  amount: number = 1,
  message?: string,
  config: ProgressConfig = {}
): Result<ProgressState> {
  if (amount < 0) {
    return { ok: false, error: 'Increment amount must be non-negative' };
  }

  const filePathResult = getProgressFilePath(config);
  if (!filePathResult.ok) {
    return filePathResult;
  }

  const readResult = readProgress(filePathResult.value);

  if (!readResult.ok) {
    return readResult;
  }

  const state = readResult.value;
  state.current = Math.min(state.current + amount, state.total);
  state.percentage = Math.round((state.current / state.total) * 100);
  state.updatedTime = Date.now();

  if (message) {
    state.message = message;
  }

  if (state.current >= state.total) {
    state.complete = true;
  }

  const writeResult = writeProgressAtomic(filePathResult.value, state);

  if (!writeResult.ok) {
    return writeResult as Result<ProgressState>;
  }

  return { ok: true, value: state };
}

/**
 * Set progress to an absolute value
 *
 * @param current - Current progress value
 * @param message - Optional new message
 * @param config - Configuration options
 * @returns Result with updated state
 */
export function set(
  current: number,
  message?: string,
  config: ProgressConfig = {}
): Result<ProgressState> {
  if (current < 0) {
    return { ok: false, error: 'Current value must be non-negative' };
  }

  const filePathResult = getProgressFilePath(config);
  if (!filePathResult.ok) {
    return filePathResult;
  }

  const readResult = readProgress(filePathResult.value);

  if (!readResult.ok) {
    return readResult;
  }

  const state = readResult.value;
  state.current = Math.min(current, state.total);
  state.percentage = Math.round((state.current / state.total) * 100);
  state.updatedTime = Date.now();

  if (message) {
    state.message = message;
  }

  if (state.current >= state.total) {
    state.complete = true;
  }

  const writeResult = writeProgressAtomic(filePathResult.value, state);

  if (!writeResult.ok) {
    return writeResult as Result<ProgressState>;
  }

  return { ok: true, value: state };
}

/**
 * Mark progress as complete
 *
 * @param message - Optional completion message
 * @param config - Configuration options
 * @returns Result with final state
 */
export function finish(
  message?: string,
  config: ProgressConfig = {}
): Result<ProgressState> {
  const filePathResult = getProgressFilePath(config);
  if (!filePathResult.ok) {
    return filePathResult;
  }

  const readResult = readProgress(filePathResult.value);

  if (!readResult.ok) {
    return readResult;
  }

  const state = readResult.value;
  state.current = state.total;
  state.percentage = 100;
  state.complete = true;
  state.updatedTime = Date.now();

  if (message) {
    state.message = message;
  }

  const writeResult = writeProgressAtomic(filePathResult.value, state);

  if (!writeResult.ok) {
    return writeResult as Result<ProgressState>;
  }

  return { ok: true, value: state };
}

/**
 * Get current progress state
 *
 * @param config - Configuration options
 * @returns Result with current state
 */
export function get(config: ProgressConfig = {}): Result<ProgressState> {
  const filePathResult = getProgressFilePath(config);
  if (!filePathResult.ok) {
    return filePathResult;
  }
  return readProgress(filePathResult.value);
}

/**
 * Clear progress file
 *
 * @param config - Configuration options
 * @returns Result indicating success or failure
 */
export function clear(config: ProgressConfig = {}): Result<void> {
  try {
    const filePathResult = getProgressFilePath(config);
    if (!filePathResult.ok) {
      return filePathResult;
    }

    if (existsSync(filePathResult.value)) {
      unlinkSync(filePathResult.value);
    }

    return { ok: true, value: undefined };
  } catch (error: unknown) {
    const err = error as Error;
    return { ok: false, error: `Failed to clear progress: ${err.message}` };
  }
}

/**
 * Format progress state as a human-readable string
 *
 * @param state - Progress state to format
 * @returns Formatted string
 */
export function formatProgress(state: ProgressState): string {
  const elapsed = state.updatedTime - state.startTime;
  const elapsedSeconds = Math.floor(elapsed / 1000);

  return `[${state.percentage}%] ${state.current}/${state.total} - ${state.message} (${elapsedSeconds}s)`;
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  command: 'init' | 'increment' | 'set' | 'get' | 'finish' | 'clear';
  total?: number;
  amount?: number;
  current?: number;
  message?: string;
  id?: string;
} | { command: 'help' } {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { command: 'help' };
  }

  const command = args[0] as 'init' | 'increment' | 'set' | 'get' | 'finish' | 'clear';
  const result: ReturnType<typeof parseArgs> = { command } as ReturnType<typeof parseArgs>;

  for (let i = 1; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (!value) continue; // Skip if no value provided

    switch (flag) {
      case '--total':
        (result as { total?: number }).total = parseInt(value, 10);
        break;
      case '--amount':
        (result as { amount?: number }).amount = parseInt(value, 10);
        break;
      case '--current':
        (result as { current?: number }).current = parseInt(value, 10);
        break;
      case '--message':
        (result as { message?: string }).message = value;
        break;
      case '--id':
        (result as { id?: string }).id = value;
        break;
    }
  }

  return result;
}

// CLI entry point - only runs when executed directly
function main(): void {
  const args = globalThis.process?.argv?.slice(2) ?? [];
  const parsed = parseArgs(args);

  if (parsed.command === 'help') {
    console.log(`Usage: cli-progress-reporting <command> [options]

Commands:
  init       Initialize progress tracking
  increment  Increment progress by amount (default: 1)
  set        Set progress to absolute value
  get        Get current progress state
  finish     Mark progress as complete
  clear      Clear progress file

Options:
  --total <n>      Total units of work (for init)
  --amount <n>     Amount to increment (for increment, default: 1)
  --current <n>    Current progress value (for set)
  --message <msg>  Progress message
  --id <id>        Progress tracker ID (default: 'default')

Examples:
  # Initialize progress
  cli-progress-reporting init --total 100 --message "Processing files"

  # Increment progress
  cli-progress-reporting increment --amount 1 --id myproject

  # Get current state
  cli-progress-reporting get --id myproject

  # Finish progress
  cli-progress-reporting finish --message "Done!" --id myproject`);
    return;
  }

  const config: ProgressConfig = {};
  if ('id' in parsed && parsed.id) {
    config.id = parsed.id;
  }

  let result: Result<ProgressState | void>;

  switch (parsed.command) {
    case 'init':
      if (!('total' in parsed) || parsed.total === undefined || !('message' in parsed) || !parsed.message) {
        console.error('Error: init requires --total and --message');
        globalThis.process?.exit(1);
        return;
      }
      result = init(parsed.total, parsed.message, config);
      break;

    case 'increment':
      const amount = 'amount' in parsed && parsed.amount ? parsed.amount : 1;
      const incrementMsg = 'message' in parsed ? parsed.message : undefined;
      result = increment(amount, incrementMsg, config);
      break;

    case 'set':
      if (!('current' in parsed) || parsed.current === undefined) {
        console.error('Error: set requires --current');
        globalThis.process?.exit(1);
        return;
      }
      const setMsg = 'message' in parsed ? parsed.message : undefined;
      result = set(parsed.current, setMsg, config);
      break;

    case 'get':
      result = get(config);
      break;

    case 'finish':
      const finishMsg = 'message' in parsed ? parsed.message : undefined;
      result = finish(finishMsg, config);
      break;

    case 'clear':
      result = clear(config);
      break;

    default:
      console.error(`Error: Unknown command '${(parsed as { command: string }).command}'`);
      console.error('Run with --help for usage information');
      globalThis.process?.exit(1);
      return;
  }

  if (result.ok) {
    if (result.value) {
      console.log(JSON.stringify(result.value, null, 2));
    } else {
      console.log('Success');
    }
  } else {
    console.error(`Error: ${result.error}`);
    globalThis.process?.exit(1);
  }
}

// Check if this module is being run directly
// Must resolve symlinks for npm link support (argv1 may be symlink path)
const argv1 = globalThis.process?.argv?.[1];
if (argv1) {
  try {
    const realPath = realpathSync(argv1);
    if (import.meta.url === `file://${realPath}`) {
      main();
    }
  } catch {
    // Fallback for non-existent paths
    if (import.meta.url === `file://${argv1}`) {
      main();
    }
  }
}
