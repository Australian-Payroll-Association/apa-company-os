"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { HIRE_POSITIONS, HIRE_TECH_STACK, HIRE_TERMS, findBracket } from "@/lib/portal/hire-catalog";
import { submitHireRequest } from "../actions";

const usd = (n: number) => `$${n.toLocaleString()}`;

export function HireEstimatorForm({ companies }: { companies: { id: string; name: string }[] }) {
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [positionId, setPositionId] = useState(HIRE_POSITIONS[0].id);
  const [bracketId, setBracketId] = useState(HIRE_POSITIONS[0].brackets[0].id);
  const [techStack, setTechStack] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const position = HIRE_POSITIONS.find((p) => p.id === positionId)!;
  const found = useMemo(() => findBracket(positionId, bracketId), [positionId, bracketId]);
  const annualEstimate = found ? Math.round((found.bracket.minUsd + found.bracket.maxUsd) / 2) * 12 : null;

  function pickPosition(id: string) {
    setPositionId(id as typeof positionId);
    const next = HIRE_POSITIONS.find((p) => p.id === id);
    if (next && !next.brackets.some((b) => b.id === bracketId)) setBracketId(next.brackets[0].id);
  }

  function toggleTech(t: string) {
    setTechStack((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const r = await submitHireRequest({ companyId, positionId, bracketId, techStack });
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="admin-card admin-section-card">
        <div className="admin-alert admin-alert--ok" style={{ marginBottom: 12 }}>
          Request received — the Edge8 team will follow up with next steps.
        </div>
        <Link href="/portal/requests" className="admin-btn admin-btn--primary">
          Back to requests
        </Link>
      </div>
    );
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      {companies.length > 1 && (
        <label className="admin-field">
          <span>Company</span>
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} required>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="admin-field">
        <span>Position</span>
        <div className="admin-viewtoggle">
          {HIRE_POSITIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={p.id === positionId ? "is-active" : ""}
              onClick={() => pickPosition(p.id)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="admin-field">
        <span>Experience</span>
        <div className="admin-viewtoggle">
          {position.brackets.map((b) => (
            <button
              key={b.id}
              type="button"
              className={b.id === bracketId ? "is-active" : ""}
              onClick={() => setBracketId(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {found && (
        <div className="admin-alert admin-alert--ok" style={{ margin: 0 }}>
          {usd(found.bracket.minUsd)}–{usd(found.bracket.maxUsd)}/month · est. budget{" "}
          <strong>{usd(annualEstimate!)}/year</strong>
        </div>
      )}

      <div className="admin-field">
        <span>What&rsquo;s your tech stack?</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
          {HIRE_TECH_STACK.map((t) => (
            <label key={t} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={techStack.includes(t)} onChange={() => toggleTech(t)} />
              {t}
            </label>
          ))}
        </div>
      </div>

      <div className="admin-card admin-section-card" style={{ background: "var(--admin-bg)" }}>
        <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Terms</h2>
        <ul style={{ margin: 0, paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
          {HIRE_TERMS.map((t) => (
            <li key={t} style={{ fontSize: 13.5, color: "var(--admin-muted)" }}>
              {t}
            </li>
          ))}
        </ul>
      </div>

      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
          {saving ? "Submitting…" : "Submit request"}
        </button>
      </div>
    </form>
  );
}
