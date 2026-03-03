import uuid

from fastapi import APIRouter

from app.api.deps import CurrentCustomer, CustomerAuthSvc
from app.schemas.customer_auth import (
    CustomerLoginRequest,
    CustomerProfileOut,
    CustomerTokenOut,
)

router = APIRouter()


@router.post("/login", response_model=CustomerTokenOut)
async def customer_login(
    body: CustomerLoginRequest, service: CustomerAuthSvc
) -> CustomerTokenOut:
    return await service.login(body.phone, body.password)


@router.get("/me", response_model=CustomerProfileOut)
async def customer_me(
    current_customer: CurrentCustomer, service: CustomerAuthSvc
) -> CustomerProfileOut:
    return await service.get_profile(uuid.UUID(current_customer["customer_id"]))
