"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { requestSignInLink } from "./actions";

// Magic-link (passwordless) sign-in. The link email is sent server-side (see
// ./actions.ts) through the /team/verify interstitial: corporate mail security
// (e.g. Microsoft Safe Links) prefetches raw one-time links and consumes the
// token before the person can click, so the emailed link must redeem only on a
// button press. We never create a user here; accounts are minted only by an
// admin invite, and the notice is deliberately neutral so the form cannot be
// used to enumerate who has an account.
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
    try {
      await requestSignInLink(email);
    } catch {
      setError("Something went wrong sending your link. Please try again.");
      setLoading(false);
      return;
    }
    setLoading(false);
    // Neutral response regardless of whether an account exists.
    setSent(true);
  }

  if (sent) {
    return (
      <div className="admin-alert admin-alert--ok">
        If an account exists for {email.trim().toLowerCase()}, a sign-in link is on its way. Check
        your email and press the button in it to sign in.
      </div>
    );
  }

  return (
    <form className="admin-form" onSubmit={handleSubmit}>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <p className="admin-auth-sub" style={{ marginTop: 0 }}>
        Enter your work email and we will send you a sign-in link. No password needed.
      </p>
      <div className="admin-field">
        <label className="admin-label" htmlFor="email">Work email</label>
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
