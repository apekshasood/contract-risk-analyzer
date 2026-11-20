import logging
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends

from app.api.security import require_engine_secret
from app.services import supabase_store as store
from app.services.auditor import UnreadablePdf, audit_contract_text, extract_text_from_pdf

log = logging.getLogger("uvicorn.error")
router = APIRouter(dependencies=[Depends(require_engine_secret)])


@router.post("/jobs/{audit_id}", status_code=202)
def start_job(audit_id: UUID, background_tasks: BackgroundTasks):
    # Answer 202 at once; the audit runs after the response is sent.
    # On Cloud Run this needs CPU always allocated (--no-cpu-throttling),
    # otherwise CPU is paused once the response is out.
    background_tasks.add_task(run_job, str(audit_id))
    return {"auditId": str(audit_id), "status": "queued"}


def run_job(audit_id: str) -> None:
    """Plain def: Starlette runs it in a threadpool, so the blocking calls don't
    freeze the event loop. Every path ends in done or failed, never stuck."""
    try:
        audit = store.claim_audit(audit_id)
    except Exception:
        log.exception("job %s: could not claim", audit_id)
        return
    if audit is None:
        log.info("job %s: not queued, skipping", audit_id)
        return

    try:
        pdf = store.download_pdf(audit["documents"]["storage_path"])
        text = extract_text_from_pdf(pdf)
        result = audit_contract_text(text, audit["context"].strip(), audit["role"])
        store.finish_audit(audit_id, result.model_dump())
        log.info("job %s: done, %d clauses", audit_id, len(result.clauses))
    except UnreadablePdf as e:
        store.fail_audit(audit_id, str(e))
    except Exception:
        log.exception("job %s: failed", audit_id)
        try:
            store.fail_audit(audit_id, "Analysis failed. Please try again.")
        except Exception:
            log.exception("job %s: could not save failure", audit_id)
