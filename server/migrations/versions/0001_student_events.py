"""create student_events table

Revision ID: 0001_student_events
Revises:
Create Date: 2026-05-25
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001_student_events"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "student_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("student_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("attempt_number", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("concept_tag", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "event_type IN ('part_selected','flight_started','flight_ended','crash_diagnosed')",
            name="ck_student_events_event_type",
        ),
    )
    op.create_index(
        "idx_student_events_student",
        "student_events",
        ["student_id", "created_at"],
    )
    op.create_index(
        "idx_student_events_session",
        "student_events",
        ["session_id"],
    )


def downgrade() -> None:
    op.drop_index("idx_student_events_session", table_name="student_events")
    op.drop_index("idx_student_events_student", table_name="student_events")
    op.drop_table("student_events")
