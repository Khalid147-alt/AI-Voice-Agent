from typing import Any, Optional


def envelope(data: Any = None, error: Optional[str] = None) -> dict:
    """Consistent API response envelope: {"data": ..., "error": ...}."""
    return {"data": data, "error": error}
