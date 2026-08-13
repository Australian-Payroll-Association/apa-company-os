"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CHECK_CONDITIONS } from "@/lib/admin/equipment-check";
import { submitEquipmentCheck } from "./actions";

// One machine, four quick answers. Kept short on purpose: a check people can
// finish in ten seconds is a check people actually finish.
export function EquipmentCheckForm({
  equipmentId,
  assetTag,
  name,
}: {
  equipmentId: string;
  assetTag: string;
  name: string;
}) {
  const router = useRouter();
  const [condition, setCondition] = useState<string>("good");
  const [holdingBack, setHoldingBack] = useState(false);
  const [needsUpgrade, setNeedsUpgrade] = useState(false);
  const [issues, setIssues] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await submitEquipmentCheck({ equipmentId, condition, holdingBack, needsUpgrade, issues });
    setBusy(false);
    if (r.ok) {
      router.refresh();
    } else {
      setError(r.error);
    }
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="team-eq-check-head">
        <strong>{name}</strong>
        <span className="team-eq-tag">{assetTag}</span>
      </div>
      {error && <div className="admin-alert admin-alert--err">{error}</div>}

      <div className="admin-field">
        <label className="admin-label">How is it doing?</label>
        <select className="admin-select" value={condition} onChange={(e) => setCondition(e.target.value)}>
          {CHECK_CONDITIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <label className="team-eq-check-row">
        <input type="checkbox" checked={holdingBack} onChange={(e) => setHoldingBack(e.target.checked)} />
        <span>It&apos;s too slow and holds me back at work</span>
      </label>
      <label className="team-eq-check-row">
        <input type="checkbox" checked={needsUpgrade} onChange={(e) => setNeedsUpgrade(e.target.checked)} />
        <span>I think it needs an upgrade or replacement</span>
      </label>

      <div className="admin-field">
        <label className="admin-label">Anything specific? (optional)</label>
        <textarea
          className="admin-input"
          rows={2}
          value={issues}
          placeholder="Runs out of memory with a couple of containers open."
          onChange={(e) => setIssues(e.target.value)}
        />
      </div>

      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={busy}>
          {busy ? "Saving…" : "Submit check"}
        </button>
      </div>
    </form>
  );
}
