"""Read and write Supabase with plain HTTP (requests), using the service_role key.

service_role bypasses Row Level Security, so this module must only be reached
through the engine's secret-protected endpoints.
"""
import os

import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
BUCKET = "contracts"
TIMEOUT = 30  # seconds

if not SUPABASE_URL or not SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")

_session = requests.Session()
_session.headers.update({"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"})


def claim_audit(audit_id: str) -> dict | None:
    """Atomically move queued -> processing. Returns the audit, or None if it was
    not queued (already claimed, finished, or missing). The `status=eq.queued`
    filter makes a second call for the same id a no-op, so a job never runs twice."""
    r = _session.patch(
        f"{SUPABASE_URL}/rest/v1/audits",
        params={"id": f"eq.{audit_id}", "status": "eq.queued", "select": "id,role,context,documents(storage_path)"},
        json={"status": "processing"},
        headers={"Prefer": "return=representation"},
        timeout=TIMEOUT,
    )
    r.raise_for_status()
    rows = r.json()
    return rows[0] if rows else None


def finish_audit(audit_id: str, result: dict) -> None:
    _update(audit_id, {"status": "done", "result": result, "error": None})


def fail_audit(audit_id: str, error: str) -> None:
    _update(audit_id, {"status": "failed", "error": error})


def download_pdf(storage_path: str) -> bytes:
    r = _session.get(f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}", timeout=TIMEOUT)
    r.raise_for_status()
    return r.content


def _update(audit_id: str, fields: dict) -> None:
    r = _session.patch(
        f"{SUPABASE_URL}/rest/v1/audits",
        params={"id": f"eq.{audit_id}"},
        json=fields,
        timeout=TIMEOUT,
    )
    r.raise_for_status()
