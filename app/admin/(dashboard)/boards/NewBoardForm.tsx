"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBoard } from "./actions";

export function NewBoardForm({ clients }: { clients: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  function submit() {
    if (!name.trim()) return setError("Name the board.");
    setError(null);
    start(async () => {
      const r = await createBoard({ name, clientCompanyId: clientId || undefined });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      setName("");
      setClientId("");
      if (r.slug) router.push(`/admin/boards/${r.slug}`);
      else router.refresh();
    });
  }

  if (!open) {
    // Same 18px bottom rhythm as the expanded form card below.
    return (
      <button
        className="admin-btn admin-btn--primary admin-btn--sm"
        style={{ marginBottom: 18 }}
        onClick={() => setOpen(true)}
      >
        New board
      </button>
    );
  }

  return (
    <div className="admin-card admin-section-card" style={{ marginBottom: 18 }}>
      <div className="admin-form">
        <div className="admin-field">
          <label className="admin-label">Board name</label>
          <input
            className="admin-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Product, or a client name"
            autoFocus
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Client (optional)</label>
          <select className="admin-select" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">No client (internal board)</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="admin-hint">A client board is read-only in that client&apos;s portal (internal cards hidden).</p>
        </div>
        {error && <div className="admin-alert admin-alert--err">{error}</div>}
        <div className="admin-form-actions" style={{ display: "flex", gap: 8 }}>
          <button className="admin-btn admin-btn--primary" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create board"}
          </button>
          <button className="admin-btn" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
