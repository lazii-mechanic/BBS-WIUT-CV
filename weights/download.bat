@echo off
set "WEIGHT=%~dp0yolo11n.pt"
if exist "%WEIGHT%" (
    echo Weight already exists: %WEIGHT%
    exit /b 0
)
echo Downloading yolo11n.pt...
python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/ultralytics/assets/releases/download/v8.3.0/yolo11n.pt', r'%WEIGHT%')"
if exist "%WEIGHT%" (
    echo Downloaded %WEIGHT% successfully.
) else (
    echo Failed to download weights.
    exit /b 1
)
