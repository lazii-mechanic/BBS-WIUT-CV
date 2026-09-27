#!/usr/bin/env bash
set -e

# Ensure weights exist; download if missing
if [ ! -f "/app/weights/yolo11n.pt" ]; then
    echo "[Entrypoint] Weights not found, running download script..."
    bash /app/weights/download.sh || true
fi

# If no arguments or argument is "dashboard", start the web dashboard
if [ "$#" -eq 0 ] || [ "$1" = "dashboard" ]; then
    echo "=========================================================="
    echo "Starting WIUT 2026 CV Hackathon Dashboard (Team BBS)..."
    echo "Website accessible at: http://localhost:${PORT:-8080}"
    echo "=========================================================="
    exec python run_dashboard.py
fi

# If passed command starts directly with runner scripts
if [ "$1" = "run_submission.py" ]; then
    exec python run_submission.py "${@:2}"
fi

if [ "$1" = "evaluate.py" ]; then
    exec python evaluate.py "${@:2}"
fi

# Otherwise execute the passed command (e.g. python run_submission.py ...)
exec "$@"
