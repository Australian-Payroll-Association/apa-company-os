"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/browser";

// Magic-link (passwordless) sign-in for client contacts. We never create a
// user here (shouldCreateUser: false) — accounts are minted only by an admin
// invite — and the notice is deliberately neutral so the form cannot be used
// to enumerate who has an account.
export function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
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

  if (sent) {
    return (
      <div className="admin-alert admin-alert--ok">
        If an account exists for {email.trim().toLowerCase()}, a sign-in link is on its way. Check
        your email and open the link on this device.
      </div>
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
      </div>
    </form>
  );
}
