from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# JWT secrets shipped as placeholders; never allowed in production.
INSECURE_JWT_SECRETS = {
    "",
    "change-me-in-production",
    "dev-secret-change-in-prod",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost/alofok"
    JWT_SECRET: str = "change-me-in-production"
    SLACK_WEBHOOK_URL: str = ""
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hours

    # Seed credentials — read from env in production; dev fallbacks live in seed.py.
    SEED_ADMIN_PASSWORD: str = ""
    SEED_SALES_PASSWORD: str = ""

    # Connection pool
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_RECYCLE: int = 3600  # recycle connections after 1 hour

    @model_validator(mode="after")
    def _fail_fast_on_insecure_secret(self) -> "Settings":
        # In production the JWT secret must be set to a real value — refuse to
        # boot with an empty or known placeholder secret.
        if (
            self.ENVIRONMENT.lower() == "production"
            and self.JWT_SECRET in INSECURE_JWT_SECRETS
        ):
            raise ValueError(
                "JWT_SECRET must be set to a secure value when ENVIRONMENT=production "
                "(it is empty or still a known insecure default)."
            )
        return self


settings = Settings()
