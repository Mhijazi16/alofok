"""Orders must never be stored without a delivery date.

Every route / delivery view filters on ``Transaction.delivery_date``, so a NULL
date makes an order invisible everywhere except the customer statement. This
actually happened in production: the date picker cleared the auto-filled date
when the rep tapped the already-selected day, and the order vanished from the
customer's route day.
"""

from datetime import date

from app.models.customer import AssignedDay, Customer
from app.services.order_service import default_delivery_date


def _customer(day: AssignedDay) -> Customer:
    return Customer(name="test", city="x", assigned_day=day)


def test_defaults_to_today_when_today_is_the_route_day():
    # 2026-07-22 is a Wednesday.
    today = date(2026, 7, 22)
    assert default_delivery_date(_customer(AssignedDay.Wed), today) == today


def test_defaults_to_next_occurrence_of_route_day():
    today = date(2026, 7, 21)  # Tuesday
    assert default_delivery_date(_customer(AssignedDay.Wed), today) == date(2026, 7, 22)


def test_wraps_to_next_week_when_route_day_already_passed():
    today = date(2026, 7, 22)  # Wednesday
    assert default_delivery_date(_customer(AssignedDay.Tue), today) == date(2026, 7, 28)


def test_covers_every_assigned_day():
    today = date(2026, 7, 21)
    for day in AssignedDay:
        result = default_delivery_date(_customer(day), today)
        assert result >= today
        assert (result - today).days < 7
