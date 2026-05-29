import httpx
from fastapi import HTTPException, Request
from app.core.config import settings


async def get_kratos_session(request: Request) -> dict:
    """Validate Kratos session cookie and return session data."""
    cookie = request.headers.get("cookie", "")
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.kratos_public_url}/sessions/whoami",
            headers={"cookie": cookie},
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return resp.json()


async def get_kratos_identity(identity_id: str) -> dict:
    """Fetch identity from Kratos admin API."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{settings.kratos_admin_url}/admin/identities/{identity_id}"
        )
    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail="Identity not found")
    return resp.json()
