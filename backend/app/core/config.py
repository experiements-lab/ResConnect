from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str
    kratos_public_url: str
    kratos_admin_url: str
    minio_endpoint: str
    minio_access_key: str
    minio_secret_key: str
    minio_bucket_docs: str = "registration-docs"
    minio_bucket_photos: str = "property-photos"
    secret_key: str = "change_me_in_production"

    class Config:
        env_file = ".env"


settings = Settings()
