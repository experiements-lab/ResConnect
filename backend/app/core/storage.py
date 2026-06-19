import io
import logging
from supabase import create_client, Client
from app.core.config import settings

logger = logging.getLogger(__name__)

_client: Client = create_client(settings.supabase_url, settings.supabase_service_key)


class StorageError(Exception):
    """Raised when Supabase storage responds without a usable result, as opposed
    to a network/library exception (which propagates as-is)."""


def ensure_buckets():
    """No-op: buckets are created in the Supabase dashboard."""
    pass


def upload_file(bucket: str, key: str, data: bytes, content_type: str) -> str:
    _client.storage.from_(bucket).upload(
        key, data, {"content-type": content_type, "upsert": "true"}
    )
    return key


def get_presigned_url(bucket: str, key: str, expires_hours: int = 1) -> str:
    result = _client.storage.from_(bucket).create_signed_url(key, expires_hours * 3600)
    # supabase-py v2 returns a dict; newer versions may return an object
    if isinstance(result, dict):
        url = result.get("signedURL") or result.get("signedUrl")
    else:
        url = getattr(result, "signed_url", None)
    if not url:
        logger.error("No signed URL in storage response for %s/%s: %r", bucket, key, result)
        raise StorageError(f"Could not generate a signed URL for {bucket}/{key}")
    return url


def delete_file(bucket: str, key: str):
    try:
        _client.storage.from_(bucket).remove([key])
    except Exception:
        pass
