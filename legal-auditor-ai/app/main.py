from fastapi import FastAPI
from app.api.audit import router as audit_router
from app.api.jobs import router as jobs_router

app = FastAPI(title="ClauseOk AI engine")

app.include_router(audit_router, prefix="/api")
app.include_router(jobs_router, prefix="/api")

@app.get("/")
def health_check():
    return {"status": "ClauseOk AI engine is running"}

