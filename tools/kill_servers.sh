#!/bin/bash

echo "Attempting to kill processes on port 3000..."
PIDS_3000=$(lsof -t -i :3000)
if [ -n "$PIDS_3000" ]; then
  # Kill the process group for frontend (npm run dev)
  PGID_3000=$(ps -o pgid= $PIDS_3000 | grep -o '[0-9]*' | head -n 1)
  if [ -n "$PGID_3000" ]; then
    kill -- -$PGID_3000
    echo "Killed process group: $PGID_3000 on port 3000."
  else
    kill $PIDS_3000
    echo "Killed processes: $PIDS_3000 on port 3000."
  fi
else
  echo "No process found on port 3000."
fi

echo "Attempting to kill processes on port 8000..."
PIDS_8000=$(lsof -t -i :8000)
if [ -n "$PIDS_8000" ]; then
  # Kill the process group for backend (uvicorn)
  PGID_8000=$(ps -o pgid= $PIDS_8000 | grep -o '[0-9]*' | head -n 1)
  if [ -n "$PGID_8000" ]; then
    kill -- -$PGID_8000
    echo "Killed process group: $PGID_8000 on port 8000."
  else
    kill $PIDS_8000
    echo "Killed processes: $PIDS_8000 on port 8000."
  fi
else
  echo "No process found on port 8000."
fi

echo "Server kill script finished."