import uuid

from app.core.errors import HorizonException
from app.core.security import create_access_token, verify_password
from app.repositories.customer_auth_repository import CustomerAuthRepository
from app.repositories.customer_repository import CustomerRepository
from app.schemas.customer_auth import CustomerProfileOut, CustomerTokenOut


class CustomerAuthService:
    def __init__(
        self,
        auth_repo: CustomerAuthRepository,
        customer_repo: CustomerRepository,
    ):
        self._auth = auth_repo
        self._customers = customer_repo

    async def login(self, phone: str, password: str) -> CustomerTokenOut:
        auth = await self._auth.get_by_phone(phone)
        if auth is None or not verify_password(password, auth.password_hash):
            raise HorizonException(401, "Invalid credentials")
        token = create_access_token(
            subject=str(auth.id),
            role="Customer",
            user_type="customer",
            customer_id=str(auth.customer_id),
        )
        return CustomerTokenOut(access_token=token)

    async def get_profile(self, customer_id: uuid.UUID) -> CustomerProfileOut:
        customer = await self._customers.get_by_id(customer_id)
        if customer is None:
            raise HorizonException(404, "Customer not found")
        return CustomerProfileOut.model_validate(customer)
