"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "./Logo";
import { IconMail } from "./icons";

type View = "signin" | "signup" | "confirm";

export default function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [view, setView] = useState<View>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  const redirectTo = () =>
    `${process.env.NEXT_PUBLIC_SITE_URL || (typeof window !== "undefined" ? window.location.origin : "")}/auth/callback`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (view === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name || email.split("@")[0] }, emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        if (data.session) {
          router.push("/");
          router.refresh();
        } else {
          setView("confirm"); // dedicated "check your inbox" screen
        }
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

  async function resend() {
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
      setMsg({ kind: "ok", text: "Sent again — check your inbox." });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't resend." });
    } finally {
      setBusy(false);
    }
  }

  // ---- Dedicated confirmation screen ----
  if (view === "confirm") {
    return (
      <div className="auth-wrap" data-theme="sage">
        <div className="auth-card confirm">
          <div className="ic"><IconMail size={28} /></div>
          <h1>Check your inbox</h1>
          <p>
            We sent a confirmation link to <span className="email">{email}</span>. Open it to verify
            your account, then come back and sign in.
          </p>
          {msg && <div className={`auth-msg ${msg.kind}`} style={{ marginTop: 16 }}>{msg.text}</div>}
          <div className="actions">
            <button className="submit" onClick={() => { setView("signin"); setMsg(null); }}>Back to sign in</button>
            <button className="linkbtn" onClick={resend} disabled={busy}>
              {busy ? "Sending…" : "Didn’t get it? Resend email"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Sign in / sign up ----
  return (
    <div className="auth-wrap" data-theme="sage">
      <div className="auth-card">
        <div className="brand">
          <span className="mark"><Logo size={30} /></span>
          <h1>Chapter Quest</h1>
          <p className="sub">
            {view === "signin" ? "Welcome back to your reading challenges." : "Track every reading challenge in one place."}
          </p>
        </div>

        {msg && <div className={`auth-msg ${msg.kind}`}>{msg.text}</div>}

        <form onSubmit={submit}>
          {view === "signup" && (
            <div className="field">
              <label htmlFor="name">Display name</label>
              <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jenn" />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="submit" type="submit" disabled={busy}>
            {busy ? "One moment…" : view === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="toggle">
          {view === "signin" ? (
            <>New here? <button onClick={() => { setView("signup"); setMsg(null); }}>Create an account</button></>
          ) : (
            <>Already have an account? <button onClick={() => { setView("signin"); setMsg(null); }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
