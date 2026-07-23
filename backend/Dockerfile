FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
# libpq-dev and gcc are required for psycopg2 (PostgreSQL adapter) — the Docker
# Compose setup runs against PostgreSQL 16 with pgvector. When running outside
# Docker with SQLite, these are not needed.
# Note: if you change REQUIREMENTS to use asyncpg instead of psycopg2 for
# async support, libpq-dev is still needed for pgvector support.
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ app/

# Expose port
EXPOSE 8000

# Run with uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
