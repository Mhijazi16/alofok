"""add expenses and daily_cash_confirmations tables

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-03-05 15:10:00.000000

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Enum types defined here so create_type=True creates them exactly once.
expensetype = sa.Enum("Field", "Business", name="expensetype")
expensecategory = sa.Enum(
    "Fuel",
    "Food",
    "Accommodation",
    "Supplies",
    "Transport",
    "Maintenance",
    "Marketing",
    "Utilities",
    "Other",
    name="expensecategory",
)
expensestatus = sa.Enum("Pending", "Confirmed", "Flagged", name="expensestatus")


def upgrade() -> None:
    # Create expenses table — SQLAlchemy creates the enum types automatically
    # on first encounter because create_type defaults to True.
    op.create_table(
        "expenses",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("expense_type", expensetype, nullable=False),
        sa.Column("category", expensecategory, nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("notes", sa.String(), nullable=True),
        sa.Column(
            "status",
            expensestatus,
            nullable=False,
            server_default="Pending",
        ),
        sa.Column(
            "created_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "confirmed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("flag_notes", sa.String(), nullable=True),
    )
    op.create_index("ix_expenses_created_by", "expenses", ["created_by"])
    op.create_index("ix_expenses_date", "expenses", ["date"])

    # Create daily_cash_confirmations table
    op.create_table(
        "daily_cash_confirmations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "is_deleted",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column(
            "rep_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("handed_over_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "confirmed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id"),
            nullable=True,
        ),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "is_flagged",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
        sa.Column("flag_notes", sa.String(), nullable=True),
        sa.UniqueConstraint("rep_id", "date", name="uq_daily_cash_rep_date"),
    )
    op.create_index(
        "ix_daily_cash_confirmations_rep_id", "daily_cash_confirmations", ["rep_id"]
    )
    op.create_index(
        "ix_daily_cash_confirmations_date", "daily_cash_confirmations", ["date"]
    )


def downgrade() -> None:
    op.drop_table("daily_cash_confirmations")
    op.drop_table("expenses")
    expensestatus.drop(op.get_bind())
    expensecategory.drop(op.get_bind())
    expensetype.drop(op.get_bind())
