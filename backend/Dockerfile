# Use an official Python runtime as a parent image
# Matching the requires-python = ">=3.13" from pyproject.toml
FROM python:3.13-slim

# Install uv
RUN pip install --no-cache-dir uv

# Set the working directory in the container
WORKDIR /app

# Copy the project definition and lock file (if it exists)
COPY pyproject.toml ./
# COPY uv.lock ./ 
# uv.lock is not strictly necessary for `uv pip sync pyproject.toml` if pyproject.toml is well-defined,
# but including it can ensure more deterministic builds if the lock file is kept up-to-date.
# For `uv pip sync pyproject.toml`, it primarily uses pyproject.toml to resolve.
# If you prefer to sync strictly from the lock file, use `uv pip sync uv.lock`.

# Install dependencies using uv into the system Python environment
# This assumes pyproject.toml lists all direct and transitive dependencies needed.
# Using --system to install globally in the container's Python site-packages.
RUN uv pip sync pyproject.toml --system --no-cache 
# Alternatively, if you want to use a requirements.txt generated from pyproject.toml:
# RUN uv pip freeze > requirements.txt
# RUN uv pip install -r requirements.txt --system --no-cache

# Copy the rest of the application code into the container
COPY . .

# Make port 8080 available to the world outside this container
# Cloud Run expects applications to listen on the port defined by the PORT env var, default 8080.
EXPOSE 8080

# Define environment variable for the port (Cloud Run will set this)
ENV PORT 8080
ENV HOST 0.0.0.0

# Set the default command to run when the container starts
# Using uvicorn directly. Ensure GOOGLE_CLOUD_PROJECT is set as an env var in Cloud Run.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$PORT"]