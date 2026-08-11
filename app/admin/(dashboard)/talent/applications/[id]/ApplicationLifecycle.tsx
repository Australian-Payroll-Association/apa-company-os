"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { archiveApplication, unarchiveApplication } from "../actions";

// Delete = soft-archive (reversible). An archived application drops off the list
// and the board; Restore returns it to the pipeline. Duplicates and wrong-person
// records are archived, never hard-deleted, so nothing is lost.
export function ApplicationLifecycle({
  applicationId,
  archived,
}: {
  applicationId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doArchive() {
    setBusy(true);
    setErr(null);
    const r = await archiveApplication(applicationId);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    router.push("/admin/talent/applications");
  }

  async function doRestore() {
    setBusy(true);
    setErr(null);
    const r = await unarchiveApplication(applicationId);
    setBusy(false);
    if (!r.ok) {
      setErr(r.error);
      return;
    }
    router.refresh();
  }

  if (archived) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
        <button type="button" className="admin-btn admin-btn--sm" disabled={busy} onClick={doRestore}>
          {busy ? "Restoring…" : "Restore"}
        </button>
        {err && <span style={{ color: "var(--admin-err-ink)", fontSize: 12.5 }}>{err}</span>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
      {confirming ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="admin-cell-muted" style={{ fontSize: 12.5 }}>
            Archive this application?
          </span>
          <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" disabled={busy} onClick={doArchive}>
            {busy ? "Deleting…" : "Delete"}
          </button>
          <button type="button" className="admin-btn admin-btn--sm" disabled={busy} onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="admin-btn admin-btn--sm" onClick={() => setConfirming(true)}>
          Delete
        </button>
      )}
      {err && <span style={{ color: "var(--admin-err-ink)", fontSize: 12.5 }}>{err}</span>}
    </div>
  );
}
