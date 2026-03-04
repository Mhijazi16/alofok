"""add Fri to AssignedDay enum

Revision ID: b9ec4890c558
Revises: 524125d194d6
Create Date: 2026-03-04 21:32:04.878837

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b9ec4890c558'
down_revision: Union[str, None] = '524125d194d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE assignedday ADD VALUE IF NOT EXISTS 'Fri'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    pass
