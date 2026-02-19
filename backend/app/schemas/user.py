import uuid

from pydantic import BaseModel

from app.models.user import UserRole


class UserOut(BaseModel):
    id: uuid.UUID
    username: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
