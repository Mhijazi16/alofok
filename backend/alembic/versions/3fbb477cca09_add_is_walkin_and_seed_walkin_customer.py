"""add_is_walkin_and_seed_walkin_customer

Revision ID: 3fbb477cca09
Revises: 427a4d983a8e
Create Date: 2026-03-06 13:47:14.799789

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3fbb477cca09'
down_revision: Union[str, None] = '427a4d983a8e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('customers', sa.Column('is_walkin', sa.Boolean(), server_default='false', nullable=False))

    # Seed walk-in customer
    op.execute(
        """
        INSERT INTO customers (id, name, phone, city, assigned_day, is_walkin, is_deleted, balance, created_at, updated_at)
        VALUES (
            '00000000-0000-0000-0000-000000000001',
            'Walk-In',
            '0000000000',
            'N/A',
            'Sun',
            true,
            false,
            0,
            NOW(),
            NOW()
        )
        ON CONFLICT (id) DO NOTHING;
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM customers WHERE id = '00000000-0000-0000-0000-000000000001';")
    op.drop_column('customers', 'is_walkin')
