from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import TypeAdapter, ValidationError
from app.schemas.contract import ChatTurn, Role

from app.services.auditor import answer_contract_question, extract_text_from_pdf, audit_contract_text, UnreadablePdf


# This is equivalent to `const router = express.Router();`
router = APIRouter()


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

@router.post("/qa")
def ask_question(
    file: UploadFile = File(...),
    question: str = Form(...),
    history: str = Form("[]"),
    role: Role = Form("buyer"),
):
    try:
        turns = history_adapter.validate_json(history)
    except ValidationError:
        raise HTTPException(status_code=422, detail="history must be a JSON list of {role, content}")

    text = read_pdf_text(file)
    return answer_contract_question(text, question, turns[-10:], role)