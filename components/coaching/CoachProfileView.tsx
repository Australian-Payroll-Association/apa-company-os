"use client";

import { useState, useTransition } from "react";
import type {
  CoachProfileDetail,
  CoachingGoal,
  CoachingPriority,
  CommitmentStatus,
  EdgesLadder,
  EdgesOptions,
  GoalStatus,
  LadderInput,
  OceanDimensionKey,
  OneOnOne,
  RetentionRoot,
} from "@/lib/coaching/data";
import {
  COMMITMENT_STATUS_LABELS,
  GOAL_STATUS_LABELS,
  OCEAN_DIMENSIONS,
  OPEN_COMMITMENT_STATUSES,
  RETENTION_ROOT_LABELS,
} from "@/lib/coaching/data";
import {
  addCommitment,
  addGoal,
  addPriority,
  archiveMeeting,
  generatePrepAction,
  logOneOnOne,
  publishOcean,
  publishRecap,
  runTrendReport,
  saveOcean,
  saveOkrs,
  savePrivateProfile,
  saveSummaries,
  saveTranscript,
  scheduleOneOnOne,
  setCadence,
  setMinutesLink,
  setModeSplit,
  setRetentionRoot,
  summarizeAction,
  updateCommitmentStatus,
  updateGoal,
  updatePriority,
} from "@/app/team/(dashboard)/coaching/actions";

// The coach's working surface for one person. Server pre-renders every
// markdown field into `html`; edits round-trip raw markdown through the
// server actions above (each one re-asserts coach ownership server-side).

export type RenderedHtml = {
  meetings: Record<string, { prep: string | null; summary: string | null; shared: string | null }>;
  trends: Record<string, string | null>;
  okrs: string | null;
  privateProfile: string | null;
};

type ActionResult = { ok: true } | { ok: false; error: string };

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const STATUS_BADGE: Record<CommitmentStatus, string> = {
  open: "admin-badge--info",
  on_track: "admin-badge--ok",
  needs_attention: "admin-badge--warn",
  completed: "admin-badge--ok",
  dropped: "admin-badge--err",
  blocked: "admin-badge--err",
};

export function CoachProfileView({ detail, html }: { detail: CoachProfileDetail; html: RenderedHtml }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const run = (label: string, fn: () => Promise<ActionResult>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(`${label}: ${res.error}`);
    });
  };

  return (
    <div className="coach-profile">
      {error && <div className="admin-alert admin-alert--err">{error}</div>}
      {busy && <div className="admin-hint">Working… AI steps can take a minute.</div>}

      <GoalsCard detail={detail} run={run} busy={busy} />
      <PrioritiesCard detail={detail} run={run} busy={busy} />
      <CadenceCard detail={detail} run={run} busy={busy} />
      <CommitmentsCard detail={detail} run={run} busy={busy} />
      <MeetingsCard detail={detail} html={html} run={run} busy={busy} />
      <OceanCard detail={detail} run={run} busy={busy} />
      <TrendsCard detail={detail} html={html} run={run} busy={busy} />
      <NotesCard
        title="Private coaching notes"
        hint="How they're wired plus the retention read. Only you see this — it feeds the AI prep."
        initial={detail.privateProfileMarkdown ?? ""}
        rendered={html.privateProfile}
        onSave={(md) => run("Private notes", () => savePrivateProfile(detail.profileId, md))}
        busy={busy}
      />
      <NotesCard
        title="OKRs"
        hint="Shared with the team member on their coaching page."
        initial={detail.okrsMarkdown ?? ""}
        rendered={html.okrs}
        onSave={(md) => run("OKRs", () => saveOkrs(detail.profileId, md))}
        busy={busy}
      />
    </div>
  );
}

// ---- Edges ladder picker ----------------------------------------------------

function ladderValue(ladder: EdgesLadder | null): string {
  if (!ladder) return "";
  return `${ladder.kind}:${ladder.id}`;
}

function parseLadder(value: string): LadderInput {
  if (!value) return { kind: "none" };
  const [kind, id] = value.split(":");
  if ((kind === "objective" || kind === "key_result" || kind === "metric") && id) return { kind, id };
  return { kind: "none" };
}

function LadderSelect({
  edges,
  value,
  onChange,
  disabled,
}: {
  edges: EdgesOptions;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="admin-input"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Ladders to (Eight Edges)"
    >
      <option value="">No ladder</option>
      <optgroup label="Key results">
        {edges.keyResults.map((k) => (
          <option key={k.id} value={`key_result:${k.id}`}>
            {k.label}
          </option>
        ))}
      </optgroup>
      <optgroup label="Metrics (KPIs)">
        {edges.metrics.map((m) => (
          <option key={m.id} value={`metric:${m.id}`}>
            {m.label}
            {m.target != null ? ` (target ${m.target}${m.direction === "down" ? " ↓" : " ↑"})` : ""}
          </option>
        ))}
      </optgroup>
      <optgroup label="Objectives">
        {edges.objectives.map((o) => (
          <option key={o.id} value={`objective:${o.id}`}>
            {o.label}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

function LadderBadge({ ladder }: { ladder: EdgesLadder | null }) {
  if (!ladder) return <span className="admin-cell-muted">no ladder</span>;
  if (ladder.kind === "metric") {
    return (
      <span className="admin-cell-muted">
        ⇗ {ladder.label}
        {ladder.latestValue != null && ladder.target != null
          ? ` — latest ${ladder.latestValue} / target ${ladder.target}`
          : ladder.target != null
            ? ` — target ${ladder.target}`
            : ""}
      </span>
    );
  }
  return <span className="admin-cell-muted">⇗ {ladder.label}</span>;
}

// ---- FAST goals (quarterly, team-wide transparent) --------------------------

function GoalsCard({
  detail,
  run,
  busy,
}: {
  detail: CoachProfileDetail;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [ladder, setLadder] = useState("");
  const current = detail.goals.filter((g) => g.status === "active" || g.status === "draft");
  const past = detail.goals.filter((g) => g.status === "achieved" || g.status === "dropped");

  return (
    <section className="admin-card coach-section">
      <div className="admin-card-title">
        FAST goals <span className="admin-cell-muted">(Frequent · Ambitious · Specific · Transparent — visible to the whole team)</span>
      </div>

      {current.length === 0 && <div className="admin-empty">No goals yet. FAST starts with one.</div>}
      {current.map((g) => (
        <GoalRow key={g.id} g={g} detail={detail} run={run} busy={busy} />
      ))}

      <div className="coach-add-row">
        <input
          className="admin-input"
          placeholder="New quarterly goal…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <LadderSelect edges={detail.edges} value={ladder} onChange={setLadder} disabled={busy} />
        <button
          className="admin-btn"
          disabled={busy || !title.trim()}
          onClick={() => {
            run("Goal", () => addGoal(detail.profileId, title, "active", "2026-Q3", parseLadder(ladder)));
            setTitle("");
            setLadder("");
          }}
        >
          Add
        </button>
      </div>

      {past.length > 0 && (
        <details className="coach-closed">
          <summary>{past.length} past goal{past.length === 1 ? "" : "s"}</summary>
          {past.map((g) => (
            <div key={g.id} className="coach-commitment is-closed">
              <span className="admin-badge">{GOAL_STATUS_LABELS[g.status]}</span>
              <span>{g.title}</span>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function GoalRow({
  g,
  detail,
  run,
  busy,
}: {
  g: CoachingGoal;
  detail: CoachProfileDetail;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [ladder, setLadder] = useState(ladderValue(g.ladder));
  return (
    <div className="coach-commitment">
      <div className="coach-commitment-main">
        <span className={`admin-badge ${g.status === "active" ? "admin-badge--ok" : "admin-badge--warn"}`}>
          {GOAL_STATUS_LABELS[g.status]}
        </span>
        <span className="coach-commitment-title">{g.title}</span>
        <LadderBadge ladder={g.ladder} />
      </div>
      <div className="coach-commitment-controls">
        <select
          className="admin-input"
          value={g.status}
          disabled={busy}
          onChange={(e) =>
            run("Goal", () => updateGoal(detail.profileId, g.id, { status: e.target.value as GoalStatus }))
          }
        >
          {Object.entries(GOAL_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <LadderSelect
          edges={detail.edges}
          value={ladder}
          disabled={busy}
          onChange={(v) => {
            setLadder(v);
            run("Goal ladder", () => updateGoal(detail.profileId, g.id, { ladder: parseLadder(v) }));
          }}
        />
      </div>
    </div>
  );
}

// ---- priorities (standing 1-1 focus items) ----------------------------------

function PrioritiesCard({
  detail,
  run,
  busy,
}: {
  detail: CoachProfileDetail;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [detailMd, setDetailMd] = useState("");
  const active = detail.priorities.filter((p) => p.status === "active");
  const retired = detail.priorities.filter((p) => p.status === "retired");

  return (
    <section className="admin-card coach-section">
      <div className="admin-card-title">
        Priorities <span className="admin-cell-muted">(the standing focus items you review every 1-1)</span>
      </div>

      {active.length === 0 && <div className="admin-empty">No standing priorities.</div>}
      {active.map((p) => (
        <div key={p.id} className="coach-commitment">
          <div className="coach-commitment-main">
            <span className="coach-commitment-title">{p.title}</span>
            <LadderBadge ladder={p.ladder} />
          </div>
          {p.detailMarkdown && <div className="admin-cell-muted coach-priority-detail">{p.detailMarkdown}</div>}
          <div className="coach-commitment-controls">
            <button
              className="admin-btn admin-btn--sm"
              disabled={busy}
              onClick={() => run("Priority", () => updatePriority(detail.profileId, p.id, { status: "retired" }))}
            >
              Retire
            </button>
          </div>
        </div>
      ))}

      <div className="coach-add-row">
        <input
          className="admin-input"
          placeholder="New priority (e.g. P1 — Own AI Labs)…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="admin-input"
          placeholder="Detail (optional)…"
          value={detailMd}
          onChange={(e) => setDetailMd(e.target.value)}
        />
        <button
          className="admin-btn"
          disabled={busy || !title.trim()}
          onClick={() => {
            run("Priority", () => addPriority(detail.profileId, title, detailMd, { kind: "none" }));
            setTitle("");
            setDetailMd("");
          }}
        >
          Add
        </button>
      </div>

      {retired.length > 0 && (
        <details className="coach-closed">
          <summary>{retired.length} retired</summary>
          {retired.map((p) => (
            <div key={p.id} className="coach-commitment is-closed">
              <span>{p.title}</span>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

// ---- cadence + retention read -----------------------------------------------

function CadenceCard({
  detail,
  run,
  busy,
}: {
  detail: CoachProfileDetail;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [cadence, setCadenceDays] = useState(String(detail.cadenceDays));
  const [nextOn, setNextOn] = useState(detail.nextOneOnOneOn ?? "");

  return (
    <section className="admin-card coach-section">
      <div className="admin-card-title">Cadence &amp; retention read</div>
      <div className="coach-field-row">
        <div className="admin-field">
          <label className="admin-label" htmlFor="cadence-days">
            Cadence (days)
          </label>
          <input
            id="cadence-days"
            className="admin-input"
            type="number"
            min={7}
            max={90}
            value={cadence}
            onChange={(e) => setCadenceDays(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="next-on">
            Next 1-1
          </label>
          <input
            id="next-on"
            className="admin-input"
            type="date"
            value={nextOn}
            onChange={(e) => setNextOn(e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="retention-root">
            Loose engagement root (only you see this)
          </label>
          <select
            id="retention-root"
            className="admin-input"
            value={detail.retentionRoot ?? ""}
            disabled={busy}
            onChange={(e) =>
              run("Retention", () =>
                setRetentionRoot(detail.profileId, (e.target.value || null) as RetentionRoot | null),
              )
            }
          >
            <option value="">—</option>
            {Object.entries(RETENTION_ROOT_LABELS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="admin-form-actions">
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy}
          onClick={() => run("Cadence", () => setCadence(detail.profileId, Number(cadence), nextOn || null))}
        >
          Save cadence
        </button>
      </div>
    </section>
  );
}

// ---- OCEAN profile ----------------------------------------------------------

const OCEAN_LABELS: Record<OceanDimensionKey, string> = {
  openness: "Openness",
  conscientiousness: "Conscientiousness",
  extraversion: "Extraversion",
  agreeableness: "Agreeableness",
  neuroticism: "Neuroticism",
};

function OceanCard({
  detail,
  run,
  busy,
}: {
  detail: CoachProfileDetail;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const o = detail.ocean;
  const [editing, setEditing] = useState(false);
  const [dims, setDims] = useState<Record<OceanDimensionKey, { rating: string; evidence: string }>>(() => {
    const init = {} as Record<OceanDimensionKey, { rating: string; evidence: string }>;
    for (const k of OCEAN_DIMENSIONS)
      init[k] = { rating: o?.[k]?.rating ?? "", evidence: o?.[k]?.evidence ?? "" };
    return init;
  });
  const [snapshot, setSnapshot] = useState(o?.snapshotMarkdown ?? "");
  const [guidance, setGuidance] = useState(o?.guidanceMarkdown ?? "");
  const published = Boolean(o?.published);

  return (
    <section className="admin-card coach-section">
      <div className="coach-block-head">
        <div className="admin-card-title">OCEAN profile</div>
        <div className="coach-block-actions">
          <span className={`admin-badge ${published ? "admin-badge--ok" : "admin-badge--warn"}`}>
            {published ? "Published — they can read it" : "Draft — only you"}
          </span>
          <button className="admin-btn admin-btn--sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </button>
          {o && (
            <button
              className={`admin-btn admin-btn--sm ${published ? "" : "admin-btn--primary"}`}
              disabled={busy}
              onClick={() => run("OCEAN", () => publishOcean(detail.profileId, !published))}
            >
              {published ? "Unpublish" : "Publish to them"}
            </button>
          )}
        </div>
      </div>
      <div className="admin-hint">
        Ratings with behavioral evidence, a snapshot, and growth guidance written to them in second
        person. They see the full profile once published; discussion happens in the 1-1.
      </div>

      {editing ? (
        <div className="admin-form">
          {OCEAN_DIMENSIONS.map((k) => (
            <div key={k} className="coach-field-row coach-ocean-row">
              <div className="admin-field coach-ocean-rating">
                <label className="admin-label">{OCEAN_LABELS[k]}</label>
                <input
                  className="admin-input"
                  placeholder="High / Medium / Low / TBD…"
                  value={dims[k].rating}
                  onChange={(e) => setDims({ ...dims, [k]: { ...dims[k], rating: e.target.value } })}
                />
              </div>
              <div className="admin-field coach-ocean-evidence">
                <label className="admin-label">Behavioral evidence</label>
                <textarea
                  className="admin-input"
                  rows={2}
                  value={dims[k].evidence}
                  onChange={(e) => setDims({ ...dims, [k]: { ...dims[k], evidence: e.target.value } })}
                />
              </div>
            </div>
          ))}
          <div className="admin-field">
            <label className="admin-label">Personality snapshot</label>
            <textarea className="admin-input" rows={4} value={snapshot} onChange={(e) => setSnapshot(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Growth guidance (second person — written to them)</label>
            <textarea className="admin-input" rows={8} value={guidance} onChange={(e) => setGuidance(e.target.value)} />
          </div>
          <div className="admin-form-actions">
            <button
              className="admin-btn admin-btn--primary"
              disabled={busy}
              onClick={() => {
                run("OCEAN", () => saveOcean(detail.profileId, { dims, snapshot, guidance }));
                setEditing(false);
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : o ? (
        <div className="coach-ocean">
          <table className="admin-table coach-ocean-table">
            <thead>
              <tr>
                <th>Trait</th>
                <th>Rating</th>
                <th>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {OCEAN_DIMENSIONS.map((k) => (
                <tr key={k}>
                  <td>{OCEAN_LABELS[k]}</td>
                  <td>{o[k].rating ?? "—"}</td>
                  <td className="admin-cell-muted">{o[k].evidence ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {o.snapshotMarkdown && (
            <div className="coach-block">
              <span className="admin-eyebrow">Snapshot</span>
              <p>{o.snapshotMarkdown}</p>
            </div>
          )}
          {o.guidanceMarkdown && (
            <div className="coach-block">
              <span className="admin-eyebrow">Growth guidance (they read this)</span>
              <p className="coach-ocean-guidance">{o.guidanceMarkdown}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="admin-empty">No OCEAN profile yet.</div>
      )}
    </section>
  );
}

// ---- commitments ------------------------------------------------------------

function CommitmentsCard({
  detail,
  run,
  busy,
}: {
  detail: CoachProfileDetail;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<"member" | "coach">("member");
  const [dueOn, setDueOn] = useState("");
  const open = detail.commitments.filter((c) =>
    (OPEN_COMMITMENT_STATUSES as CommitmentStatus[]).includes(c.status),
  );
  const closed = detail.commitments.filter(
    (c) => !(OPEN_COMMITMENT_STATUSES as CommitmentStatus[]).includes(c.status),
  );

  return (
    <section className="admin-card coach-section">
      <div className="admin-card-title">
        Commitments <span className="admin-cell-muted">({open.length} open)</span>
      </div>

      {open.length === 0 && <div className="admin-empty">No open commitments.</div>}
      {open.map((c) => (
        <CommitmentRow key={c.id} c={c} run={run} busy={busy} />
      ))}

      <div className="coach-add-row">
        <input
          className="admin-input"
          placeholder="New commitment…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <select className="admin-input" value={owner} onChange={(e) => setOwner(e.target.value as "member" | "coach")}>
          <option value="member">{detail.member.name}</option>
          <option value="coach">Me</option>
        </select>
        <input className="admin-input" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
        <button
          className="admin-btn"
          disabled={busy || !title.trim()}
          onClick={() => {
            run("Commitment", () => addCommitment(detail.profileId, title, owner, dueOn || null));
            setTitle("");
            setDueOn("");
          }}
        >
          Add
        </button>
      </div>

      {closed.length > 0 && (
        <details className="coach-closed">
          <summary>{closed.length} closed</summary>
          {closed.map((c) => (
            <div key={c.id} className="coach-commitment is-closed">
              <span className={`admin-badge ${STATUS_BADGE[c.status]}`}>{COMMITMENT_STATUS_LABELS[c.status]}</span>
              <span>{c.title}</span>
            </div>
          ))}
        </details>
      )}
    </section>
  );
}

function CommitmentRow({
  c,
  run,
  busy,
}: {
  c: CoachProfileDetail["commitments"][number];
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [note, setNote] = useState(c.statusNote ?? "");
  return (
    <div className="coach-commitment">
      <div className="coach-commitment-main">
        <span className={`admin-badge ${STATUS_BADGE[c.status]}`}>{COMMITMENT_STATUS_LABELS[c.status]}</span>
        <span className="coach-commitment-title">{c.title}</span>
        <span className="admin-cell-muted">
          {c.owner === "coach" ? "me" : "them"}
          {c.dueOn ? ` · due ${fmt(c.dueOn)}` : ""}
        </span>
      </div>
      <div className="coach-commitment-controls">
        <select
          className="admin-input"
          value={c.status}
          disabled={busy}
          onChange={(e) =>
            run("Commitment", () => updateCommitmentStatus(c.id, e.target.value as CommitmentStatus, note))
          }
        >
          {Object.entries(COMMITMENT_STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <input
          className="admin-input"
          placeholder="Status note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => {
            if ((c.statusNote ?? "") !== note)
              run("Note", () => updateCommitmentStatus(c.id, c.status, note));
          }}
        />
      </div>
    </div>
  );
}

// ---- 1-1 meetings -----------------------------------------------------------

function MeetingsCard({
  detail,
  html,
  run,
  busy,
}: {
  detail: CoachProfileDetail;
  html: RenderedHtml;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [scheduleDate, setScheduleDate] = useState("");
  const [logDate, setLogDate] = useState("");
  const [logTranscript, setLogTranscript] = useState("");
  const [showLog, setShowLog] = useState(false);

  return (
    <section className="admin-card coach-section">
      <div className="admin-card-title">1-1s</div>

      <div className="coach-add-row">
        <input
          className="admin-input"
          type="date"
          value={scheduleDate}
          onChange={(e) => setScheduleDate(e.target.value)}
        />
        <button
          className="admin-btn"
          disabled={busy || !scheduleDate}
          onClick={() => {
            run("Schedule", () => scheduleOneOnOne(detail.profileId, scheduleDate));
            setScheduleDate("");
          }}
        >
          Schedule next 1-1
        </button>
        <button className="admin-btn" onClick={() => setShowLog((v) => !v)}>
          {showLog ? "Cancel" : "Log a past 1-1"}
        </button>
      </div>

      {showLog && (
        <div className="admin-form coach-log-form">
          <div className="admin-field">
            <label className="admin-label" htmlFor="log-date">
              Meeting date
            </label>
            <input
              id="log-date"
              className="admin-input"
              type="date"
              value={logDate}
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label" htmlFor="log-transcript">
              Transcript (paste it and the AI drafts both summaries + extracts commitments)
            </label>
            <textarea
              id="log-transcript"
              className="admin-input"
              rows={6}
              value={logTranscript}
              onChange={(e) => setLogTranscript(e.target.value)}
              placeholder="Paste the meeting transcript or your raw notes…"
            />
          </div>
          <div className="admin-form-actions">
            <button
              className="admin-btn admin-btn--primary"
              disabled={busy || !logDate}
              onClick={() => {
                run("Log 1-1", () => logOneOnOne(detail.profileId, logDate, logTranscript));
                setShowLog(false);
                setLogDate("");
                setLogTranscript("");
              }}
            >
              Log it
            </button>
          </div>
        </div>
      )}

      {detail.meetings.length === 0 && <div className="admin-empty">No 1-1s yet.</div>}
      {detail.meetings.map((m) => (
        <MeetingRow key={m.id} m={m} html={html.meetings[m.id]} run={run} busy={busy} />
      ))}
    </section>
  );
}

function MeetingRow({
  m,
  html,
  run,
  busy,
}: {
  m: OneOnOne;
  html: { prep: string | null; summary: string | null; shared: string | null } | undefined;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [privateMd, setPrivateMd] = useState(m.summaryMarkdown ?? "");
  const [sharedMd, setSharedMd] = useState(m.sharedSummaryMarkdown ?? "");
  const [transcript, setTranscript] = useState("");
  const [minutesUrl, setMinutesUrl] = useState("");
  const [mode, setMode] = useState({
    coach: m.modeSplit ? String(m.modeSplit.coach) : "",
    mentor: m.modeSplit ? String(m.modeSplit.mentor) : "",
    direct: m.modeSplit ? String(m.modeSplit.direct) : "",
  });

  const published = Boolean(m.sharedPublishedAt);

  return (
    <div className="coach-meeting">
      <button className="coach-meeting-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <strong>{fmt(m.heldOn)}</strong>
        <span className={`admin-badge ${m.status === "held" ? "admin-badge--ok" : "admin-badge--info"}`}>
          {m.status}
        </span>
        {m.modeSplit && (
          <span className="admin-badge admin-badge--info" title="Coach / Mentor / Direct — target 80/15/5">
            {m.modeSplit.coach}/{m.modeSplit.mentor}/{m.modeSplit.direct}
          </span>
        )}
        {m.summaryMarkdown && (
          <span className={`admin-badge ${published ? "admin-badge--ok" : "admin-badge--warn"}`}>
            {published ? "Recap published" : "Recap draft"}
          </span>
        )}
        {m.aiError && <span className="admin-badge admin-badge--err">AI error</span>}
        <span className="coach-meeting-caret" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open && (
        <div className="coach-meeting-body">
          {m.aiError && <div className="admin-alert admin-alert--err">AI: {m.aiError}</div>}

          {/* Mode split (coach-only) */}
          <div className="coach-block">
            <div className="coach-block-head">
              <span className="admin-eyebrow">Mode split — coach / mentor / direct (target 80/15/5)</span>
            </div>
            <div className="coach-add-row coach-mode-row">
              {(["coach", "mentor", "direct"] as const).map((k) => (
                <input
                  key={k}
                  className="admin-input"
                  type="number"
                  min={0}
                  max={100}
                  placeholder={k}
                  aria-label={`${k} %`}
                  value={mode[k]}
                  onChange={(e) => setMode({ ...mode, [k]: e.target.value })}
                />
              ))}
              <button
                className="admin-btn admin-btn--sm"
                disabled={busy || !(mode.coach && mode.mentor && mode.direct)}
                onClick={() =>
                  run("Mode split", () =>
                    setModeSplit(m.id, {
                      coach: Number(mode.coach),
                      mentor: Number(mode.mentor),
                      direct: Number(mode.direct),
                    }),
                  )
                }
              >
                Save
              </button>
            </div>
          </div>

          {/* Lark Minutes link */}
          <div className="coach-block">
            <div className="coach-block-head">
              <span className="admin-eyebrow">Lark Minutes</span>
            </div>
            {m.minutesToken ? (
              <a
                href={`https://edge8company.sg.larksuite.com/minutes/${m.minutesToken}`}
                target="_blank"
                rel="noreferrer"
                className="admin-cell-muted"
              >
                Recording linked ({m.transcriptSource === "minutes_auto" ? "auto-detected" : "linked"}) — open in Lark ↗
              </a>
            ) : (
              <div className="coach-add-row">
                <input
                  className="admin-input"
                  placeholder="Paste the Lark Minutes link…"
                  value={minutesUrl}
                  onChange={(e) => setMinutesUrl(e.target.value)}
                />
                <button
                  className="admin-btn admin-btn--sm"
                  disabled={busy || !minutesUrl.trim()}
                  onClick={() => {
                    run("Minutes link", () => setMinutesLink(m.id, minutesUrl));
                    setMinutesUrl("");
                  }}
                >
                  Link
                </button>
              </div>
            )}
          </div>

          {/* Prep */}
          <div className="coach-block">
            <div className="coach-block-head">
              <span className="admin-eyebrow">Prep</span>
              <button className="admin-btn admin-btn--sm" disabled={busy} onClick={() => run("Prep", () => generatePrepAction(m.id))}>
                {m.prepMarkdown ? "Regenerate" : "Generate prep"}
              </button>
            </div>
            {html?.prep ? (
              <div className="idea-plan" dangerouslySetInnerHTML={{ __html: html.prep }} />
            ) : (
              <div className="admin-cell-muted">No prep yet.</div>
            )}
          </div>

          {/* Transcript */}
          <div className="coach-block">
            <div className="coach-block-head">
              <span className="admin-eyebrow">Transcript</span>
            </div>
            {m.transcript ? (
              <details>
                <summary className="admin-cell-muted">
                  {m.transcript.length.toLocaleString()} characters — view
                </summary>
                <pre className="coach-transcript">{m.transcript}</pre>
              </details>
            ) : (
              <>
                <textarea
                  className="admin-input"
                  rows={5}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Paste the transcript — the AI drafts both summaries and extracts commitments."
                />
                <div className="admin-form-actions">
                  <button
                    className="admin-btn"
                    disabled={busy || !transcript.trim()}
                    onClick={() => run("Transcript", () => saveTranscript(m.id, transcript))}
                  >
                    Save &amp; summarize
                  </button>
                </div>
              </>
            )}
            {m.transcript && !m.summaryMarkdown && (
              <div className="admin-form-actions">
                <button className="admin-btn" disabled={busy} onClick={() => run("Summary", () => summarizeAction(m.id))}>
                  Summarize transcript
                </button>
              </div>
            )}
          </div>

          {/* Summaries */}
          {(m.summaryMarkdown || m.sharedSummaryMarkdown) && (
            <div className="coach-block">
              <div className="coach-block-head">
                <span className="admin-eyebrow">Summaries</span>
                <div className="coach-block-actions">
                  <button className="admin-btn admin-btn--sm" onClick={() => setEditing((v) => !v)}>
                    {editing ? "Cancel edit" : "Edit"}
                  </button>
                  <button
                    className={`admin-btn admin-btn--sm ${published ? "" : "admin-btn--primary"}`}
                    disabled={busy}
                    onClick={() => run("Publish", () => publishRecap(m.id, !published))}
                  >
                    {published ? "Unpublish recap" : "Publish recap to them"}
                  </button>
                </div>
              </div>

              {editing ? (
                <div className="admin-form">
                  <div className="admin-field">
                    <label className="admin-label">Private summary (only you)</label>
                    <textarea
                      className="admin-input"
                      rows={10}
                      value={privateMd}
                      onChange={(e) => setPrivateMd(e.target.value)}
                    />
                  </div>
                  <div className="admin-field">
                    <label className="admin-label">Shared recap (they see this once published)</label>
                    <textarea
                      className="admin-input"
                      rows={8}
                      value={sharedMd}
                      onChange={(e) => setSharedMd(e.target.value)}
                    />
                  </div>
                  <div className="admin-form-actions">
                    <button
                      className="admin-btn admin-btn--primary"
                      disabled={busy}
                      onClick={() => {
                        run("Summaries", () => saveSummaries(m.id, privateMd, sharedMd));
                        setEditing(false);
                      }}
                    >
                      Save both
                    </button>
                  </div>
                </div>
              ) : (
                <div className="coach-summaries">
                  <div>
                    <div className="coach-tier-label">Private — only you</div>
                    {html?.summary ? (
                      <div className="idea-plan" dangerouslySetInnerHTML={{ __html: html.summary }} />
                    ) : (
                      <div className="admin-cell-muted">No private summary.</div>
                    )}
                  </div>
                  <div>
                    <div className="coach-tier-label">
                      Shared recap — {published ? "published to them" : "draft, they can't see it yet"}
                    </div>
                    {html?.shared ? (
                      <div className="idea-plan" dangerouslySetInnerHTML={{ __html: html.shared }} />
                    ) : (
                      <div className="admin-cell-muted">No shared recap.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="coach-block coach-block--danger">
            <button
              className="admin-btn admin-btn--sm admin-btn--danger"
              disabled={busy}
              onClick={() => {
                if (window.confirm("Archive this 1-1? It disappears from both views.")) {
                  run("Archive", () => archiveMeeting(m.id));
                }
              }}
            >
              Archive this 1-1
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- trends -----------------------------------------------------------------

function TrendsCard({
  detail,
  html,
  run,
  busy,
}: {
  detail: CoachProfileDetail;
  html: RenderedHtml;
  run: (label: string, fn: () => Promise<ActionResult>) => void;
  busy: boolean;
}) {
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);

  return (
    <section className="admin-card coach-section">
      <div className="admin-card-title">Trend reports</div>
      <div className="coach-add-row">
        <input className="admin-input" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        <button
          className="admin-btn"
          disabled={busy || !/^\d{4}-\d{2}$/.test(period)}
          onClick={() => run("Trend report", () => runTrendReport(detail.profileId, period))}
        >
          Run report
        </button>
      </div>
      {detail.trends.length === 0 && (
        <div className="admin-empty">No trend reports yet. They also run automatically on the 1st of each month.</div>
      )}
      {detail.trends.map((t) => (
        <details key={t.id} className="coach-trend">
          <summary>
            <strong>{t.period}</strong>
            {t.aiError && <span className="admin-badge admin-badge--err">failed</span>}
          </summary>
          {html.trends[t.id] ? (
            <div className="idea-plan" dangerouslySetInnerHTML={{ __html: html.trends[t.id]! }} />
          ) : (
            <div className="admin-cell-muted">{t.aiError ?? "Empty."}</div>
          )}
        </details>
      ))}
    </section>
  );
}

// ---- markdown notes (private profile / OKRs) --------------------------------

function NotesCard({
  title,
  hint,
  initial,
  rendered,
  onSave,
  busy,
}: {
  title: string;
  hint: string;
  initial: string;
  rendered: string | null;
  onSave: (md: string) => void;
  busy: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [md, setMd] = useState(initial);

  return (
    <section className="admin-card coach-section">
      <div className="coach-block-head">
        <div className="admin-card-title">{title}</div>
        <button className="admin-btn admin-btn--sm" onClick={() => setEditing((v) => !v)}>
          {editing ? "Cancel" : "Edit"}
        </button>
      </div>
      <div className="admin-hint">{hint}</div>
      {editing ? (
        <div className="admin-form">
          <textarea className="admin-input" rows={12} value={md} onChange={(e) => setMd(e.target.value)} />
          <div className="admin-form-actions">
            <button
              className="admin-btn admin-btn--primary"
              disabled={busy}
              onClick={() => {
                onSave(md);
                setEditing(false);
              }}
            >
              Save
            </button>
          </div>
        </div>
      ) : rendered ? (
        <div className="idea-plan" dangerouslySetInnerHTML={{ __html: rendered }} />
      ) : (
        <div className="admin-cell-muted">Nothing here yet.</div>
      )}
    </section>
  );
}
