/**
 * CLI Command Executor
 *
 * Executes parsed commands and handles output formatting.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ParsedCommand } from './parser.js';
import { MultiProgress } from '../multi-progress.js';
import type { Result } from '../index.js';
import type { ProgressState, ProgressConfig } from '../index.js';
import { init, increment as incrementFn, set as setFn, finish as finishFn, get as getFn, clear as clearFn } from '../index.js';

/**
 * Execute a parsed command
 */
export function executeCommand(command: ParsedCommand): void {
  switch (command.type) {
    case 'single':
      executeSingleCommand(command);
      break;
    case 'multi':
      executeMultiCommand(command);
      break;
    case 'global':
      executeGlobalCommand(command);
      break;
  }
}

/**
 * Execute single progress tracker command (using functional API)
 */
function executeSingleCommand(command: Extract<ParsedCommand, { type: 'single' }>): void {
  const config: ProgressConfig = { id: command.trackerId };
  let result: Result<ProgressState | void>;

  switch (command.action) {
    case 'init':
      result = init(command.total, command.message || 'Processing', config);
      break;

    case 'inc':
      result = incrementFn(command.amount || 1, command.message, config);
      break;

    case 'set':
      result = setFn(command.current, command.message, config);
      break;

    case 'get':
      result = getFn(config);
      break;

    case 'done':
      result = finishFn(command.message, config);
      break;

    case 'clear':
      result = clearFn(config);
      break;
  }

  handleResult(result);
}

/**
 * Execute multi-progress command
 */
function executeMultiCommand(command: Extract<ParsedCommand, { type: 'multi' }>): void {
  const multi = new MultiProgress({ id: command.multiId });

  switch (command.action) {
    case 'init': {
      // Multi-progress container is auto-initialized in constructor
      const result = multi.status();
      handleResult(result);
      break;
    }

    case 'add': {
      const tracker = multi.add({
        trackerId: command.trackerId,
        total: command.total,
        message: command.message || 'Processing',
      });
      const result = tracker.get();
      handleResult(result);
      break;
    }

    case 'status': {
      const result = multi.status();
      handleResult(result);
      break;
    }

    case 'done': {
      // Mark all trackers as complete
      const getAllResult = multi.getAll();
      if (getAllResult.ok) {
        for (const { tracker } of getAllResult.value) {
          tracker.done();
        }
      }
      const result = multi.status();
      handleResult(result);
      break;
    }

    case 'clear': {
      // Remove all trackers
      const getAllResult = multi.getAll();
      if (getAllResult.ok) {
        for (const { id } of getAllResult.value) {
          multi.remove(id);
        }
      }
      // Also clear the multi-progress file
      const config: ProgressConfig = { id: `multi-${command.multiId}` };
      const result = clearFn(config);
      handleResult(result);
      break;
    }
  }
}

/**
 * Execute global command
 */
function executeGlobalCommand(command: Extract<ParsedCommand, { type: 'global' }>): void {
  switch (command.action) {
    case 'list':
      listAllTrackers();
      break;

    case 'version':
      showVersion();
      break;

    case 'help':
      showHelp(command.command);
      break;
  }
}


/**
 * Handle command result and output
 */
function handleResult(result: Result<any>): void {
  if (result.ok) {
    if (result.value) {
      console.log(JSON.stringify(result.value, null, 2));
    } else {
      console.log('Success');
    }
    globalThis.process?.exit(0);
  } else {
    console.error(`Error: ${result.error}`);
    globalThis.process?.exit(1);
  }
}

/**
 * List all active trackers
 */
function listAllTrackers(): void {
  const tmpDir = tmpdir();
  const allFiles = readdirSync(tmpDir);

  // Default limit to prevent buffer overflow in tests/spawned processes
  const DEFAULT_LIMIT = 50;
  const limit = DEFAULT_LIMIT;

  const singleTrackers: string[] = [];
  const multiTrackers: string[] = [];

  for (const file of allFiles) {
    if (file.startsWith('progress-') && file.endsWith('.json')) {
      if (file.startsWith('progress-multi-')) {
        const id = file.slice('progress-multi-'.length, -'.json'.length);
        multiTrackers.push(id);
      } else {
        const id = file.slice('progress-'.length, -'.json'.length);
        singleTrackers.push(id);
      }
    }
  }

  const totalTrackers = singleTrackers.length + multiTrackers.length;
  const sortedSingle = singleTrackers.sort();
  const sortedMulti = multiTrackers.sort();

  console.log('Active Progress Trackers:');
  console.log('');

  let displayed = 0;

  if (sortedSingle.length > 0) {
    console.log('Single Trackers:');
    const singleLimit = Math.min(sortedSingle.length, limit - displayed);
    for (let i = 0; i < singleLimit; i++) {
      const id = sortedSingle[i];
      const filePath = join(tmpDir, `progress-${id}.json`);
      try {
        const state = JSON.parse(readFileSync(filePath, 'utf-8')) as ProgressState;
        const status = state.complete ? '✓' : '⏳';
        console.log(`  ${status} ${id}: ${state.percentage}% - ${state.message}`);
        displayed++;
      } catch {
        console.log(`  ⚠ ${id}: (invalid state)`);
        displayed++;
      }
    }
    if (sortedSingle.length > singleLimit) {
      console.log(`  ... and ${sortedSingle.length - singleLimit} more single tracker(s)`);
    }
    console.log('');
  }

  if (sortedMulti.length > 0 && displayed < limit) {
    console.log('Multi Trackers:');
    const multiLimit = Math.min(sortedMulti.length, limit - displayed);
    for (let i = 0; i < multiLimit; i++) {
      const id = sortedMulti[i];
      const filePath = join(tmpDir, `progress-multi-${id}.json`);
      try {
        const multiState = JSON.parse(readFileSync(filePath, 'utf-8'));
        const trackers = multiState.trackers || {};
        const count = Object.keys(trackers).length;
        console.log(`  📊 ${id}: ${count} tracker(s)`);
        for (const [trackerId, state] of Object.entries(trackers as Record<string, ProgressState>)) {
          const status = state.complete ? '✓' : '⏳';
          console.log(`      ${status} ${trackerId}: ${state.percentage}% - ${state.message}`);
        }
        displayed++;
      } catch {
        console.log(`  ⚠ ${id}: (invalid state)`);
        displayed++;
      }
    }
    if (sortedMulti.length > multiLimit) {
      console.log(`  ... and ${sortedMulti.length - multiLimit} more multi tracker(s)`);
    }
    console.log('');
  }

  if (totalTrackers === 0) {
    console.log('  No active trackers found');
  } else if (totalTrackers > limit) {
    console.log(`Total: ${totalTrackers} tracker(s) (showing first ${limit})`);
  } else {
    console.log(`Total: ${totalTrackers} tracker(s)`);
  }

  globalThis.process?.exit(0);
}

/**
 * Show version information
 */
function showVersion(): void {
  // Read version from package.json
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    const packageJsonPath = join(dirname(currentFilePath), '../../package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      console.log(`CLI Progress Reporting v${packageJson.version}`);
    } else {
      console.log('CLI Progress Reporting (version unknown)');
    }
  } catch {
    console.log('CLI Progress Reporting (version unknown)');
  }
  globalThis.process?.exit(0);
}

/**
 * Show help message
 */
function showHelp(command?: string): void {
  if (command) {
    showCommandHelp(command);
  } else {
    showGeneralHelp();
  }
  globalThis.process?.exit(0);
}

/**
 * Show general help
 */
function showGeneralHelp(): void {
  console.log(`CLI Progress Reporting - Concurrent-safe progress tracking

Usage: prog <command> [options]

Single Progress Commands:
  prog <tracker-id> init <total> [--message <msg>]    Initialize progress tracker
  prog <tracker-id> inc [<amount>] [--message <msg>]  Increment progress
  prog <tracker-id> set <current> [--message <msg>]   Set absolute progress
  prog <tracker-id> get                               Get current state
  prog <tracker-id> done [<message>]                  Mark as complete
  prog <tracker-id> clear                             Clear progress file

Multi-Progress Commands:
  prog multi <multi-id> init                          Initialize multi-progress
  prog multi <multi-id> add <id> <total> [--message]  Add tracker to multi-progress
  prog multi <multi-id> status                        Get all tracker states
  prog multi <multi-id> done                          Mark all trackers complete
  prog multi <multi-id> clear                         Clear multi-progress

Global Commands:
  prog list                                           List all active trackers
  prog version                                        Show version
  prog help [<command>]                               Show help

Examples:
  # Single tracker
  prog myproject init 100 --message "Processing files"
  prog myproject inc 5
  prog myproject get
  prog myproject done "Complete!"

  # Multi-progress
  prog multi pipeline init
  prog multi pipeline add downloads 50 --message "Downloading"
  prog multi pipeline add uploads 30 --message "Uploading"
  prog multi pipeline status
  prog multi pipeline done

  # Global
  prog list
  prog version

For more details: prog help <command>`);
}

/**
 * Show help for specific command
 */
function showCommandHelp(command: string): void {
  const helpText: Record<string, string> = {
    init: `prog <tracker-id> init <total> [--message <msg>]

Initialize a new progress tracker.

Arguments:
  <tracker-id>  Unique identifier for this tracker
  <total>       Total units of work (must be > 0)

Options:
  --message     Initial progress message (default: "Processing")

Example:
  prog myproject init 100 --message "Processing files"`,

    inc: `prog <tracker-id> inc [<amount>] [--message <msg>]

Increment progress by amount.

Arguments:
  <tracker-id>  Unique identifier for the tracker
  <amount>      Amount to increment (default: 1)

Options:
  --message     Optional progress message

Example:
  prog myproject inc 5
  prog myproject inc 10 --message "Uploaded batch 1"`,

    set: `prog <tracker-id> set <current> [--message <msg>]

Set absolute progress value.

Arguments:
  <tracker-id>  Unique identifier for the tracker
  <current>     New current progress value (>= 0)

Options:
  --message     Optional progress message

Example:
  prog myproject set 75
  prog myproject set 90 --message "Almost done"`,

    get: `prog <tracker-id> get

Get current progress state (outputs JSON).

Arguments:
  <tracker-id>  Unique identifier for the tracker

Example:
  prog myproject get`,

    done: `prog <tracker-id> done [<message>]

Mark progress as complete.

Arguments:
  <tracker-id>  Unique identifier for the tracker
  <message>     Optional completion message

Example:
  prog myproject done
  prog myproject done "All files processed!"`,

    clear: `prog <tracker-id> clear

Clear progress file and remove tracker.

Arguments:
  <tracker-id>  Unique identifier for the tracker

Example:
  prog myproject clear`,

    multi: `prog multi <multi-id> <action> [args...]

Manage multiple progress trackers simultaneously.

Actions:
  init                          Initialize multi-progress
  add <id> <total> [--message]  Add tracker to multi-progress
  status                        Get all tracker states
  done                          Mark all trackers complete
  clear                         Clear multi-progress

Examples:
  prog multi pipeline init
  prog multi pipeline add downloads 50 --message "Downloading"
  prog multi pipeline status
  prog multi pipeline done`,

    list: `prog list

List all active progress trackers (single and multi).

Example:
  prog list`,

    version: `prog version

Show CLI Progress Reporting version.

Example:
  prog version`,
  };

  if (command in helpText) {
    console.log(helpText[command]);
  } else {
    console.error(`Unknown command: ${command}`);
    console.error('Run "prog help" for available commands');
    globalThis.process?.exit(1);
  }
}
