"""Parse comma-separated run topic strings into a stable list."""

from __future__ import annotations


def parse_topics(raw: str) -> list[str]:
    """Split on commas, strip whitespace, drop empty segments."""
    if not raw or not raw.strip():
        return []
    return [part.strip() for part in raw.split(",") if part.strip()]
