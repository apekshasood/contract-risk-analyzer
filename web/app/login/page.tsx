"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, useSession } from "../../lib/supabase";
import { IconScale } from "../_components/icons";

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace("/");
  }, [session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const { data, error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setError(error.message);
    // Sign-up with "Confirm email" on returns no session until the link is clicked
    if (mode === "signup" && !data.session) setNotice("Check your email for a confirmation link, then sign in.");
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-paper px-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-accent-ink">
            <IconScale width={18} height={18} />
          </span>
          <span className="font-display text-[17px] font-medium tracking-tight text-ink">Clause</span>
        </div>
        <h1 className="font-display text-2xl text-ink">{mode === "signin" ? "Sign in" : "Create an account"}</h1>

        <label className="block text-sm text-ink-2">
          Email
          <input
            type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent/60"
          />
        </label>
        <label className="block text-sm text-ink-2">
          Password
          <input
            type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-ink outline-none focus:border-accent/60"
          />
        </label>

        {error && <p className="rounded-lg bg-high-soft px-3 py-2 text-sm text-high">{error}</p>}
        {notice && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{notice}</p>}

        <button
          type="submit" disabled={busy}
          className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-accent-ink transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>
        <button
          type="button"
          onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setNotice(null); }}
          className="w-full text-sm text-muted hover:text-ink"
        >
          {mode === "signin" ? "No account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
