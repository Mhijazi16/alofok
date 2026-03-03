"""add Sat to assignedday enum

Revision ID: 5a1b2c3d4e5f
Revises: 4d494ecdfd14
Create Date: 2026-03-03 20:00:00.000000

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5a1b2c3d4e5f"
down_revision: Union[str, None] = "4d494ecdfd14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE assignedday ADD VALUE IF NOT EXISTS 'Sat'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values; no-op
    pass
