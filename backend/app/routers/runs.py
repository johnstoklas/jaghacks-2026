from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models import Run, SavedReel
from app.schemas.runs import RunCreate, RunOut, RunUpdate, SavedReelCreate, SavedReelOut

router = APIRouter(prefix="/api/runs", tags=["runs"])

Db = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[RunOut])
def list_runs(db: Db) -> list[Run]:
    return list(db.scalars(select(Run).order_by(Run.id.desc())).all())


@router.post("", response_model=RunOut, status_code=status.HTTP_201_CREATED)
def create_run(body: RunCreate, db: Db) -> Run:
    run = Run(name=body.name.strip(), topics=body.topics.strip())
    db.add(run)
    db.commit()
    db.refresh(run)
    return run


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
    db.delete(run)
    db.commit()


@router.get("/{run_id}/saved-reels", response_model=list[SavedReelOut])
def list_saved_reels(run_id: int, db: Db) -> list[SavedReel]:
    _get_run_or_404(db, run_id)
    return list(
        db.scalars(
            select(SavedReel)
            .where(SavedReel.run_id == run_id)
            .order_by(SavedReel.id.desc())
        ).all()
    )


@router.post(
    "/{run_id}/saved-reels",
    response_model=SavedReelOut,
    status_code=status.HTTP_201_CREATED,
)
def create_saved_reel(run_id: int, body: SavedReelCreate, db: Db) -> SavedReel:
    _get_run_or_404(db, run_id)
    reel = SavedReel(
        run_id=run_id,
        reel_ref=body.reel_ref.strip(),
        summary=body.summary.strip() if body.summary else None,
    )
    db.add(reel)
    db.commit()
    db.refresh(reel)
    return reel
