# CLI Progress Reporting v0.3.0 Enhancement Plan

**Feature Branch:** TBD (will create after v0.2.0 merges)
**Status:** Planning
**Target Version:** v0.3.0
**Date Started:** 2026-01-11

---

## Executive Summary

v0.3.0 focuses on **advanced integrations** and **formal specification**. This builds on v0.2.0's multi-API foundation to add streaming capabilities, improved CLI UX, and complete documentation.

### From v0.2.0

**Completed in v0.2.0:**
- ✅ Multi-API Design (ProgressTracker, ProgressBuilder, createProgress)
- ✅ Concurrent Progress (MultiProgress)
- ✅ Template System (7 templates, 5 spinners, progress bars, ETA)
- ✅ 239 tests (116% increase from v0.1.0)
- ✅ 4 example files demonstrating new APIs
- ✅ Comprehensive README documentation

### Goals for v0.3.0

| Enhancement | Priority | Complexity | Status |
|-------------|----------|------------|--------|
| Streaming API (async generators) | MEDIUM | HIGH | 🔴 Not Started |
| CLI Nested Commands | HIGH | MEDIUM | 🔴 Not Started |
| SPEC.md (Formal Specification) | HIGH | LOW | 🔴 Not Started |
| Advanced Examples | MEDIUM | LOW | 🔴 Not Started |
| Performance Benchmarks | LOW | MEDIUM | 🔴 Not Started |

---

## Phase 1: Streaming API

**Goal:** Generator-based progress for async iterators and streams

### Problem Statement

Many modern Node.js applications use async generators and streams for processing large datasets. Current progress tracking requires manual updates in the processing loop:

```typescript
// Current approach (manual)
const progress = createProgress().total(items.length).message('Processing').build();

for (const item of items) {
  await processItem(item);
  progress.increment(1); // Manual increment
}
```

Streaming API should provide **automatic progress tracking** for iterators.

### API Design

```typescript
import { createProgressStream } from 'cli-progress-reporting';

// Async generator with auto-progress
async function* processItems(items: string[]) {
  const progress = createProgressStream({
    total: items.length,
    message: 'Processing items'
  });

  for (const item of items) {
    await processItem(item);
    yield progress.next();  // Auto-increments and returns state
  }

  progress.done();
}

// Usage
for await (const state of processItems(myItems)) {
  console.log(`Progress: ${state.percentage}%`);
}
```

### Stream Integration

```typescript
import { Readable } from 'stream';
import { attachProgress } from 'cli-progress-reporting';

// Wrap existing stream
const fileStream = fs.createReadStream('large-file.csv');
const progressStream = attachProgress(fileStream, {
  total: fileSize,
  message: 'Reading file'
});

progressStream.on('progress', (state) => {
  console.log(`${state.percentage}% complete`);
});
```

### Implementation Steps

#### Step 1.1: Create ProgressStream Class

- [ ] Create `src/progress-stream.ts`
- [ ] Define `ProgressStream` class implementing AsyncIterableIterator
- [ ] Methods:
  - `next(): Promise<ProgressState>` - Auto-increment and return state
  - `return(): Promise<void>` - Mark as complete
  - `throw(error): Promise<void>` - Mark as failed
- [ ] Integrate with existing ProgressTracker

#### Step 1.2: Stream Wrapper

- [ ] Create `attachProgress(stream, config)` function
- [ ] Support Node.js Readable streams
- [ ] Emit 'progress' events
- [ ] Track bytes processed vs total

#### Step 1.3: Add Tests (20 tests)

- [ ] Async generator tests (8 tests)
- [ ] Stream integration tests (7 tests)
- [ ] Error handling tests (5 tests)

**Acceptance Criteria:**
- ✅ Works with async iterators
- ✅ Auto-increments on yield
- ✅ Integrates with Node.js streams
- ✅ 20 new tests (total: 259 tests)

---

## Phase 2: CLI Nested Commands

**Goal:** Improve CLI UX with nested command structure

### Problem Statement

Current CLI is flat and repetitive:

```bash
prog init --total 100 --message "Processing" --id myproject
prog increment --amount 5 --id myproject
prog set --current 75 --id myproject
prog finish --message "Done" --id myproject
```

Nested commands provide better organization:

```bash
prog myproject init --total 100 --message "Processing"
prog myproject inc 5
prog myproject set 75
prog myproject done "Complete"
```

### Proposed CLI Structure

```bash
# Single progress commands
prog <tracker-id> init <total> [--message <msg>]
prog <tracker-id> inc [<amount>] [--message <msg>]
prog <tracker-id> set <current> [--message <msg>]
prog <tracker-id> get
prog <tracker-id> done [<message>]
prog <tracker-id> clear

# Multi-progress commands
prog multi <multi-id> init
prog multi <multi-id> add <tracker-id> <total> [--message <msg>]
prog multi <multi-id> status
prog multi <multi-id> done
prog multi <multi-id> clear

# Global commands
prog list                    # List all active trackers
prog version                 # Show version
prog help [<command>]        # Show help
```

### Backward Compatibility

Keep old flat commands working but mark as deprecated:

```bash
prog init --total 100 --id myproject     # Still works, shows deprecation warning
prog myproject init 100                  # New preferred syntax
```

### Implementation Steps

#### Step 2.1: Refactor CLI Parser

- [ ] Create `src/cli/parser.ts` for command parsing
- [ ] Support nested command structure
- [ ] Parse positional arguments and flags
- [ ] Add help text generation

#### Step 2.2: Implement New Commands

- [ ] Single progress commands (6 commands)
- [ ] Multi-progress commands (5 commands)
- [ ] Global commands (3 commands)

#### Step 2.3: Add Deprecation Warnings

- [ ] Detect old flat command syntax
- [ ] Show deprecation warning with new syntax
- [ ] Continue supporting old commands

#### Step 2.4: Update Documentation

- [ ] README CLI usage section
- [ ] Update shell script examples
- [ ] Add migration guide

#### Step 2.5: Add Tests (25 tests)

- [ ] Command parsing tests (10 tests)
- [ ] Nested command execution tests (10 tests)
- [ ] Backward compatibility tests (5 tests)

**Acceptance Criteria:**
- ✅ New nested commands work
- ✅ Old flat commands still work (with warnings)
- ✅ Help text auto-generates
- ✅ 25 new tests (total: 284 tests)

---

## Phase 3: SPEC.md Formal Specification

**Goal:** Document all behavior, formats, and guarantees

### Contents

#### 1. Progress State Format

- JSON schema for ProgressState
- Field descriptions and constraints
- Timestamp format (milliseconds since epoch)
- Percentage calculation algorithm

#### 2. File Format Specification

- Single progress file format: `progress-{id}.json`
- Multi-progress file format: `progress-multi-{id}.json`
- Atomic write algorithm (write-then-rename)
- File permissions (0o644)

#### 3. Concurrent Safety Guarantees

- Multiple processes can safely update same tracker
- Read operations never see partial writes
- Race condition handling
- Lock-free design using OS-level atomicity

#### 4. Template System Specification

- Template variable syntax: `{{variable}}`
- Supported variables and their types
- Function template signature
- Spinner frame rotation algorithm

#### 5. CLI Protocol

- Exit codes (0 = success, 1 = error)
- Stdout format (JSON or human-readable)
- Stderr for errors only
- Environment variable support

#### 6. Error Handling

- Result type specification
- Error message format
- Common error codes
- Error recovery strategies

### Implementation Steps

#### Step 3.1: Write SPEC.md

- [ ] Create `SPEC.md` following template above
- [ ] Include JSON schemas
- [ ] Add diagrams for atomic write algorithm
- [ ] Document all edge cases

#### Step 3.2: Validate Against Implementation

- [ ] Review each spec section against actual code
- [ ] Fix any discrepancies
- [ ] Add tests for spec compliance

**Acceptance Criteria:**
- ✅ SPEC.md covers all behavior
- ✅ Implementation matches specification
- ✅ No spec violations in tests

---

## Phase 4: Advanced Examples

**Goal:** Real-world usage examples beyond basic demos

### Examples to Create

#### 1. `examples/streaming-async.ts`

Demonstrates ProgressStream with async generators:

```typescript
// Process large dataset with auto-progress
async function* processRecords(records: Record[]) {
  const progress = createProgressStream({
    total: records.length,
    message: 'Processing records'
  });

  for (const record of records) {
    await validateRecord(record);
    await transformRecord(record);
    await saveRecord(record);
    yield progress.next();
  }

  progress.done();
}
```

#### 2. `examples/streaming-node.ts`

Demonstrates stream integration:

```typescript
// Track file processing progress
const fileStream = fs.createReadStream('data.csv');
const progressStream = attachProgress(fileStream, {
  total: fileStats.size,
  message: 'Reading CSV'
});

progressStream
  .pipe(csv.parse())
  .pipe(transform())
  .pipe(destination);

progressStream.on('progress', (state) => {
  console.log(engine.render(templates.bar, state));
});
```

#### 3. `examples/multi-stage-pipeline.ts`

Demonstrates complex multi-stage processing:

```typescript
// Multi-stage data pipeline with progress tracking
const multi = new MultiProgress();

const download = multi.create('download', 100, 'Downloading');
const parse = multi.create('parse', 100, 'Parsing');
const validate = multi.create('validate', 100, 'Validating');
const transform = multi.create('transform', 100, 'Transforming');
const upload = multi.create('upload', 100, 'Uploading');

// Process each stage with dependencies
await runStage(download, downloadData);
await runStage(parse, parseData);
await runStage(validate, validateData);
await runStage(transform, transformData);
await runStage(upload, uploadResults);
```

#### 4. `examples/cli-integration.ts`

Demonstrates using progress in CLI tools:

```typescript
#!/usr/bin/env node
import { createProgress } from 'cli-progress-reporting';

const files = process.argv.slice(2);
const progress = createProgress()
  .total(files.length)
  .message('Processing files')
  .build();

for (const file of files) {
  await processFile(file);
  progress.increment(1, `Processed ${file}`);
}

progress.finish('All files processed!');
```

### Implementation Steps

#### Step 4.1: Create Example Files

- [ ] `streaming-async.ts` - Async generator example
- [ ] `streaming-node.ts` - Node.js stream example
- [ ] `multi-stage-pipeline.ts` - Complex pipeline
- [ ] `cli-integration.ts` - Real CLI tool

#### Step 4.2: Verify All Examples Run

- [ ] Test each example manually
- [ ] Add to README examples section
- [ ] Ensure they work standalone

**Acceptance Criteria:**
- ✅ 4 new advanced examples
- ✅ All examples run successfully
- ✅ README updated with examples

---

## Phase 5: Performance Benchmarks (Optional)

**Goal:** Measure and document performance characteristics

### Benchmarks to Create

#### 1. Single Progress Performance

```typescript
// Measure init, increment, get, finish operations
bench('ProgressTracker.init()', () => {
  tracker.init(1000, 'Test');
});

bench('ProgressTracker.increment()', () => {
  tracker.increment(1);
});
```

#### 2. Multi-Progress Performance

```typescript
// Measure multi-tracker overhead
bench('MultiProgress with 10 trackers', () => {
  for (let i = 0; i < 10; i++) {
    multi.create(`tracker-${i}`, 100, 'Test');
  }
});
```

#### 3. Template Rendering Performance

```typescript
// Measure template rendering speed
bench('TemplateEngine.render(templates.full)', () => {
  engine.render(templates.full, state);
});
```

### Performance Targets

- Single operation: < 2ms
- Multi-progress (10 trackers): < 5ms
- Template rendering: < 1ms
- Scalability: Handle 1,000,000 total units

### Implementation Steps

#### Step 5.1: Create Benchmark Suite

- [ ] Use tatami-ng (same as property-validator)
- [ ] Create `benchmarks/index.bench.ts`
- [ ] Add to package.json scripts

#### Step 5.2: Run Baselines

- [ ] Establish v0.3.0 baseline
- [ ] Compare with v0.2.0 (no regressions)
- [ ] Document results in `benchmarks/README.md`

**Acceptance Criteria:**
- ✅ Benchmarks established
- ✅ No performance regressions vs v0.2.0
- ✅ Results documented

---

## Testing & Quality

### Test Coverage Goals

- **v0.2.0:** 239 tests
- **v0.3.0 target:** 300+ tests

**New tests:**
- Phase 1 (Streaming): +20 tests (259)
- Phase 2 (CLI): +25 tests (284)
- Phase 4 (Examples): +10 tests (294)
- Phase 5 (Benchmarks): +6 tests (300)

### Quality Checklist

- [ ] All 300+ tests pass
- [ ] Zero runtime dependencies maintained
- [ ] TypeScript compiles with no errors
- [ ] Dogfooding scripts pass (flaky detection, output diff)
- [ ] `/quality-check` passes
- [ ] All examples run successfully
- [ ] SPEC.md validated against implementation
- [ ] Performance benchmarks meet targets

---

## Documentation Updates

### README.md

- [ ] Add Streaming API section
- [ ] Update CLI usage with nested commands
- [ ] Add link to SPEC.md
- [ ] Update test count badge (300+)
- [ ] Update version badge (0.3.0)

### CHANGELOG.md

- [ ] Document all v0.3.0 changes
- [ ] Migration guide from v0.2.0
- [ ] Breaking changes (if any)

### Examples

- [ ] Update examples/README.md
- [ ] Add streaming examples
- [ ] Add advanced pipeline example

---

## Release Plan

### Pre-Release

1. [ ] All phases complete
2. [ ] All tests passing (300+)
3. [ ] Documentation complete
4. [ ] Quality checks pass
5. [ ] Performance benchmarks meet targets

### Release Steps

1. [ ] Update version in package.json: `0.3.0`
2. [ ] Update version badge in README
3. [ ] Update CHANGELOG with release date
4. [ ] Commit: `chore: prepare v0.3.0 release`
5. [ ] Create PR for cli-progress-reporting
6. [ ] Create PR for tuulbelt meta repo
7. [ ] Merge PRs
8. [ ] Tag v0.3.0
9. [ ] Push tag

### Post-Release

1. [ ] Announce v0.3.0 features
2. [ ] Update tuulbelt root README
3. [ ] Consider npm publication (if ready)

---

## Risk Assessment

### High Risk

**Streaming API complexity**
- Mitigation: Start with simple async generator, expand later
- Fallback: Defer stream integration to v0.3.1

**CLI breaking changes**
- Mitigation: Maintain backward compatibility with warnings
- Fallback: Version CLI separately

### Medium Risk

**Performance regressions**
- Mitigation: Continuous benchmarking during development
- Fallback: Optimize or defer feature

### Low Risk

**Documentation completeness**
- Mitigation: Write SPEC.md early, validate as we go

---

## Dependencies

**None** - Zero runtime dependencies maintained.

**Dev Dependencies (same as v0.2.0):**
- TypeScript (compilation)
- tsx (running examples)
- Node.js built-in test runner (testing)
- tatami-ng (benchmarking - new in v0.3.0)

---

## Timeline Estimate

**Total Estimated Effort:** 3-4 sessions

| Phase | Estimated Effort | Complexity |
|-------|-----------------|------------|
| Phase 1: Streaming API | 1-1.5 sessions | HIGH |
| Phase 2: CLI Nested Commands | 1 session | MEDIUM |
| Phase 3: SPEC.md | 0.5 session | LOW |
| Phase 4: Advanced Examples | 0.5 session | LOW |
| Phase 5: Benchmarks (optional) | 0.5 session | MEDIUM |

**Note:** This assumes v0.2.0 is merged and stable before starting v0.3.0.

---

## Success Criteria

v0.3.0 is considered complete when:

- ✅ Streaming API works with async generators and streams
- ✅ CLI nested commands implemented with backward compatibility
- ✅ SPEC.md formally documents all behavior
- ✅ 4 advanced examples created and tested
- ✅ 300+ tests passing
- ✅ Performance benchmarks established (optional)
- ✅ All documentation updated
- ✅ PRs merged and v0.3.0 tagged

---

## References

- v0.2.0 ENHANCEMENT_PLAN.md
- Property Validator (gold standard patterns)
- ora (spinner inspiration)
- listr2 (task list inspiration)
- Node.js Streams API documentation
- Async Iterators specification

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-11 by Claude
**Maintained By:** Tuulbelt Core Team
