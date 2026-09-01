"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openEdition } from "./actions";

// Opening an edition is a deliberate act, not something a cron does. Deadline
// is optional: it is shown to contributors, and an edition with no deadline
// simply stays open until someone closes it.

export function NewEditionForm({ blocked }: { blocked: boolean }) {
  const router = useRouter();
  const now = new Date();
  const [month, setMonth] = useState(
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`,
  );
  const [deadline, setDeadline] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(null);
    const result = await openEdition({ month, deadline, title });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/revenue/marketing/newsletter/${result.id}`);
    router.refresh();
  }

  if (blocked) {
    return (
      <div className="admin-card" style={{ padding: "18px 22px" }}>
        <p className="admin-page-sub" style={{ margin: 0 }}>
          An edition is already open. Close its intake before opening the next one — contributors
          are shown a single open edition, so two would split the month&rsquo;s submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-card" style={{ padding: "20px 22px" }}>
      <h2 className="admin-card-title">Open an edition</h2>
      <p className="admin-page-sub" style={{ marginTop: 0 }}>
        Training and webinars in the month are pulled from the events calendar as soon as it opens.
      </p>
      <div className="admin-form" style={{ marginTop: 12 }}>
        <div className="admin-field">
          <label className="admin-label" htmlFor="ed-month">
            Month
          </label>
          <input
            id="ed-month"
            type="month"
            className="admin-input"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="ed-deadline">
            Submissions close <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span>
          </label>
          <input
            id="ed-deadline"
            type="date"
            className="admin-input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="ed-title">
            Title <span style={{ fontWeight: 400, opacity: 0.7 }}>(defaults to the month)</span>
          </label>
          <input
            id="ed-title"
            className="admin-input"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="September 2026"
          />
        </div>
        {error && <div className="admin-alert admin-alert--err">{error}</div>}
        <div className="admin-form-actions">
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={submit}
            disabled={saving}
          >
            {saving ? "Opening…" : "Open edition"}
          </button>
        </div>
      </div>
    </div>
  );
}
