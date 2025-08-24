#!/bin/bash

echo "Attempting to kill processes on port 3000..."
PIDS_3000=$(lsof -t -i :3000)
if [ -n "$PIDS_3000" ]; then
  kill $PIDS_3000
  echo "Killed processes: $PIDS_3000 on port 3000."
else
  echo "No process found on port 3000."
fi

echo "Attempting to kill processes on port 8000..."
PIDS_8000=$(lsof -t -i :8000)
if [ -n "$PIDS_8000" ]; then
  kill $PIDS_8000
  echo "Killed processes: $PIDS_8000 on port 8000."
else
  echo "No process found on port 8000."
fi

echo "Server kill script finished."
