# ClauseOk

Upload a contract PDF, pick your side of the deal, and get a list of risky or missing clauses, each with a severity, a plain-English explanation and a suggested rewrite. Then ask follow-up questions about the same document.

Every risky clause the model quotes is checked against the real PDF text, so the user can see which findings are backed by the document.

## Features

- **Role-aware audit**: the same contract is audited for the `buyer`, `seller`, `landlord` or `tenant`. A clause that protects you is not flagged as a risk.
- **Your situation as context**: optional free text (up to 2,000 characters), for example "I want to leave after 6 months". The model uses it to rank risks but is told not to invent risks from it.
- **Structured output**: the LLM must return JSON that matches a Pydantic schema (`severity` is only `High`, `Medium` or `Low`). There's no free-text parsing.
- **Quote verification**: PDF text is tagged by page (`[Page N]`). After the model answers, `verify_clauses()` searches for each quoted clause:
  - Found on the stated page: `verified: true`.
  - Found on a different page: the page number is corrected.
  - Not found anywhere: `verified: false`, shown to the user as unverified.
- **Q&A on the document**: chat about the contract, with the last 10 turns of history. Answers include a direct quote, or say the contract doesn't cover the question.
- **Safe uploads**: 10 MB limit, MIME type check and a `%PDF-` magic-bytes check in the gateway. Unreadable or scanned PDFs return a clear 422 instead of crashing.

## Architecture

```
web/  Next.js 16 + React 19 chat UI          :3000
  │   multipart: PDF + role + context / question
  ▼
gateway/  Node.js + Express                   :3001
  │   multer (10 MB, PDF only) → validatePdf (magic bytes)
  │   asyncHandler + central errorHandler (400 / 413 / 502)
  ▼
legal-auditor-ai/  Python + FastAPI           :8000
      pdfplumber (page-tagged text) → OpenAI gpt-4o-mini
      (structured output) → verify_clauses() → JSON
```

**Why a separate gateway?** The browser never talks to the AI engine directly. The gateway is the single place for input checks and error mapping. Later it will also handle auth and rate limits. The Python service only does PDF and LLM work.

**Why plain `def` routes in FastAPI?** pdfplumber and the OpenAI client are blocking calls. FastAPI runs plain `def` routes in a thread pool, so one slow audit doesn't block other requests.

## API

| Service | Method and path | Body (multipart) | Returns |
|---|---|---|---|
| gateway | `POST /api/uploads` | `contract` (PDF), `role`, `context` | audit result |
| gateway | `POST /api/uploads/qa` | `contract`, `question`, `history` (JSON), `role` | `{ answer, direct_quote, is_in_contract }` |
| gateway | `GET /health` | | status |
| ai engine | `POST /api/audit`, `POST /api/qa` | same, with the field named `file` | same |

Audit result shape:

```json
{
  "summary": "…",
  "clauses": [
    {
      "title": "Unlimited liability",
      "type": "risky",
      "page": 3,
      "quote": "The Tenant shall be liable for all…",
      "severity": "High",
      "issue": "…",
      "plain_english": "…",
      "rewrite": "…",
      "verified": true
    }
  ]
}
```

`type: "missing"` means a clause the contract should have but doesn't. It has no quote, so `verified` is `null`.

## Run locally

You need Node.js 20+, Python 3.11+ and an OpenAI API key.

```bash
# 1. AI engine
cd legal-auditor-ai
python -m venv venv
venv\Scripts\activate            # Windows  (macOS/Linux: source venv/bin/activate)
pip install -r requirements.txt
cp .env.example .env             # then put your real OPENAI_API_KEY in .env

# 2. Gateway
cd ../gateway
npm install
cp .env.example .env

# 3. Web
cd ../web
npm install

# 4. Start all three from the repo root
cd ..
npm install
npm run dev
```

Open http://localhost:3000.

> The root `dev:python` script uses the Windows venv path (`venv\Scripts\python`). On macOS or Linux, start the engine yourself with `cd legal-auditor-ai && venv/bin/python -m uvicorn app.main:app --reload --port 8000`.

Never commit `.env` files. They are git-ignored. Only the `.env.example` files with placeholder values are tracked.

## Status and roadmap

Done: the full audit and Q&A flow, end to end on a local machine. In progress: Supabase (login, PDF storage, `documents` / `audits` tables with row-level security), then an async job flow (`queued → processing → done / failed`), a dashboard of past audits, Docker and Cloud Run deploy, and evals for audit quality.

See [ROADMAP.md](ROADMAP.md) for the full checklist.
