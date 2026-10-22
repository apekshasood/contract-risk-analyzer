import pdfplumber, io
from openai import OpenAI
from app.schemas.contract import AuditResult, ContractAudit, QuestionResponse, VerifiedClause, ChatTurn
from dotenv import load_dotenv
import os
import re
load_dotenv()

openai_api_key = os.getenv("OPENAI_API_KEY")
if not openai_api_key:
    raise ValueError("OPENAI_API_KEY is not set in the environment variables")
# timeout: fail in 60s instead of the 10-min default; 1 retry for transient errors
client = OpenAI(api_key=openai_api_key, timeout=60, max_retries=1)


class UnreadablePdf(Exception):
    """The file can't be parsed, or has no extractable text (e.g. a scanned image)."""

def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()

def verify_clauses(audit: ContractAudit, text: str) -> AuditResult:
    parts = re.split(r"\[Page (\d+)\]\n", text)
    pages = {int(parts[i]): _normalize(parts[i + 1]) for i in range(1, len(parts), 2)}

    clauses = []
    for c in audit.clauses:
        data = c.model_dump()
        verified = None
        if c.type == "risky" and c.quote:
            q = _normalize(c.quote)
            if c.page in pages and q in pages[c.page]:
                verified = True
            else:
                found = next((p for p, t in pages.items() if q in t), None)
                verified = found is not None
                if found:
                    data["page"] = found  # right quote, wrong page, so fix the page
        clauses.append(VerifiedClause(**data, verified=verified))
    return AuditResult(summary=audit.summary, clauses=clauses)
    
def extract_text_from_pdf(file: bytes) -> str:
    pages = []
    empty = 0
    try:
        with pdfplumber.open(io.BytesIO(file)) as pdf:
            for i, page in enumerate(pdf.pages, start=1):
                page_text = page.extract_text() or ""
                if not page_text.strip():
                    empty += 1
                pages.append(f"[Page {i}]\n{page_text}")
    except Exception as e:
        raise UnreadablePdf("This PDF can't be read. It may be corrupted or password-protected.") from e
    if not pages or empty == len(pages):
        raise UnreadablePdf("No text found in this PDF. It may be a scanned image.")
    text = "\n\n".join(pages)
    print(f"[extract] {len(pages)} pages, {empty} empty, {len(text)} chars")
    return text


def audit_system(role: str) -> str:
    r = role.upper()
    return (
        f"- You are auditing on behalf of the {r}.\n"
        f"- Only flag a clause if its text creates a risk or disadvantage for the {r}. "
        f"Do NOT flag clauses that protect the {r} or confirm something is already done.\n"
        f"- rewrite: improved contract wording that fixes the risk in the {r}'s favour. "
        "Never just restate the original clause.\n"
        "- If the user describes their situation, use it to decide which clauses matter most "
        "and how severe they are. Only flag what the contract actually says — "
        "never invent risks from the user's description.\n"
    )

def qa_system(role: str) -> str:
    return (
        f"You are an expert legal assistant helping the {role.upper()} understand their contract.\n"
        "- Base legal answers only on the contract text.\n"
        "- The user may tell you facts about their situation (dates, amounts). "
        "Use those facts to apply the contract to their case.\n"
        "- If the user only states a fact, acknowledge it briefly and say how the contract applies.\n"
        "- direct_quote must be copied exactly from the contract. If no clause applies, "
        "set is_in_contract to false and direct_quote to 'None'.\n"
        "- Never invent contract terms."
    )


def audit_contract_text(text: str, context: str = "", role: str = "buyer") -> AuditResult:
    response = client.chat.completions.parse(
        model="gpt-4o-mini",
        temperature=0,
        messages=[
            {"role": "system", "content": audit_system(role)},
            {"role": "user", "content": f"Audit this contract:\n{text}"},
            *([{"role": "user", "content": f"My situation:\n{context}"}] if context else []),
        ],
        response_format=ContractAudit,
    )
    return verify_clauses(response.choices[0].message.parsed, text)


def answer_contract_question(text: str, question: str, history: list[ChatTurn], role: str = "buyer") -> QuestionResponse:
    messages = [
        {"role": "system", "content": qa_system(role)},
        {"role": "system", "content": f"Contract text:\n{text}"},
        *[{"role": t.role, "content": t.content} for t in history],
        {"role": "user", "content": question},
    ]
    response = client.chat.completions.parse(
        model="gpt-4o-mini",
        temperature=0,
        messages=messages,
        response_format=QuestionResponse,
    )
    return response.choices[0].message.parsed
