from minio import Minio
from minio.error import S3Error
from app.core.config import settings
import io

client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False,
)


def ensure_buckets():
    for bucket in [settings.minio_bucket_docs, settings.minio_bucket_photos]:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)


def upload_file(bucket: str, key: str, data: bytes, content_type: str) -> str:
    client.put_object(
        bucket, key, io.BytesIO(data), len(data), content_type=content_type
    )
    return key


def get_presigned_url(bucket: str, key: str, expires_hours: int = 1) -> str:
    from datetime import timedelta
    return client.presigned_get_object(bucket, key, expires=timedelta(hours=expires_hours))


def delete_file(bucket: str, key: str):
    try:
        client.remove_object(bucket, key)
    except S3Error:
        pass
