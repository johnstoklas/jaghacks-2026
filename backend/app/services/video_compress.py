"""Transcode video with ffmpeg (defaults aligned with legacy AIDEN example: 540x960, 5 fps)."""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path


def ffmpeg_available() -> bool:
    return shutil.which("ffmpeg") is not None


def compress_video_path(
    input_path: str | Path,
    *,
    width: int = 540,
    height: int = 960,
    fps: int = 5,
) -> tuple[str, float]:
    """
    Returns:
        (path_to_compressed_mp4, size_kb)
    """
    if not ffmpeg_available():
        raise RuntimeError(
            "ffmpeg not found on PATH. Install ffmpeg to use the Vertex summarization route."
        )

    input_path = Path(input_path)
    fd, out_path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    out_path = Path(out_path)

    w, h = width, height
    vf = f"scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,fps={fps}"

    cmd = [
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        str(input_path),
        "-vf",
        vf,
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "28",
        "-c:a",
        "aac",
        "-b:a",
        "64k",
        str(out_path),
    ]

    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        try:
            out_path.unlink(missing_ok=True)
        except OSError:
            pass
        err = (e.stderr or e.stdout or "").strip()
        raise RuntimeError(f"ffmpeg failed: {err or e}") from e

    size_kb = out_path.stat().st_size / 1024.0
    return str(out_path), size_kb
