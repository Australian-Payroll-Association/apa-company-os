"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  inviteToPortal,
  resendPortalInvite,
  revokePortalAccess,
} from "@/app/admin/(dashboard)/talent/team/actions";

type Result = { ok: true; message: string } | { ok: false; error: string };

// Talent > Team portal-access control. Not provisioned: an Invite button that
// confirms first (it emails a real sign-in link). Provisioned: a "Portal ✓"
// badge; with `full` (the member detail page) it adds Resend link and Revoke.
// List rows omit `full` to stay compact.
export function InvitePortalButton({
  teamMemberId,
  provisioned,
  full = false,
}: {
  teamMemberId: string;
  provisioned: boolean;
  full?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function run(confirmText: string, action: (id: string) => Promise<Result>) {
    if (!window.confirm(confirmText)) return;
    setMsg(null);
    start(async () => {
      const res = await action(teamMemberId);
      setMsg(res.ok ? res.message : res.error);
      if (res.ok) router.refresh();
    });
  }

  if (provisioned) {
    if (!full) return <span className="admin-badge admin-badge--ok">Portal ✓</span>;
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span className="admin-badge admin-badge--ok">Portal ✓</span>
        <button
          className="admin-btn admin-btn--sm"
          disabled={pending}
          onClick={() => run("Email this person a fresh sign-in link?", resendPortalInvite)}
        >
          Resend link
        </button>
        <button
          className="admin-btn admin-btn--sm admin-btn--danger"
          disabled={pending}
          onClick={() =>
            run(
              "Revoke portal access? They are signed out and blocked until re-invited.",
              revokePortalAccess,
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
        onClick={() => run("Send this person a portal sign-in invite by email?", inviteToPortal)}
      >
        {pending ? "Sending…" : "Invite"}
      </button>
      {msg && <span className="admin-cell-muted">{msg}</span>}
    </span>
  );
}
