"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type View = "signin" | "forgot";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  const redirectTo = (next?: string) =>
    `${process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (view === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: redirectTo("/auth/reset-password"),
        });
        if (error) throw error;
        setMsg({ kind: "ok", text: "If that email has an account, a reset link is on its way. Open it in this same browser." });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  // ---- Sign in. Accounts are invite-only, so there is no signup here. ----
  return (
    <div className="auth-wrap" data-theme="sage">
      <div className="auth-card">
        <div className="brand">
          <div className="wm wm-auth"><span className="de">Dog Ears</span><span className="dn"><i>&amp;</i> Dunes</span></div>
          <p className="sub">
            {view === "signin"
              ? "Welcome back to your reading challenges."
              : "Enter your email and we’ll send a link to set a new password."}
          </p>
        </div>

        {msg && <div className={`auth-msg ${msg.kind}`}>{msg.text}</div>}

        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          {view !== "forgot" && (
            <div className="field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
          )}
          <button className="submit" type="submit" disabled={busy}>
            {busy ? "One moment…" : view === "signin" ? "Sign in" : "Send reset link"}
          </button>
        </form>

        {view === "signin" && (
          <div className="toggle" style={{ marginTop: 10 }}>
            <button onClick={() => { setView("forgot"); setMsg(null); }}>Forgot password?</button>
          </div>
        )}

        <div className="toggle">
          {view === "forgot" && (
            <>Remembered it? <button onClick={() => { setView("signin"); setMsg(null); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
