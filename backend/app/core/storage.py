import io
from supabase import create_client, Client
from app.core.config import settings

_client: Client = create_client(settings.supabase_url, settings.supabase_service_key)


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
        return result.get("signedURL") or result.get("signedUrl") or ""
    return str(getattr(result, "signed_url", ""))


def delete_file(bucket: str, key: str):
    try:
        _client.storage.from_(bucket).remove([key])
    except Exception:
        pass
