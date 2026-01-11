/**
 * CLI Command Parser for Nested Command Structure
 *
 * Supports both new nested commands and legacy flat commands (with deprecation warnings).
 */

// =============================================================================
// Command Types
// =============================================================================

/**
 * Single progress tracker commands
 */
export type SingleCommand =
  | { type: 'single'; trackerId: string; action: 'init'; total: number; message?: string }
  | { type: 'single'; trackerId: string; action: 'inc'; amount?: number; message?: string }
  | { type: 'single'; trackerId: string; action: 'set'; current: number; message?: string }
  | { type: 'single'; trackerId: string; action: 'get' }
  | { type: 'single'; trackerId: string; action: 'done'; message?: string }
  | { type: 'single'; trackerId: string; action: 'clear' };

/**
 * Multi-progress tracker commands
 */
export type MultiCommand =
  | { type: 'multi'; multiId: string; action: 'init' }
  | { type: 'multi'; multiId: string; action: 'add'; trackerId: string; total: number; message?: string }
  | { type: 'multi'; multiId: string; action: 'status' }
  | { type: 'multi'; multiId: string; action: 'done' }
  | { type: 'multi'; multiId: string; action: 'clear' };

/**
 * Global commands
 */
export type GlobalCommand =
  | { type: 'global'; action: 'list' }
  | { type: 'global'; action: 'version' }
  | { type: 'global'; action: 'help'; command?: string };

/**
 * Legacy flat commands (for backward compatibility)
 */
export type LegacyCommand =
  | { type: 'legacy'; command: 'init'; total: number; message: string; id?: string }
  | { type: 'legacy'; command: 'increment'; amount?: number; message?: string; id?: string }
  | { type: 'legacy'; command: 'set'; current: number; message?: string; id?: string }
  | { type: 'legacy'; command: 'get'; id?: string }
  | { type: 'legacy'; command: 'finish'; message?: string; id?: string }
  | { type: 'legacy'; command: 'clear'; id?: string };

/**
 * All possible parsed commands
 */
export type ParsedCommand = SingleCommand | MultiCommand | GlobalCommand | LegacyCommand;

/**
 * Parse result
 */
export type ParseResult =
  | { ok: true; command: ParsedCommand }
  | { ok: false; error: string };

// =============================================================================
// Parser Implementation
// =============================================================================

/**
 * Parse command line arguments into structured command
 */
export function parseCommand(args: string[]): ParseResult {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { ok: true, command: { type: 'global', action: 'help' } };
  }

  const firstArg = args[0];

  // Global commands (no subcommand)
  if (firstArg === 'list') {
    return { ok: true, command: { type: 'global', action: 'list' } };
  }

  if (firstArg === 'version') {
    return { ok: true, command: { type: 'global', action: 'version' } };
  }

  if (firstArg === 'help') {
    const helpCommand = args[1];
    return { ok: true, command: { type: 'global', action: 'help', command: helpCommand } };
  }

  // Multi-progress commands: prog multi <multi-id> <action>
  if (firstArg === 'multi') {
    return parseMultiCommand(args.slice(1));
  }

  // Check if this is a legacy flat command (--flag syntax)
  if (isLegacyCommand(args)) {
    return parseLegacyCommand(args);
  }

  // Single progress commands: prog <tracker-id> <action>
  return parseSingleCommand(args);
}

/**
 * Parse single progress tracker command
 */
function parseSingleCommand(args: string[]): ParseResult {
  if (args.length < 2) {
    return { ok: false, error: 'Single progress commands require tracker ID and action' };
  }

  const trackerId = args[0]!; // Safe: length check ensures args[0] exists
  const action = args[1]!;     // Safe: length check ensures args[1] exists
  const restArgs = args.slice(2);

  // Validate tracker ID
  if (!isValidId(trackerId)) {
    return { ok: false, error: `Invalid tracker ID: ${trackerId}` };
  }

  switch (action) {
    case 'init': {
      if (restArgs.length < 1) {
        return { ok: false, error: 'init requires <total>' };
      }
      const total = parseInt(restArgs[0]!, 10); // Safe: length check ensures restArgs[0] exists
      if (isNaN(total) || total <= 0) {
        return { ok: false, error: 'total must be a positive number' };
      }
      const message = parseFlag(restArgs, '--message');
      return {
        ok: true,
        command: {
          type: 'single',
          trackerId,
          action: 'init',
          total,
          ...(message !== undefined ? { message } : {})
        },
      };
    }

    case 'inc': {
      const amountStr = restArgs[0] && !restArgs[0].startsWith('--') ? restArgs[0] : undefined;
      const amount = amountStr ? parseInt(amountStr, 10) : undefined;
      if (amount !== undefined && (isNaN(amount) || amount < 0)) {
        return { ok: false, error: 'amount must be a non-negative number' };
      }
      const message = parseFlag(restArgs, '--message');
      return {
        ok: true,
        command: {
          type: 'single',
          trackerId,
          action: 'inc',
          ...(amount !== undefined ? { amount } : {}),
          ...(message !== undefined ? { message } : {})
        },
      };
    }

    case 'set': {
      if (restArgs.length < 1) {
        return { ok: false, error: 'set requires <current>' };
      }
      const current = parseInt(restArgs[0]!, 10); // Safe: length check ensures restArgs[0] exists
      if (isNaN(current) || current < 0) {
        return { ok: false, error: 'current must be a non-negative number' };
      }
      const message = parseFlag(restArgs, '--message');
      return {
        ok: true,
        command: {
          type: 'single',
          trackerId,
          action: 'set',
          current,
          ...(message !== undefined ? { message } : {})
        },
      };
    }

    case 'get':
      return {
        ok: true,
        command: { type: 'single', trackerId, action: 'get' },
      };

    case 'done': {
      const message = restArgs[0] && !restArgs[0].startsWith('--') ? restArgs[0] : undefined;
      return {
        ok: true,
        command: {
          type: 'single',
          trackerId,
          action: 'done',
          ...(message !== undefined ? { message } : {})
        },
      };
    }

    case 'clear':
      return {
        ok: true,
        command: { type: 'single', trackerId, action: 'clear' },
      };

    default:
      return { ok: false, error: `Unknown action: ${action}` };
  }
}

/**
 * Parse multi-progress command
 */
function parseMultiCommand(args: string[]): ParseResult {
  if (args.length < 2) {
    return { ok: false, error: 'Multi-progress commands require multi ID and action' };
  }

  const multiId = args[0]!; // Safe: length check ensures args[0] exists
  const action = args[1]!;   // Safe: length check ensures args[1] exists
  const restArgs = args.slice(2);

  // Validate multi ID
  if (!isValidId(multiId)) {
    return { ok: false, error: `Invalid multi ID: ${multiId}` };
  }

  switch (action) {
    case 'init':
      return {
        ok: true,
        command: { type: 'multi', multiId, action: 'init' },
      };

    case 'add': {
      if (restArgs.length < 2) {
        return { ok: false, error: 'add requires <tracker-id> <total>' };
      }
      const trackerId = restArgs[0]!; // Safe: length check ensures restArgs[0] exists
      const total = parseInt(restArgs[1]!, 10); // Safe: length check ensures restArgs[1] exists
      if (!isValidId(trackerId)) {
        return { ok: false, error: `Invalid tracker ID: ${trackerId}` };
      }
      if (isNaN(total) || total <= 0) {
        return { ok: false, error: 'total must be a positive number' };
      }
      const message = parseFlag(restArgs, '--message');
      return {
        ok: true,
        command: {
          type: 'multi',
          multiId,
          action: 'add',
          trackerId,
          total,
          ...(message !== undefined ? { message } : {})
        },
      };
    }

    case 'status':
      return {
        ok: true,
        command: { type: 'multi', multiId, action: 'status' },
      };

    case 'done':
      return {
        ok: true,
        command: { type: 'multi', multiId, action: 'done' },
      };

    case 'clear':
      return {
        ok: true,
        command: { type: 'multi', multiId, action: 'clear' },
      };

    default:
      return { ok: false, error: `Unknown multi action: ${action}` };
  }
}

/**
 * Parse legacy flat command (for backward compatibility)
 */
function parseLegacyCommand(args: string[]): ParseResult {
  const command = args[0] as 'init' | 'increment' | 'set' | 'get' | 'finish' | 'clear';
  const flags = parseLegacyFlags(args.slice(1));

  switch (command) {
    case 'init':
      if (flags.total === undefined || flags.message === undefined) {
        return { ok: false, error: 'init requires --total and --message' };
      }
      return {
        ok: true,
        command: {
          type: 'legacy',
          command: 'init',
          total: flags.total,
          message: flags.message,
          ...(flags.id !== undefined ? { id: flags.id } : {}),
        },
      };

    case 'increment':
      return {
        ok: true,
        command: {
          type: 'legacy',
          command: 'increment',
          ...(flags.amount !== undefined ? { amount: flags.amount } : {}),
          ...(flags.message !== undefined ? { message: flags.message } : {}),
          ...(flags.id !== undefined ? { id: flags.id } : {}),
        },
      };

    case 'set':
      if (flags.current === undefined) {
        return { ok: false, error: 'set requires --current' };
      }
      return {
        ok: true,
        command: {
          type: 'legacy',
          command: 'set',
          current: flags.current,
          ...(flags.message !== undefined ? { message: flags.message } : {}),
          ...(flags.id !== undefined ? { id: flags.id } : {}),
        },
      };

    case 'get':
      return {
        ok: true,
        command: {
          type: 'legacy',
          command: 'get',
          ...(flags.id !== undefined ? { id: flags.id } : {}),
        },
      };

    case 'finish':
      return {
        ok: true,
        command: {
          type: 'legacy',
          command: 'finish',
          ...(flags.message !== undefined ? { message: flags.message } : {}),
          ...(flags.id !== undefined ? { id: flags.id } : {}),
        },
      };

    case 'clear':
      return {
        ok: true,
        command: {
          type: 'legacy',
          command: 'clear',
          ...(flags.id !== undefined ? { id: flags.id } : {}),
        },
      };

    default:
      return { ok: false, error: `Unknown legacy command: ${command}` };
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if arguments represent a legacy flat command
 */
function isLegacyCommand(args: string[]): boolean {
  const legacyCommands = ['init', 'increment', 'set', 'get', 'finish', 'clear'];
  return args.length > 0 && legacyCommands.includes(args[0]!) && args.some((arg) => arg.startsWith('--'));
}

/**
 * Validate that an ID is safe (alphanumeric, hyphens, underscores only)
 */
function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 0 && id.length <= 255;
}

/**
 * Parse a flag value from arguments
 */
function parseFlag(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return undefined;
  }
  return args[index + 1];
}

/**
 * Parse legacy flags (--flag value format)
 */
function parseLegacyFlags(args: string[]): {
  total?: number;
  amount?: number;
  current?: number;
  message?: string;
  id?: string;
} {
  const flags: ReturnType<typeof parseLegacyFlags> = {};

  for (let i = 0; i < args.length; i += 2) {
    const flag = args[i];
    const value = args[i + 1];

    if (!value) continue;

    switch (flag) {
      case '--total':
        flags.total = parseInt(value, 10);
        break;
      case '--amount':
        flags.amount = parseInt(value, 10);
        break;
      case '--current':
        flags.current = parseInt(value, 10);
        break;
      case '--message':
        flags.message = value;
        break;
      case '--id':
        flags.id = value;
        break;
    }
  }

  return flags;
}

/**
 * Get deprecation warning for legacy command
 */
export function getDeprecationWarning(command: LegacyCommand): string {
  const id = command.id || 'default';

  switch (command.command) {
    case 'init':
      return `⚠️  DEPRECATED: Use 'prog ${id} init ${command.total}${command.message ? ` --message "${command.message}"` : ''}' instead`;
    case 'increment':
      return `⚠️  DEPRECATED: Use 'prog ${id} inc${command.amount ? ` ${command.amount}` : ''}${command.message ? ` --message "${command.message}"` : ''}' instead`;
    case 'set':
      return `⚠️  DEPRECATED: Use 'prog ${id} set ${command.current}${command.message ? ` --message "${command.message}"` : ''}' instead`;
    case 'get':
      return `⚠️  DEPRECATED: Use 'prog ${id} get' instead`;
    case 'finish':
      return `⚠️  DEPRECATED: Use 'prog ${id} done${command.message ? ` "${command.message}"` : ''}' instead`;
    case 'clear':
      return `⚠️  DEPRECATED: Use 'prog ${id} clear' instead`;
  }
}
