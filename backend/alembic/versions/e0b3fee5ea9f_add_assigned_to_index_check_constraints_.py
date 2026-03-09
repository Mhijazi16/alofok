"""add_assigned_to_index_check_constraints_sync_expense_enum

Revision ID: e0b3fee5ea9f
Revises: 3fbb477cca09
Create Date: 2026-03-09 13:34:40.082998

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e0b3fee5ea9f"
down_revision: Union[str, None] = "3fbb477cca09"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SCHEMA-01: Add index on customers.assigned_to
    op.create_index(
        op.f("ix_customers_assigned_to"),
        "customers",
        ["assigned_to"],
        unique=False,
    )

    # SCHEMA-02: Add new enum values to expensecategory type
    op.execute("ALTER TYPE expensecategory ADD VALUE IF NOT EXISTS 'Gifts'")
    op.execute("ALTER TYPE expensecategory ADD VALUE IF NOT EXISTS 'CarWash'")
    op.execute("ALTER TYPE expensecategory ADD VALUE IF NOT EXISTS 'Electricity'")
    op.execute("ALTER TYPE expensecategory ADD VALUE IF NOT EXISTS 'Internet'")
    op.execute("ALTER TYPE expensecategory ADD VALUE IF NOT EXISTS 'CarRepair'")
    op.execute("ALTER TYPE expensecategory ADD VALUE IF NOT EXISTS 'Salaries'")

    # SCHEMA-03: CHECK constraints
    op.create_check_constraint(
        "ck_expense_amount_positive",
        "expenses",
        "amount > 0",
    )
    op.create_check_constraint(
        "ck_product_stock_qty_non_negative",
        "products",
        "stock_qty >= 0 OR stock_qty IS NULL",
    )
    op.create_check_constraint(
        "ck_product_discount_type_valid",
        "products",
        "discount_type IN ('percent', 'fixed') OR discount_type IS NULL",
    )


def downgrade() -> None:
    op.drop_constraint("ck_product_discount_type_valid", "products", type_="check")
    op.drop_constraint("ck_product_stock_qty_non_negative", "products", type_="check")
    op.drop_constraint("ck_expense_amount_positive", "expenses", type_="check")
    op.drop_index(op.f("ix_customers_assigned_to"), table_name="customers")
    # Note: PostgreSQL enum values cannot be removed in downgrade
