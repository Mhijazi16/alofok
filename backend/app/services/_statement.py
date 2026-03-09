"""Shared statement-building helpers used by customer_service and customer_portal_service."""

import uuid
from decimal import Decimal

from app.schemas.transaction import (
    StatementEntryOut,
    StatementOut,
    TransactionOut,
)


def find_since_zero_index(txns) -> int:
    """Return the index of the first transaction after the last zero-or-credit balance."""
    running = Decimal("0")
    last_zero_index = 0
    for i, txn in enumerate(txns):
        running += txn.amount
        if running <= 0:
            last_zero_index = i + 1
    return last_zero_index


def build_statement(customer_id: uuid.UUID, txns: list) -> StatementOut:
    """Build a StatementOut with running balance from an ordered list of transactions."""
    running = Decimal("0")
    entries: list[StatementEntryOut] = []
    for txn in txns:
        running += txn.amount
        entries.append(
            StatementEntryOut(
                transaction=TransactionOut.model_validate(txn),
                running_balance=running,
            )
        )
    return StatementOut(
        customer_id=customer_id, entries=entries, closing_balance=running
    )
