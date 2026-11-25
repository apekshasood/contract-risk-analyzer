// Stream a Q&A answer from the gateway (Server-Sent Events over a POST).
// EventSource can't send a POST body or an Authorization header,
// so we read the response body with fetch and parse the SSE frames ourselves.
import { supabase, GATEWAY } from "./supabase";
import type { QaResult } from "../app/_components/types";

export async function streamQuestion(
  form: FormData,
  signal: AbortSignal,
  onDelta: (text: string) => void,
): Promise<QaResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${GATEWAY}/api/uploads/qa/stream`, {
      method: "POST",
      body: form,
      signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch (e) {
    if (signal.aborted) throw e;
    throw new Error("Can't reach the server. Please try again.");
  }
  // Errors before the stream starts are plain JSON from the gateway
  if (!res.ok || !res.body) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    // One SSE frame ends with a blank line; a chunk can hold half a frame, so keep the rest
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = frame.match(/^event: (.*)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === "delta") onDelta(payload.text);
      else if (event === "done") return payload as QaResult;
      else if (event === "error") throw new Error(payload.error);
    }
  }
  throw new Error("The answer stopped halfway. Please try again.");
}
