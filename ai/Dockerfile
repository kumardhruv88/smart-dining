FROM python:3.11-slim

WORKDIR /code

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (for Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# HuggingFace Spaces requires port 7860
EXPOSE 7860

# Use non-root user for HF Spaces (UID 1000)
RUN useradd -m -u 1000 appuser && chown -R appuser /code
USER appuser

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
