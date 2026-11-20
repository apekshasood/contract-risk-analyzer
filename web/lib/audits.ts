// Audit job flow, all from the browser:
//   upload PDF to Storage -> insert documents row -> insert queued audits row
//   -> ask the gateway to start it -> watch the row until done / failed.
import { supabase, gatewayFetch } from "./supabase";
import type { AuditResult } from "../app/_components/types";

export type JobStatus = "queued" | "processing" | "done" | "failed";

export type AuditRow = {
  id: string;
  status: JobStatus;
  role: string;
  result: AuditResult | null;
  error: string | null;
  created_at: string;
  documents: { file_name: string; storage_path: string } | null;
};

export const AUDIT_SELECT = "id,status,role,result,error,created_at,documents(file_name,storage_path)";

const abortError = () => new DOMException("Stopped", "AbortError");

/** onCreated runs as soon as the audit row exists, so Stop can cancel it. */
export async function startAudit(
  file: File,
  role: string,
  context: string,
  signal?: AbortSignal,
  onCreated?: (auditId: string) => void,
): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Please sign in again.");

  // Path must start with the user id: the storage policy checks the first folder.
  const path = `${user.id}/${crypto.randomUUID()}.pdf`;
  const up = await supabase.storage.from("contracts").upload(path, file, { contentType: "application/pdf" });
  if (up.error) throw new Error(`Upload failed: ${up.error.message}`);
  if (signal?.aborted) throw abortError();

  const doc = await supabase
    .from("documents")
    .insert({ file_name: file.name.slice(0, 255), storage_path: path, size_bytes: file.size })
    .select("id")
    .single();
  if (doc.error) throw new Error(`Could not save the document: ${doc.error.message}`);

  const audit = await supabase
    .from("audits")
    .insert({ document_id: doc.data.id, role, context: context.slice(0, 2000) })
    .select("id")
    .single();
  if (audit.error) throw new Error(`Could not create the audit: ${audit.error.message}`);
  onCreated?.(audit.data.id);
  if (signal?.aborted) throw abortError();

  await gatewayFetch("/api/audits", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auditId: audit.data.id }),
  });
  return audit.data.id;
}

/** Stop a queued/processing audit. Safe to call more than once. */
export async function cancelAudit(id: string): Promise<void> {
  await gatewayFetch(`/api/audits/${id}/cancel`, { method: "POST" }).catch(() => {});
}

export async function getAudit(id: string): Promise<AuditRow | null> {
  const { data, error } = await supabase.from("audits").select(AUDIT_SELECT).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as AuditRow | null;
}

const POLL_MS = 4000; // fallback if a Realtime event is missed
const MAX_WAIT_MS = 5 * 60 * 1000;

/**
 * Resolve when the audit is done (result) or failed (throws).
 * Realtime pushes status changes; a slow poll covers missed events.
 */
export function waitForAudit(id: string, onStatus: (s: JobStatus) => void, signal?: AbortSignal): Promise<AuditResult> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError());
    let finished = false;
    const finish = (fn: () => void) => {
      if (finished) return;
      finished = true;
      clearInterval(poll);
      clearTimeout(timeout);
      supabase.removeChannel(channel);
      fn();
    };
    const handle = (row: Pick<AuditRow, "status" | "result" | "error"> | null) => {
      if (!row) return;
      if (row.status === "done" && row.result) finish(() => resolve(row.result as AuditResult));
      else if (row.status === "failed") finish(() => reject(new Error(row.error ?? "Analysis failed. Please try again.")));
      else onStatus(row.status);
    };
    const check = () => getAudit(id).then(handle).catch(() => {});

    const channel = supabase
      .channel(`audit-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "audits", filter: `id=eq.${id}` }, (p) =>
        handle(p.new as AuditRow),
      )
      .subscribe();
    const poll = setInterval(check, POLL_MS);
    signal?.addEventListener("abort", () => finish(() => reject(abortError())), { once: true });
    const timeout = setTimeout(
      () => finish(() => reject(new Error("The analysis is taking too long. Check your dashboard later."))),
      MAX_WAIT_MS,
    );
    check();
  });
}
