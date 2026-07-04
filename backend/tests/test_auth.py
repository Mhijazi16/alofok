"""Auth + RBAC tests for get_current_user and the _require_role guards."""

import uuid

import pytest
from fastapi.security import HTTPAuthorizationCredentials

from app.api.deps import _require_role, get_current_user
from app.core.errors import HorizonException
from app.core.security import create_access_token
from app.models.user import UserRole
from tests.conftest import make_user


def _creds(token: str, scheme: str = "Bearer") -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme=scheme, credentials=token)


def _token_for(user) -> str:
    return create_access_token(
        subject=str(user.id), role=user.role.value, username=user.username
    )


@pytest.mark.asyncio
async def test_active_user_passes(db):
    user = await make_user(db, role=UserRole.Sales)
    payload = await get_current_user(db, _creds(_token_for(user)))
    assert payload["sub"] == str(user.id)
    assert payload["role"] == "Sales"


@pytest.mark.asyncio
async def test_deactivated_user_rejected(db):
    user = await make_user(db, role=UserRole.Sales, is_active=False)
    with pytest.raises(HorizonException) as e:
        await get_current_user(db, _creds(_token_for(user)))
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_soft_deleted_user_rejected(db):
    user = await make_user(db, role=UserRole.Sales, is_deleted=True)
    with pytest.raises(HorizonException) as e:
        await get_current_user(db, _creds(_token_for(user)))
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_unknown_user_rejected(db):
    token = create_access_token(subject=str(uuid.uuid4()), role="Sales")
    with pytest.raises(HorizonException) as e:
        await get_current_user(db, _creds(token))
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_credentials_rejected(db):
    with pytest.raises(HorizonException) as e:
        await get_current_user(db, None)
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_wrong_scheme_rejected(db):
    user = await make_user(db)
    with pytest.raises(HorizonException) as e:
        await get_current_user(db, _creds(_token_for(user), scheme="Basic"))
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_invalid_token_rejected(db):
    with pytest.raises(HorizonException) as e:
        await get_current_user(db, _creds("not-a-jwt"))
    assert e.value.status_code == 401


@pytest.mark.asyncio
async def test_sales_blocked_from_admin_guard():
    guard = _require_role("Admin")
    with pytest.raises(HorizonException) as e:
        await guard({"role": "Sales"})
    assert e.value.status_code == 403


@pytest.mark.asyncio
async def test_admin_passes_admin_guard():
    guard = _require_role("Admin")
    out = await guard({"role": "Admin"})
    assert out["role"] == "Admin"


@pytest.mark.asyncio
async def test_sales_passes_sales_guard():
    guard = _require_role("Sales", "Admin")
    assert (await guard({"role": "Sales"}))["role"] == "Sales"
    assert (await guard({"role": "Admin"}))["role"] == "Admin"
