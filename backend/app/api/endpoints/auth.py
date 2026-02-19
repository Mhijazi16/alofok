import uuid

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import AuthSvc, CurrentUser
from app.schemas.user import TokenOut, UserOut

router = APIRouter()


class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/login", response_model=TokenOut)
async def login(body: LoginRequest, service: AuthSvc) -> TokenOut:
    return await service.login(body.username, body.password)


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser, service: AuthSvc) -> UserOut:
    return await service.get_me(uuid.UUID(current_user["sub"]))
