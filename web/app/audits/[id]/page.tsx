"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "../../../lib/supabase";
import { getAudit, waitForAudit, type AuditRow } from "../../../lib/audits";
import { AuditView } from "../../_components/AuditView";
import { IconAlert, IconScale } from "../../_components/icons";

export default function AuditReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const session = useSession();
  const [audit, setAudit] = useState<AuditRow | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session === null) router.replace("/login");
    if (!session) return;
    let cancelled = false;
    getAudit(id)
      .then((row) => {
        if (cancelled) return;
        setAudit(row);
        // Still running: follow it live
        if (row && (row.status === "queued" || row.status === "processing")) {
          waitForAudit(id, (status) => !cancelled && setAudit((a) => (a ? { ...a, status } : a)))
            .then((result) => !cancelled && setAudit((a) => (a ? { ...a, status: "done", result } : a)))
            .catch((e: Error) => !cancelled && setAudit((a) => (a ? { ...a, status: "failed", error: e.message } : a)));
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [id, session, router]);

  return (
    <div className="min-h-dvh bg-paper">
      <header className="border-b border-line/70">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
              <IconScale width={18} height={18} />
            </span>
            <span className="font-display text-[17px] font-medium tracking-tight text-ink">ClauseOk</span>
          </Link>
          <Link href="/audits" className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-sunken hover:text-ink">
            All audits
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        {audit && (
          <div className="mb-6">
            <h1 className="truncate font-display text-2xl text-ink">{audit.documents?.file_name ?? "Contract"}</h1>
            <p className="text-sm capitalize text-muted">{audit.role} · {new Date(audit.created_at).toLocaleString()}</p>
          </div>
        )}
        {(error || audit === null) && <Problem text={error ?? "Audit not found."} />}
        {audit === undefined && !error && <div className="skeleton h-24 rounded-xl" />}
        {audit && (audit.status === "queued" || audit.status === "processing") && (
          <p className="rounded-xl border border-line bg-surface p-4 text-sm text-ink-2" role="status">
            {audit.status === "queued" ? "Waiting in the queue…" : "Analyzing the contract…"} This page updates by itself.
          </p>
        )}
        {audit?.status === "failed" && <Problem text={audit.error ?? "Analysis failed."} />}
        {audit?.status === "done" && audit.result && (
          <AuditView data={audit.result} onAsk={() => {}} showSuggestions={false} />
        )}
      </main>
    </div>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-high/25 bg-high-soft p-4">
      <IconAlert className="mt-0.5 shrink-0 text-high" width={18} height={18} />
      <p className="text-sm text-ink-2">{text}</p>
    </div>
  );
}
