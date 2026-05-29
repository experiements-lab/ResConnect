from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import students, landlords, properties, enquiries

app = FastAPI(title="ResConnect API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(students.router)
app.include_router(landlords.router)
app.include_router(properties.router)
app.include_router(enquiries.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
