"""add hidden_from_sales to customers

Revision ID: a7f3c9d21b84
Revises: e0b3fee5ea9f
Create Date: 2026-06-13 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a7f3c9d21b84"
down_revision: Union[str, None] = "e0b3fee5ea9f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "customers",
        sa.Column(
            "hidden_from_sales",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("customers", "hidden_from_sales")
