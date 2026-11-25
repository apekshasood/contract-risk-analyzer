import json
import logging

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import TypeAdapter, ValidationError
from app.schemas.contract import ChatTurn, Role
from app.api.security import require_engine_secret

from app.services.auditor import (
    answer_contract_question, audit_contract_text, extract_text_from_pdf, stream_contract_answer, UnreadablePdf,
)

log = logging.getLogger(__name__)


# This is equivalent to `const router = express.Router();`
router = APIRouter(dependencies=[Depends(require_engine_secret)])  # only the gateway may call these


# Plain `def` (not async): FastAPI runs these in a threadpool, so the blocking
# pdfplumber + OpenAI calls don't freeze the event loop for other requests.
def read_pdf_text(file: UploadFile) -> str:
    try:
        return extract_text_from_pdf(file.file.read())
    except UnreadablePdf as e:
        raise HTTPException(status_code=422, detail=str(e))

@router.post("/audit")
def audit(file: UploadFile = File(...), context: str = Form(""), role: Role = Form("buyer")):
    if len(context) > 2000:
        raise HTTPException(status_code=422, detail="context must be 2000 characters or less")
    text = read_pdf_text(file)
    return audit_contract_text(text, context.strip(), role)



history_adapter = TypeAdapter(list[ChatTurn])

def parse_history(history: str) -> list[ChatTurn]:
    try:
        return history_adapter.validate_json(history)[-10:]
    except ValidationError:
        raise HTTPException(status_code=422, detail="history must be a JSON list of {role, content}")


@router.post("/qa")
def ask_question(
    file: UploadFile = File(...),
    question: str = Form(...),
    history: str = Form("[]"),
    role: Role = Form("buyer"),
):
    turns = parse_history(history)
    text = read_pdf_text(file)
    return answer_contract_question(text, question, turns, role)


def sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("/qa/stream")
def ask_question_stream(
    file: UploadFile = File(...),
    question: str = Form(...),
    history: str = Form("[]"),
    role: Role = Form("buyer"),
):
    # Validate before streaming: once the 200 + headers are sent we can't return a 4xx any more.
    turns = parse_history(history)
    text = read_pdf_text(file)

    def events():
        try:
            for kind, value in stream_contract_answer(text, question, turns, role):
                if kind == "delta":
                    yield sse("delta", {"text": value})
                else:
                    yield sse("done", value.model_dump())
        except Exception:
            log.exception("qa stream failed")
            yield sse("error", {"error": "The answer stopped halfway. Please try again."})

    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})
