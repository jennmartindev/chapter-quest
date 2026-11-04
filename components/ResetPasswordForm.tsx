"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Shown after a recovery link signs the user in; lets them set a new password.
export default function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  useEffect(() => {
    async function start() {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        // Take the tokens out of the address bar and browser history.
        window.history.replaceState(null, "", window.location.pathname);
        setHasSession(!error);
        return;
      }
      const { data } = await supabase.auth.getUser();
      setHasSession(!!data.user);
    }
    start();
  }, [supabase]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setMsg({ kind: "err", text: "Passwords don’t match." });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't update password." });
      setBusy(false);
    }
  }

  return (
    <div className="auth-wrap" data-theme="sage">
      <div className="auth-card">
        <div className="brand">
          <div className="wm wm-auth"><span className="de">Dog Ears</span><span className="dn"><i>&amp;</i> Dunes</span></div>
          <p className="sub">Choose a new password.</p>
        </div>

        {hasSession === false ? (
          <>
            <div className="auth-msg err">This reset link is invalid or has expired. Request a new one from the sign-in page.</div>
            <button className="submit" onClick={() => router.push("/login")}>Back to sign in</button>
          </>
        ) : (
          <>
            {msg && <div className={`auth-msg ${msg.kind}`}>{msg.text}</div>}
            <form onSubmit={submit}>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input id="password" type="password" required minLength={6} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div className="field">
                <label htmlFor="confirm">Confirm password</label>
                <input id="confirm" type="password" required minLength={6} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
              </div>
              <button className="submit" type="submit" disabled={busy || hasSession === null}>
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
