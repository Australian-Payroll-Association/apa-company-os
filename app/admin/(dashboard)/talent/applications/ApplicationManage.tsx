"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/admin/format";
import { useAutosave } from "@/components/admin/useAutosave";
import { AutosaveIndicator } from "@/components/admin/AutosaveStatus";
import { PersonSelect } from "@/components/admin/PersonSelect";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/admin/application-status";
import { APPLICATION_SOURCE_OPTIONS, POOL_STATUS_OPTIONS } from "@/lib/admin/recruiting-options";
import { COUNTRIES } from "@/lib/admin/countries";
import type { PersonOption } from "@/lib/admin/people-options";
import { InterviewRounds } from "./InterviewRounds";
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
  // sourcing (writes applications)
  source: string | null;
  sourceDetail: string | null;
  referrerId: string | null;
  resumeDocumentId: string | null;
  // person-side profile (edits write to people)
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  headline: string | null;
  currentTitle: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  doNotHire: boolean;
  poolStatus: string | null;
  // recruiter's own assessment for this application (writes applications)
  hrAssessment: string | null;
  // recruiter overrides for the AI-extracted fields (write candidate_profile)
  englishProficiency: string | null;
  salaryExpectationCents: number | null;
  salaryExpectationCurrency: string | null;
  noticePeriod: string | null;
};

// Editable "manage" surface for one application, rendered inside the row's side
// shelf (DetailDrawer). Two save scopes: application fields write applications;
// the applicant profile writes people. Notes post individually to the thread.
type AppFieldForm = {
  stageId: string;
  status: string;
  rating: number | null;
  rejectionReason: string;
  hrAssessment: string;
  source: string;
  sourceDetail: string;
  referrerId: string;
  appliedAt: string;
  decidedAt: string;
};

// A stored timestamp -> the YYYY-MM-DD a <input type="date"> expects. The org
// operates in Vietnam, so read the instant as its Ho Chi Minh calendar day; a
// plain UTC slice shows the wrong day for timestamps near midnight. The fixed
// timezone also keeps SSR and client hydration in agreement.
const APP_TZ = "Asia/Ho_Chi_Minh";
const toDateInput = (v: string | null): string => {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return v.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

export function ApplicationManage({
  app,
  referrerOptions,
}: {
  app: AppManageData;
  referrerOptions: PersonOption[];
}) {
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
      hrAssessment: app.hrAssessment ?? "",
      source: app.source ?? "",
      sourceDetail: app.sourceDetail ?? "",
      referrerId: app.referrerId ?? "",
      appliedAt: toDateInput(app.appliedAt),
      decidedAt: toDateInput(app.decidedAt),
    },
    saveAppField,
  );
  const { stageId, status, rating, rejectionReason, hrAssessment, source, sourceDetail, referrerId, appliedAt, decidedAt } = form;

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
        // Moving onto a terminal stage auto-stamps decided_at server-side; mirror
        // that into the form so the Decided field reflects it without a reload.
        if (r.ok && r.decidedAt !== undefined) field("decidedAt", toDateInput(r.decidedAt));
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
      case "hrAssessment":
        r = await updateApplication(app.id, { hr_assessment: (value as string).trim() || null });
        break;
      case "source":
        r = await updateApplication(app.id, { source: (value as string) || null });
        break;
      case "sourceDetail":
        r = await updateApplication(app.id, { source_detail: (value as string).trim() || null });
        break;
      case "referrerId":
        r = await updateApplication(app.id, { referrer_person_id: (value as string) || null });
        break;
      case "appliedAt":
        r = await updateApplication(app.id, { applied_at: (value as string) || null });
        break;
      case "decidedAt":
        r = await updateApplication(app.id, { decided_at: (value as string) || null });
        break;
      default:
        return { ok: true as const };
    }
    if (r.ok) router.refresh();
    return r;
  }

  return (
    <>
      <dl className="admin-kv" style={{ marginBottom: 16, alignItems: "center", rowGap: 8 }}>
        <dt>Job req</dt>
        <dd>{app.jobReqTitle || "—"}</dd>
        <dt>Applied</dt>
        <dd>
          <input
            className="admin-input"
            type="date"
            aria-label="Applied date"
            value={appliedAt}
            style={{ maxWidth: 180 }}
            onChange={(e) => {
              field("appliedAt", e.target.value);
              commit("appliedAt", e.target.value);
            }}
          />
        </dd>
        <dt>Decided</dt>
        <dd>
          <input
            className="admin-input"
            type="date"
            aria-label="Decided date"
            value={decidedAt}
            style={{ maxWidth: 180 }}
            onChange={(e) => {
              field("decidedAt", e.target.value);
              commit("decidedAt", e.target.value);
            }}
          />
        </dd>
        <dt>Resume</dt>
        <dd>
          <ResumeField applicationId={app.id} resumeDocumentId={app.resumeDocumentId} />
        </dd>
      </dl>

      <div className="admin-form">
        <div style={{ display: "flex", justifyContent: "flex-end", fontSize: 12 }}>
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
              {APPLICATION_STATUS_OPTIONS.map(([v, l]) => (
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

        <div
          style={{
            marginTop: 4,
            paddingTop: 12,
            borderTop: "1px solid var(--admin-line)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="admin-field">
              <label className="admin-label">Source</label>
              <select
                className="admin-select"
                value={source}
                onChange={(e) => {
                  field("source", e.target.value);
                  commit("source", e.target.value);
                }}
              >
                <option value="">—</option>
                {APPLICATION_SOURCE_OPTIONS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
                {source && !APPLICATION_SOURCE_OPTIONS.some(([v]) => v === source) && (
                  <option value={source}>{source}</option>
                )}
              </select>
            </div>
            <div className="admin-field">
              <label className="admin-label">Referred by</label>
              <PersonSelect
                value={referrerId}
                onChange={(v) => {
                  field("referrerId", v);
                  commit("referrerId", v);
                }}
                options={referrerOptions.map((o) => ({ value: o.id, label: o.name }))}
                emptyLabel="No referrer"
                ariaLabel="Referred by"
              />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Source detail</label>
            <input
              className="admin-input"
              placeholder="Which job board, event, or who sourced them"
              value={sourceDetail}
              onChange={(e) => field("sourceDetail", e.target.value)}
              onBlur={(e) => commit("sourceDetail", e.target.value)}
            />
          </div>
        </div>

        {saveStatus.state === "error" && <div className="admin-alert admin-alert--err">{saveStatus.error}</div>}
      </div>

      {extras && <AiScreenSection extras={extras} />}

      <section style={{ marginTop: 18 }}>
        <div className="admin-label" style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
          <span>HR assessment</span>
          <AutosaveIndicator status={saveStatus} />
        </div>
        <div className="admin-hint" style={{ marginBottom: 6 }}>
          Your own read on this candidate, editable anytime. Separate from the AI screen and from interview results.
        </div>
        <textarea
          className="admin-input"
          rows={4}
          placeholder="Strengths, concerns, anything the interview surfaced that the resume missed…"
          value={hrAssessment}
          onChange={(e) => field("hrAssessment", e.target.value)}
          onBlur={(e) => commit("hrAssessment", e.target.value)}
        />
      </section>

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

      <InterviewRounds applicationId={app.id} />

      {app.personId && (
        <ApplicantProfile
          personId={app.personId}
          name={app.candidateName}
          email={app.email}
          phone={app.phone}
          city={app.city}
          country={app.country}
          headline={app.headline}
          currentTitle={app.currentTitle}
          linkedinUrl={app.linkedinUrl}
          portfolioUrl={app.portfolioUrl}
          doNotHire={app.doNotHire}
          poolStatus={app.poolStatus}
          englishProficiency={app.englishProficiency}
          salaryExpectationCents={app.salaryExpectationCents}
          salaryExpectationCurrency={app.salaryExpectationCurrency}
          noticePeriod={app.noticePeriod}
          aiEnglish={extras?.aiSummary?.english ?? null}
          aiSalary={extras?.aiSummary?.salary_expectation ?? null}
          aiNotice={extras?.aiSummary?.notice_period ?? null}
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

// The AI screen result: overview and skills/gaps, read-only. English, salary,
// and notice used to render here too, but they are now editable recruiter fields
// in the applicant profile (which fall back to the AI value). Rendered only once
// a screen has run — an application with no resume has nothing to show.
function AiScreenSection({ extras }: { extras: ApplicationExtras }) {
  if (!extras.aiStatus && !extras.aiSummary) return null;
  const s = extras.aiSummary;
  return (
    <div style={{ marginTop: 18 }}>
      <div className="admin-label" style={{ marginBottom: 6, display: "flex", justifyContent: "space-between" }}>
        <span>
          AI screen{extras.aiRating != null && <> — {extras.aiRating}/5</>}
        </span>
        {extras.aiScreenedAt && <span className="admin-cell-muted">{formatDate(extras.aiScreenedAt)}</span>}
      </div>
      {extras.aiStatus === "failed" && extras.aiError && (
        <div className="admin-alert admin-alert--err">Scan failed: {extras.aiError}</div>
      )}
      {extras.aiStatus === "pending" && <div className="admin-hint">Screen in progress…</div>}
      {s ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 14 }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{s.overview}</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            {s.skills.map((sk, j) => (
              <li key={j}>{sk}</li>
            ))}
          </ul>
        </div>
      ) : (
        extras.aiStatus !== "failed" &&
        extras.aiStatus !== "pending" && <div className="admin-hint">No screen result yet.</div>
      )}
    </div>
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
  email: string;
  phone: string;
  city: string;
  country: string;
  headline: string;
  currentTitle: string;
  linkedinUrl: string;
  portfolioUrl: string;
  doNotHire: boolean;
  poolStatus: string;
  englishProficiency: string;
  noticePeriod: string;
};

// A "from AI screen" fallback is only worth showing when the AI actually
// extracted something — its schema writes "Not stated"/"Unknown" when it didn't.
function aiHint(v: string | null): string | null {
  const t = (v ?? "").trim();
  if (!t) return null;
  const low = t.toLowerCase();
  if (["not stated", "unknown", "n/a", "na", "none", "—", "-"].includes(low)) return null;
  return t;
}

function ApplicantProfile(props: {
  personId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
  headline: string | null;
  currentTitle: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  doNotHire: boolean;
  poolStatus: string | null;
  englishProficiency: string | null;
  salaryExpectationCents: number | null;
  salaryExpectationCurrency: string | null;
  noticePeriod: string | null;
  aiEnglish: string | null;
  aiSalary: string | null;
  aiNotice: string | null;
}) {
  const { form, field, commit, status } = useAutosave<ApplicantFieldForm>(
    {
      email: props.email ?? "",
      phone: props.phone ?? "",
      city: props.city ?? "",
      country: props.country ?? "",
      headline: props.headline ?? "",
      currentTitle: props.currentTitle ?? "",
      linkedinUrl: props.linkedinUrl ?? "",
      portfolioUrl: props.portfolioUrl ?? "",
      doNotHire: props.doNotHire,
      poolStatus: props.poolStatus ?? "",
      englishProficiency: props.englishProficiency ?? "",
      noticePeriod: props.noticePeriod ?? "",
    },
    saveProfileField,
  );
  const {
    email,
    phone,
    city,
    country,
    headline,
    currentTitle,
    linkedinUrl,
    portfolioUrl,
    doNotHire,
    poolStatus,
    englishProficiency,
    noticePeriod,
  } = form;

  async function saveProfileField(patch: Partial<ApplicantFieldForm>) {
    const [key, value] = Object.entries(patch)[0] as [keyof ApplicantFieldForm, string | boolean];
    switch (key) {
      case "email":
        return updateApplicantProfile(props.personId, { email: (value as string).trim() || null });
      case "phone":
        return updateApplicantProfile(props.personId, { phone: (value as string).trim() || null });
      case "city":
        return updateApplicantProfile(props.personId, { city: (value as string).trim() || null });
      case "country":
        return updateApplicantProfile(props.personId, { country: (value as string).trim() || null });
      case "poolStatus":
        return updateApplicantProfile(props.personId, { pool_status: (value as string) || null });
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
      case "englishProficiency":
        return updateApplicantProfile(props.personId, { english_proficiency: (value as string).trim() || null });
      case "noticePeriod":
        return updateApplicantProfile(props.personId, { notice_period: (value as string).trim() || null });
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
        <div className="admin-field">
          <label className="admin-label">Email</label>
          <input
            className="admin-input"
            type="email"
            value={email}
            onChange={(e) => field("email", e.target.value)}
            onBlur={(e) => commit("email", e.target.value)}
          />
        </div>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">City</label>
            <input
              className="admin-input"
              value={city}
              onChange={(e) => field("city", e.target.value)}
              onBlur={(e) => commit("city", e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Country</label>
            <select
              className="admin-select"
              value={country}
              onChange={(e) => {
                field("country", e.target.value);
                commit("country", e.target.value);
              }}
            >
              <option value="">—</option>
              {country && !(COUNTRIES as readonly string[]).includes(country) && (
                <option value={country}>{country}</option>
              )}
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
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

        <div
          style={{
            marginTop: 4,
            paddingTop: 12,
            borderTop: "1px solid var(--admin-line)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div className="admin-hint">
            Recruiter-verified details. Overrides the AI screen; leave blank to keep showing the AI value.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="admin-field">
              <label className="admin-label">English proficiency</label>
              <input
                className="admin-input"
                value={englishProficiency}
                onChange={(e) => field("englishProficiency", e.target.value)}
                onBlur={(e) => commit("englishProficiency", e.target.value)}
              />
              {!englishProficiency.trim() && aiHint(props.aiEnglish) && (
                <div className="admin-hint" style={{ marginTop: 4 }}>
                  From AI screen: {aiHint(props.aiEnglish)}
                </div>
              )}
            </div>
            <div className="admin-field">
              <label className="admin-label">Notice period</label>
              <input
                className="admin-input"
                value={noticePeriod}
                onChange={(e) => field("noticePeriod", e.target.value)}
                onBlur={(e) => commit("noticePeriod", e.target.value)}
              />
              {!noticePeriod.trim() && aiHint(props.aiNotice) && (
                <div className="admin-hint" style={{ marginTop: 4 }}>
                  From AI screen: {aiHint(props.aiNotice)}
                </div>
              )}
            </div>
          </div>
          <SalaryField
            personId={props.personId}
            cents={props.salaryExpectationCents}
            currency={props.salaryExpectationCurrency}
            aiFallback={aiHint(props.aiSalary)}
          />
        </div>

        <div className="admin-field">
          <label className="admin-label">Pool status</label>
          <select
            className="admin-select"
            value={poolStatus}
            onChange={(e) => {
              field("poolStatus", e.target.value);
              commit("poolStatus", e.target.value);
            }}
          >
            <option value="">—</option>
            {POOL_STATUS_OPTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
            {poolStatus && !POOL_STATUS_OPTIONS.some(([v]) => v === poolStatus) && (
              <option value={poolStatus}>{poolStatus}</option>
            )}
          </select>
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

// Structured salary expectation: amount (major units) + currency, stored as
// minor units (cents) on candidate_profile. Saves on blur / currency change.
// Empty amount clears both back to null and the AI value shows through again.
const SALARY_CURRENCIES = ["VND", "USD", "EUR", "GBP", "AUD", "SGD"];

function SalaryField({
  personId,
  cents,
  currency,
  aiFallback,
}: {
  personId: string;
  cents: number | null;
  currency: string | null;
  aiFallback: string | null;
}) {
  const [amount, setAmount] = useState(cents != null ? String(Math.round(cents / 100)) : "");
  const [cur, setCur] = useState(currency || "VND");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(nextAmount: string, nextCur: string) {
    const cleaned = nextAmount.replace(/[,\s]/g, "").trim();
    const parsed = cleaned === "" ? null : Number(cleaned);
    if (parsed != null && (Number.isNaN(parsed) || parsed < 0)) {
      setErr("Enter a number.");
      return;
    }
    setSaving(true);
    setErr(null);
    const r = await updateApplicantProfile(personId, {
      salary_expectation_cents: parsed == null ? null : Math.round(parsed * 100),
      salary_expectation_currency: parsed == null ? null : nextCur,
    });
    setSaving(false);
    if (!r.ok) setErr(r.error);
  }

  return (
    <div className="admin-field">
      <label className="admin-label">Salary expectation</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="admin-input"
          inputMode="numeric"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={(e) => save(e.target.value, cur)}
          style={{ flex: 1 }}
        />
        <select
          className="admin-select"
          aria-label="Currency"
          value={cur}
          style={{ maxWidth: 96 }}
          onChange={(e) => {
            setCur(e.target.value);
            if (amount.trim()) save(amount, e.target.value);
          }}
        >
          {SALARY_CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {saving && <div className="admin-hint" style={{ marginTop: 4 }}>Saving…</div>}
      {err && (
        <div className="admin-alert admin-alert--err" style={{ marginTop: 4 }}>
          {err}
        </div>
      )}
      {!amount.trim() && aiFallback && (
        <div className="admin-hint" style={{ marginTop: 4 }}>
          From AI screen: {aiFallback}
        </div>
      )}
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

// Interview Results: an append-only feedback thread for this application. Each
// entry is attributed (author + date) and immutable, so several interviewers
// build a history no one overwrites. Stored in the shared interactions log.
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
        Interview results
      </div>

      <div className="admin-field">
        <textarea
          className="admin-input"
          rows={3}
          placeholder="Add interview feedback for this candidate…"
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
          {saving ? "Adding…" : "Add feedback"}
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
        <div className="admin-empty">No interview results yet.</div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map((n) => (
            <li key={n.id} style={{ borderLeft: "2px solid var(--admin-line-strong)", paddingLeft: 10 }}>
              <div className="admin-cell-muted" style={{ marginBottom: 2 }}>
                {n.author ? `${n.author} · ` : ""}
                {formatDate(n.occurredAt)}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{n.body || "—"}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
