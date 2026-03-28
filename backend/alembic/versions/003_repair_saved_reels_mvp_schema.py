"""Repair saved_reels to MVP schema (video_path, optional reel_ref)

Revision ID: 003
Revises: 002
Create Date: 2026-03-28

Use when `alembic_version` is already `002` but the table still has columns from an
older migration (e.g. `match`, `topic_matches`, `summary`) or is missing `video_path`.

This drops and recreates `saved_reels` — existing rows in that table are deleted.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "003"
down_revision: Union[str, Sequence[str], None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_saved_reels_mvp() -> None:
    op.create_table(
        "saved_reels",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("reel_ref", sa.String(length=2048), nullable=True),
        sa.Column("video_path", sa.String(length=512), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("(CURRENT_TIMESTAMP)"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["run_id"], ["runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_reels_run_id"), "saved_reels", ["run_id"], unique=False)


def _needs_repair(inspector: sa.Inspector) -> bool:
    if not inspector.has_table("saved_reels"):
        return True
    cols = {c["name"] for c in inspector.get_columns("saved_reels")}
    if "video_path" not in cols:
        return True
    if cols & {"match", "topic_matches", "summary"}:
        return True
    return False


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if not _needs_repair(insp):
        return
    op.execute(sa.text("DROP TABLE IF EXISTS saved_reels CASCADE"))
    _create_saved_reels_mvp()


def downgrade() -> None:
    """Step back to revision 002 schema (MVP `saved_reels`). No-op if already correct."""
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if insp.has_table("saved_reels"):
        cols = {c["name"] for c in insp.get_columns("saved_reels")}
        if "video_path" in cols and not (cols & {"match", "topic_matches", "summary"}):
            return
    op.execute(sa.text("DROP TABLE IF EXISTS saved_reels CASCADE"))
    _create_saved_reels_mvp()
