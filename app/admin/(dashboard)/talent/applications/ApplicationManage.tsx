"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate, humanize } from "@/lib/admin/format";
import { useAutosave } from "@/components/admin/useAutosave";
import { AutosaveIndicator } from "@/components/admin/AutosaveStatus";
import {
  addApplicationNote,
  getApplicationExtras,
  getApplicationNotes,
  getApplicationStages,
  updateApplicantProfile,
  updateApplication,
  uploadApplicationResume,
  type AppNote,
  type ApplicationExtras,
  type StageOption,
} from "./actions";

export type AppManageData = {
  id: string;
  jobReqId: string | null;
  personId: string | null;
  jobReqTitle: string | null;
  candidateName: string | null;
  status: string | null;
  rating: number | null;
  rejectionReason: string | null;
  currentStageId: string | null;
  currentStageName: string | null;
  appliedAt: string | null;
  decidedAt: string | null;
  resumeDocumentId: string | null;
  // person-side profile (edits write to people)
  email: string | null;
  phone: string | null;
  headline: string | null;
  currentTitle: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  doNotHire: boolean;
};

const STATUS_OPTIONS = [
  ["active", "Active"],
  ["on_hold", "On hold"],
  ["passive", "Passive"],
  ["withdrawn", "Withdrawn"],
  ["hired", "Hired"],
  ["rejected", "Rejected"],
  ["future_consideration", "Future consideration"],
] as const;

// Editable "manage" surface for one application, rendered inside the row's side
// shelf (DetailDrawer). Two save scopes: application fields write applications;
// the applicant profile writes people. Notes post individually to the thread.
type AppFieldForm = {
  stageId: string;
  status: string;
  rating: number | null;
  rejectionReason: string;
};

export function ApplicationManage({ app }: { app: AppManageData }) {
  const router = useRouter();

  const [stages, setStages] = useState<StageOption[]>([]);
  const [stagesLoading, setStagesLoading] = useState(true);
  const [extras, setExtras] = useState<ApplicationExtras | null>(null);

  const { form, field, commit, status: saveStatus } = useAutosave<AppFieldForm>(
    {
      stageId: app.currentStageId ?? "",
      status: app.status ?? "active",
      rating: app.rating ?? null,
      rejectionReason: app.rejectionReason ?? "",
    },
    saveAppField,
  );
  const { stageId, status, rating, rejectionReason } = form;

  // Load this req's hiring stages when the shelf opens.
  useEffect(() => {
    if (!app.jobReqId) {
      setStagesLoading(false);
      return;
    }
    let live = true;
    setStagesLoading(true);
    getApplicationStages(app.jobReqId).then((r) => {
      if (!live) return;
      if (r.ok) setStages(r.stages);
      setStagesLoading(false);
    });
    return () => {
      live = false;
    };
  }, [app.jobReqId]);

  // Cover letter + answers are large columns kept out of the list payload; load
  // them when the shelf opens (or switches to another application).
  useEffect(() => {
    let live = true;
    setExtras(null);
    getApplicationExtras(app.id).then((r) => {
      if (!live) return;
      if (r.ok) setExtras(r.extras);
    });
    return () => {
      live = false;
    };
  }, [app.id]);

  const showRejectionReason = status === "rejected" || rejectionReason.trim() !== "";

  async function saveAppField(patch: Partial<AppFieldForm>) {
    const [key, value] = Object.entries(patch)[0] as [keyof AppFieldForm, string | number | null];
    let r;
    switch (key) {
      case "stageId":
        r = await updateApplication(app.id, { current_stage_id: (value as string) || null });
        break;
      case "status":
        r = await updateApplication(app.id, { status: value as string });
        break;
      case "rating":
        r = await updateApplication(app.id, { rating: value as number | null });
        break;
      case "rejectionReason":
        r = await updateApplication(app.id, { rejection_reason: (value as string).trim() || null });
        break;
      default:
        return { ok: true as const };
    }
    if (r.ok) router.refresh();
    return r;
  }

  return (
    <>
      <dl className="admin-kv" style={{ marginBottom: 16 }}>
        <dt>Job req</dt>
        <dd>{app.jobReqTitle || "—"}</dd>
        <dt>Applied</dt>
        <dd>{app.appliedAt ? formatDate(app.appliedAt) : "—"}</dd>
        {app.decidedAt && (
          <>
            <dt>Decided</dt>
            <dd>{formatDate(app.decidedAt)}</dd>
          </>
        )}
        <dt>Resume</dt>
        <dd>
          <ResumeField applicationId={app.id} resumeDocumentId={app.resumeDocumentId} />
        </dd>
      </dl>

      <div className="admin-form">
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12.5 }}>
          <AutosaveIndicator status={saveStatus} />
        </div>

        <div className="admin-field">
          <label className="admin-label">Stage</label>
          {app.jobReqId ? (
            <select
              className="admin-select"
              aria-label="Hiring stage"
              value={stageId}
              disabled={stagesLoading}
              onChange={(e) => {
                field("stageId", e.target.value);
                commit("stageId", e.target.value);
              }}
            >
              {stagesLoading && <option value={stageId}>{app.currentStageName || "Loading…"}</option>}
              {!stagesLoading && <option value="">No stage</option>}
              {!stagesLoading &&
                stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isTerminal ? " (final)" : ""}
                  </option>
                ))}
            </select>
          ) : (
            <div className="admin-hint">No job req linked, so there is no stage to set.</div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Status</label>
            <select
              className="admin-select"
              value={status}
              onChange={(e) => {
                field("status", e.target.value);
                commit("status", e.target.value);
              }}
            >
              {STATUS_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label">Rating</label>
            <StarRating
              value={rating}
              onChange={(v) => {
                field("rating", v);
                commit("rating", v);
              }}
            />
          </div>
        </div>

        {showRejectionReason && (
          <div className="admin-field">
            <label className="admin-label">Rejection reason</label>
            <input
              className="admin-input"
              placeholder="Why was this candidate rejected?"
              value={rejectionReason}
              onChange={(e) => field("rejectionReason", e.target.value)}
              onBlur={(e) => commit("rejectionReason", e.target.value)}
            />
          </div>
        )}

        {saveStatus.state === "error" && <div className="admin-alert admin-alert--err">{saveStatus.error}</div>}
      </div>

      {extras && (extras.coverLetter || extras.answers.length > 0) && (
        <div style={{ marginTop: 18 }}>
          {extras.coverLetter && (
            <div style={{ marginBottom: 12 }}>
              <div className="admin-label" style={{ marginBottom: 6 }}>
                Cover letter
              </div>
              <div style={{ whiteSpace: "pre-wrap", borderLeft: "2px solid var(--admin-line-strong)", paddingLeft: 10 }}>
                {extras.coverLetter}
              </div>
            </div>
          )}
          {extras.answers.map((x, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <div className="admin-label" style={{ marginBottom: 6 }}>
                {x.q}
              </div>
              <div style={{ whiteSpace: "pre-wrap", borderLeft: "2px solid var(--admin-line-strong)", paddingLeft: 10 }}>
                {x.a || "—"}
              </div>
            </div>
          ))}
        </div>
      )}

      {app.personId && (
        <ApplicantProfile
          personId={app.personId}
          name={app.candidateName}
          email={app.email}
          phone={app.phone}
          headline={app.headline}
          currentTitle={app.currentTitle}
          linkedinUrl={app.linkedinUrl}
          portfolioUrl={app.portfolioUrl}
          doNotHire={app.doNotHire}
        />
      )}

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        {app.personId && (
          <Link href={`/admin/contacts/${app.personId}`} className="admin-btn">
            Open contact
          </Link>
        )}
        {app.jobReqId && (
          <Link href={`/admin/talent/jobs/${app.jobReqId}`} className="admin-btn">
            Open job req
          </Link>
        )}
      </div>

      <ApplicationNotes applicationId={app.id} />
    </>
  );
}

// View the current resume (signed-URL route) and upload a replacement.
function ResumeField({
  applicationId,
  resumeDocumentId,
}: {
  applicationId: string;
  resumeDocumentId: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [docId, setDocId] = useState(resumeDocumentId);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.append("resume", file);
    const r = await uploadApplicationResume(applicationId, fd);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
    if (!r.ok) return setErr(r.error);
    setDocId(r.documentId);
    router.refresh();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {docId ? (
        <a href={`/admin/talent/resume/${docId}`} target="_blank" rel="noreferrer" className="admin-cell-strong">
          Open ↗
        </a>
      ) : (
        <span className="admin-cell-muted">none</span>
      )}
      <button
        type="button"
        className="admin-btn admin-btn--sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? "Uploading…" : docId ? "Replace" : "Upload"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        style={{ display: "none" }}
        onChange={onFile}
      />
      {err && <span style={{ color: "var(--admin-err-ink)" }}>{err}</span>}
    </span>
  );
}

// The applicant as a person: identity + professional profile. Identity fields
// (phone, LinkedIn) write to people (shared with the CRM); recruiting fields
// write to the candidate_profile satellite — never to the application.
// do_not_hire is the recruiting flag — separate from the do_not_contact
// consent opt-out, which is managed from Contact 360, not here.
type ApplicantFieldForm = {
  phone: string;
  headline: string;
  currentTitle: string;
  linkedinUrl: string;
  portfolioUrl: string;
  doNotHire: boolean;
};

function ApplicantProfile(props: {
  personId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  headline: string | null;
  currentTitle: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  doNotHire: boolean;
}) {
  const { form, field, commit, status } = useAutosave<ApplicantFieldForm>(
    {
      phone: props.phone ?? "",
      headline: props.headline ?? "",
      currentTitle: props.currentTitle ?? "",
      linkedinUrl: props.linkedinUrl ?? "",
      portfolioUrl: props.portfolioUrl ?? "",
      doNotHire: props.doNotHire,
    },
    saveProfileField,
  );
  const { phone, headline, currentTitle, linkedinUrl, portfolioUrl, doNotHire } = form;

  async function saveProfileField(patch: Partial<ApplicantFieldForm>) {
    const [key, value] = Object.entries(patch)[0] as [keyof ApplicantFieldForm, string | boolean];
    switch (key) {
      case "phone":
        return updateApplicantProfile(props.personId, { phone: (value as string).trim() || null });
      case "headline":
        return updateApplicantProfile(props.personId, { headline: (value as string).trim() || null });
      case "currentTitle":
        return updateApplicantProfile(props.personId, { current_title: (value as string).trim() || null });
      case "linkedinUrl":
        return updateApplicantProfile(props.personId, { linkedin_url: (value as string).trim() || null });
      case "portfolioUrl":
        return updateApplicantProfile(props.personId, { portfolio_url: (value as string).trim() || null });
      case "doNotHire":
        return updateApplicantProfile(props.personId, { do_not_hire: value as boolean });
      default:
        return { ok: true as const };
    }
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div className="admin-label" style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span>Applicant — {props.name || props.email || "person"}</span>
        <AutosaveIndicator status={status} />
      </div>
      <div className="admin-form">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Headline</label>
            <input
              className="admin-input"
              value={headline}
              onChange={(e) => field("headline", e.target.value)}
              onBlur={(e) => commit("headline", e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Current title</label>
            <input
              className="admin-input"
              value={currentTitle}
              onChange={(e) => field("currentTitle", e.target.value)}
              onBlur={(e) => commit("currentTitle", e.target.value)}
            />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Phone</label>
            <input
              className="admin-input"
              type="tel"
              value={phone}
              onChange={(e) => field("phone", e.target.value)}
              onBlur={(e) => commit("phone", e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">LinkedIn</label>
            <input
              className="admin-input"
              type="url"
              placeholder="https://linkedin.com/in/…"
              value={linkedinUrl}
              onChange={(e) => field("linkedinUrl", e.target.value)}
              onBlur={(e) => commit("linkedinUrl", e.target.value)}
            />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Portfolio</label>
          <input
            className="admin-input"
            type="url"
            placeholder="https://…"
            value={portfolioUrl}
            onChange={(e) => field("portfolioUrl", e.target.value)}
            onBlur={(e) => commit("portfolioUrl", e.target.value)}
          />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={doNotHire}
            onChange={(e) => {
              field("doNotHire", e.target.checked);
              commit("doNotHire", e.target.checked);
            }}
          />
          <span>
            Do not hire <span className="admin-cell-muted">(we would not consider this person again)</span>
          </span>
        </label>

        {status.state === "error" && <div className="admin-alert admin-alert--err">{status.error}</div>}
      </div>
    </div>
  );
}

// 1–5 stars. Clicking the current rating again clears it back to none.
function StarRating({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, height: 34 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          aria-pressed={value != null && n <= value}
          onClick={() => onChange(value === n ? null : n)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontSize: 20,
            lineHeight: 1,
            color: value != null && n <= value ? "var(--admin-accent)" : "var(--admin-line-strong)",
          }}
        >
          {value != null && n <= value ? "★" : "☆"}
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          style={{ marginLeft: 4 }}
          onClick={() => onChange(null)}
        >
          Clear
        </button>
      )}
    </div>
  );
}

// The application's note thread. Free-text entries append to the shared activity
// log (interactions), newest first. Mirrors the deal communications component.
function ApplicationNotes({ applicationId }: { applicationId: string }) {
  const [items, setItems] = useState<AppNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadErr(null);
    getApplicationNotes(applicationId).then((r) => {
      if (!live) return;
      if (r.ok) setItems(r.items);
      else setLoadErr(r.error);
      setLoading(false);
    });
    return () => {
      live = false;
    };
  }, [applicationId]);

  async function add() {
    const text = body.trim();
    if (!text) return;
    setSaving(true);
    setSaveErr(null);
    const r = await addApplicationNote(applicationId, text);
    setSaving(false);
    if (!r.ok) return setSaveErr(r.error);
    setItems((cur) => [r.item, ...cur]);
    setBody("");
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div className="admin-label" style={{ marginBottom: 6 }}>
        Notes
      </div>

      <div className="admin-field">
        <textarea
          className="admin-input"
          rows={3}
          placeholder="Add a note about this application…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <div className="admin-form-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="admin-btn admin-btn--primary admin-btn--sm"
          onClick={add}
          disabled={saving || !body.trim()}
        >
          {saving ? "Adding…" : "Add note"}
        </button>
      </div>
      {saveErr && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>
          {saveErr}
        </div>
      )}

      {loading ? (
        <div className="admin-hint">Loading…</div>
      ) : loadErr ? (
        <div className="admin-alert admin-alert--err">{loadErr}</div>
      ) : items.length === 0 ? (
        <div className="admin-empty">No notes yet.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((n) => (
            <li key={n.id} style={{ borderLeft: "2px solid var(--admin-line-strong)", paddingLeft: 10 }}>
              <div className="admin-cell-muted" style={{ marginBottom: 2 }}>
                {humanize(n.kind)} · {formatDate(n.occurredAt)}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{n.body || "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
