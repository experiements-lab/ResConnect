import httpx
from fastapi import HTTPException, Request
from jose import jwt, JWTError
from app.core.config import settings

_jwks_cache: dict | None = None


async def _get_jwks(force_refresh: bool = False) -> dict:
    global _jwks_cache
    if _jwks_cache is None or force_refresh:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def _decode(token: str) -> dict:
    """Supabase signs session JWTs with project-specific asymmetric keys (ES256/RS256),
    verified via its JWKS endpoint rather than a static shared secret."""
    jwks = await _get_jwks()
    try:
        return jwt.decode(token, jwks, algorithms=["ES256", "RS256"], audience="authenticated")
    except JWTError:
        pass
    # Key may have rotated since we cached it — refetch once and retry before giving up.
    jwks = await _get_jwks(force_refresh=True)
    return jwt.decode(token, jwks, algorithms=["ES256", "RS256"], audience="authenticated")


async def get_current_user(request: Request) -> dict:
    """Verify Supabase JWT from Authorization header and return a session-like dict."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = await _decode(token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    meta = payload.get("user_metadata") or {}
    return {
        "identity": {
            "id": payload["sub"],
            "traits": {
                "email": payload.get("email", ""),
                "role": meta.get("role"),
                "full_name": meta.get("full_name", ""),
                "student_number": meta.get("student_number", ""),
                "phone": meta.get("phone", ""),
            },
        }
    }
