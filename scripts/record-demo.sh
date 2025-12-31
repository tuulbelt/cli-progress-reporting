#!/bin/bash
# Record CLI Progress Reporting demo
source "$(dirname "$0")/lib/demo-framework.sh"

TOOL_NAME="cli-progress-reporting"
SHORT_NAME="prog"
LANGUAGE="typescript"

demo_commands() {
  echo "# CLI Progress Reporting Demo"
  sleep 1

  echo ""
  echo "# Initialize progress tracking"
  sleep 0.5
  echo "$ prog init --total 100 --message \"Processing files\""
  sleep 0.5
  prog init --total 100 --message "Processing files"
  sleep 1

  echo ""
  echo "# Update progress in a loop"
  sleep 0.5
  for i in {1..5}; do
    echo "$ prog increment --amount 20"
    prog increment --amount 20
    sleep 0.8
  done
  sleep 1

  echo ""
  echo "# Finish with completion message"
  sleep 0.5
  echo "$ prog finish --message \"Complete!\""
  sleep 0.5
  prog finish --message "Complete!"
  sleep 2

  echo ""
  echo "# Show help"
  sleep 0.5
  echo "$ prog --help"
  sleep 0.5
  prog --help
  sleep 2

  echo ""
  echo "# Done! Track progress with the prog command."
  sleep 1
}

run_demo
