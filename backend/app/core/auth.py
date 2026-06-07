from fastapi import HTTPException, Request
from jose import jwt, JWTError
from app.core.config import settings


async def get_current_user(request: Request) -> dict:
    """Verify Supabase JWT from Authorization header and return a session-like dict."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        payload = jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
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
