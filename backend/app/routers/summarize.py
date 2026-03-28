import asyncio
import os
import tempfile
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.deps import get_db
from app.models import Run
from app.schemas.runs import MatchOut
from app.services.gemini_summarize import summarize_video_path
from app.services.topic_match import match_summary_to_topics_gemini, match_summary_to_topics_vertex
from app.services.vertex_summarize import summarize_video_gcs
from app.services.video_compress import compress_video_path

router = APIRouter(tags=["summarize"])

Db = Annotated[Session, Depends(get_db)]


def _get_run_or_404(db: Session, run_id: int) -> Run:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run

ALLOWED_VIDEO_PREFIX = "video/"
ALLOWED_EXTENSIONS = {".mp4", ".webm", ".mov", ".mpeg", ".avi", ".flv", ".wmv", ".3gpp"}


def _filename_looks_like_video(filename: str | None) -> bool:
    if not filename:
        return False
    lower = filename.lower()
    return any(lower.endswith(ext) for ext in ALLOWED_EXTENSIONS)


def _suffix_from_filename(filename: str | None) -> str:
    if not filename:
        return ".mp4"
    lower = filename.lower()
    for ext in ALLOWED_EXTENSIONS:
        if lower.endswith(ext):
            return ext
    return ".mp4"


def _mime_from_filename(filename: str | None) -> str:
    ext = _suffix_from_filename(filename).lstrip(".")
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
    return mapping.get(ext, "video/mp4")


def _validate_video_content_type(video: UploadFile) -> None:
    content_type = (video.content_type or "").lower()
    if not content_type:
        return
    is_video = content_type.startswith(ALLOWED_VIDEO_PREFIX)
    is_octet = content_type == "application/octet-stream"
    if not is_video and not (is_octet and _filename_looks_like_video(video.filename)):
        raise HTTPException(
            status_code=415,
            detail=(
                f"Unsupported media type: {video.content_type!r}. "
                "Expected video/* or application/octet-stream with a known video filename."
            ),
        )


async def _read_upload_to_temp(
    video: UploadFile,
    *,
    max_bytes: int,
    max_upload_mb: int,
) -> tuple[str, str]:
    """Write upload to a temp file. Returns (path, mime_type for original file)."""
    _validate_video_content_type(video)
    content_type = (video.content_type or "").lower()
    suffix = _suffix_from_filename(video.filename)
    mime_type = content_type if content_type.startswith(ALLOWED_VIDEO_PREFIX) else _mime_from_filename(video.filename)

    fd, tmp_path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    try:
        total = 0
        chunk_size = 1024 * 1024
        while True:
            chunk = await video.read(chunk_size)
            if not chunk:
                break
            total += len(chunk)
            if total > max_bytes:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum size is {max_upload_mb} MB.",
                )
            with open(tmp_path, "ab") as out:
                out.write(chunk)

        if total == 0:
            raise HTTPException(status_code=400, detail="Empty file.")

        return tmp_path, mime_type
    except HTTPException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise
    except Exception:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


#@router.post("/api/upload-and-summarize")
async def upload_and_summarize(
    video: Annotated[UploadFile, File(..., description="Video file to summarize")],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    """Gemini API (developer API key) + Files API upload."""
    if not settings.gemini_api_configured:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not set. Add it to your environment to use this route.",
        )

    tmp_path, mime_type = await _read_upload_to_temp(
        video,
        max_bytes=settings.max_upload_bytes,
        max_upload_mb=settings.max_upload_mb,
    )
    try:
        try:
            assert settings.gemini_api_key is not None
            summary = await asyncio.to_thread(
                summarize_video_path,
                tmp_path,
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
                mime_type=mime_type,
            )
        except TimeoutError as e:
            raise HTTPException(status_code=504, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Summarization failed: {e!s}") from e

        return {"summary": summary}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.post("/api/upload-and-summarize-vertex")
async def upload_and_summarize_vertex(
    video: Annotated[UploadFile, File(..., description="Video file to summarize")],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, str]:
    """Vertex AI: ffmpeg compress → GCS → GenerativeModel (Application Default Credentials)."""
    if not settings.vertex_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "Vertex route is not configured. Set GCP_PROJECT_ID and GCS_BUCKET, "
                "and configure Application Default Credentials (e.g. gcloud auth application-default login)."
            ),
        )

    tmp_path, _mime_type = await _read_upload_to_temp(
        video,
        max_bytes=settings.max_upload_bytes,
        max_upload_mb=settings.max_upload_mb,
    )
    compressed_path: str | None = None
    try:
        try:
            compressed_path, _size_kb = await asyncio.to_thread(
                compress_video_path,
                tmp_path,
                width=settings.compress_width,
                height=settings.compress_height,
                fps=settings.compress_fps,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

        try:
            summary = await asyncio.to_thread(
                summarize_video_gcs,
                compressed_path,
                project_id=settings.gcp_project_id,
                bucket_name=settings.gcs_bucket,
                model_name=settings.vertex_model,
                mime_type="video/mp4",
                delete_blob_after=settings.delete_gcs_after,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Vertex summarization failed: {e!s}") from e

        return {"summary": summary}
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        if compressed_path:
            try:
                os.unlink(compressed_path)
            except OSError:
                pass


#@router.post(
#    "/api/runs/{run_id}/upload-and-match",
#    response_model=MatchOut,
#)
async def upload_and_match(
    run_id: int,
    video: Annotated[UploadFile, File(..., description="Video file to evaluate against run topics")],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Db,
) -> MatchOut:
    """Gemini: summarize reel, then YES/NO vs `Run.topics`. Returns `{"match": true|false}`."""
    if not settings.gemini_api_configured:
        raise HTTPException(
            status_code=503,
            detail="GEMINI_API_KEY is not set. Add it to your environment to use this route.",
        )

    run = _get_run_or_404(db, run_id)

    tmp_path, mime_type = await _read_upload_to_temp(
        video,
        max_bytes=settings.max_upload_bytes,
        max_upload_mb=settings.max_upload_mb,
    )
    try:
        try:
            assert settings.gemini_api_key is not None
            summary = await asyncio.to_thread(
                summarize_video_path,
                tmp_path,
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
                mime_type=mime_type,
            )
        except TimeoutError as e:
            raise HTTPException(status_code=504, detail=str(e)) from e
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Summarization failed: {e!s}") from e

        try:
            matched = await asyncio.to_thread(
                match_summary_to_topics_gemini,
                summary,
                run.topics,
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
            )
        except ValueError as e:
            raise HTTPException(status_code=502, detail=f"Topic match parse failed: {e!s}") from e
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Topic match failed: {e!s}") from e

        return MatchOut(match=matched)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.post(
    "/api/runs/{run_id}/upload-and-match-vertex",
    response_model=MatchOut,
)
async def upload_and_match_vertex(
    run_id: int,
    video: Annotated[UploadFile, File(..., description="Video file to evaluate against run topics")],
    settings: Annotated[Settings, Depends(get_settings)],
    db: Db,
) -> MatchOut:
    """Vertex: compress → GCS → summarize, then YES/NO vs `Run.topics`. Returns `{"match": true|false}`."""
    if not settings.vertex_configured:
        raise HTTPException(
            status_code=503,
            detail=(
                "Vertex route is not configured. Set GCP_PROJECT_ID and GCS_BUCKET, "
                "and configure Application Default Credentials (e.g. gcloud auth application-default login)."
            ),
        )

    run = _get_run_or_404(db, run_id)

    tmp_path, _mime_type = await _read_upload_to_temp(
        video,
        max_bytes=settings.max_upload_bytes,
        max_upload_mb=settings.max_upload_mb,
    )
    compressed_path: str | None = None
    try:
        try:
            compressed_path, _size_kb = await asyncio.to_thread(
                compress_video_path,
                tmp_path,
                width=settings.compress_width,
                height=settings.compress_height,
                fps=settings.compress_fps,
            )
        except RuntimeError as e:
            raise HTTPException(status_code=500, detail=str(e)) from e

        try:
            summary = await asyncio.to_thread(
                summarize_video_gcs,
                compressed_path,
                project_id=settings.gcp_project_id,
                bucket_name=settings.gcs_bucket,
                model_name=settings.vertex_model,
                mime_type="video/mp4",
                delete_blob_after=settings.delete_gcs_after,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Vertex summarization failed: {e!s}") from e

        try:
            matched = await asyncio.to_thread(
                match_summary_to_topics_vertex,
                summary,
                run.topics,
                model_name=settings.vertex_model,
            )
        except ValueError as e:
            raise HTTPException(status_code=502, detail=f"Topic match parse failed: {e!s}") from e
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Topic match failed: {e!s}") from e

        return MatchOut(match=matched)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        if compressed_path:
            try:
                os.unlink(compressed_path)
            except OSError:
                pass
