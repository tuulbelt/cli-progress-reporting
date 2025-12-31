#!/bin/bash
# Record CLI Progress Reporting demo
source "$(dirname "$0")/lib/demo-framework.sh"

TOOL_NAME="cli-progress-reporting"
SHORT_NAME="prog"
LANGUAGE="typescript"

# GIF parameters
GIF_COLS=100
GIF_ROWS=30
GIF_SPEED=1.0
GIF_FONT_SIZE=14

demo_commands() {
  # ═══════════════════════════════════════════
  # CLI Progress Reporting / prog - Tuulbelt
  # ═══════════════════════════════════════════

  # Step 1: Installation
  echo "# Step 1: Install globally"
  sleep 0.5
  echo "$ npm link"
  sleep 1

  # Step 2: View help
  echo ""
  echo "# Step 2: View available commands"
  sleep 0.5
  echo "$ prog --help"
  sleep 0.5
  prog --help
  sleep 3

  # Step 3: Initialize progress tracker
  echo ""
  echo "# Step 3: Initialize progress tracker"
  sleep 0.5
  echo "$ prog init --total 100 --message \"Processing files\""
  sleep 0.5
  prog init --total 100 --message "Processing files"
  sleep 1

  # Step 4: Increment progress
  echo ""
  echo "# Step 4: Increment progress"
  sleep 0.5
  echo "$ prog increment --amount 10"
  prog increment --amount 10
  sleep 0.5
  echo "$ prog increment --amount 20"
  prog increment --amount 20
  sleep 0.5
  echo "$ prog increment --amount 30"
  prog increment --amount 30
  sleep 1

  # Step 5: Check current state
  echo ""
  echo "# Step 5: Check current state"
  sleep 0.5
  echo "$ prog get"
  sleep 0.5
  prog get
  sleep 2

  # Step 6: Complete and finish
  echo ""
  echo "# Step 6: Complete and finish"
  sleep 0.5
  echo "$ prog finish --message \"All files processed!\""
  sleep 0.5
  prog finish --message "All files processed!"
  sleep 1

  # Step 7: Multiple trackers with IDs
  echo ""
  echo "# Step 7: Multiple trackers with IDs"
  sleep 0.5
  echo "$ prog init --total 50 --id build --message \"Building project\""
  prog init --total 50 --id build --message "Building project"
  sleep 0.5
  echo "$ prog increment --id build --amount 25"
  prog increment --id build --amount 25
  sleep 0.5
  echo "$ prog get --id build"
  prog get --id build
  sleep 2

  # Cleanup
  prog clear --id build 2>/dev/null || true

  echo ""
  echo "# Done! Track progress with: prog init --total N"
  sleep 1
}

run_demo
