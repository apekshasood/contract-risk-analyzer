"use client";
import { useMemo, useState } from "react";
import type { AuditResult, Clause, Severity } from "./types";
import { IconAlert, IconCheck, IconChevron, IconCopy, IconShield } from "./icons";

const ORDER: Record<Severity, number> = { High: 0, Medium: 1, Low: 2 };

const SEV: Record<Severity, { text: string; soft: string; dot: string }> = {
  High: { text: "text-high", soft: "bg-high-soft", dot: "bg-high" },
  Medium: { text: "text-med", soft: "bg-med-soft", dot: "bg-med" },
  Low: { text: "text-low", soft: "bg-low-soft", dot: "bg-low" },
};

type Filter = "All" | Severity | "Missing";

const SUGGESTIONS = [
  "Can I terminate this contract early?",
  "What are the payment terms?",
  "What happens if the other party breaches?",
];

export function AuditView({
  data,
  onAsk,
  showSuggestions,
}: {
  data: AuditResult;
  onAsk: (q: string) => void;
  showSuggestions: boolean;
}) {
  const [filter, setFilter] = useState<Filter>("All");

  const sorted = useMemo(
    () => [...data.clauses].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]),
    [data.clauses],
  );

  const counts = useMemo(() => {
    const c = { High: 0, Medium: 0, Low: 0, Missing: 0, quotes: 0, verified: 0 };
    for (const cl of data.clauses) {
      c[cl.severity]++;
      if (cl.type === "missing") c.Missing++;
      if (cl.verified !== null && cl.verified !== undefined) {
        c.quotes++;
        if (cl.verified) c.verified++;
      }
    }
    return c;
  }, [data.clauses]);

  const visible = sorted.filter((c) =>
    filter === "All" ? true : filter === "Missing" ? c.type === "missing" : c.severity === filter,
  );

  const filters: { key: Filter; n: number }[] = [
    { key: "All", n: data.clauses.length },
    { key: "High", n: counts.High },
    { key: "Medium", n: counts.Medium },
    { key: "Low", n: counts.Low },
    { key: "Missing", n: counts.Missing },
  ];

  return (
    <div className="space-y-6">
      <section>
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Summary</p>
        <p className="font-display text-[1.3rem] leading-snug text-ink">{data.summary}</p>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="High risk" value={counts.High} tone="text-high" />
        <Stat label="Medium" value={counts.Medium} tone="text-med" />
        <Stat label="Low" value={counts.Low} tone="text-low" />
        <Stat
          label="Quotes verified"
          value={counts.quotes ? `${counts.verified}/${counts.quotes}` : "—"}
          tone="text-accent"
        />
      </section>

      {data.clauses.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-4 text-sm text-ink-2">
          <IconShield className="text-accent" />
          No risky or missing clauses found for your side.
        </div>
      ) : (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter clauses">
            {filters.map((f) => (
              <button
                key={f.key}
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                disabled={f.n === 0 && f.key !== "All"}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-150 disabled:opacity-40 ${
                  filter === f.key
                    ? "border-ink bg-ink text-paper"
                    : "border-line bg-surface text-ink-2 hover:border-muted/50"
                }`}
              >
                {f.key} <span className="opacity-60">{f.n}</span>
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {visible.map((c, i) => (
              <ClauseCard key={`${c.title}-${i}`} clause={c} defaultOpen={i === 0 && filter === "All"} />
            ))}
          </div>
        </section>
      )}

      {showSuggestions && (
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted">Ask a follow-up</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => onAsk(s)}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-2 transition duration-150 hover:border-accent/40 hover:bg-accent-soft hover:text-ink"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <div className={`font-display text-2xl leading-none ${tone}`}>{value}</div>
      <div className="mt-1.5 text-xs text-muted">{label}</div>
    </div>
  );
}

function ClauseCard({ clause, defaultOpen }: { clause: Clause; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(false);
  const s = SEV[clause.severity];

  async function copy() {
    try {
      await navigator.clipboard.writeText(clause.rewrite);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <details
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      className="group rounded-xl border border-line bg-surface transition-shadow duration-200 open:shadow-sm hover:shadow-sm"
    >
      <summary className="flex cursor-pointer items-start gap-3 rounded-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <h3 className="font-medium leading-snug text-ink">{clause.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted group-open:line-clamp-none">
            {clause.issue}
          </p>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
            <span className={`rounded-md px-2 py-0.5 font-medium ${s.soft} ${s.text}`}>{clause.severity}</span>
            {clause.type === "missing" ? (
              <span className="rounded-md bg-sunken px-2 py-0.5 text-ink-2">Missing clause</span>
            ) : (
              clause.page != null && <span className="rounded-md bg-sunken px-2 py-0.5 text-ink-2">Page {clause.page}</span>
            )}
            {clause.verified === true && (
              <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 py-0.5 text-accent">
                <IconCheck width={12} height={12} strokeWidth={2.5} /> Quote verified
              </span>
            )}
            {clause.verified === false && (
              <span className="inline-flex items-center gap-1 rounded-md bg-med-soft px-2 py-0.5 text-med">
                <IconAlert width={12} height={12} strokeWidth={2.25} /> Quote not found in PDF
              </span>
            )}
          </div>
        </div>
        <IconChevron className="mt-0.5 shrink-0 text-muted transition-transform duration-200 group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-line p-4 sm:pl-9">
        {clause.quote && (
          <figure>
            <figcaption className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted">
              From the contract{clause.page != null && ` · p. ${clause.page}`}
            </figcaption>
            <blockquote className="border-l-2 border-line pl-3 font-display text-[15px] italic leading-relaxed text-ink-2">
              “{clause.quote}”
            </blockquote>
          </figure>
        )}
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-widest text-muted">In plain English</p>
          <p className="text-[15px] leading-relaxed text-ink">{clause.plain_english}</p>
        </div>
        <div className="rounded-lg bg-accent-soft p-3.5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-accent">Suggested rewrite</p>
            <button
              onClick={copy}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-accent transition hover:bg-accent/10"
            >
              {copied ? <IconCheck width={13} height={13} /> : <IconCopy width={13} height={13} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-[15px] leading-relaxed text-ink">{clause.rewrite}</p>
        </div>
      </div>
    </details>
  );
}
