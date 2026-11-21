// Browser Supabase client. The anon key is public by design: Row Level Security
// decides what each signed-in user can read and write.
import { createClient, type Session } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !anonKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env.local");
}

export const supabase = createClient(url, anonKey);
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

export const GATEWAY = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:3001";

/** undefined = still loading, null = signed out */
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

/** Call the gateway with the user's access token. Throws Error(message) on failure. */
export async function gatewayFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession(); // refreshes the token if needed
  const token = data.session?.access_token;
  let res: Response;
  try {
    res = await fetch(`${GATEWAY}${path}`, {
      ...init,
      headers: { ...init.headers, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
  } catch (e) {
    if (init.signal?.aborted) throw e; // Stop pressed: let the caller see the AbortError
    throw new Error("Can't reach the server. Please try again.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? body.message ?? `Request failed (${res.status})`);
  return body as T;
}
