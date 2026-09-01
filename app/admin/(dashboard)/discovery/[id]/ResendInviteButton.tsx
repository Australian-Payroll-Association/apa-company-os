"use client";

import { useState } from "react";
import { resendInvite } from "./actions";

export function ResendInviteButton({ engagementId }: { engagementId: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setState("sending");
    setError(null);
    const r = await resendInvite(engagementId);
    if (r.ok) {
      setState("sent");
      setTimeout(() => setState("idle"), 2500);
    } else {
      setState("error");
      setError(r.error);
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" className="admin-btn admin-btn--sm" onClick={handleClick} disabled={state === "sending"}>
        {state === "sending" ? "Sending…" : "Resend invite"}
      </button>
      {state === "sent" && <span className="admin-hint">Sent</span>}
      {state === "error" && <span className="admin-hint">{error}</span>}
    </div>
  );
}
