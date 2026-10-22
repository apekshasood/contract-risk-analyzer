"use client";
/*
 * Design brief
 * Who: a buyer, seller, landlord or tenant checking a contract (and interviewers seeing the demo).
 * Feel: calm, trustworthy — a senior lawyer's desk, not a toy chatbot.
 * One action: drop a contract PDF, then ask follow-up questions.
 * Hierarchy: 1) risk summary + counts  2) clause cards  3) composer.
 * Memorable: serif "legal paper" feel + verified-quote badges that prove the AI isn't inventing text.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AuditView } from "./_components/AuditView";
import type { AuditResult, QaResult } from "./_components/types";
import {
  IconAlert, IconArrowUp, IconCheck, IconFile, IconInfo, IconPaperclip, IconPlus, IconScale, IconShield, IconUpload,
} from "./_components/icons";

const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

const ROLES = ["buyer", "seller", "landlord", "tenant"] as const;
type Role = (typeof ROLES)[number];

type Msg =
  | { id: string; role: "user"; kind: "file"; name: string; size: number }
  | { id: string; role: "user"; kind: "text"; text: string }
  | { id: string; role: "assistant"; kind: "loading"; mode: "audit" | "qa" }
  | { id: string; role: "assistant"; kind: "audit"; data: AuditResult }
  | { id: string; role: "assistant"; kind: "answer"; data: QaResult }
  | { id: string; role: "assistant"; kind: "error"; text: string };

const uid = () => Math.random().toString(36).slice(2);

const formatSize = (b: number) =>
  b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`;

async function post<T>(path: string, fd: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${GATEWAY}${path}`, { method: "POST", body: fd });
  } catch {
    throw new Error("Can't reach the gateway. Is it running on port 3001?");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? data.message ?? `Request failed (${res.status})`);
  return data as T;
}

export default function Home() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [role, setRole] = useState<Role>("buyer");

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const replace = (id: string, msg: Msg) => setMessages((m) => m.map((x) => (x.id === id ? msg : x)));
  const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong");

  const analyze = useCallback(
    async (f: File, context = "") => {
      if (busy) return;
      if (f.type !== "application/pdf") {
        setMessages((m) => [...m, { id: uid(), role: "assistant", kind: "error", text: "That file isn't a PDF. Please upload the contract as a PDF." }]);
        return;
      }
      setFile(f);
      setBusy(true);
      const loadingId = uid();
      setMessages((m) => [
        ...m,
        { id: uid(), role: "user", kind: "file", name: f.name, size: f.size },
        ...(context ? [{ id: uid(), role: "user" as const, kind: "text" as const, text: context }] : []),
        { id: loadingId, role: "assistant", kind: "loading", mode: "audit" },
      ]);
      try {
        const fd = new FormData();
        fd.append("contract", f);
        if (context) fd.append("context", context);
        fd.append("role", role);
        const data = await post<AuditResult>("/api/uploads", fd);
        replace(loadingId, { id: loadingId, role: "assistant", kind: "audit", data });
      } catch (e) {
        replace(loadingId, { id: loadingId, role: "assistant", kind: "error", text: errText(e) });
      } finally {
        setBusy(false);
        textarea.current?.focus();
      }
    },
    [busy, role],
  );

  const ask = useCallback(
    async (q: string) => {
      const question = q.trim();
      if (!question || busy) return;
      if (!file) {
        fileInput.current?.click();
        return;
      }
      setInput("");
      setBusy(true);
      const loadingId = uid();
      setMessages((m) => [
        ...m,
        { id: uid(), role: "user", kind: "text", text: question },
        { id: loadingId, role: "assistant", kind: "loading", mode: "qa" },
      ]);
      try {
        const fd = new FormData();
        fd.append("question", question);
        fd.append("contract", file);
        fd.append("role", role);
        fd.append("history", JSON.stringify(
          messages.flatMap((m) =>
            m.kind === "text" ? [{ role: "user", content: m.text }]
            : m.kind === "answer" ? [{ role: "assistant", content: m.data.answer }]
            : []
          )
        ));
        const data = await post<QaResult>("/api/uploads/qa", fd);
        replace(loadingId, { id: loadingId, role: "assistant", kind: "answer", data });
      } catch (e) {
        replace(loadingId, { id: loadingId, role: "assistant", kind: "error", text: errText(e) });
      } finally {
        setBusy(false);
      }
    },
    [busy, file, messages, role],
  );

  function send() {
    if (pending) {
      const context = input.trim();
      setInput("");
      setPending(null);
      analyze(pending, context);
    } else {
      ask(input);
    }
  }

  function reset() {
    if (busy) return;
    setMessages([]);
    setFile(null);
    setInput("");
  }

  const lastAuditId = [...messages].reverse().find((m) => m.kind === "audit")?.id;
  const isLast = (id: string) => messages[messages.length - 1]?.id === id;

  return (
    <div
      className="relative flex h-dvh flex-col bg-paper"
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) setDragging(true);
      }}
    >
      {/* Header */}
      <header className="z-10 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-3 px-4">
          <button onClick={reset} className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
              <IconScale width={18} height={18} />
            </span>
            <span className="font-display text-[17px] font-medium tracking-tight text-ink">Clause</span>
          </button>
          <div className="flex min-w-0 items-center gap-2">
            {file && (
              <span className="hidden min-w-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-ink-2 sm:inline-flex">
                <IconFile width={14} height={14} className="shrink-0 text-muted" />
                <span className="truncate max-w-48">{file.name}</span>
              </span>
            )}
            {messages.length > 0 && (
              <button
                onClick={reset}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 transition hover:bg-sunken hover:text-ink disabled:opacity-40"
              >
                <IconPlus width={16} height={16} /> New
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Conversation */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-8">
          {messages.length === 0 ? (
            <EmptyState onPick={() => fileInput.current?.click()} />
          ) : (
            <ol className="space-y-8" aria-live="polite">
              {messages.map((m) => (
                <li key={m.id} className="animate-rise">
                  {m.role === "user" ? (
                    <UserMessage msg={m} />
                  ) : (
                    <AssistantRow>
                      {m.kind === "loading" && <Thinking mode={m.mode} />}
                      {m.kind === "error" && <ErrorCard text={m.text} />}
                      {m.kind === "answer" && <Answer data={m.data} />}
                      {m.kind === "audit" && (
                        <AuditView data={m.data} onAsk={ask} showSuggestions={m.id === lastAuditId && isLast(m.id) && !busy} />
                      )}
                    </AssistantRow>
                  )}
                </li>
              ))}
            </ol>
          )}
          <div ref={bottom} className="h-2" />
        </div>
      </main>

      {/* Composer */}
      <footer className="border-t border-line/70 bg-paper/90 backdrop-blur-md">
        <form
          className="mx-auto max-w-3xl px-4 pb-3 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label="Your role">
            <span className="text-muted">I am the</span>
            {ROLES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                disabled={busy}
                aria-pressed={role === r}
                className={`rounded-full border px-2.5 py-1 capitalize transition disabled:opacity-40 ${
                  role === r ? "border-accent bg-accent-soft text-accent" : "border-line text-muted hover:text-ink"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          {pending && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink">
              <IconFile />
              <span className="flex-1 truncate">{pending.name}</span>
              <button type="button" onClick={() => setPending(null)} aria-label="Remove file" className="text-muted hover:text-ink">✕</button>
            </div>
          )}
          <div className="flex items-end gap-1.5 rounded-2xl border border-line bg-surface p-1.5 shadow-sm transition duration-200 focus-within:border-accent/50 focus-within:ring-4 focus-within:ring-accent/10">
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={busy}
              aria-label="Attach contract PDF"
              title="Attach contract PDF"
              className="grid size-10 shrink-0 place-items-center rounded-xl text-muted transition hover:bg-sunken hover:text-ink disabled:opacity-40"
            >
              <IconPaperclip />
            </button>
            <label htmlFor="question" className="sr-only">Ask about the contract</label>
            <textarea
              id="question"
              ref={textarea}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={pending ? "Add your situation (optional) — e.g. resale flat, I'm the buyer…" : file ? "Ask about this contract…" : "Attach a contract to begin…"}
              className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1 py-2.5 text-[15px] leading-5 text-ink outline-none [field-sizing:content] placeholder:text-muted/80"
            />
            <button
              type="submit"
              disabled={(!input.trim() && !pending) || busy}
              aria-label="Send question"
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink transition duration-150 hover:brightness-110 active:scale-95 disabled:opacity-30 disabled:hover:brightness-100"
            >
              <IconArrowUp width={18} height={18} strokeWidth={2.25} />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-muted">AI analysis, not legal advice. Check important clauses with a lawyer.</p>
        </form>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPending(f);
            e.target.value = "";
          }}
        />
      </footer>

      {/* Drag overlay */}
      {dragging && (
        <div
          className="absolute inset-0 z-20 grid place-items-center bg-paper/85 p-6 backdrop-blur-sm"
          onDragOver={(e) => e.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f) setPending(f);
          }}
        >
          <div className="pointer-events-none flex w-full max-w-md flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent/50 bg-surface px-8 py-14 text-center">
            <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
              <IconUpload />
            </span>
            <p className="font-display text-xl text-ink">Drop to analyze</p>
            <p className="text-sm text-muted">PDF contracts up to 10 MB</p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- pieces ---------- */

function EmptyState({ onPick }: { onPick: () => void }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="bg-dots pointer-events-none absolute inset-x-0 top-14 -z-0 h-[420px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative">
        <p className="mb-4 text-xs font-medium uppercase tracking-widest text-accent">Contract risk analysis</p>
        <h1 className="font-display text-4xl leading-[1.1] tracking-tight text-ink sm:text-5xl">
          Know what you&rsquo;re signing.
        </h1>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-muted">
          Drop in a contract. Get every risky clause in plain English, with quotes checked against the PDF and fairer
          wording you can use.
        </p>

        <button
          onClick={onPick}
          className="group mx-auto mt-8 flex w-full max-w-md items-center gap-4 rounded-2xl border border-dashed border-line bg-surface p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent/15"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition group-hover:bg-accent group-hover:text-accent-ink">
            <IconUpload />
          </span>
          <span>
            <span className="block font-medium text-ink">Choose a PDF or drag it here</span>
            <span className="mt-0.5 block text-sm text-muted">Up to 10 MB · analyzed from your side</span>
          </span>
        </button>

        <ul className="mx-auto mt-8 flex max-w-md flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-2">
          {["Page-cited quotes", "Plain-English risks", "Suggested rewrites"].map((t) => (
            <li key={t} className="inline-flex items-center gap-1.5">
              <IconCheck width={15} height={15} className="text-accent" strokeWidth={2.25} /> {t}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function UserMessage({ msg }: { msg: Extract<Msg, { role: "user" }> }) {
  if (msg.kind === "file") {
    return (
      <div className="flex justify-end">
        <div className="flex max-w-[85%] items-center gap-3 rounded-2xl rounded-br-md border border-line bg-surface p-3 pr-4 shadow-sm">
          <span className="grid h-11 w-9 shrink-0 place-items-center rounded-md bg-high-soft text-[10px] font-semibold tracking-wide text-high">
            PDF
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{msg.name}</p>
            <p className="text-xs text-muted">{formatSize(msg.size)}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-[15px] leading-relaxed text-paper">
        {msg.text}
      </p>
    </div>
  );
}

function AssistantRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-accent-ink" aria-hidden>
        <IconScale width={16} height={16} />
      </span>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </div>
  );
}

const STEPS = {
  audit: ["Reading every page", "Finding the clauses", "Weighing risk for your side", "Checking quotes against the PDF"],
  qa: ["Searching the contract", "Drafting an answer"],
};

function Thinking({ mode }: { mode: "audit" | "qa" }) {
  const steps = STEPS[mode];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 2400);
    return () => clearInterval(t);
  }, [steps.length]);

  return (
    <div className="space-y-4" role="status">
      <div className="flex items-center gap-3 text-sm text-muted">
        <span className="flex gap-1" aria-hidden>
          {[0, 150, 300].map((d) => (
            <span key={d} className="dot size-1.5 rounded-full bg-accent" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        <span key={i} className="animate-rise">{steps[i]}…</span>
      </div>
      {mode === "audit" && (
        <div className="space-y-2" aria-hidden>
          <div className="skeleton h-4 w-11/12 rounded" />
          <div className="skeleton h-4 w-3/4 rounded" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((k) => <div key={k} className="skeleton h-16 rounded-xl" />)}
          </div>
        </div>
      )}
    </div>
  );
}

function ErrorCard({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-high/25 bg-high-soft p-4">
      <IconAlert className="mt-0.5 shrink-0 text-high" width={18} height={18} />
      <div>
        <p className="text-sm font-medium text-ink">Couldn&rsquo;t finish that</p>
        <p className="mt-0.5 text-sm text-ink-2">{text}</p>
      </div>
    </div>
  );
}

function Answer({ data }: { data: QaResult }) {
  const hasQuote = data.is_in_contract && data.direct_quote && data.direct_quote !== "None";
  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{data.answer}</p>
      {hasQuote ? (
        <figure className="rounded-xl border border-line bg-surface p-4">
          <figcaption className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-widest text-accent">
            <IconShield width={14} height={14} /> From the contract
          </figcaption>
          <blockquote className="font-display text-[15px] italic leading-relaxed text-ink-2">“{data.direct_quote}”</blockquote>
        </figure>
      ) : (
        <p className="inline-flex items-center gap-1.5 rounded-md bg-sunken px-2.5 py-1 text-xs text-ink-2">
          <IconInfo width={14} height={14} /> The contract is silent on this
        </p>
      )}
    </div>
  );
}
