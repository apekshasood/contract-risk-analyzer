"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, useSession } from "../../lib/supabase";
import { AUDIT_SELECT, type AuditRow, type JobStatus } from "../../lib/audits";
import { IconPlus, IconScale } from "../_components/icons";

const STATUS_STYLE: Record<JobStatus, string> = {
  queued: "bg-sunken text-ink-2",
  processing: "bg-med-soft text-med",
  done: "bg-low-soft text-low",
  failed: "bg-high-soft text-high",
};

export default function AuditsPage() {
  const router = useRouter();
  const session = useSession();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session === null) router.replace("/login");
    if (!session) return;
    // RLS returns only this user's audits; no user_id filter needed
    supabase
      .from("audits")
      .select(AUDIT_SELECT)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => (error ? setError(error.message) : setRows(data as unknown as AuditRow[])));
  }, [session, router]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line/70">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
              <IconScale width={18} height={18} />
            </span>
            <span className="font-display text-[17px] font-medium tracking-tight text-ink">Clause</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink">
            <IconPlus width={16} height={16} /> New audit
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="mb-6 font-display text-3xl text-ink">Your audits</h1>
        {error && <p className="rounded-lg bg-high-soft px-3 py-2 text-sm text-high">{error}</p>}
        {rows === null && !error && <div className="skeleton h-16 rounded-xl" />}
        {rows?.length === 0 && <p className="text-muted">No audits yet. Upload a contract to start.</p>}
        <ul className="space-y-2">
          {rows?.map((a) => (
            <li key={a.id}>
              <Link
                href={`/audits/${a.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4 transition hover:border-accent/50"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{a.documents?.file_name ?? "Contract"}</span>
                  <span className="text-xs capitalize text-muted">
                    {a.role} · {new Date(a.created_at).toLocaleString()}
                    {a.status === "done" && a.result ? ` · ${a.result.clauses.length} findings` : ""}
                  </span>
                </span>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs capitalize ${STATUS_STYLE[a.status]}`}>{a.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
