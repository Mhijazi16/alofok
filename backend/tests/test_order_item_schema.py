"""Tests for OrderItemSchema and typed order creation schemas."""

import uuid
from decimal import Decimal

from pydantic import ValidationError


def test_order_item_schema_exists():
    """OrderItemSchema should be importable from transaction schemas."""
    from app.schemas.transaction import OrderItemSchema

    assert OrderItemSchema is not None


def test_order_item_schema_valid():
    """Valid item should construct successfully."""
    from app.schemas.transaction import OrderItemSchema

    item = OrderItemSchema(
        product_id=uuid.uuid4(),
        quantity=2,
        unit_price=Decimal("10.50"),
    )
    assert item.quantity == 2
    assert item.unit_price == Decimal("10.50")
    assert isinstance(item.product_id, uuid.UUID)


def test_order_item_schema_negative_quantity_rejected():
    """Negative quantity should raise ValidationError."""
    from app.schemas.transaction import OrderItemSchema

    try:
        OrderItemSchema(
            product_id=uuid.uuid4(),
            quantity=-1,
            unit_price=Decimal("10.50"),
        )
        assert False, "Should have raised ValidationError"
    except ValidationError:
        pass


def test_order_item_schema_zero_quantity_rejected():
    """Zero quantity should raise ValidationError (gt=0)."""
    from app.schemas.transaction import OrderItemSchema

    try:
        OrderItemSchema(
            product_id=uuid.uuid4(),
            quantity=0,
            unit_price=Decimal("10.50"),
        )
        assert False, "Should have raised ValidationError"
    except ValidationError:
        pass


def test_order_item_schema_negative_price_rejected():
    """Negative unit_price should raise ValidationError."""
    from app.schemas.transaction import OrderItemSchema

    try:
        OrderItemSchema(
            product_id=uuid.uuid4(),
            quantity=1,
            unit_price=Decimal("-5.00"),
        )
        assert False, "Should have raised ValidationError"
    except ValidationError:
        pass


def test_order_create_uses_typed_items():
    """OrderCreate.items should accept dicts and coerce to OrderItemSchema."""
    from app.schemas.transaction import OrderCreate

    oc = OrderCreate(
        customer_id=uuid.uuid4(),
        items=[
            {
                "product_id": str(uuid.uuid4()),
                "quantity": 1,
                "unit_price": "5.00",
            }
        ],
    )
    # Items should have typed attribute access (not dict)
    assert hasattr(oc.items[0], "product_id")
    assert hasattr(oc.items[0], "quantity")
    assert hasattr(oc.items[0], "unit_price")


def test_order_update_uses_typed_items():
    """OrderUpdate.items should use OrderItemSchema when provided."""
    from app.schemas.transaction import OrderUpdate

    ou = OrderUpdate(
        items=[
            {
                "product_id": str(uuid.uuid4()),
                "quantity": 3,
                "unit_price": "7.50",
            }
        ],
    )
    assert hasattr(ou.items[0], "product_id")


def test_draft_order_create_uses_typed_items():
    """DraftOrderCreate.items should use OrderItemSchema."""
    from app.schemas.customer_auth import DraftOrderCreate

    doc = DraftOrderCreate(
        items=[
            {
                "product_id": str(uuid.uuid4()),
                "quantity": 2,
                "unit_price": "12.00",
            }
        ],
    )
    assert hasattr(doc.items[0], "product_id")


def test_order_item_schema_optional_name():
    """OrderItemSchema should accept optional name field."""
    from app.schemas.transaction import OrderItemSchema

    item = OrderItemSchema(
        product_id=uuid.uuid4(),
        quantity=1,
        unit_price=Decimal("10.00"),
        name="Paint Brush",
    )
    assert item.name == "Paint Brush"

    item_no_name = OrderItemSchema(
        product_id=uuid.uuid4(),
        quantity=1,
        unit_price=Decimal("10.00"),
    )
    assert item_no_name.name is None


if __name__ == "__main__":
    tests = [
        test_order_item_schema_exists,
        test_order_item_schema_valid,
        test_order_item_schema_negative_quantity_rejected,
        test_order_item_schema_zero_quantity_rejected,
        test_order_item_schema_negative_price_rejected,
        test_order_create_uses_typed_items,
        test_order_update_uses_typed_items,
        test_draft_order_create_uses_typed_items,
        test_order_item_schema_optional_name,
    ]
    for t in tests:
        try:
            t()
            print(f"PASS: {t.__name__}")
        except Exception as e:
            print(f"FAIL: {t.__name__}: {e}")
