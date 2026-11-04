"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/supabase/env";

type View = "signin" | "forgot";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth") {
      setMsg({ kind: "err", text: "That link didn’t work or has expired. Please request a new one." });
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (view === "forgot") {
        // The default PKCE flow only works in the browser that asked for the link. Reset emails often
        // open somewhere else, such as a mail app, so this one flow carries its session in the link.
        const resetClient = createPlainClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: { flowType: "implicit", persistSession: false, detectSessionInUrl: false },
        });
        const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
        const { error } = await resetClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${site}/auth/reset-password`,
        });
        if (error) throw error;
        setMsg({ kind: "ok", text: "If that email has an account, a reset link is on its way. It works in any browser." });
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
