"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RoadmapGroup } from "@/lib/client-backlog";
import { teamCreateRoadmapItem } from "./actions";

// Add a roadmap item from the hub. New items land at the end of the chosen
// group as source=edge8 / status=accepted, with priority left to the admin
// default; the server action re-checks the actor's assignment.

export function AddItemForm({ companyId, groups }: { companyId: string; groups: RoadmapGroup[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupKey, setGroupKey] = useState(groups[0]?.key ?? "");
  const [title, setTitle] = useState("");
  const [buildDesc, setBuildDesc] = useState("");

  if (groups.length === 0) return null;

  async function submit() {
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    const r = await teamCreateRoadmapItem(companyId, {
      group_key: groupKey,
      title,
      build_desc: buildDesc,
    });
    setBusy(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setTitle("");
    setBuildDesc("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div style={{ marginBottom: 18 }}>
        <button type="button" className="admin-btn" onClick={() => setOpen(true)}>
          + Add roadmap item
        </button>
      </div>
    );
  }

  return (
    <section className="admin-card admin-section-card" style={{ marginBottom: 18 }}>
      <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Add roadmap item</h2>
      <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
        <label className="admin-label">
          Section
          <select className="admin-select" value={groupKey} onChange={(e) => setGroupKey(e.target.value)}>
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.step_label ? `${g.step_label} · ` : ""}{g.title}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-label">
          Title
          <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="admin-label">
          What we&apos;d build (optional)
          <textarea className="admin-input" rows={3} value={buildDesc} onChange={(e) => setBuildDesc(e.target.value)} />
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={submit}>
            {busy ? "Adding…" : "Add item"}
          </button>
          <button type="button" className="admin-btn" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
        {error && <div className="admin-alert admin-alert--err">{error}</div>}
      </div>
    </section>
  );
}
