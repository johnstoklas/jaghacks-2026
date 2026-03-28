"""Persist matched reel videos on disk and create SavedReel rows."""

from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import SavedReel


def reels_root(settings: Settings) -> Path:
    return Path(settings.reels_storage_dir).resolve()


def _ensure_under_root(root: Path, candidate: Path) -> None:
    root = root.resolve()
    candidate = candidate.resolve()
    try:
        candidate.relative_to(root)
    except ValueError as e:
        raise RuntimeError("invalid storage path") from e


def persist_matched_reel_copy(
    db: Session,
    *,
    run_id: int,
    source_file: str,
    reel_ref: str | None,
    settings: Settings,
    file_suffix: str,
) -> SavedReel:
    """Copy source_file into reels_storage_dir/{run_id}/ and insert SavedReel."""
    suffix = file_suffix if file_suffix.startswith(".") else f".{file_suffix}"
    rel = f"{run_id}/{uuid.uuid4().hex}{suffix}"
    root = reels_root(settings)
    dest = (root / rel).resolve()
    _ensure_under_root(root, dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_file, dest)
    reel = SavedReel(run_id=run_id, reel_ref=reel_ref, video_path=rel)
    db.add(reel)
    db.commit()
    db.refresh(reel)
    return reel


def resolve_stored_video_file(settings: Settings, relative_path: str) -> Path:
    """Resolve DB relative path to absolute file; raise 400/404 if invalid or missing."""
    root = reels_root(settings)
    p = (root / relative_path).resolve()
    try:
        p.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid video path") from None
    if not p.is_file():
        raise HTTPException(status_code=404, detail="Video file not found")
    return p


def guess_media_type(suffix: str) -> str:
    ext = suffix.lower().lstrip(".")
    mapping = {
        "mp4": "video/mp4",
        "webm": "video/webm",
        "mov": "video/quicktime",
        "mpeg": "video/mpeg",
        "avi": "video/x-msvideo",
        "flv": "video/x-flv",
        "wmv": "video/x-ms-wmv",
        "3gpp": "video/3gpp",
    }
    return mapping.get(ext, "application/octet-stream")
