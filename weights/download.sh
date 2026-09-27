#!/usr/bin/env bash
# Download model weights before offline grading run
set -e
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEIGHT="$DIR/yolo11n.pt"

if [ -f "$WEIGHT" ]; then
    echo "Weight already exists: $WEIGHT"
    exit 0
fi

echo "Downloading yolo11n.pt..."
if command -v curl >/dev/null 2>&1; then
    curl -L -o "$WEIGHT" https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt
elif command -v wget >/dev/null 2>&1; then
    wget -O "$WEIGHT" https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt
else
    python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt', '$WEIGHT')"
fi
echo "Downloaded $WEIGHT"
