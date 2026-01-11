# CLI Progress Reporting Specification

**Version:** 0.2.0
**Date:** 2026-01-11
**Status:** Stable

---

## 1. Overview

This document formally specifies the behavior, data formats, and guarantees of the CLI Progress Reporting tool. It serves as the authoritative reference for implementation correctness and compatibility.

### 1.1 Design Goals

- **Concurrent Safety:** Multiple processes can safely update the same progress tracker without corruption
- **Persistence:** Progress state survives process crashes and restarts
- **Atomicity:** State transitions are atomic - no partial writes visible to readers
- **Zero Dependencies:** Uses only Node.js built-in modules
- **Backward Compatibility:** API changes maintain compatibility with existing code

### 1.2 Scope

This specification covers:
- Progress state data format
- File-based storage format and atomicity guarantees
- Template system variable substitution
- CLI protocol and exit codes
- Error handling patterns

---

## 2. Progress State Format

### 2.1 JSON Schema

Progress state is represented as a JSON object with the following schema:

```typescript
interface ProgressState {
  total: number;           // Total units of work (positive integer > 0)
  current: number;         // Current units completed (non-negative integer ≥ 0)
  message: string;         // User-friendly message (arbitrary string)
  percentage: number;      // Percentage complete (floating point 0.0-100.0)
  startTime: number;       // Unix timestamp in milliseconds when initialized
  updatedTime: number;     // Unix timestamp in milliseconds of last update
  complete: boolean;       // Whether progress is marked as finished
}
```

### 2.2 Field Constraints

#### `total`
- **Type:** Positive integer
- **Range:** `1` to `Number.MAX_SAFE_INTEGER` (2^53 - 1)
- **Validation:** Must be greater than 0
- **Immutable:** Cannot change after initialization

#### `current`
- **Type:** Non-negative integer
- **Range:** `0` to `total` (inclusive)
- **Clamping:** Values exceeding `total` are clamped to `total`
- **Monotonicity:** Typically increases (decreases allowed via `set()`)

#### `message`
- **Type:** String
- **Length:** Unlimited (implementation may truncate in output)
- **Encoding:** UTF-8
- **Special characters:** Allowed (including newlines, Unicode)

#### `percentage`
- **Type:** Floating point number
- **Range:** `0.0` to `100.0` (inclusive)
- **Precision:** Implementation-defined (typically 2 decimal places)
- **Calculation:** `(current / total) * 100`
- **Special cases:**
  - `current = 0` → `percentage = 0.0`
  - `current = total` → `percentage = 100.0`

#### `startTime`
- **Type:** Integer (Unix timestamp in milliseconds)
- **Source:** `Date.now()` at initialization
- **Immutable:** Never changes after initialization
- **Use case:** Calculate elapsed time

#### `updatedTime`
- **Type:** Integer (Unix timestamp in milliseconds)
- **Source:** `Date.now()` at each operation
- **Monotonicity:** Increases with each update
- **Use case:** Track last modification time

#### `complete`
- **Type:** Boolean
- **Semantics:**
  - `false` - Progress in progress
  - `true` - Progress marked as finished (via `finish()`)
- **Independent of percentage:** Can be `true` even if `percentage < 100`

### 2.3 Invariants

The following invariants MUST always hold:

1. `0 ≤ current ≤ total`
2. `total > 0`
3. `percentage = (current / total) * 100`
4. `startTime ≤ updatedTime`
5. `typeof message === 'string'`
6. `typeof complete === 'boolean'`

### 2.4 Example State

```json
{
  "total": 100,
  "current": 42,
  "message": "Processing files",
  "percentage": 42.0,
  "startTime": 1704988800000,
  "updatedTime": 1704988842000,
  "complete": false
}
```

---

## 3. File Format Specification

### 3.1 Single Progress Tracker

**Filename Pattern:** `progress-{id}.json`

**Location:** OS temp directory (`os.tmpdir()`)

**Format:** UTF-8 encoded JSON

**Example:**
```
/tmp/progress-myproject.json
```

**Contents:**
```json
{
  "total": 100,
  "current": 50,
  "message": "Processing items",
  "percentage": 50.0,
  "startTime": 1704988800000,
  "updatedTime": 1704988825000,
  "complete": false
}
```

### 3.2 Multi-Progress Tracker

**Filename Pattern:** `progress-multi-{id}.json`

**Format:** UTF-8 encoded JSON with nested tracker states

**Example:**
```
/tmp/progress-multi-myproject.json
```

**Contents:**
```json
{
  "download": {
    "total": 50,
    "current": 25,
    "message": "Downloading files",
    "percentage": 50.0,
    "startTime": 1704988800000,
    "updatedTime": 1704988812000,
    "complete": false
  },
  "upload": {
    "total": 30,
    "current": 30,
    "message": "Upload complete",
    "percentage": 100.0,
    "startTime": 1704988800000,
    "updatedTime": 1704988825000,
    "complete": true
  }
}
```

### 3.3 File Permissions

**Mode:** `0o644` (read/write owner, read-only group/others)

**Rationale:** Progress data is intended to be shared across processes

**Security:** Do NOT include sensitive data in messages or tracker IDs

### 3.4 Atomic Write Algorithm

To prevent partial writes and ensure concurrent safety, the implementation MUST use the following algorithm:

```
1. Generate temporary filename: `progress-{id}.json.tmp.{random}`
   where {random} is a cryptographically secure random string

2. Write complete JSON to temporary file

3. Call fsync() to flush to disk (optional but recommended)

4. Atomically rename temporary file to target filename:
   fs.renameSync(tempFile, targetFile)

5. OS guarantees rename is atomic - readers see either:
   - Old complete state (before rename)
   - New complete state (after rename)
   - NEVER partial/corrupted state
```

**Implementation Example:**
```typescript
function atomicWrite(filepath: string, data: ProgressState): void {
  const tempPath = `${filepath}.tmp.${randomBytes(8).toString('hex')}`;

  // Write to temp file
  writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');

  // Atomic rename (overwrites target if exists)
  renameSync(tempPath, filepath);

  // Readers only ever see complete, valid JSON
}
```

### 3.5 Read Operations

**Read Algorithm:**
```
1. Open file for reading
2. Read entire file contents
3. Parse JSON
4. Validate against ProgressState schema
5. Return parsed state
```

**Error Handling:**
- File not found → Return error (progress not initialized)
- JSON parse error → Return error (corrupted state - should never happen with atomic writes)
- Schema validation fails → Return error (implementation bug)

---

## 4. Concurrent Safety Guarantees

### 4.1 Atomicity Guarantee

**Guarantee:** All state transitions are atomic from external observers' perspective.

**Implementation:** File system atomic rename operation (`fs.renameSync()`)

**OS-Level Support:**
- POSIX: `rename(2)` is atomic
- Windows: `MoveFileEx()` with `MOVEFILE_REPLACE_EXISTING` is atomic
- Node.js: `fs.renameSync()` uses OS atomic rename

### 4.2 Concurrent Write Safety

**Scenario:** Multiple processes writing to same tracker simultaneously

**Behavior:**
- Last write wins (most recent `renameSync()` determines final state)
- No data corruption (atomic rename prevents partial writes)
- No race condition (OS ensures rename atomicity)

**Example:**
```
Process A: increment(1) at T1 → writes current=50
Process B: increment(1) at T2 → writes current=51
Process C: increment(1) at T3 → writes current=52

Final state: current=52 (last write wins)
```

**Note:** Increments are NOT additive across processes. Use separate tracker IDs for independent progress tracking.

### 4.3 Concurrent Read Safety

**Scenario:** Multiple processes reading while another process writes

**Behavior:**
- Readers ALWAYS see complete, valid JSON (never partial writes)
- Readers see either old state OR new state (never transitional state)
- No read locks required

**Example:**
```
Writer:  [old state] → [writing to temp] → [rename] → [new state]
Reader:  [reads old state]                            [reads new state]
           ↑ Sees complete old state                   ↑ Sees complete new state
```

### 4.4 Multi-Tracker Independence

**Guarantee:** Different tracker IDs are completely independent.

**Behavior:**
- Updates to `tracker-A` do NOT affect `tracker-B`
- Separate files eliminate contention
- No global locks

**Example:**
```
Tracker "download":  progress-download.json
Tracker "upload":    progress-upload.json
Tracker "process":   progress-process.json

All can be updated concurrently with zero interference.
```

---

## 5. Template System Specification

### 5.1 Template Syntax

Templates support variable substitution using double-brace syntax: `{{variable}}`

**Valid Variable Names:**
```
{{percentage}}   - Percentage complete (0-100)
{{current}}      - Current value
{{total}}        - Total value
{{message}}      - User message
{{elapsed}}      - Elapsed seconds since start
{{spinner}}      - Animated spinner character
{{bar}}          - Progress bar string
{{eta}}          - Estimated time remaining (seconds)
```

### 5.2 Variable Substitution Algorithm

```
For each variable in template:
  1. Match pattern: /\{\{(\w+)\}\}/g
  2. Extract variable name
  3. Lookup value in TemplateVariables object
  4. Convert value to string
  5. Replace {{variable}} with string value
```

**Example:**
```
Template: "{{spinner}} {{percentage}}% - {{message}}"
State:    { percentage: 42, message: "Processing", spinner: "⠋" }
Result:   "⠋ 42% - Processing"
```

### 5.3 Template Variables Type Specification

```typescript
interface TemplateVariables {
  percentage: number;      // 0.0 to 100.0
  current: number;         // 0 to total
  total: number;           // Positive integer
  message: string;         // Arbitrary string
  elapsed: number;         // Seconds since start (integer)
  spinner: string;         // Single character (Unicode)
  bar: string;             // Progress bar visualization
  eta: number;             // Estimated seconds remaining (integer, 0 if unknown)
}
```

### 5.4 ETA Calculation

**Formula:**
```typescript
if (current === 0 || elapsed === 0) {
  eta = 0;  // Unknown
} else {
  const rate = current / elapsed;           // Items per second
  const remaining = total - current;        // Items left
  eta = Math.ceil(remaining / rate);        // Seconds remaining
}
```

**Edge Cases:**
- `current = 0` → `eta = 0` (no data yet)
- `elapsed = 0` → `eta = 0` (too fast to measure)
- `current = total` → `eta = 0` (complete)

### 5.5 Progress Bar Rendering

**Algorithm:**
```typescript
function renderBar(percentage: number, width: number): string {
  const filled = Math.round((percentage / 100) * width);
  const empty = width - filled;
  const filledBar = '█'.repeat(filled);
  const emptyBar = '░'.repeat(empty);
  return `[${filledBar}${emptyBar}]`;
}
```

**Characters:**
- Filled: `█` (U+2588 FULL BLOCK)
- Empty: `░` (U+2591 LIGHT SHADE)

**Example:**
```
renderBar(50, 10)  → "[█████░░░░░]"
renderBar(75, 20)  → "[███████████████░░░░░]"
renderBar(0, 5)    → "[░░░░░]"
renderBar(100, 5)  → "[█████]"
```

### 5.6 Spinner Animation

**Frame Rotation:**
```typescript
class TemplateEngine {
  private spinnerFrame: number = 0;

  getSpinner(): string {
    const frame = this.spinnerFrames[this.spinnerFrame] || '·';
    this.spinnerFrame = (this.spinnerFrame + 1) % this.spinnerFrames.length;
    return frame;
  }
}
```

**Built-in Spinner Sets:**

```typescript
const spinners = {
  dots: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],  // 10 frames
  line: ['|', '/', '-', '\\'],                                  // 4 frames
  arrows: ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],            // 8 frames
  box: ['◰', '◳', '◲', '◱'],                                    // 4 frames
  clock: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛']  // 12 frames
};
```

### 5.7 Function Templates

Templates can be strings OR functions:

```typescript
type Template = string | ((vars: TemplateVariables) => string);
```

**Function Template Signature:**
```typescript
function customTemplate(vars: TemplateVariables): string {
  // Custom logic
  return `${vars.percentage}% complete`;
}
```

**Example:**
```typescript
const template = (vars) => {
  const eta = vars.eta > 0 ? ` (ETA: ${vars.eta}s)` : '';
  return `${vars.bar} ${vars.percentage}%${eta}`;
};

engine.render(template, state);
// "[████░░░░] 50% (ETA: 30s)"
```

---

## 6. CLI Protocol

### 6.1 Command Structure

**Format:** `prog <command> [options] [arguments]`

**Commands:**
```
prog init --total <N> --message <msg> [--id <id>]
prog increment [--amount <N>] [--message <msg>] [--id <id>]
prog set --current <N> [--message <msg>] [--id <id>]
prog get [--id <id>]
prog finish [--message <msg>] [--id <id>]
prog clear [--id <id>]
prog help [<command>]
prog version
```

### 6.2 Exit Codes

| Code | Meaning | When Used |
|------|---------|-----------|
| `0` | Success | Operation completed successfully |
| `1` | Error | Invalid arguments, operation failed, or validation error |

**Examples:**
```bash
prog init --total 100 --message "Test"  # Exit 0 (success)
prog init --total 0 --message "Test"    # Exit 1 (total must be > 0)
prog get --id nonexistent               # Exit 1 (tracker not found)
```

### 6.3 Output Format

#### Success (JSON)

When operation succeeds, output valid JSON to stdout:

```json
{
  "ok": true,
  "value": {
    "total": 100,
    "current": 50,
    "message": "Processing",
    "percentage": 50.0,
    "startTime": 1704988800000,
    "updatedTime": 1704988825000,
    "complete": false
  }
}
```

#### Error (JSON)

When operation fails, output error JSON to stdout (NOT stderr):

```json
{
  "ok": false,
  "error": "Total must be greater than 0"
}
```

**Rationale:** Using stdout for both success and error allows piping to JSON processors like `jq`.

### 6.4 Human-Readable Output

**Flag:** `--format human` (future enhancement)

**Current Behavior:** Use `formatProgress()` function in library API

**Example:**
```bash
prog get --id myproject
# Output: [50%] 50/100 - Processing (25s)
```

### 6.5 Environment Variables

**Supported Variables:**

| Variable | Purpose | Example |
|----------|---------|---------|
| `PROG_ID` | Default tracker ID | `export PROG_ID=myproject` |
| `PROG_DIR` | Custom temp directory | `export PROG_DIR=/var/run/progress` |

**Precedence:** CLI flags > Environment variables > Defaults

---

## 7. Error Handling

### 7.1 Result Type

All library operations return a `Result<T>` type:

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };
```

**Rationale:** Explicit error handling, no exceptions thrown.

### 7.2 Error Categories

#### Validation Errors

Triggered by invalid inputs:

```typescript
{ ok: false, error: "Total must be greater than 0" }
{ ok: false, error: "Increment amount must be non-negative" }
{ ok: false, error: "Invalid tracker ID: contains path traversal" }
```

#### State Errors

Triggered by invalid operations:

```typescript
{ ok: false, error: "Progress file does not exist" }
{ ok: false, error: "Tracker ID 'foo' not found in multi-progress" }
```

#### I/O Errors

Triggered by filesystem failures:

```typescript
{ ok: false, error: "Failed to write progress: EACCES permission denied" }
{ ok: false, error: "Failed to read progress: ENOENT file not found" }
```

### 7.3 Error Recovery

**Strategy:** All operations are idempotent where possible.

**Examples:**
- `init()` twice → Overwrites previous state (safe)
- `clear()` on non-existent file → Returns success (idempotent)
- `increment()` on non-existent tracker → Returns error (not idempotent)

### 7.4 Security Validation

#### Tracker ID Validation

**Rules:**
- Alphanumeric characters, hyphens, underscores only: `/^[a-zA-Z0-9_-]+$/`
- Max length: 255 characters
- No path traversal: Reject `..`, `/`, `\`, null bytes

**Example:**
```typescript
// Valid IDs
"myproject"
"task-123"
"worker_node_5"

// Invalid IDs (rejected)
"../etc/passwd"      // Path traversal
"my/project"         // Slash
"task\x00file"       // Null byte
"a".repeat(300)      // Too long
```

#### Message Content

**Allowed:** Any valid UTF-8 string (no restrictions)

**Warning:** Messages are stored in world-readable files (`0o644`). Do NOT include:
- Passwords or API keys
- Personal identifiable information (PII)
- Sensitive business data

---

## 8. Versioning and Compatibility

### 8.1 Semantic Versioning

This specification follows [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR:** Breaking changes to file format or API
- **MINOR:** Backward-compatible feature additions
- **PATCH:** Backward-compatible bug fixes

### 8.2 File Format Compatibility

**Guarantee:** JSON file format for v0.x.x remains stable.

**Forward Compatibility:** New fields MAY be added in MINOR versions. Old implementations MUST ignore unknown fields.

**Example:**
```json
{
  "total": 100,
  "current": 50,
  "message": "Processing",
  "percentage": 50.0,
  "startTime": 1704988800000,
  "updatedTime": 1704988825000,
  "complete": false,
  "newFieldInV0_3": "value"  // Old parsers ignore this
}
```

### 8.3 API Compatibility

**Guarantee:** Existing API methods remain available through v0.x.x

**Deprecation Policy:**
1. New API introduced in MINOR version
2. Old API marked deprecated (warning in docs)
3. Old API removed in MAJOR version (v1.0.0+)

**Current APIs (v0.2.0):**
- Functional API (v0.1.0) - Stable
- ProgressTracker (v0.2.0) - Stable
- ProgressBuilder (v0.2.0) - Stable
- MultiProgress (v0.2.0) - Stable
- TemplateEngine (v0.2.0) - Stable

---

## 9. Implementation Requirements

### 9.1 Runtime Dependencies

**Requirement:** ZERO runtime dependencies.

**Allowed:** Node.js built-in modules only
- `fs` (file system)
- `path` (path manipulation)
- `os` (OS utilities)
- `crypto` (random bytes for temp files)

**Forbidden:** Any npm package dependencies at runtime

### 9.2 Platform Support

**Supported Platforms:**
- Linux (POSIX)
- macOS (POSIX)
- Windows (Win32)

**Node.js Versions:**
- Minimum: 18.0.0
- Tested: 18, 20, 22

### 9.3 Test Coverage

**Requirement:** Minimum 80% code coverage

**Current:** 239 tests covering:
- Functional API (35 tests)
- CLI integration (28 tests)
- Filesystem edge cases (21 tests)
- Fuzzy property tests (32 tests)
- ProgressTracker (28 tests)
- ProgressBuilder (17 tests)
- MultiProgress (23 tests)
- Template system (48 tests)
- Security validation (7 tests)

### 9.4 Performance Targets

**Single Operation:**
- `init()` - < 2ms
- `increment()` - < 2ms
- `get()` - < 1ms
- `finish()` - < 2ms

**Template Rendering:**
- Simple template - < 0.5ms
- Complex template with bar - < 1ms

**Multi-Progress:**
- 10 trackers - < 5ms total

---

## 10. References

### 10.1 Standards

- [RFC 8259: JSON Data Interchange Format](https://tools.ietf.org/html/rfc8259)
- [POSIX rename(2)](https://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html)
- [Semantic Versioning 2.0.0](https://semver.org/)

### 10.2 Related Specifications

- [Property Validator SPEC.md](https://github.com/tuulbelt/property-validator/blob/main/SPEC.md) - Gold standard example
- [Node.js File System API](https://nodejs.org/api/fs.html)
- [Unicode Block Elements](https://unicode.org/charts/PDF/U2580.pdf) - Progress bar characters

---

## 11. Changelog

### v0.2.0 (2026-01-11)

- Initial specification release
- Documented all v0.2.0 behavior:
  - Progress state format
  - File format and atomic writes
  - Concurrent safety guarantees
  - Template system
  - CLI protocol
  - Error handling

---

**Specification Version:** 1.0.0
**Last Updated:** 2026-01-11
**Maintained By:** Tuulbelt Core Team
**License:** MIT
