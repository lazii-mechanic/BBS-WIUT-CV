# syntax=docker/dockerfile:1
FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered terminal logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive \
    PORT=8080

# Working directory inside container
WORKDIR /app

# Install system dependencies for OpenCV, FFmpeg video processing, and networking
RUN apt-get update && apt-get install --no-install-recommends -y \
    build-essential \
    curl \
    wget \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first for caching efficiency
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir lapx>=0.5.5

# Copy project source code into container
COPY . .

# Ensure model weights are present (runs download script if not present)
RUN bash weights/download.sh

# Ensure executable permissions for scripts
RUN chmod +x entrypoint.sh weights/download.sh scripts/*.py || true

# Expose web application port (HTTP 8080)
EXPOSE 8080

# Configure container entrypoint and default command
ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
CMD ["dashboard"]
