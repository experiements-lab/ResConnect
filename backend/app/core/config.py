from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    supabase_bucket_docs: str = "registration-docs"
    supabase_bucket_photos: str = "property-photos"
    secret_key: str
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"

    @field_validator("secret_key")
    @classmethod
    def secret_key_must_not_be_placeholder(cls, v: str) -> str:
        if v == "change_me_in_production":
            raise ValueError(
                "SECRET_KEY is still set to the placeholder value from .env.example. "
                "Set a real random secret via the SECRET_KEY environment variable."
            )
        return v


settings = Settings()
