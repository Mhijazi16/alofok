"""add delivery_date to transactions

Revision ID: 6b2c3d4e5f6a
Revises: 5a1b2c3d4e5f
Create Date: 2026-03-03 21:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "6b2c3d4e5f6a"
down_revision: Union[str, None] = "5a1b2c3d4e5f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("delivery_date", sa.Date(), nullable=True))
    op.create_index("ix_transactions_delivery_date", "transactions", ["delivery_date"])


def downgrade() -> None:
    op.drop_index("ix_transactions_delivery_date", table_name="transactions")
    op.drop_column("transactions", "delivery_date")
