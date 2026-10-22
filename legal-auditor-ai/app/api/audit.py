from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from pydantic import TypeAdapter, ValidationError
from app.schemas.contract import ChatTurn, Role

from app.services.auditor import answer_contract_question, extract_text_from_pdf, audit_contract_text


# This is equivalent to `const router = express.Router();`
router = APIRouter()

@router.post("/audit")
async def audit(file: UploadFile = File(...), context: str = Form(""), role: Role = Form("buyer")):
    if len(context) > 2000:
        raise HTTPException(status_code=422, detail="context must be 2000 characters or less")
    file_bytes = await file.read()
    text = extract_text_from_pdf(file_bytes)
    return audit_contract_text(text, context.strip(), role)



history_adapter = TypeAdapter(list[ChatTurn])

@router.post("/qa")
async def ask_question(
    file: UploadFile = File(...),
    question: str = Form(...),
    history: str = Form("[]"),
    role: Role = Form("buyer"),
):
    try:
        turns = history_adapter.validate_json(history)
    except ValidationError:
        raise HTTPException(status_code=422, detail="history must be a JSON list of {role, content}")

    file_bytes = await file.read()
    text = extract_text_from_pdf(file_bytes)
    return answer_contract_question(text, question, turns[-10:], role)