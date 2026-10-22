from fastapi import FastAPI
from app.api.audit import router as audit_router

app = FastAPI(title="AI legal Auditor API")

app.include_router(audit_router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "AI legal Auditor API is running"}

