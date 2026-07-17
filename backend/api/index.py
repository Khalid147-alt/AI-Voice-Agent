"""Vercel Python serverless entrypoint.

Vercel's `@vercel/python` runtime imports an ASGI `app` from a file under
`api/`. The application modules (main.py, routers/, services/, …) live at the
backend project root, so we add that root to sys.path before importing, then
re-export the FastAPI instance as `app` for the runtime to serve.
"""
import os
import sys

# backend/ is the parent of this api/ directory. Ensure it's importable.
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from main import app  # noqa: E402

# `app` is the ASGI callable Vercel serves.
__all__ = ["app"]
