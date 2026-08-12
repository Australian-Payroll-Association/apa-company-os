"use client";

import { useState } from "react";
import type { ClientDocument } from "@/lib/client-documents";
import { teamDownloadClientDocument } from "./documents-actions";

// Read-only list: title, date, uploader, download. No upload or delete on /team.

function formatBytes(n: number | null): string {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ClientDocumentsList({ documents }: { documents: ClientDocument[] }) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(id: string) {
    setError(null);
    setBusyId(id);
    const r = await teamDownloadClientDocument(id);
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
              <div className="admin-list-sub">
                {formatDay(d.createdAt)}
                {(d.uploaderName || d.uploadedBy) && ` · uploaded by ${d.uploaderName ?? d.uploadedBy}`}
                {d.sizeBytes != null && ` · ${formatBytes(d.sizeBytes)}`}
                {d.programName && ` · ${d.programName}`}
              </div>
            </div>
            <div className="admin-list-aside">
              <button
                type="button"
                className="admin-btn admin-btn--sm"
                onClick={() => download(d.id)}
                disabled={busyId === d.id}
              >
                {busyId === d.id ? "…" : "Download"}
              </button>
            </div>
          </div>
        ))}
      </div>
      {error && <div className="admin-alert admin-alert--err" style={{ marginTop: 10 }}>{error}</div>}
    </div>
  );
}
