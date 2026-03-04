"""backfill_check_data_fields

Revision ID: 524125d194d6
Revises: a1b2c3d4e5f7
Create Date: 2026-03-04 14:06:30.093836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '524125d194d6'
down_revision: Union[str, None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE transactions
        SET data = jsonb_build_object(
            'bank',           data->>'bank',
            'bank_number',    data->>'bank_number',
            'branch_number',  data->>'branch_number',
            'account_number', data->>'account_number',
            'holder_name',    data->>'holder_name',
            'due_date',       data->>'due_date',
            'image_url',      data->>'image_url'
        )
        WHERE type = 'Payment_Check'
          AND is_deleted = false
          AND data IS NOT NULL
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE transactions
        SET data = data - 'bank_number' - 'branch_number' - 'account_number' - 'holder_name'
        WHERE type = 'Payment_Check'
    """)
