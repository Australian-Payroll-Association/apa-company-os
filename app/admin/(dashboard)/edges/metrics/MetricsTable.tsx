"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { AGENTS, OFFICES, agentInitials, personInitials, type MetricRow } from "../edges-shared";
import { createMetric, saveManualReading, updateMetric } from "./actions";

export type MetricView = MetricRow & {
  kr_title: string | null;
  owner_name: string | null;
  latest_value: number | null;
  latest_week: string | null;
  previous_value: number | null;
  has_this_week: boolean;
};

export type TeamOption = { id: string; full_name: string };

function fmt(m: MetricView, v: number | null): string {
  if (v == null) return "—";
  if (m.name.toLowerCase().includes("mrr")) return `$${(v / 1000).toFixed(1)}k`;
  return `${v}`;
}

function delta(m: MetricView): { text: string; cls: string } {
  if (m.latest_value == null || m.previous_value == null) return { text: "·", cls: "" };
  const diff = m.latest_value - m.previous_value;
  if (diff === 0) return { text: "·", cls: "" };
  const better = m.direction === "up" ? diff > 0 : diff < 0;
  const arrow = diff > 0 ? "▲" : "▼";
  return { text: `${arrow} ${Math.abs(diff)}`, cls: better ? "admin-cell-strong" : "" };
}

// Owners are encoded "p:<person_id>" or "a:<agent>" in the filter and form.
function ownerKey(m: MetricView): string {
  if (m.owner_person_id) return `p:${m.owner_person_id}`;
  if (m.owner_agent) return `a:${m.owner_agent}`;
  return "";
}
function ownerLabel(m: MetricView): string {
  if (m.owner_person_id) return m.owner_name ?? "Unknown person";
  if (m.owner_agent) return `${m.owner_agent} agent`;
  return "—";
}

function OwnerCell({ m }: { m: MetricView }) {
  if (m.owner_agent && !m.owner_person_id) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span className="edges-av edges-av--bot" title={`${m.owner_agent} agent`}>
          {agentInitials(m.owner_agent)}
        </span>
        {m.owner_agent}
      </span>
    );
  }
  if (m.owner_person_id) {
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <span className="edges-av" title={m.owner_name ?? undefined}>
          {personInitials(m.owner_name ?? "?")}
        </span>
        {m.owner_name ?? "Unknown"}
      </span>
    );
  }
  return <span className="admin-cell-muted">—</span>;
}

export function MetricsTable({
  metrics,
  thisWeek,
  teamOptions,
}: {
  metrics: MetricView[];
  thisWeek: string;
  teamOptions: TeamOption[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<null | { metric?: MetricView }>(null);
  const [entry, setEntry] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ownerFilter, setOwnerFilter] = useState<string>("");

  const ownerChoices = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of metrics) {
      const key = ownerKey(m);
      if (key && !seen.has(key)) seen.set(key, ownerLabel(m));
    }
    return Array.from(seen.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [metrics]);

  const visible = ownerFilter ? metrics.filter((m) => ownerKey(m) === ownerFilter) : metrics;

  async function saveEntry(m: MetricView) {
    const raw = entry[m.id];
    if (raw === undefined || raw === "") return;
    setBusyId(m.id);
    const res = await saveManualReading(m.id, Number(raw));
    setBusyId(null);
    if (!res.ok) setErr(res.error);
    else {
      setErr(null);
      startTransition(() => router.refresh());
    }
  }

  return (
    <>
      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {err}
        </div>
      )}
      <div className="admin-toolbar" style={{ justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <label style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 12, fontWeight: 650 }}>
          Owner
          <select
            className="admin-select"
            style={{ width: "auto", minWidth: 180 }}
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
          >
            <option value="">All owners</option>
            {ownerChoices.map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          {ownerFilter && (
            <span className="admin-cell-muted" style={{ fontWeight: 550 }}>
              {visible.length} of {metrics.length}
            </span>
          )}
        </label>
        <button className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setDrawer({})}>
          + New metric
        </button>
      </div>
      <div className="admin-table-wrap">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Owner</th>
                <th>Office</th>
                <th>Feeds</th>
                <th>Target</th>
                <th>This week</th>
                <th>Δ week</th>
                <th>Direction</th>
                <th>Source</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="admin-empty">
                      {metrics.length === 0 ? "No metrics yet. Add the first one." : "No metrics for this owner."}
                    </div>
                  </td>
                </tr>
              )}
              {visible.map((m) => {
                const d = delta(m);
                return (
                  <tr key={m.id}>
                    <td className="admin-cell-strong">{m.name}</td>
                    <td>
                      <OwnerCell m={m} />
                    </td>
                    <td style={{ textTransform: "capitalize" }}>{m.office}</td>
                    <td className="admin-cell-muted" title={m.kr_title ?? undefined}>
                      {m.kr_title ? `${m.kr_title.slice(0, 28)}${m.kr_title.length > 28 ? "…" : ""}` : "—"}
                    </td>
                    <td className="admin-cell-mono">{m.target ?? "—"}</td>
                    <td className="admin-cell-mono admin-cell-strong">
                      {m.source === "manual" && !m.has_this_week ? (
                        <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                          <input
                            className="admin-input"
                            style={{ width: 84, padding: "3px 7px", fontSize: 12 }}
                            type="number"
                            step="any"
                            placeholder={m.latest_value != null ? String(m.latest_value) : "enter…"}
                            value={entry[m.id] ?? ""}
                            onChange={(e) => setEntry((s) => ({ ...s, [m.id]: e.target.value }))}
                          />
                          <button className="edges-minibtn" disabled={busyId === m.id} onClick={() => saveEntry(m)}>
                            {busyId === m.id ? "…" : "Save"}
                          </button>
                        </span>
                      ) : (
                        fmt(m, m.latest_value)
                      )}
                    </td>
                    <td className={`admin-cell-mono ${d.cls}`}>{d.text}</td>
                    <td className="admin-cell-muted">{m.direction === "down" ? "Down is good" : "Up is good"}</td>
                    <td>
                      <span className={`admin-badge ${m.source === "agent" ? "admin-badge--ok" : "admin-badge--warn"}`}>
                        {m.source === "agent" ? "AGENT" : "MANUAL"}
                      </span>
                    </td>
                    <td>
                      <button className="edges-minibtn" onClick={() => setDrawer({ metric: m })}>
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="admin-hint" style={{ marginTop: 10 }}>
        Week of {thisWeek}. Agent-sourced numbers are written by the Monday 06:00 collector; a manual box means no
        automatic source exists yet.
      </p>

      <DetailDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        eyebrow="Eight Edges"
        title={drawer?.metric ? "Edit metric" : "New metric"}
      >
        {drawer && (
          <MetricForm
            metric={drawer.metric}
            teamOptions={teamOptions}
            onDone={(res) => {
              if (res.ok) {
                setDrawer(null);
                startTransition(() => router.refresh());
              }
            }}
          />
        )}
      </DetailDrawer>
    </>
  );
}

function MetricForm({
  metric,
  teamOptions,
  onDone,
}: {
  metric?: MetricView;
  teamOptions: TeamOption[];
  onDone: (res: { ok: boolean; error?: string }) => void;
}) {
  const [name, setName] = useState(metric?.name ?? "");
  const [office, setOffice] = useState(metric?.office ?? OFFICES[0]);
  const [formula, setFormula] = useState(metric?.formula ?? "");
  const [target, setTarget] = useState(metric?.target != null ? String(metric.target) : "");
  const [direction, setDirection] = useState<"up" | "down">(metric?.direction ?? "up");
  const [source, setSource] = useState<"agent" | "manual">(metric?.source ?? "manual");
  const [detail, setDetail] = useState(metric?.source_detail ?? "");
  const [owner, setOwner] = useState<string>(
    metric?.owner_person_id ? `p:${metric.owner_person_id}` : metric?.owner_agent ? `a:${metric.owner_agent}` : "",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="admin-form">
      {err && <div className="admin-alert admin-alert--err">{err}</div>}
      <div className="admin-field">
        <label className="admin-label">Name</label>
        <input className="admin-input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="admin-field">
        <label className="admin-label">Owner (required: who answers for this number)</label>
        <select className="admin-select" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Pick an owner…</option>
          <optgroup label="Team">
            {teamOptions.map((p) => (
              <option key={p.id} value={`p:${p.id}`}>
                {p.full_name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Agents">
            {AGENTS.map((a) => (
              <option key={a} value={`a:${a}`}>
                {a} agent
              </option>
            ))}
          </optgroup>
        </select>
      </div>
      <div className="admin-field">
        <label className="admin-label">Formula (how it's calculated, in words)</label>
        <input className="admin-input" value={formula} onChange={(e) => setFormula(e.target.value)} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="admin-field">
          <label className="admin-label">Office</label>
          <select className="admin-select" value={office} onChange={(e) => setOffice(e.target.value)}>
            {OFFICES.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Target</label>
          <input className="admin-input" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Direction</label>
          <select className="admin-select" value={direction} onChange={(e) => setDirection(e.target.value as "up" | "down")}>
            <option value="up">up is good</option>
            <option value="down">down is good</option>
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="admin-field">
          <label className="admin-label">Source</label>
          <select className="admin-select" value={source} onChange={(e) => setSource(e.target.value as "agent" | "manual")}>
            <option value="manual">manual (typed weekly)</option>
            <option value="agent">agent (collected Monday 06:00)</option>
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Source detail</label>
          <input className="admin-input" value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="company_os.deals, site…" />
        </div>
      </div>
      <div className="admin-form-actions">
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const payload = {
              name,
              office,
              formula,
              target: target === "" ? null : Number(target),
              direction,
              source,
              source_detail: detail,
              owner_person_id: owner.startsWith("p:") ? owner.slice(2) : null,
              owner_agent: owner.startsWith("a:") ? owner.slice(2) : null,
            };
            const res = metric ? await updateMetric(metric.id, payload) : await createMetric(payload);
            setBusy(false);
            if (!res.ok) setErr(res.error ?? "Something went wrong.");
            else onDone(res);
          }}
        >
          {busy ? "Saving…" : metric ? "Save metric" : "Create metric"}
        </button>
      </div>
    </div>
  );
}
