# Dogfooding Strategy: CLI Progress Reporting

This document outlines how CLI Progress Reporting leverages other Tuulbelt tools to demonstrate composability and validate concurrent safety.

## Multi-Tool Composition Goals

**Objective:** Prove that CLI Progress Reporting is concurrent-safe and deterministic under high load, validating it's safe for production use in other tools.

## Identified Dogfooding Opportunities

### 1. Test Flakiness Detector (Bidirectional Validation)

**Use Case:** Validate that progress tracking is concurrent-safe and non-flaky

**Why High Iterations:** Progress tracking involves file I/O and concurrent operations. Higher run counts (20+) catch rare race conditions.

**Implementation:**
```bash
#!/bin/bash
# scripts/dogfood-flaky.sh

RUNS="${1:-20}"
cd ../test-flakiness-detector
npx tsx src/index.ts \
    --test "cd '../cli-progress-reporting' && npm test 2>&1" \
    --runs "$RUNS"
```

**Value:** Creates bidirectional validation where:
- Test Flakiness Detector USES CLI Progress (for progress tracking)
- Test Flakiness Detector VALIDATES CLI Progress (this script)

**Example:**
```bash
$ cd cli-progress-reporting
$ ./scripts/dogfood-flaky.sh 20
✅ NO FLAKINESS DETECTED (125 tests × 20 runs = 2,500 executions)
```

---

### 2. Output Diffing Utility (State Consistency)

**Use Case:** Compare progress state files across multiple runs to ensure consistency

**Integration Points:**
- Capture progress state files from different runs
- Diff the states to verify identical structure
- Catch any non-deterministic timestamp or counter issues

**Implementation:**
```bash
#!/bin/bash
# scripts/dogfood-diff.sh

TEMP_DIR="/tmp/progress-diff-$$"
mkdir -p "$TEMP_DIR"

# Run progress operations twice
npm test > "$TEMP_DIR/run1.txt" 2>&1
npm test > "$TEMP_DIR/run2.txt" 2>&1

# Diff outputs (should be identical)
if [ -d "../output-diffing-utility" ]; then
  cd ../output-diffing-utility
  cargo run --release -- "$TEMP_DIR/run1.txt" "$TEMP_DIR/run2.txt"
fi

rm -rf "$TEMP_DIR"
```

**Value:** Proves test outputs are deterministic (no random UUIDs, timestamps in output)

---

## Implementation Checklist

- [ ] Add `scripts/dogfood-flaky.sh` for Test Flakiness Detector validation (bidirectional)
- [ ] Add `scripts/dogfood-diff.sh` for Output Diffing validation
- [ ] Document bidirectional relationship in README
- [ ] Update GH Pages docs with composition examples
- [ ] Test graceful fallback when tools not available

---

## Expected Outcomes

1. **Proves Concurrent Safety**
   - 125 tests × 20 runs = 2,500 executions without flakiness
   - Validates progress tracking under concurrent load
   - Safe for use in Test Flakiness Detector

2. **Validates Determinism**
   - Test outputs identical across runs
   - No random data in progress state
   - Predictable behavior for dependent tools

3. **Bidirectional Validation Network**
   - CLI Progress ↔ Test Flakiness Detector mutual validation
   - Each tool proves the other's reliability
   - Real-world confidence through dogfooding

---

**Status:** Strategy defined, ready for implementation
**Next:** Implement composition scripts and update documentation
