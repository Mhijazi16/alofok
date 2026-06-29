"""add Discount to TransactionType enum

Revision ID: b4d8e1c2f9a0
Revises: a7f3c9d21b84
Create Date: 2026-06-29 18:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "b4d8e1c2f9a0"
down_revision: Union[str, None] = "a7f3c9d21b84"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Must commit the enum change before it can be used in subsequent migrations.
    conn = op.get_bind()
    conn.execute(sa.text("COMMIT"))
    conn.execute(
        sa.text("ALTER TYPE transactiontype ADD VALUE IF NOT EXISTS 'Discount'")
    )
    conn.execute(sa.text("BEGIN"))


def downgrade() -> None:
    pass  # PostgreSQL doesn't support removing enum values
