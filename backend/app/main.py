from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.api import students, landlords, properties, enquiries, admin
from app.core.config import settings

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="ResConnect API", version="0.1.0", redirect_slashes=False)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — read allowed origins from env so production domains can be added without code changes
cors_origins = [o.strip() for o in settings.cors_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(landlords.router)
app.include_router(properties.router)
app.include_router(enquiries.router)
app.include_router(admin.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
