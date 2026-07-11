"use client";

import { useState, useTransition } from "react";
import type { AssumableClient } from "@/lib/admin/portal-assume";
import { startAssumeSession } from "./actions";

// "View as" launches the client portal scoped to that company, in this same
// browser tab — your admin session stays logged in underneath. A banner on
// every /portal page shows who you're viewing as and lets you exit back here.
export function AssumeManager({ clients }: { clients: AssumableClient[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function handleView(companyId: string) {
    setError(null);
    setPendingId(companyId);
    start(async () => {
      const res = await startAssumeSession(companyId);
      // startAssumeSession redirects on success, so reaching here means it failed.
      if (res && !res.ok) setError(res.error);
      setPendingId(null);
    });
  }

  return (
    <>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}

      <div className="admin-list">
        {clients.length === 0 ? (
          <div className="admin-empty">No active client-portal companies yet.</div>
        ) : (
          clients.map((c) => (
            <div className="admin-list-row" key={c.companyId}>
              <div className="admin-list-main">
                <div className="admin-list-title">{c.companyName}</div>
                <div className="admin-list-sub">
                  {c.contactName || c.contactEmail
                    ? `Viewing as ${c.contactName || c.contactEmail}`
                    : "No linked contact"}
                </div>
              </div>
              <div className="admin-list-aside">
                <button
                  className="admin-btn admin-btn--sm admin-btn--primary"
                  disabled={pending || !c.contactEmail}
                  onClick={() => handleView(c.companyId)}
                >
                  {pending && pendingId === c.companyId ? "Opening…" : "View as"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
