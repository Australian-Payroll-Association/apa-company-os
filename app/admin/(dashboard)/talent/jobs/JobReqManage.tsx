"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { formatDate, humanize } from "@/lib/admin/format";
import { closeJobReq, deleteJobReq, reopenJobReq, updateJobReq } from "./actions";

export type JobReqManageData = {
  id: string;
  title: string;
  companyName: string | null;
  status: string | null;
  employmentType: string;
  location: string | null;
  remotePolicy: string | null;
  salaryMinCents: number | null;
  salaryMaxCents: number | null;
  currency: string;
  openedAt: string | null;
  closedAt: string | null;
  description: string | null;
  isPublic: boolean;
  slug: string | null;
  applicationCount: number;
};

const EMPLOYMENT_OPTIONS = [
  ["full_time", "Full-time"],
  ["part_time", "Part-time"],
  ["contract", "Contract"],
  ["intern", "Internship"],
  ["temp", "Temporary"],
  ["advisor", "Advisor"],
] as const;

const REMOTE_OPTIONS = [
  ["", "Not set"],
  ["onsite", "Onsite"],
  ["hybrid", "Hybrid"],
  ["remote", "Remote"],
] as const;

const CLOSE_OUTCOMES = [
  ["filled", "Filled — we hired"],
  ["closed", "Closed — no hire"],
  ["cancelled", "Cancelled"],
] as const;

const CURRENCIES = ["usd", "eur", "gbp", "aud", "sgd", "vnd"];

// Manage surface for one job req, rendered in the list row's side shelf:
// every field visible, edit in place, close/reopen with an outcome, delete
// when the req has no applications. The full page (hiring board + public
// posting editor) stays a click away.
export function JobReqManage({ req }: { req: JobReqManageData }) {
  const router = useRouter();
  const isOpen = req.status === "open";
  const live = req.isPublic && isOpen;

  const [title, setTitle] = useState(req.title);
  const [employmentType, setEmploymentType] = useState(req.employmentType);
  const [location, setLocation] = useState(req.location ?? "");
  const [remotePolicy, setRemotePolicy] = useState(req.remotePolicy ?? "");
  const [salaryMin, setSalaryMin] = useState(req.salaryMinCents != null ? String(req.salaryMinCents / 100) : "");
  const [salaryMax, setSalaryMax] = useState(req.salaryMaxCents != null ? String(req.salaryMaxCents / 100) : "");
  const [currency, setCurrency] = useState(req.currency.toLowerCase());
  const [description, setDescription] = useState(req.description ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [closing, setClosing] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [busy, setBusy] = useState(false);

  const currencyOptions = CURRENCIES.includes(currency) ? CURRENCIES : [currency, ...CURRENCIES];

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await updateJobReq(req.id, {
      title,
      employment_type: employmentType,
      location: location || null,
      remote_policy: remotePolicy || null,
      salary_min: salaryMin.trim() === "" ? null : Number(salaryMin),
      salary_max: salaryMax.trim() === "" ? null : Number(salaryMax),
      currency,
      description: description || null,
    });
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function close() {
    if (!outcome) return;
    setBusy(true);
    setMsg(null);
    const r = await closeJobReq(req.id, outcome);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setClosing(false);
    setMsg({ ok: true, text: `Req marked ${outcome}.` });
    router.refresh();
  }

  async function reopen() {
    setBusy(true);
    setMsg(null);
    const r = await reopenJobReq(req.id);
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Req reopened." });
    router.refresh();
  }

  return (
    <>
      <dl className="admin-kv" style={{ marginBottom: 16 }}>
        <dt>Status</dt>
        <dd>
          {req.status && <Badge tone={statusTone(req.status)}>{humanize(req.status)}</Badge>}{" "}
          {live && <Badge tone="ok">Live on /careers</Badge>}
        </dd>
        <dt>Company</dt>
        <dd>{req.companyName || "—"}</dd>
        <dt>Applicants</dt>
        <dd>
          {req.applicationCount === 0 ? (
            "None yet"
          ) : (
            <Link href={`/admin/talent/jobs/${req.id}`} className="admin-cell-strong">
              {req.applicationCount} — open hiring board
            </Link>
          )}
        </dd>
        <dt>Opened</dt>
        <dd>{req.openedAt ? formatDate(req.openedAt) : "—"}</dd>
        {req.closedAt && (
          <>
            <dt>Closed</dt>
            <dd>{formatDate(req.closedAt)}</dd>
          </>
        )}
        {req.slug && (
          <>
            <dt>Public URL</dt>
            <dd>
              {live ? (
                <a href={`https://www.edge8.ai/careers/${req.slug}/apply`} target="_blank" rel="noreferrer">
                  /careers/{req.slug} ↗
                </a>
              ) : (
                <span className="admin-cell-muted">/careers/{req.slug} (not live)</span>
              )}
            </dd>
          </>
        )}
      </dl>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {msg && <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>}

        <div className="admin-field">
          <label className="admin-label">Title</label>
          <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Type</label>
            <select className="admin-select" value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}>
              {EMPLOYMENT_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label">Remote policy</label>
            <select className="admin-select" value={remotePolicy} onChange={(e) => setRemotePolicy(e.target.value)}>
              {REMOTE_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Location</label>
          <input className="admin-input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 90px", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Salary min</label>
            <input className="admin-input" type="number" min="0" step="0.01" inputMode="decimal" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Salary max</label>
            <input className="admin-input" type="number" min="0" step="0.01" inputMode="decimal" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Currency</label>
            <select className="admin-select" value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {currencyOptions.map((c) => (
                <option key={c} value={c}>
                  {c.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Internal description</label>
          <textarea className="admin-input" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/admin/talent/jobs/${req.id}`} className="admin-btn">
          Hiring board & posting
        </Link>
        {isOpen && !closing && (
          <button type="button" className="admin-btn" onClick={() => { setClosing(true); setOutcome(""); }}>
            Close…
          </button>
        )}
        {!isOpen && (
          <button type="button" className="admin-btn" onClick={reopen} disabled={busy}>
            {busy ? "Reopening…" : "Reopen"}
          </button>
        )}
      </div>

      {closing && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          <select className="admin-select" aria-label="Close outcome" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
            <option value="">How did this req end?</option>
            {CLOSE_OUTCOMES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="admin-btn admin-btn--primary" disabled={!outcome || busy} onClick={close}>
              {busy ? "Closing…" : "Close req"}
            </button>
            <button type="button" className="admin-btn" onClick={() => setClosing(false)}>
              Cancel
            </button>
          </div>
          <div className="admin-hint">Closing takes the role off /careers. Applications and history are kept.</div>
        </div>
      )}

      <div className="admin-danger-zone" style={{ marginTop: 18 }}>
        <div className="admin-danger-zone-title">Danger zone</div>
        <div className="admin-danger-row">
          <span className="admin-danger-row-text">
            {req.applicationCount > 0
              ? `Delete is blocked while ${req.applicationCount} application${req.applicationCount === 1 ? "" : "s"} reference this req — close it instead.`
              : "Permanently delete this req and its pipeline stages. Cannot be undone."}
          </span>
          <ConfirmButton
            label="Delete permanently"
            title="Permanently delete this job req?"
            body={
              <>
                This deletes <strong>{req.title || "this req"}</strong> and its pipeline stages. This cannot be undone.
              </>
            }
            confirmLabel="Delete permanently"
            onConfirm={() => deleteJobReq(req.id)}
            onDone={() => router.refresh()}
          />
        </div>
      </div>
    </>
  );
}
