"""product_overhaul_options_images_discount

Revision ID: a1b2c3d4e5f7
Revises: f7d8db5dd7c5
Create Date: 2026-03-03 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "f7d8db5dd7c5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create product_options table
    op.create_table(
        "product_options",
        sa.Column(
            "id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False
        ),
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
        sa.Column("is_deleted", sa.Boolean(), nullable=False, default=False),
        sa.Column(
            "product_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("products.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("values", postgresql.JSONB(), nullable=False),
        sa.Column("sort_order", sa.Integer(), default=0),
    )

    # 2. Add new columns to products
    op.add_column(
        "products", sa.Column("trademark", sa.String(), nullable=True)
    )
    op.add_column(
        "products",
        sa.Column("purchase_price", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "products", sa.Column("discount_type", sa.String(), nullable=True)
    )
    op.add_column(
        "products",
        sa.Column("discount_value", sa.Numeric(precision=12, scale=2), nullable=True),
    )
    op.add_column(
        "products", sa.Column("image_urls", postgresql.JSONB(), nullable=True)
    )

    # 3. Data migration: brand → trademark
    op.execute("UPDATE products SET trademark = brand WHERE brand IS NOT NULL")

    # 4. Data migration: image_url → image_urls (as single-element array)
    op.execute(
        """
        UPDATE products
        SET image_urls = jsonb_build_array(image_url)
        WHERE image_url IS NOT NULL
        """
    )

    # 5. Data migration: discount_percentage → discount_type + discount_value
    op.execute(
        """
        UPDATE products
        SET discount_type = 'percent',
            discount_value = discount_percentage
        WHERE discount_percentage IS NOT NULL
        """
    )

    # 6. Drop old columns
    op.drop_column("products", "image_url")
    op.drop_column("products", "brand")
    op.drop_column("products", "discount_percentage")
    op.drop_column("products", "discounted_price")
    op.drop_column("products", "color_options")


def downgrade() -> None:
    # Re-add old columns
    op.add_column(
        "products",
        sa.Column("color_options", postgresql.JSONB(), nullable=True),
    )
    op.add_column(
        "products",
        sa.Column(
            "discounted_price", sa.Numeric(precision=12, scale=2), nullable=True
        ),
    )
    op.add_column(
        "products",
        sa.Column(
            "discount_percentage", sa.Numeric(precision=5, scale=2), nullable=True
        ),
    )
    op.add_column(
        "products", sa.Column("brand", sa.String(), nullable=True)
    )
    op.add_column(
        "products", sa.Column("image_url", sa.String(), nullable=True)
    )

    # Reverse data migrations
    op.execute("UPDATE products SET brand = trademark WHERE trademark IS NOT NULL")
    op.execute(
        "UPDATE products SET image_url = image_urls->>0 WHERE image_urls IS NOT NULL"
    )
    op.execute(
        """
        UPDATE products
        SET discount_percentage = discount_value
        WHERE discount_type = 'percent'
        """
    )

    # Drop new columns
    op.drop_column("products", "image_urls")
    op.drop_column("products", "discount_value")
    op.drop_column("products", "discount_type")
    op.drop_column("products", "purchase_price")
    op.drop_column("products", "trademark")

    # Drop product_options table
    op.drop_table("product_options")
