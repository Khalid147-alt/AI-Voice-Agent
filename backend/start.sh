#!/bin/bash
# Start the VoiceDesk backend.
python -m venv .venv 2>/dev/null || true
# shellcheck disable=SC1091
source .venv/bin/activate 2>/dev/null || source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
