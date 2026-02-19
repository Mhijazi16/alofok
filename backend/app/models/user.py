import enum

from sqlalchemy import Boolean, Enum as SAEnum, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, BaseMixin


class UserRole(str, enum.Enum):
    Admin = "Admin"
    Designer = "Designer"
    Sales = "Sales"


class User(BaseMixin, Base):
    __tablename__ = "users"

    username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="userrole"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
