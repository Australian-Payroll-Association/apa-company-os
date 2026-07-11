"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  invitePortalMember,
  resendPortalMemberInvite,
  revokePortalMember,
} from "@/app/admin/(dashboard)/revenue/companies/portal-actions";

type Result = { ok: true; message: string } | { ok: false; error: string };

// Client-portal access controls for one (person, company) pair. Sibling of
// InvitePortalButton (the /team one), but membership-based: Invite confirms
// first (it emails a real sign-in link); an active member gets Resend + Revoke.
export function PortalMemberControls({
  personId,
  companyId,
  active,
}: {
  personId: string;
  companyId: string;
  active: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(confirmText: string, action: () => Promise<Result>) {
    if (!window.confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const res = await action();
      setMsg(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });
  }

  if (active) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="admin-badge admin-badge--ok">Portal ✓</span>
        <button
          className="admin-btn admin-btn--sm"
          disabled={pending}
          onClick={() =>
            run("Email this contact a fresh sign-in link?", () =>
              resendPortalMemberInvite(personId, companyId),
            )
          }
        >
          Resend link
        </button>
        <button
          className="admin-btn admin-btn--sm admin-btn--danger"
          disabled={pending}
          onClick={() =>
            run(
              "Revoke portal access for this company? If it is their last membership they are signed out and blocked until re-invited.",
              () => revokePortalMember(personId, companyId),
            )
          }
        >
          Revoke
        </button>
        {msg && <span className="admin-cell-muted">{msg}</span>}
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        className="admin-btn admin-btn--sm"
        disabled={pending}
        onClick={() =>
          run("Send this contact a client-portal invite by email?", () =>
            invitePortalMember(personId, companyId),
          )
        }
      >
        {pending ? "Sending…" : "Invite to portal"}
      </button>
      {msg && <span className="admin-cell-muted">{msg}</span>}
    </span>
  );
}
