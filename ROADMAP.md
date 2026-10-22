# Legal Auditor AI — Roadmap

Tick items with `[x]` as you finish them.

## Target architecture

```
Next.js frontend (Vercel)
   │  login via Supabase Auth
   │  upload PDF directly to Supabase Storage (signed URL)
   ▼
Node gateway (GCP Cloud Run)     → creates job, checks user, rate limits
   ▼
Python AI engine (GCP Cloud Run) → reads PDF, chunks, calls OpenAI
   ▼
Supabase Postgres                → stores job status + audit result
   └─ Realtime ─▶ frontend updates live (Processing… → Done)
```

---

## Phase 0 — Security & cleanup (~1 session) 🔴 DO FIRST
- [x] Revoke both OpenAI keys (hardcoded one + the one in git history)
- [x] Move the key to `.env`, read it with `os.getenv`
- [x] Add root `.gitignore` (`venv/`, `node_modules/`, `.env`, `big.pdf`)
- [x] Add `requirements.txt` (`pip freeze > requirements.txt`)
- [x] Remove stray root `package.json`, `package-lock.json`, `node_modules/`, and `legal-auditor-ai/package-lock.json`
- [x] Install `busboy` inside `gateway/` (was installed at root by mistake)
- [ ] Fix typos: `uploadContoller.js`, `answer_constract_question`
- [ ] Re-init the git repo so the leaked key is gone from history

## Phase 1 — Node fundamentals (~1–2 sessions)
- [x] 1. Make it boot (imports, Express middleware pipeline)
- [x] 2. Forward file to Python (multer → FormData → axios → FastAPI)
- [x] 3. Survive failure
  - [x] try/catch + 502
  - [x] Central `errorHandler` middleware
  - [x] `asyncHandler` wrapper
- [x] 4. Validate input
  - [x] multer `limits` (10 MB) + `fileFilter`
  - [x] `MulterError` → 413 / 400
  - [x] `%PDF-` magic-bytes check
- [ ] 5. Streaming
  - [x] Measure "before": 50 → 276 MB (20 × 9 MB concurrent)
  - [x] Busboy events (146 chunks of ~64 KB)
  - [x] Stream upload to Python (`/api/stream-test`), real audit works
  - [ ] Measure "after" with the same load test
  - [ ] Validation in streaming form (size limit, `%PDF-` on first chunk, no-file case)
  - [ ] Replace the multer route with the streaming route, remove multer

## Phase 2 — AI engine that really works (Python) (~3–4 sessions)
- [ ] Send the full PDF text to the audit (remove the `[:500]` cut)
- [ ] Chunking for long contracts (map-reduce: audit sections, then merge)
- [ ] Return 422 for an unreadable PDF instead of a 500 crash
- [ ] `severity: Literal["HIGH","MEDIUM","LOW"]` in the Pydantic schema
- [ ] `client.beta.chat.completions.parse` → `client.chat.completions.parse`

## Phase 3 — Supabase (~2–3 sessions)
- [ ] Create project, connect keys via `.env`
- [ ] Auth (email / Google login)
- [ ] Storage bucket for PDFs
- [ ] Tables: `documents`, `audits` (id, user_id, status, result JSON)
- [ ] Row Level Security (users only see their own data)

## Phase 4 — Async job flow (~2–3 sessions)
- [ ] `POST /audits` → 202 + `jobId` immediately
- [ ] Python processes the job and writes the result to Postgres
- [ ] Status flow: `queued → processing → done / failed`
- [ ] Failed jobs store an error message

## Phase 5 — Frontend (Next.js) (~4–5 sessions)
- [ ] Login / signup pages
- [ ] Dashboard: list of past audits
- [ ] Upload with progress bar (direct to Supabase Storage)
- [ ] Live status via Supabase Realtime
- [ ] Audit report view: risks grouped by severity, clause text quoted

## Phase 6 — Deploy on GCP (~2–3 sessions)
- [ ] Dockerfile for gateway + Python service
- [ ] Deploy both to Cloud Run
- [ ] Secrets in Secret Manager
- [ ] CORS + environment config
- [ ] Frontend on Vercel
- [ ] Test end to end with a stranger's PDF

## Phase 7 — Evals, the resume number (~3–4 sessions)
- [ ] Collect 15–20 contracts, hand-mark the expected risks
- [ ] Script that scores the AI output against them
- [ ] Record one number (e.g. "catches X% of high-risk clauses") + latency + cost per contract

## Phase 8 — Portfolio polish (~2 sessions)
- [ ] Rate limiting + daily OpenAI cost cap
- [ ] README: architecture diagram, measured numbers, design tradeoffs
- [ ] 2-minute demo video

---

**Total:** ~22–28 sessions, roughly 6–8 weeks at ~1–1.5 hours a day.
**Resume-ready:** end of Phase 7 (deployed + works for a stranger + one measured number).
