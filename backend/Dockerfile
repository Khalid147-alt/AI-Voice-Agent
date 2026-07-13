# VoiceDesk backend — Hugging Face Docker Space (must listen on port 7860).
FROM python:3.11-slim

# HF Spaces run as a non-root user with uid 1000.
RUN useradd -m -u 1000 user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PORT=7860

WORKDIR /app

# Install deps first for better layer caching.
COPY --chown=user requirements.txt requirements.txt
RUN pip install --no-cache-dir --upgrade -r requirements.txt

# Copy the application source.
COPY --chown=user . /app

USER user

EXPOSE 7860

# Bind to 0.0.0.0:7860 as required by HF Spaces.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860}"]
