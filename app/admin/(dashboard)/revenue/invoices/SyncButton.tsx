"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { runInvoiceSync, type SyncSummary } from "./sync-action";

// "Sync now": pulls both QuickBooks companies into the ledger on demand (same
// engine as the weekly cron). Shows a one-line per-company result afterwards.
export function SyncButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SyncSummary[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function run() {
    setErr(null);
    setResult(null);
    start(async () => {
      try {
        const r = await runInvoiceSync();
        setResult(r);
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Sync failed.");
      }
    });
  }

  const label = (s: SyncSummary) =>
    s.ok
      ? `${s.entity === "aio" ? "AIO" : "Edge8"}: ${s.upserted} synced` +
        (s.skippedUnmapped ? `, ${s.skippedUnmapped} unmapped` : "")
      : `${s.entity === "aio" ? "AIO" : "Edge8"}: ${s.error ?? "failed"}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
      <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={run}>
        {pending ? "Syncing…" : "Sync now"}
      </button>
      {result && (
        <span style={{ fontSize: 12, color: "var(--admin-muted)", textAlign: "right" }}>
          {result.map(label).join(" · ")}
        </span>
      )}
      {err && <span style={{ fontSize: 12, color: "var(--admin-err-ink)" }}>{err}</span>}
    </div>
  );
}
