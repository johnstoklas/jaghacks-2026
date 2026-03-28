"""saved_reels: video_path, optional reel_ref; drop summary

Revision ID: 002
Revises: 001
Create Date: 2026-03-28

MVP: store file path only; reels created from upload-and-match when match is true.
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "002"
down_revision: Union[str, Sequence[str], None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_table("saved_reels")
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


def downgrade() -> None:
    op.drop_index(op.f("ix_saved_reels_run_id"), table_name="saved_reels")
    op.drop_table("saved_reels")
    op.create_table(
        "saved_reels",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("run_id", sa.Integer(), nullable=False),
        sa.Column("reel_ref", sa.String(length=2048), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
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
