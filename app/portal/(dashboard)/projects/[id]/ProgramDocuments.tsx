"use client";

import { useState } from "react";
import { downloadDocumentAction } from "../actions";
import type { PortalProgramDocument } from "@/lib/portal/ai-programs";

function formatBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Documents open via a short-lived signed URL minted server-side (private
// bucket), so links can't be shared or guessed.
export function ProgramDocuments({ documents }: { documents: PortalProgramDocument[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(id: string) {
    setError(null);
    setBusyId(id);
    const r = await downloadDocumentAction(id);
    setBusyId(null);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    window.open(r.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="admin-list">
        {documents.map((d) => (
          <div className="admin-list-row" key={d.id}>
            <div className="admin-list-main">
              <div className="admin-list-title">{d.filename}</div>
              {d.sizeBytes != null && <div className="admin-list-sub">{formatBytes(d.sizeBytes)}</div>}
            </div>
            <div className="admin-list-aside">
              <button type="button" className="admin-btn admin-btn--sm" onClick={() => open(d.id)} disabled={busyId === d.id}>
                {busyId === d.id ? "Opening…" : "Download"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <div className="admin-alert admin-alert--err" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
