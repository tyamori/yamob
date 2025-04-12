# Use an official Python runtime as a parent image
FROM python:3.11-slim-bullseye

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Install system dependencies if needed
# RUN apt-get update && apt-get install -y --no-install-recommends some-package && rm -rf /var/lib/apt/lists/*

# Install pip and Ruff
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir ruff

# Set the working directory (optional)
# WORKDIR /app

# Copy project files (adjust if needed, often done via mount)
# COPY . /app

# Add a non-root user for security (optional but recommended)
# RUN useradd -ms /bin/bash vscode
# USER vscode

# Keep the container running (optional, useful for debugging)
# CMD ["sleep", "infinity"] 