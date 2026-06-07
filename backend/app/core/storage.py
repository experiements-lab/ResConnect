from minio import Minio
from minio.error import S3Error
from app.core.config import settings
import io

# Used for all actual S3 operations inside the Docker network
client = Minio(
    settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False,
)

# Used only for generating presigned URLs — endpoint must be browser-reachable.
# region="us-east-1" prevents an automatic bucket-location lookup (which would
# fail since localhost:9000 is unreachable from inside the container).
_presign_client = Minio(
    "localhost:9000",
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    secure=False,
    region="us-east-1",
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
    # _presign_client uses localhost:9000 so the URL is browser-accessible.
    # presigned_get_object does not make a network connection — it only computes
    # an HMAC signature — so localhost:9000 not being reachable from the container
    # is not a problem here.
    return _presign_client.presigned_get_object(bucket, key, expires=timedelta(hours=expires_hours))


def delete_file(bucket: str, key: str):
    try:
        client.remove_object(bucket, key)
    except S3Error:
        pass
