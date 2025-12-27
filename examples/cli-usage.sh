#!/bin/bash

# CLI Usage Example for CLI Progress Reporting
#
# This example shows how to use the progress reporting tool from shell scripts.
#
# Run this example:
#   bash examples/cli-usage.sh

echo "=== CLI Progress Reporting - CLI Usage Example ==="
echo ""

PROGRESS_ID="shell-example"

# Initialize progress
echo "Initializing progress..."
prog init --total 5 --message "Processing shell tasks" --id "$PROGRESS_ID"
echo ""

# Simulate processing tasks
for i in {1..5}; do
  echo "Processing task $i..."
  sleep 1

  # Increment progress
  prog increment --amount 1 --message "Completed task $i" --id "$PROGRESS_ID"
  echo ""
done

# Get final status
echo "Getting final status..."
prog get --id "$PROGRESS_ID"
echo ""

# Mark as finished
echo "Marking as finished..."
prog finish --message "All tasks complete!" --id "$PROGRESS_ID"
echo ""

# Clean up
echo "Cleaning up..."
prog clear --id "$PROGRESS_ID"
echo "Done!"
