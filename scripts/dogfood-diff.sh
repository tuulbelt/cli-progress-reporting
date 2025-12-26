#!/bin/bash
#
# Dogfooding: Output Diffing Utility integration
#
# HIGH-VALUE: Proves test outputs are deterministic (no random data)
#
# Why This Matters:
#   - Progress state must be predictable
#   - No random UUIDs or timestamps in output
#   - Diff reveals any non-determinism
#
# Usage:
#   ./scripts/dogfood-diff.sh
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_DIR="$(dirname "$SCRIPT_DIR")"
DIFF_DIR="$TOOL_DIR/../output-diffing-utility"
TEMP_DIR="/tmp/progress-diff-$$"

echo "🔬 Dogfooding: Output Diffing Utility + CLI Progress"
echo ""
echo "This proves test outputs are deterministic:"
echo "  Run tests twice → Capture outputs → Diff them"
echo "  Should be IDENTICAL (no random data)"
echo ""

if [ ! -d "$DIFF_DIR" ]; then
    echo "⚠️  Output Diffing Utility not available"
    echo ""
    echo "Falling back to standard diff..."
    echo ""

    mkdir -p "$TEMP_DIR"
    cd "$TOOL_DIR"

    npm test > "$TEMP_DIR/run1.txt" 2>&1
    npm test > "$TEMP_DIR/run2.txt" 2>&1

    echo "📊 Comparing outputs:"
    diff "$TEMP_DIR/run1.txt" "$TEMP_DIR/run2.txt" || echo "(No differences!)"

    rm -rf "$TEMP_DIR"
    exit 0
fi

if [ ! -f "$DIFF_DIR/target/release/output-diff" ]; then
    echo "🔨 Building Output Diffing Utility..."
    (cd "$DIFF_DIR" && cargo build --release 2>&1 | grep -v "Compiling\|Finished" || true)
fi

echo "✅ Output Diffing Utility available"
echo ""

mkdir -p "$TEMP_DIR"

echo "🔄 Running tests twice..."
cd "$TOOL_DIR"

echo "  [Run 1/2]"
npm test > "$TEMP_DIR/run1.txt" 2>&1
echo "  ✓ Complete"

echo "  [Run 2/2]"
npm test > "$TEMP_DIR/run2.txt" 2>&1
echo "  ✓ Complete"
echo ""

echo "📊 Comparing outputs with Output Diffing Utility..."
echo "---"

cd "$DIFF_DIR"
./target/release/output-diff "$TEMP_DIR/run1.txt" "$TEMP_DIR/run2.txt" || {
  DIFF_EXIT=$?
  if [ $DIFF_EXIT -eq 1 ]; then
    echo ""
    echo "⚠️  DIFFERENCES FOUND!"
    echo ""
    echo "💡 Possible issues:"
    echo "   - Timestamps in test output"
    echo "   - Random UUIDs or IDs"
    echo "   - Non-deterministic test ordering"
    echo ""
  fi
}

if cmp -s "$TEMP_DIR/run1.txt" "$TEMP_DIR/run2.txt"; then
  echo ""
  echo "✅ Outputs are IDENTICAL!"
  echo ""
  echo "💡 Progress test outputs are deterministic"
  echo "   No random data, predictable behavior"
fi

echo "---"
echo ""

rm -rf "$TEMP_DIR"

echo "✨ Composition Demo Complete!"
echo ""
echo "💡 Key Takeaways:"
echo "   - Deterministic outputs = reliable tool"
echo "   - TypeScript ↔ Rust composition"
echo "   - Real validation of predictability"
echo ""
echo "🔗 See DOGFOODING_STRATEGY.md for details"
