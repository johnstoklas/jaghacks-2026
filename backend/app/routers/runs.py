import os
import shutil
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings, get_settings
from app.deps import get_db
from app.models import Run, SavedReel
from app.schemas.runs import RunCreate, RunCreated, RunOut, RunUpdate, SavedReelOut, SeedKeywordGroup
from app.services.keyword_expand import (
    expand_seeds_gemini,
    expand_seeds_vertex,
    seeds_from_topics,
)
from app.routers.summarize import _read_upload_to_temp, _suffix_from_filename
from app.services.reel_storage import guess_media_type, persist_matched_reel_copy, resolve_stored_video_file

router = APIRouter(prefix="/api/runs", tags=["runs"])

Db = Annotated[Session, Depends(get_db)]


def _saved_reel_out(reel: SavedReel) -> SavedReelOut:
    return SavedReelOut(
        id=reel.id,
        run_id=reel.run_id,
        reel_ref=reel.reel_ref,
        created_at=reel.created_at,
        video_url=f"/api/runs/{reel.run_id}/saved-reels/{reel.id}/video",
    )


@router.get("", response_model=list[RunOut])
def list_runs(db: Db) -> list[Run]:
    return list(db.scalars(select(Run).order_by(Run.id.desc())).all())


def _run_to_created(run: Run) -> RunCreated:
    raw = run.keyword_expansion
    topics_map: dict[str, list[str]] = {}
    if raw:
        for row in raw:
            seed = row.get("seed")
            kws = row.get("keywords")
            if isinstance(seed, str) and isinstance(kws, list):
                topics_map[seed] = [str(x) for x in kws]
    return RunCreated(id=run.id, topics=topics_map)


@router.post("", response_model=RunCreated, status_code=status.HTTP_201_CREATED)
def create_run(
    body: RunCreate,
    db: Db,
    settings: Annotated[Settings, Depends(get_settings)],
) -> RunCreated:
    name = body.name.strip()
    topics = body.topics.strip()
    seeds = seeds_from_topics(topics)
    kw: list | None = None
    if seeds:
        if settings.vertex_configured:
            try:
                kw = expand_seeds_vertex(seeds, model_name=settings.vertex_model)
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Keyword expansion parse failed: {e!s}",
                ) from e
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Keyword expansion failed: {e!s}",
                ) from e
        elif settings.gemini_api_configured:
            try:
                assert settings.gemini_api_key is not None
                kw = expand_seeds_gemini(
                    seeds,
                    api_key=settings.gemini_api_key,
                    model=settings.gemini_model,
                )
            except ValueError as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Keyword expansion parse failed: {e!s}",
                ) from e
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Keyword expansion failed: {e!s}",
                ) from e
        else:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    "Keyword expansion requires Vertex (GCP_PROJECT_ID + GCS_BUCKET) or "
                    "GEMINI_API_KEY in the environment."
                ),
            )

    run = Run(name=name, topics=topics, keyword_expansion=kw)
    db.add(run)
    db.commit()
    db.refresh(run)
    return _run_to_created(run)


def _get_run_or_404(db: Session, run_id: int) -> Run:
    run = db.get(Run, run_id)
    if run is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Run not found")
    return run


@router.get("/{run_id}", response_model=RunOut)
def get_run(run_id: int, db: Db) -> Run:
    return _get_run_or_404(db, run_id)


@router.patch("/{run_id}", response_model=RunOut)
def update_run(run_id: int, body: RunUpdate, db: Db) -> Run:
    run = _get_run_or_404(db, run_id)
    if body.name is None and body.topics is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide at least one of name or topics",
        )
    if body.name is not None:
        run.name = body.name.strip()
    if body.topics is not None:
        run.topics = body.topics.strip()
    db.commit()
    db.refresh(run)
    return run


@router.delete("/{run_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_run(run_id: int, db: Db) -> None:
    run = _get_run_or_404(db, run_id)
    settings = get_settings()
    run_dir = Path(settings.reels_storage_dir).resolve() / str(run_id)
    db.delete(run)
    db.commit()
    if run_dir.is_dir():
        shutil.rmtree(run_dir, ignore_errors=True)


@router.post(
    "/{run_id}/saved-reels",
    response_model=SavedReelOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_saved_reel(
    run_id: int,
    video: Annotated[UploadFile, File(..., description="Video file to store for this run")],
    db: Db,
    settings: Annotated[Settings, Depends(get_settings)],
    reel_ref: Annotated[str | None, Form()] = None,
) -> SavedReelOut:
    """Multipart: required `video`, optional `reel_ref`. Stores file under `REELS_STORAGE_DIR` and inserts `saved_reels`."""
    _get_run_or_404(db, run_id)
    tmp_path, _mime = await _read_upload_to_temp(
        video,
        max_bytes=settings.max_upload_bytes,
        max_upload_mb=settings.max_upload_mb,
    )
    try:
        rr = (reel_ref or "").strip() or None
        reel = persist_matched_reel_copy(
            db,
            run_id=run_id,
            source_file=tmp_path,
            reel_ref=rr,
            settings=settings,
            file_suffix=_suffix_from_filename(video.filename),
        )
        return _saved_reel_out(reel)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.get("/{run_id}/saved-reels", response_model=list[SavedReelOut])
def list_saved_reels(run_id: int, db: Db) -> list[SavedReelOut]:
    _get_run_or_404(db, run_id)
    reels = list(
        db.scalars(
            select(SavedReel)
            .where(SavedReel.run_id == run_id)
            .order_by(SavedReel.id.desc())
        ).all()
    )
    return [_saved_reel_out(r) for r in reels]


@router.get("/{run_id}/saved-reels/{saved_reel_id}/video")
def get_saved_reel_video(
    run_id: int,
    saved_reel_id: int,
    db: Db,
    settings: Annotated[Settings, Depends(get_settings)],
) -> FileResponse:
    _get_run_or_404(db, run_id)
    reel = db.get(SavedReel, saved_reel_id)
    if reel is None or reel.run_id != run_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Saved reel not found")
    path = resolve_stored_video_file(settings, reel.video_path)
    return FileResponse(path, media_type=guess_media_type(path.suffix))
