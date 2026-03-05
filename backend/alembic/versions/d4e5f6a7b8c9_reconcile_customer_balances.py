"""reconcile customer balances from transaction sums

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-03-05 12:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()

    # Fix customer.balance to match SUM(transactions.amount).
    # This corrects drift caused by initial_balance being set
    # without a corresponding transaction.
    conn.execute(
        sa.text("""
            UPDATE customers c
            SET balance = COALESCE(s.txn_sum, 0)
            FROM (
                SELECT customer_id, SUM(amount) AS txn_sum
                FROM transactions
                WHERE is_deleted = false
                GROUP BY customer_id
            ) s
            WHERE s.customer_id = c.id
              AND c.is_deleted = false
              AND c.balance != s.txn_sum
        """)
    )

    # Customers with no transactions but non-zero balance
    conn.execute(
        sa.text("""
            UPDATE customers
            SET balance = 0
            WHERE is_deleted = false
              AND balance != 0
              AND id NOT IN (
                  SELECT DISTINCT customer_id
                  FROM transactions
                  WHERE is_deleted = false
              )
        """)
    )


def downgrade() -> None:
    pass  # Cannot reverse — original balances are lost
