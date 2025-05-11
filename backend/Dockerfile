```dockerfile
# Use an official Python runtime as a parent image
# Matching the requires-python = ">=3.13" from pyproject.toml
FROM python:3.13-slim

# Install uv
RUN pip install --no-cache-dir uv

# Set the working directory in the container.
# This will be the directory from which the app is run, and should be in PYTHONPATH.
WORKDIR /app

# Copy only necessary files for dependency installation first to leverage Docker cache
COPY backend/pyproject.toml backend/uv.lock* ./backend/
# The uv.lock* handles cases where the file might not exist initially.
# If uv.lock is guaranteed, just use backend/uv.lock

# Install dependencies using uv into the system Python environment.
# We run this from /app, but target the pyproject.toml inside the ./backend/ subdirectory.
# Using --no-dev to exclude test dependencies in the production image.
RUN uv pip sync ./backend/pyproject.toml --system --no-cache --no-dev

# Copy the entire backend application code into /app/backend
# This creates /app/backend/main.py, /app/backend/routers/, etc.
COPY backend/ ./backend/

# Make port 8080 available (Cloud Run default)
EXPOSE 8080

# Define environment variable for the port (Cloud Run will set this)
ENV PORT 8080
ENV HOST 0.0.0.0
# Ensure PYTHONPATH includes /app so that 'from backend...' works
ENV PYTHONPATH /app

# Set the default command to run when the container starts.
# Run as a module 'backend.main'
CMD ["uvicorn", "backend.main:app", "--host", "$HOST", "--port", "$PORT"]
```
**Explanation of changes:**
-   `WORKDIR /app`: Sets the main working directory.
-   `COPY backend/pyproject.toml backend/uv.lock* ./backend/`: Copies dependency files into a `backend` subdirectory within `/app`. This is done so that `uv pip sync` can find them relative to the `WORKDIR`.
-   `RUN uv pip sync ./backend/pyproject.toml ...`: Installs dependencies.
-   `COPY backend/ ./backend/`: Copies the *entire content* of your local `backend` directory (source) to `/app/backend/` (destination) in the image. This creates the structure `/app/backend/main.py`, `/app/backend/routers/`, etc.
-   `ENV PYTHONPATH /app`: Explicitly adds `/app` to `PYTHONPATH`. When Python looks for `backend.main`, it will find the `backend` directory within `/app`.
-   `CMD ["uvicorn", "backend.main:app", ...]`: Runs Uvicorn specifying the app as `backend.main:app`.

This structure ensures that when Uvicorn starts, Python can resolve `from backend...` imports correctly because `/app` is on the `PYTHONPATH` and contains the `backend` package.

**Next, Step 2: Review and Update `cloudbuild.yaml`**
I'll need to see the current `cloudbuild.yaml` content.
 cloudbuild.yaml