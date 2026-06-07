from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    supabase_url: str
    supabase_service_key: str
    supabase_jwt_secret: str
    supabase_bucket_docs: str = "registration-docs"
    supabase_bucket_photos: str = "property-photos"
    secret_key: str = "change_me_in_production"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = ".env"


settings = Settings()
