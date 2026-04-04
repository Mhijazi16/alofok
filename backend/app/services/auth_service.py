import uuid

from app.core.errors import HorizonException
from app.core.security import create_access_token, verify_password
from app.repositories.user_repository import UserRepository
from app.schemas.user import TokenOut, UserOut


class AuthService:
    def __init__(self, user_repo: UserRepository):
        self._users = user_repo

    async def login(self, username: str, password: str) -> TokenOut:
        user = await self._users.get_by_username(username)
        if user is None or not verify_password(password, user.password_hash):
            raise HorizonException(401, "Invalid credentials")
        token = create_access_token(
            subject=str(user.id), role=user.role.value, username=user.username
        )
        return TokenOut(access_token=token)

    async def get_me(self, user_id: uuid.UUID) -> UserOut:
        user = await self._users.get_by_id(user_id)
        if user is None:
            raise HorizonException(404, "User not found")
        return UserOut.model_validate(user)
