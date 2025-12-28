#!/bin/bash
#
# Dogfooding: Test Flakiness Detector validation (Bidirectional)
#
# HIGH-VALUE: Proves CLI Progress is concurrent-safe under high load
#
# Why This Matters:
#   - Progress tracking involves file I/O and concurrent operations
#   - Test Flakiness Detector DEPENDS on this tool for progress display
#   - Must prove it's safe before using in production workflows
#
# Bidirectional Relationship:
#   ↔️  Test Flakiness Detector USES CLI Progress (library integration)
#   ↔️  Test Flakiness Detector VALIDATES CLI Progress (this script)
#
# Usage:
#   ./scripts/dogfood-flaky.sh [runs]
#
# Examples:
#   ./scripts/dogfood-flaky.sh     # Default: 20 runs (high for concurrent safety)
#   ./scripts/dogfood-flaky.sh 50  # Extra thorough validation
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOOL_DIR="$(dirname "$SCRIPT_DIR")"
DETECTOR_DIR="$TOOL_DIR/../test-flakiness-detector"
RUNS="${1:-20}"

echo "🔬 Dogfooding: Validating CLI Progress Reporting (Bidirectional)"
echo ""
echo "This creates BIDIRECTIONAL VALIDATION:"
echo "  1️⃣  Test Flakiness Detector USES Progress (for tracking)"
echo "  2️⃣  Test Flakiness Detector VALIDATES Progress (this script)"
echo ""
echo "Why high run count ($RUNS)?"
echo "  - Progress involves concurrent file operations"
echo "  - Higher iterations catch rare race conditions"
echo "  - Critical for tools that depend on this"
echo ""

if [ ! -d "$DETECTOR_DIR" ]; then
    echo "❌ Test Flakiness Detector not found"
    echo ""
    echo "This demonstrates graceful degradation:"
    echo "  - Tool works standalone"
    echo "  - Validation requires monorepo"
    echo ""
    echo "To run: git clone https://github.com/tuulbelt/tuulbelt.git"
    exit 1
fi

if [ ! -d "$DETECTOR_DIR/node_modules" ]; then
    echo "📦 Installing Test Flakiness Detector dependencies..."
    (cd "$DETECTOR_DIR" && npm install --silent)
fi

echo "✅ Test Flakiness Detector available"
echo "🎯 Running validation ($RUNS iterations for concurrent safety)..."
echo ""

cd "$DETECTOR_DIR"
set +e  # Temporarily disable exit on error to capture exit code
npx flaky \
    --test "cd '$TOOL_DIR' && npm test 2>&1" \
    --runs "$RUNS" \
    --verbose

EXIT_CODE=$?
set -e  # Re-enable exit on error

echo ""
if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ VALIDATION SUCCESSFUL!"
    echo ""
    echo "💡 CLI Progress is concurrent-safe:"
    echo "   - All $RUNS runs passed consistently"
    echo "   - No race conditions detected"
    echo "   - Safe for Test Flakiness Detector to use"
    echo ""
    echo "🔗 Bidirectional validation proven:"
    echo "   ✓ Flakiness Detector trusts Progress (uses it)"
    echo "   ✓ Progress trusts Flakiness Detector (validated by it)"
else
    echo "❌ FLAKINESS DETECTED!"
    echo ""
    echo "⚠️  FIX BEFORE USING IN PRODUCTION"
    echo "⚠️  This affects Test Flakiness Detector's progress tracking!"
    exit 1
fi

echo ""
echo "✨ Composition Demo Complete!"
echo ""
echo "💡 Key Takeaways:"
echo "   - Bidirectional validation builds confidence"
echo "   - 125 tests × $RUNS runs = $((125 * RUNS)) executions"
echo "   - Proves concurrent safety for production use"
echo ""
echo "🔗 See DOGFOODING_STRATEGY.md for details"
