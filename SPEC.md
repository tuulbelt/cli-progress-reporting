# CLI Progress Reporting - Formal Specification

**Version:** 0.3.0
**Last Updated:** 2026-01-11

This document provides the formal specification for CLI Progress Reporting, documenting all behavior, formats, and guarantees.

---

## Table of Contents

1. [Progress State Format](#1-progress-state-format)
2. [File Format Specification](#2-file-format-specification)
3. [Concurrent Safety Guarantees](#3-concurrent-safety-guarantees)
4. [Template System Specification](#4-template-system-specification)
5. [Streaming API Specification](#5-streaming-api-specification)
6. [CLI Protocol](#6-cli-protocol)
7. [Error Handling](#7-error-handling)

---

## 1. Progress State Format

### 1.1 ProgressState Interface

The `ProgressState` interface represents the complete state of a progress tracker at a point in time.

```typescript
interface ProgressState {
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
```

### 1.2 Field Constraints

| Field | Type | Range | Required | Description |
|-------|------|-------|----------|-------------|
| `total` | number | > 0 | Yes | Total units of work to complete |
| `current` | number | 0 ≤ current ≤ total | Yes | Units completed so far |
| `message` | string | - | Yes | Human-readable progress message |
| `percentage` | number | 0-100 | Yes | Computed from current/total |
| `startTime` | number | > 0 | Yes | Unix timestamp in milliseconds |
| `updatedTime` | number | ≥ startTime | Yes | Unix timestamp in milliseconds |
| `complete` | boolean | true/false | Yes | Whether progress is finished |

### 1.3 Derived Values

**Percentage Calculation:**
```
percentage = Math.round((current / total) * 100)
```

**Elapsed Time (seconds):**
```
elapsed = Math.floor((updatedTime - startTime) / 1000)
```

**ETA (estimated time remaining, seconds):**
```
if (current === 0) {
  eta = 0
} else {
  rate = current / elapsed
  remaining = total - current
  eta = Math.round(remaining / rate)
}
```

### 1.4 JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "total": {
      "type": "number",
      "minimum": 1,
      "description": "Total units of work"
    },
    "current": {
      "type": "number",
      "minimum": 0,
      "description": "Current units completed"
    },
    "message": {
      "type": "string",
      "description": "User-friendly progress message"
    },
    "percentage": {
      "type": "number",
      "minimum": 0,
      "maximum": 100,
      "description": "Percentage complete (0-100)"
    },
    "startTime": {
      "type": "number",
      "minimum": 0,
      "description": "Unix timestamp in milliseconds"
    },
    "updatedTime": {
      "type": "number",
      "minimum": 0,
      "description": "Unix timestamp in milliseconds"
    },
    "complete": {
      "type": "boolean",
      "description": "Whether progress is complete"
    }
  },
  "required": ["total", "current", "message", "percentage", "startTime", "updatedTime", "complete"]
}
```

---

## 2. File Format Specification

### 2.1 Single Progress File Format

**File Pattern:**
```
progress-{id}.json
```

**Location:**
- Default: `/tmp/progress-{id}.json`
- Custom: User-specified via `filePath` option

**Content Example:**
```json
{
  "total": 100,
  "current": 42,
  "message": "Processing files",
  "percentage": 42,
  "startTime": 1704931200000,
  "updatedTime": 1704931242000,
  "complete": false
}
```

**Encoding:** UTF-8

**Formatting:** Pretty-printed with 2-space indentation (for human readability)

**File Permissions:** `0o644` (rw-r--r--)

### 2.2 Multi-Progress File Format

**File Pattern:**
```
progress-multi-{multiProgressId}.json
```

**Content Example:**
```json
{
  "trackers": {
    "download": {
      "total": 1000,
      "current": 450,
      "message": "Downloading files",
      "percentage": 45,
      "startTime": 1704931200000,
      "updatedTime": 1704931242000,
      "complete": false
    },
    "process": {
      "total": 500,
      "current": 100,
      "message": "Processing data",
      "percentage": 20,
      "startTime": 1704931250000,
      "updatedTime": 1704931260000,
      "complete": false
    }
  }
}
```

**Root Structure:**
- `trackers`: Object mapping tracker IDs to ProgressState objects

### 2.3 Atomic Write Algorithm

To ensure concurrent safety, all writes follow this algorithm:

**Step 1: Generate temp file path**
```typescript
const tempPath = join(tmpdir(), `progress-${randomBytes(8).toString('hex')}.tmp`);
```

**Step 2: Write to temp file**
```typescript
writeFileSync(tempPath, json, { encoding: 'utf-8', mode: 0o644 });
```

**Step 3: Atomic rename**
```typescript
renameSync(tempPath, finalPath);
```

**Properties Guaranteed:**
- Readers never see partial writes (rename is atomic at OS level)
- Multiple writers don't corrupt files (OS serializes renames)
- Failures leave previous state intact (temp file is orphaned)

**Diagram:**

```
Writer Process A        Writer Process B        Reader Process C
─────────────────      ─────────────────      ─────────────────
                                               
1. Write to            1. Write to             
   temp-abc.tmp           temp-xyz.tmp         
                                               
2. Rename              (waiting)               
   temp-abc.tmp →                             
   progress.json                              
                                               
                       2. Rename               3. Read
                          temp-xyz.tmp →          progress.json
                          progress.json           (sees B's data)
                                               
                       ✓ No corruption!        ✓ Never partial!
```

### 2.4 Cleanup Policy

**Automatic Cleanup:**
- Single progress: Files deleted via `clear()` method
- Multi-progress: Individual trackers removed via `remove(trackerId)`
- Orphaned temp files: User responsibility (OS typically cleans `/tmp` on reboot)

**Manual Cleanup:**
```bash
# Remove all progress files
rm -f /tmp/progress-*.json

# Remove orphaned temp files
find /tmp -name "progress-*.tmp" -mtime +1 -delete
```

---

## 3. Concurrent Safety Guarantees

### 3.1 Multi-Process Safety

**Guarantee:** Multiple processes can safely update the same progress tracker without file corruption.

**How It Works:**
1. Each update writes to a unique temp file
2. Atomic `rename()` ensures only complete states are visible
3. OS-level rename serialization prevents race conditions

**Example Scenario:**

```
Process A                    Process B
─────────                    ─────────
read: current = 10           read: current = 10
compute: current + 1 = 11    compute: current + 1 = 11
write temp-abc.tmp           write temp-xyz.tmp
rename → progress.json       (waiting for A's rename to complete)
                             rename → progress.json
                             
Final state: current = 11 ✓
(Last writer wins, no corruption)
```

### 3.2 Read Operations

**Guarantee:** Read operations never see partial writes or corrupted data.

**Mechanism:**
- Readers use `readFileSync()` which is atomic for files <4KB (typical for progress state)
- Rename operations are atomic at kernel level
- Readers either see old state or new state, never mid-transition

**Edge Cases:**

| Scenario | Read Result | Notes |
|----------|-------------|-------|
| Read during write to temp | Previous state | Temp file not visible |
| Read during rename | Previous or new state | Depends on timing, both valid |
| Read after rename | New state | Always consistent |
| File deleted mid-read | Error (ENOENT) | Caller handles via Result type |

### 3.3 Lock-Free Design

**No Locks Used:**
- No file locks (flock, lockf)
- No mutex/semaphore primitives
- No busy-waiting

**Why Lock-Free:**
- Avoids deadlock scenarios
- No lock acquisition overhead
- Works across networked filesystems (NFS, CIFS)
- Survives process crashes (no orphaned locks)

**Trade-off:**
- Last writer wins (may lose increments if two processes increment simultaneously)
- For precise counting, use single writer pattern or external coordination

---

## 4. Template System Specification

### 4.1 Template Variable Syntax

Templates support variable substitution using `{{variable}}` syntax.

**Grammar:**
```
template     := (text | variable)*
variable     := "{{" identifier "}}"
identifier   := [a-zA-Z_][a-zA-Z0-9_]*
text         := any characters except "{{"
```

**Example:**
```
"{{message}}: {{current}}/{{total}} ({{percentage}}%)"
→
"Processing files: 42/100 (42%)"
```

### 4.2 Supported Variables

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `percentage` | number | Completion percentage (0-100) | `42` |
| `current` | number | Current progress value | `42` |
| `total` | number | Total work units | `100` |
| `message` | string | User-provided message | `"Processing files"` |
| `elapsed` | number | Elapsed seconds | `120` |
| `eta` | number | Estimated seconds remaining | `180` |
| `spinner` | string | Animated spinner character | `⠋` |
| `bar` | string | Progress bar visualization | `████████░░` |

### 4.3 Built-in Templates

**Percentage Template:**
```typescript
"{{percentage}}%"
// Output: "42%"
```

**Bar Template:**
```typescript
"{{bar}} {{percentage}}%"
// Output: "████████░░░░░░░░░░░░ 42%"
```

**Spinner Template:**
```typescript
"{{spinner}} {{message}}"
// Output: "⠋ Processing files"
```

**Minimal Template:**
```typescript
"{{current}}/{{total}}"
// Output: "42/100"
```

**Detailed Template:**
```typescript
"{{message}}: {{current}}/{{total}} ({{percentage}}%) [{{elapsed}}s elapsed, {{eta}}s remaining]"
// Output: "Processing files: 42/100 (42%) [120s elapsed, 180s remaining]"
```

### 4.4 Function Templates

Templates can also be functions for full customization:

```typescript
type Template = string | ((vars: TemplateVariables) => string);

const customTemplate = (vars: TemplateVariables) => {
  const color = vars.percentage < 50 ? 'red' : 'green';
  return `[${color}] ${vars.message}: ${vars.percentage}%`;
};
```

### 4.5 Spinner Frame Rotation

**Frame Sets:**
```typescript
const spinners = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
  line: ['|', '/', '-', '\\'],
  arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
  box: ['◰', '◳', '◲', '◱'],
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
};
```

**Rotation Algorithm:**
```typescript
class TemplateEngine {
  private spinnerFrame: number = 0;
  private spinnerFrames: readonly string[] = spinners.dots;

  getSpinnerChar(): string {
    const char = this.spinnerFrames[this.spinnerFrame];
    this.spinnerFrame = (this.spinnerFrame + 1) % this.spinnerFrames.length;
    return char;
  }
}
```

**Usage:**
```typescript
const engine = new TemplateEngine({ spinnerFrames: spinners.line });

engine.render('{{spinner}}', state); // "|"
engine.render('{{spinner}}', state); // "/"
engine.render('{{spinner}}', state); // "-"
engine.render('{{spinner}}', state); // "\\"
engine.render('{{spinner}}', state); // "|" (wraps)
```

### 4.6 Progress Bar Rendering

**Algorithm:**
```typescript
function renderBar(percentage: number, width: number = 20): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}
```

**Examples:**
```
percentage = 0,   width = 20: "░░░░░░░░░░░░░░░░░░░░"
percentage = 25,  width = 20: "█████░░░░░░░░░░░░░░░"
percentage = 50,  width = 20: "██████████░░░░░░░░░░"
percentage = 100, width = 20: "████████████████████"
```

---

## 5. Streaming API Specification

### 5.1 ProgressStream - Async Iterator Protocol

**Interface:**
```typescript
class ProgressStream implements AsyncIterableIterator<ProgressState> {
  async next(): Promise<IteratorResult<ProgressState>>;
  async return(value?: ProgressState): Promise<IteratorResult<ProgressState>>;
  async throw(error?: unknown): Promise<IteratorResult<ProgressState>>;
  [Symbol.asyncIterator](): AsyncIterableIterator<ProgressState>;
}
```

**Behavior:**

| Method | Behavior | Returns |
|--------|----------|---------|
| `next()` | Increments progress by `incrementAmount` | `{ done: false, value: ProgressState }` |
| `return()` | Marks progress as complete | `{ done: true, value?: ProgressState }` |
| `throw(err)` | Marks progress as failed, then throws | Never returns (throws) |
| `[Symbol.asyncIterator]()` | Returns self | `this` |

**State Transitions:**
```
[Created] → next() → [Active] → next() → ... → return() → [Done]
                         ↓
                     throw(err) → [Failed + thrown]
```

**For-Await-Of Support:**
```typescript
async function* processItems() {
  const stream = new ProgressStream({
    total: 10,
    message: 'Processing',
    id: 'task-1',
  });

  for (let i = 0; i < 10; i++) {
    const result = await stream.next();
    if (!result.done && result.value) {
      yield result.value; // Yield ProgressState
    }
  }

  await stream.return();
}

// Consumer
for await (const state of processItems()) {
  console.log(`Progress: ${state.percentage}%`);
}
```

### 5.2 ProgressTransform - Node.js Stream Integration

**Interface:**
```typescript
class ProgressTransform extends Transform {
  constructor(config: StreamProgressConfig);
  getProgress(): ProgressState;
  
  // Events
  on(event: 'progress', listener: (state: ProgressState) => void): this;
}
```

**Behavior:**

| Event | When Emitted | Payload |
|-------|-------------|---------|
| `'progress'` | After each chunk (if updateInterval allows) | `ProgressState` |
| `'finish'` | When stream ends | (none) |
| `'error'` | On processing error | `Error` |

**Update Throttling:**
```typescript
interface StreamProgressConfig {
  total: number;
  message: string;
  id: string;
  updateInterval?: number; // Bytes between progress events (0 = every chunk)
}
```

**Algorithm:**
```typescript
_transform(chunk, encoding, callback) {
  bytesProcessed += chunkSize;
  
  if (updateInterval === 0 || (bytesProcessed - lastEmitted) >= updateInterval) {
    tracker.update(bytesProcessed);
    emit('progress', state);
    lastEmitted = bytesProcessed;
  }
  
  callback(null, chunk); // Pass through
}
```

**Example Pipeline:**
```typescript
const readStream = createReadStream('large-file.txt');
const progressStream = new ProgressTransform({
  total: fileSize,
  message: 'Reading file',
  id: 'file-read',
  updateInterval: 1024 * 1024, // Emit every 1MB
});
const writeStream = createWriteStream('output.txt');

progressStream.on('progress', (state) => {
  console.log(`Read ${state.percentage}%`);
});

await pipeline(readStream, progressStream, writeStream);
```

---

## 6. CLI Protocol

### 6.1 Command Structure

**General Format:**
```
prog <command> [options] [arguments]
```

**Commands:**

| Command | Arguments | Description |
|---------|-----------|-------------|
| `init` | `--total <n>` `--message <msg>` `--id <id>` | Initialize new progress tracker |
| `increment` | `[amount]` `--id <id>` `[--message <msg>]` | Increment progress |
| `update` | `<value>` `--id <id>` `[--message <msg>]` | Set progress to specific value |
| `done` | `--id <id>` `[--message <msg>]` | Mark progress complete |
| `get` | `--id <id>` | Get current progress state |
| `clear` | `--id <id>` | Clear progress file |
| `status` | `--id <id>` | Get multi-progress status |
| `list` | - | List all active progress trackers |
| `version` | - | Show version information |
| `help` | - | Show help information |

### 6.2 Exit Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `0` | Success | Command completed successfully |
| `1` | Error | Any error (invalid args, file I/O failure, etc.) |

**No other exit codes are used.**

### 6.3 Output Format

**Stdout:**
- JSON format by default
- Human-readable format with `--format text` (future)
- Empty on success for mutating commands (init, increment, update, done, clear)
- JSON object on success for query commands (get, status)

**Stderr:**
- Error messages only
- Format: `Error: <message>`
- Includes usage hint: `Run "prog help" for usage information`

**Example Success (get):**
```bash
$ prog get --id my-task
{"total":100,"current":42,"message":"Processing","percentage":42,"startTime":1704931200000,"updatedTime":1704931242000,"complete":false}
```

**Example Error:**
```bash
$ prog get --id nonexistent
Error: Failed to read progress: ENOENT: no such file or directory
Run "prog help" for usage information
```

### 6.4 Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PROGRESS_DIR` | string | `/tmp` | Directory for progress files |

**Example:**
```bash
export PROGRESS_DIR=/var/run/progress
prog init --total 100 --message "Task" --id my-task
# Creates: /var/run/progress/progress-my-task.json
```

---

## 7. Error Handling

### 7.1 Result Type Specification

All fallible operations return a `Result<T>` type:

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
```

**Properties:**
- Discriminated union (check `ok` field)
- No exceptions thrown (errors returned as values)
- Error messages are human-readable strings

**Usage Pattern:**
```typescript
const result = progress.increment(1);
if (!result.ok) {
  console.error(result.error);
  return;
}
const state = result.value;
console.log(`Progress: ${state.percentage}%`);
```

### 7.2 Error Categories

| Category | Example Error | Cause | Recovery |
|----------|--------------|-------|----------|
| **Validation** | `"Total must be a valid number greater than 0"` | Invalid input | Fix input, retry |
| **File I/O** | `"Failed to read progress: ENOENT"` | File missing/unreadable | Check file exists |
| **JSON Parse** | `"Failed to parse progress state: Unexpected token"` | Corrupted file | Delete and recreate |
| **State** | `"Cannot increment: progress already complete"` | Operation after completion | Check `complete` flag |
| **Concurrency** | `"Failed to write progress: EAGAIN"` | Transient OS error | Retry after delay |

### 7.3 Error Message Format

**Structure:**
```
"<Operation failed>: <specific reason>"
```

**Examples:**
```typescript
"Failed to write progress: ENOENT: no such file or directory"
"Failed to increment: Total must be greater than 0"
"Failed to parse progress state: Unexpected token < in JSON at position 0"
```

### 7.4 Error Recovery Strategies

**For Transient Errors (I/O):**
```typescript
function writeWithRetry(data: ProgressState, retries = 3): Result<void> {
  for (let i = 0; i < retries; i++) {
    const result = writeFn(data);
    if (result.ok) return result;
    if (i < retries - 1) {
      await sleep(100 * Math.pow(2, i)); // Exponential backoff
    }
  }
  return { ok: false, error: 'Failed after 3 retries' };
}
```

**For Corrupted Files:**
```typescript
const readResult = progress.get();
if (!readResult.ok && readResult.error.includes('parse')) {
  // Corrupted file - reinitialize
  progress.clear();
  progress = createProgress({ total: 100, message: 'Restarted', id });
}
```

**For State Errors:**
```typescript
const result = progress.increment(1);
if (!result.ok && result.error.includes('already complete')) {
  // Progress already done - ignore or log
  console.warn('Progress already complete, skipping increment');
  return;
}
```

---

## Appendix A: Performance Characteristics

See `benchmarks/README.md` for full performance analysis.

**Summary (v0.3.0):**

| Operation | Latency | Throughput |
|-----------|---------|------------|
| Single increment + write | ~1.5 ms | 650 ops/sec |
| Template rendering | <2 µs | 500K+ ops/sec |
| Multi-progress (10 trackers) | ~11 ms | 90 ops/sec |
| Stream processing | ~630 µs/chunk | 1600 chunks/sec |

---

## Appendix B: Compatibility

**Node.js Versions:**
- Minimum: Node.js 18.0.0 (LTS)
- Tested: Node.js 18, 20, 22
- ES Modules required (`"type": "module"`)

**Filesystem Requirements:**
- POSIX-compliant filesystem (Linux, macOS, WSL)
- Atomic `rename()` support (standard on all POSIX systems)
- NFS/CIFS: Works with caveats (atomicity depends on server implementation)

**TypeScript:**
- Minimum: TypeScript 5.0
- Target: ES2022
- Strict mode recommended

---

## Appendix C: Changelog

**v0.3.0 (2026-01-11):**
- Added Streaming API (ProgressStream, ProgressTransform)
- Added CLI nested commands (increment, update, done, get, clear, status)
- Added formal specification (this document)
- Added performance benchmarks

**v0.2.0:**
- Added MultiProgress support
- Added template system
- Added builder pattern

**v0.1.0:**
- Initial release with basic progress tracking

---

**End of Specification**
