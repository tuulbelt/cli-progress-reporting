# CLI Progress Reporting Enhancement Plan

**Feature Branch:** `claude/enhance-cli-progress-reporting-LVOek` (meta) + corresponding submodule branch
**Status:** In Progress
**Based on:** [TOOL_MATURITY_ANALYSIS.md](https://github.com/tuulbelt/tuulbelt/blob/main/docs/TOOL_MATURITY_ANALYSIS.md)
**Target Version:** v0.2.0
**Date Started:** 2026-01-10

---

## Executive Summary

This document tracks the enhancement of cli-progress-reporting based on the Property Validator gold standard and competitive analysis. The goal is to evolve from v0.1.0 (foundational implementation) to v0.2.0 (mature multi-API design with concurrent progress tracking).

### Competitive Position

**Current:** ⚠️ **MODERATE** — ora (spinners), listr2 (task lists), cli-progress dominate
**Differentiator:** Concurrent-safe, zero dependencies (competitors have deps)

### Key Enhancements

| Enhancement | Priority | Status |
|-------------|----------|--------|
| Multi-API Design | HIGH | ✅ Complete |
| Concurrent Progress (MultiProgress) | HIGH | ✅ Complete (API only, CLI deferred) |
| Template System | MEDIUM | ✅ Complete |
| Streaming API | LOW | 🔴 Not Started (deferred to v0.3.0) |
| SPEC.md Documentation | HIGH | 🔴 Not Started |
| Advanced Examples | HIGH | 🔴 Not Started |

---

## Phase 1: Multi-API Design

**Goal:** Add builder pattern and instance-based API (like Property Validator's multi-tier design)

### Current API (v0.1.0)

```typescript
// Functional API - all operations through global functions
import { init, increment, get, finish } from 'cli-progress-reporting';

init(100, 'Processing');
increment(5);
finish();
```

### New API (v0.2.0)

```typescript
// Builder pattern + instance API
import { createProgress } from 'cli-progress-reporting';

// Single progress (builder pattern)
const progress = createProgress({
  total: 100,
  message: 'Processing files'
});
progress.update(50);
progress.done();

// Fluent API
const progress2 = createProgress({ total: 100 })
  .withMessage('Processing')
  .withId('my-task');
```

### Implementation Steps

#### Step 1.1: Create ProgressTracker Class ✅

- [x] Create `src/progress-tracker.ts`
- [x] Define `ProgressTracker` class with:
  - `constructor(config: ProgressTrackerConfig)`
  - `update(current: number, message?: string): Result<ProgressState>`
  - `increment(amount?: number, message?: string): Result<ProgressState>`
  - `done(message?: string): Result<ProgressState>`
  - `get(): Result<ProgressState>`
  - `clear(): Result<void>`
- [x] Use existing file-based implementation internally

#### Step 1.2: Create Builder Pattern ✅

- [x] Create `src/progress-builder.ts`
- [x] Define `ProgressBuilder` class with:
  - `withTotal(total: number): this`
  - `withMessage(message: string): this`
  - `withId(id: string): this`
  - `withFilePath(path: string): this`
  - `build(): ProgressTracker`

#### Step 1.3: Add createProgress Factory ✅

- [x] Add `createProgress(config: ProgressConfig): ProgressTracker` to `src/index.ts`
- [x] Support both builder pattern and direct config

#### Step 1.4: Maintain Backward Compatibility ✅

- [x] Keep existing functional API (`init`, `increment`, etc.)
- [x] Mark old API as stable (not deprecated yet)
- [x] All existing tests continue to pass

#### Step 1.5: Add Tests ✅

- [x] Unit tests for `ProgressTracker` class (15 tests)
- [x] Unit tests for `ProgressBuilder` (10 tests)
- [x] Integration tests for new API (13 tests)
- [x] Backward compatibility tests (5 tests)

**Acceptance Criteria:**
- ✅ New builder API works as documented
- ✅ Old functional API still works
- ✅ All 121 existing tests pass
- ✅ 42 new tests added (total: 163 tests passing)

---

## Phase 2: Concurrent Progress Tracking

**Goal:** Multiple progress bars simultaneously (like listr2's strength)

### API Design

```typescript
import { MultiProgress } from 'cli-progress-reporting';

// Create container for multiple progress trackers
const multi = new MultiProgress();

// Add multiple trackers
const download = multi.add({ total: 50, message: 'Downloading' });
const process = multi.add({ total: 100, message: 'Processing' });
const upload = multi.add({ total: 25, message: 'Uploading' });

// Update independently
download.update(25);
process.update(75);
upload.done();

// Finish all
multi.done();
```

### CLI Support

```bash
# Initialize multi-progress
prog multi init --id myproject

# Add tracker
prog multi add --id myproject --tracker download --total 50 --message "Downloading"
prog multi add --id myproject --tracker process --total 100 --message "Processing"

# Update specific tracker
prog multi update --id myproject --tracker download --current 25

# Get all trackers status
prog multi status --id myproject

# Finish all
prog multi done --id myproject
```

### Implementation Steps

#### Step 2.1: Create MultiProgress Class ✅

- [x] Create `src/multi-progress.ts`
- [x] Define `MultiProgress` class with:
  - `add(config: ProgressConfig): ProgressTracker`
  - `get(trackerId: string): Result<ProgressTracker>`
  - `getAll(): Result<ProgressTracker[]>`
  - `remove(trackerId: string): Result<void>`
  - `done(): Result<void>`
  - `clear(): Result<void>`
  - `sync(): Result<void>` (bonus: reload state from disk)
  - `status(): Result<MultiProgressState>` (bonus: get state snapshot)

#### Step 2.2: File-Based State Management ✅

- [x] Design multi-progress JSON format:
  ```json
  {
    "trackers": {
      "tracker1": { "total": 50, "current": 25, ... },
      "tracker2": { "total": 100, "current": 75, ... }
    },
    "meta": {
      "created": "2026-01-10T...",
      "updated": "2026-01-10T..."
    }
  }
  ```
- [x] Store in `progress-multi-{id}.json`
- [x] Use same atomic write pattern

#### Step 2.3: CLI Commands ⏸️ (Deferred)

- [ ] Add `prog multi init` command
- [ ] Add `prog multi add` command
- [ ] Add `prog multi update` command
- [ ] Add `prog multi status` command
- [ ] Add `prog multi done` command

**Note:** CLI commands deferred to focus on core API completion. MultiProgress can be used programmatically in v0.2.0, CLI support can be added in v0.2.1.

#### Step 2.4: Add Tests ✅ (Partial - 28 tests)

- [x] Unit tests for `MultiProgress` class (16 tests)
- [x] Concurrent safety tests (7 tests)
- [x] Edge case tests (5 tests)
- [ ] CLI integration tests (12 tests) - deferred with CLI commands

**Current Status:**
- ✅ Can track multiple progress bars independently
- ✅ Concurrent-safe file-based state
- ⏸️ CLI commands deferred to v0.2.1
- ✅ 28 new tests added (total: 191 tests, was 163)

---

## Phase 3: Template System

**Goal:** Customizable output format (like ora's spinners)

### API Design

```typescript
import { createProgress, templates } from 'cli-progress-reporting';

// Built-in templates
const progress = createProgress({
  total: 100,
  template: templates.bar,      // [████░░░░] 50%
  // or: templates.spinner,     // ⠋ Processing...
  // or: templates.percentage,  // 50%
  // or: templates.detailed     // [50%] 50/100 - Processing (5s)
});

// Custom template
const custom = createProgress({
  total: 100,
  template: '{{spinner}} {{percentage}}% - {{message}} ({{elapsed}}s)'
});
```

### Template Variables

```
{{percentage}}  - Percentage (0-100)
{{current}}     - Current value
{{total}}       - Total value
{{message}}     - User message
{{elapsed}}     - Elapsed seconds
{{spinner}}     - Animated spinner
{{bar}}         - Progress bar
{{eta}}         - Estimated time remaining
```

### Implementation Steps

#### Step 3.1: Create Template Engine ✅

- [x] Create `src/templates.ts`
- [x] Define `TemplateEngine` class with:
  - `render(template: Template, state: ProgressState): string`
  - Variable substitution ({{percentage}}, {{current}}, {{total}}, {{message}}, {{elapsed}}, {{spinner}}, {{bar}}, {{eta}})
- [x] Support string and function templates
- [x] `resetSpinner()`, `setSpinnerFrames()`, `setBarWidth()` methods

#### Step 3.2: Built-in Templates ✅

- [x] Define `templates.bar` (progress bar: `[████░░░░] 50%`)
- [x] Define `templates.spinner` (animated spinner: `⠋ Processing...`)
- [x] Define `templates.percentage` (percentage only: `50%`)
- [x] Define `templates.detailed` (detailed: `[50%] 50/100 - Processing (5s)`)
- [x] Define `templates.minimal` (simple: `Processing 50%`)
- [x] Define `templates.full` (full with ETA)
- [x] Define `templates.spinnerProgress` (spinner + progress)

#### Step 3.3: Spinner Animation ✅

- [x] Create 5 built-in spinner sets (dots, line, arrows, box, clock)
- [x] Rotate frame on each render
- [x] Support configurable spinner sets via `setSpinnerFrames()`

#### Step 3.4: Progress Bar Rendering ✅

- [x] Calculate bar width based on percentage
- [x] Use Unicode block characters: `█` (filled) and `░` (empty)
- [x] Support configurable bar width via constructor and `setBarWidth()`

#### Step 3.5: Add Tests ✅ (48 tests - exceeded target!)

- [x] Template engine tests (18 tests)
- [x] Spinner animation tests (3 tests)
- [x] Progress bar rendering tests (5 tests)
- [x] ETA calculation tests (3 tests)
- [x] Built-in template tests (7 tests)
- [x] Factory function tests (2 tests)
- [x] Spinner set tests (5 tests)
- [x] Edge cases and integration (5 tests)

**Acceptance Criteria:**
- ✅ Can use built-in templates
- ✅ Can create custom templates
- ✅ Spinner animates correctly
- ✅ Progress bar renders correctly
- ✅ 48 new tests added (total: 239 tests, was 191)

---

## Phase 4: Streaming API (Low Priority)

**Goal:** Generator-based progress for async iterators

### API Design

```typescript
import { createProgressStream } from 'cli-progress-reporting';

// Async iterator with progress
async function* processItems(items: string[]) {
  const progress = createProgressStream({
    total: items.length,
    message: 'Processing'
  });

  for (const item of items) {
    await processItem(item);
    yield progress.update();  // Auto-increments
  }

  progress.done();
}

// Usage
for await (const state of processItems(myItems)) {
  console.log(formatProgress(state));
}
```

### Implementation Steps

#### Step 4.1: Create ProgressStream Class

- [ ] Create `src/progress-stream.ts`
- [ ] Define `ProgressStream` class with async generator
- [ ] Support auto-increment on yield
- [ ] Support manual control

#### Step 4.2: Add Tests

- [ ] Async generator tests (12 tests)
- [ ] Integration with async iterators (8 tests)

**Acceptance Criteria:**
- ✅ Works with async iterators
- ✅ Auto-increments on yield
- ✅ 20 new tests added (total: 259 tests)

**Note:** This phase is LOW priority and may be deferred to v0.3.0

---

## Phase 5: Documentation

**Goal:** Complete documentation following Property Validator gold standard

### Documents to Create/Update

#### SPEC.md (New)

- [ ] Define progress state format
- [ ] Define file format (JSON schema)
- [ ] Define atomic write algorithm
- [ ] Define concurrent safety guarantees
- [ ] Define output format specifications
- [ ] Define escape sequences for terminal control
- [ ] Define multi-progress format

#### README.md (Update)

- [ ] Add new API examples
- [ ] Add multi-progress examples
- [ ] Add template system section
- [ ] Update test count badge
- [ ] Add comparison with competitors (ora, listr2)

#### examples/concurrent.ts (New)

- [ ] Demo multiple progress bars simultaneously
- [ ] Show concurrent process safety
- [ ] Show real-world use case

#### examples/templates.ts (New)

- [ ] Demo all built-in templates
- [ ] Demo custom template creation
- [ ] Show spinner animation

#### examples/streaming.ts (New)

- [ ] Demo async iterator integration
- [ ] Show real-world async processing

#### CHANGELOG.md (Update)

- [ ] Document all v0.2.0 changes
- [ ] Follow Keep a Changelog format
- [ ] Add migration guide from v0.1.0

**Acceptance Criteria:**
- ✅ SPEC.md covers all behavior
- ✅ README has all new features
- ✅ 3 new example files
- ✅ CHANGELOG.md updated

---

## Phase 6: Testing & Quality

**Goal:** Ensure production readiness

### Quality Checklist

- [ ] All phases complete
- [ ] Total test count ≥ 239 tests
- [ ] All tests pass (100%)
- [ ] Zero runtime dependencies
- [ ] TypeScript compiles with no errors
- [ ] Dogfooding scripts pass:
  - [ ] `./scripts/dogfood-flaky.sh 20` (no flakiness)
  - [ ] `./scripts/dogfood-diff.sh` (deterministic output)
- [ ] `/quality-check` passes
- [ ] Examples all run successfully

### Performance Testing

- [ ] Benchmark single progress (should be ~1-2ms)
- [ ] Benchmark multi-progress (should be ~2-3ms per tracker)
- [ ] Benchmark template rendering (should be <1ms)
- [ ] Test with 1,000,000 total units (scalability)

### Security Review

- [ ] ID validation prevents path traversal
- [ ] Template injection prevented
- [ ] No XSS via message content
- [ ] File permissions appropriate (0o644)

**Acceptance Criteria:**
- ✅ All quality checks pass
- ✅ Performance acceptable
- ✅ Security reviewed

---

## Phase 7: Release

**Goal:** Tag v0.2.0 and create PRs

### Release Steps

- [ ] Commit all changes to feature branch
- [ ] Update version in package.json to `0.2.0`
- [ ] Update version badge in README.md
- [ ] Update CHANGELOG.md with release date
- [ ] Commit: `chore: prepare v0.2.0 release`
- [ ] Push feature branch to origin
- [ ] Create PR for submodule (cli-progress-reporting)
- [ ] Create PR for meta repo (tuulbelt)
- [ ] Review PRs
- [ ] Merge PRs to main
- [ ] Tag v0.2.0 in submodule
- [ ] Push tag to origin

### PR Description Template

```markdown
## CLI Progress Reporting v0.2.0 Enhancement

Modernizes cli-progress-reporting following Property Validator gold standard patterns.

### New Features

- ✅ Multi-API Design (createProgress builder pattern)
- ✅ Concurrent Progress Tracking (MultiProgress)
- ✅ Template System (customizable output formats)
- ✅ Built-in templates (bar, spinner, percentage, detailed)

### Documentation

- ✅ SPEC.md (formal behavior specification)
- ✅ examples/concurrent.ts (multi-progress demo)
- ✅ examples/templates.ts (template system demo)

### Testing

- ✅ 239 tests (was 111, added 128)
- ✅ Zero flakiness (validated with test-flakiness-detector)
- ✅ 100% backward compatible

### Migration Guide

v0.1.0 API continues to work. New API is opt-in:

```typescript
// Old (still works)
import { init, increment } from 'cli-progress-reporting';
init(100, 'Processing');
increment(5);

// New (v0.2.0)
import { createProgress } from 'cli-progress-reporting';
const progress = createProgress({ total: 100 });
progress.update(5);
```

Closes #XXX
```

**Acceptance Criteria:**
- ✅ PRs created and linked
- ✅ CI passes on PRs
- ✅ PRs merged to main
- ✅ v0.2.0 tagged

---

## Tracking & Status

### Phase Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Multi-API Design | 🔴 Not Started | 0/6 steps |
| Phase 2: Concurrent Progress | 🔴 Not Started | 0/4 steps |
| Phase 3: Template System | 🔴 Not Started | 0/5 steps |
| Phase 4: Streaming API | 🔴 Not Started | 0/2 steps (optional) |
| Phase 5: Documentation | 🔴 Not Started | 0/6 documents |
| Phase 6: Testing & Quality | 🔴 Not Started | 0/3 checklists |
| Phase 7: Release | 🔴 Not Started | 0/9 steps |

### Session Continuity

**Current Session:** 2026-01-10
**Next Session:** Pick up from current phase status
**Branch:** `claude/enhance-cli-progress-reporting-LVOek`

**How to Resume:**
1. Check this document for current phase status
2. Review completed steps (marked with ✅)
3. Continue from first incomplete step
4. Update status as you progress
5. Commit this document after each phase completes

---

## Dependencies

**None** - This tool maintains zero runtime dependencies.

**Dev Dependencies Only:**
- TypeScript (compilation)
- tsx (running examples)
- Node.js built-in test runner (testing)

---

## References

- [TOOL_MATURITY_ANALYSIS.md](https://github.com/tuulbelt/tuulbelt/blob/main/docs/TOOL_MATURITY_ANALYSIS.md)
- [Property Validator](https://github.com/tuulbelt/property-validator) (gold standard)
- [ora](https://github.com/sindresorhus/ora) (spinner competitor)
- [listr2](https://github.com/listr2/listr2) (task list competitor)

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-10 by Claude
**Maintained By:** Tuulbelt Core Team
