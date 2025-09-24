FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy configuration files
COPY config/alembic.ini .

# Copy application code
COPY main.py .
COPY reset_and_migrate.py .
COPY app/ ./app/
COPY alembic/ ./alembic/

# Expose port
EXPOSE 8000

# Start application with migration reset and setup
CMD ["sh", "-c", "echo 'Starting deployment...' && echo 'DATABASE_URL:' $DATABASE_URL && echo 'PORT:' $PORT && echo 'Resetting migration state...' && python reset_and_migrate.py && echo 'Running migrations...' && alembic upgrade head && echo 'Migration completed successfully!' && echo 'Starting server...' && uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]