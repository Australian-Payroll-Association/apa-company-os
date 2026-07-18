"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";
import { PasswordField } from "@/components/admin/PasswordField";

// Magic-link (passwordless) sign-in for client contacts, with a password
// fallback for contacts whose mail security (e.g. Microsoft Safe Links)
// consumes one-time links before they can be clicked. We never create a
// user here (shouldCreateUser: false) — accounts are minted only by an admin
// invite — and the notice is deliberately neutral so the form cannot be used
// to enumerate who has an account.
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"link" | "password">("link");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    params.get("error") ? "That sign-in link was invalid or expired. Request a new one below." : null,
  );
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/api/auth/callback?next=/portal`,
      },
    });
    setLoading(false);
    // Neutral response regardless of whether an account exists.
    if (error && error.status && error.status >= 500) {
      setError("Something went wrong sending your link. Please try again.");
      return;
    }
    setSent(true);
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) {
      setError("That email and password combination did not work.");
      setLoading(false);
      return;
    }
    // Full navigation so the middleware + server layout re-run with the new cookie.
    router.replace("/portal");
    router.refresh();
  }

  if (sent) {
    return (
      <div className="admin-alert admin-alert--ok">
        If an account exists for {email.trim().toLowerCase()}, a sign-in link is on its way. Check
        your email and open the link on this device.
      </div>
    );
  }

  if (mode === "password") {
    return (
      <form className="admin-form" onSubmit={handlePasswordSubmit}>
        {error && <div className="admin-alert admin-alert--err">{error}</div>}
        <div className="admin-field">
          <label className="admin-label" htmlFor="email">Email</label>
          <input
            id="email"
            className="admin-input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="password">Password</label>
          <PasswordField id="password" value={password} onChange={setPassword} />
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
          <button
            type="button"
            className="admin-btn"
            onClick={() => {
              setMode("link");
              setError(null);
            }}
          >
            Use a sign-in link instead
          </button>
        </div>
      </form>
    );
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <p className="admin-auth-sub" style={{ marginTop: 0 }}>
        Enter your email and we will send you a sign-in link. No password needed.
      </p>
      <div className="admin-field">
        <label className="admin-label" htmlFor="email">Email</label>
        <input
          id="email"
          className="admin-input"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={loading}>
          {loading ? "Sending…" : "Send sign-in link"}
        </button>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            setMode("password");
            setError(null);
          }}
        >
          Sign in with a password
        </button>
      </div>
    </form>
  );
}
