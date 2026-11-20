import os
import secrets

from dotenv import load_dotenv
from fastapi import Header, HTTPException

load_dotenv()

ENGINE_SECRET = os.getenv("ENGINE_SECRET", "")
if not ENGINE_SECRET:
    raise ValueError("ENGINE_SECRET is not set in the environment variables")


def require_engine_secret(x_engine_secret: str = Header("")) -> None:
    """Only the gateway knows ENGINE_SECRET. Without this, anyone who finds the
    engine URL could spend our OpenAI credit. compare_digest avoids timing leaks."""
    if not secrets.compare_digest(x_engine_secret, ENGINE_SECRET):
        raise HTTPException(status_code=401, detail="Unauthorized")
