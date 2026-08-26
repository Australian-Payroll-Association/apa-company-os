"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AGENTS,
  BRANDS,
  DAVE_PERSON_ID,
  DELIVERY_MIXES,
  KR_STATUSES,
  BRAND_LABELS,
  agentInitials,
  looksLikeActivity,
  progressPct,
  type KrRow,
  type KrStatus,
} from "../../edges/edges-shared";
import type { ObjectiveWithKrs } from "@/lib/company/goals";
import { barClass, fmtValue } from "@/components/company/CompanyGoalsObjectives";
import { checkInKr, createKr, createObjective, updateKr, updateObjective } from "../actions";

// Inline editor for the company objectives and their key results, the single
// place these are edited (the 8 Edges cascade board is retired). Every
// objective here is company-level; accountability stays Dave, agents execute.
// Mirrors the read-only CompanyGoalsObjectives card, with edit / add / check-in
// controls layered on.
type Result = { ok: true } | { ok: false; error: string };

type KrDraft = {
  title: string;
  target: string;
  unit: string;
  direction: "up" | "down";
  mix: (typeof DELIVERY_MIXES)[number];
  agent: string;
};

function krDraft(kr?: KrRow): KrDraft {
  return {
    title: kr?.title ?? "",
    target: kr?.target_value != null ? String(kr.target_value) : "",
    unit: kr?.unit ?? "",
    direction: (kr?.direction as "up" | "down") ?? "up",
    mix: (kr?.delivery_mix as (typeof DELIVERY_MIXES)[number]) ?? "human",
    agent: kr?.executing_agent ?? "",
  };
}

export function CompanyGoalsEditor({
  tree,
  initialsById,
  quarter,
  emptyLabel,
}: {
  tree: ObjectiveWithKrs[];
  initialsById: Record<string, string>;
  quarter: string;
  emptyLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  // Which inline form is open. Only one at a time keeps the board readable.
  const [mode, setMode] = useState<
    | { kind: "none" }
    | { kind: "add-objective" }
    | { kind: "edit-objective"; id: string }
    | { kind: "add-kr"; objectiveId: string }
    | { kind: "edit-kr"; id: string }
    | { kind: "checkin"; id: string }
  >({ kind: "none" });

  function run(fn: () => Promise<Result & { id?: string }>, okText: string) {
    setBanner(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setBanner({ tone: "ok", text: okText });
        setMode({ kind: "none" });
        router.refresh();
      } else {
        setBanner({ tone: "err", text: res.error });
      }
    });
  }

  return (
    <div>
      {banner && <div className={`admin-alert admin-alert--${banner.tone === "ok" ? "ok" : "err"}`}>{banner.text}</div>}

      <div className="admin-form-actions" style={{ marginBottom: 16 }}>
        {mode.kind === "add-objective" ? (
          <button className="admin-btn" onClick={() => setMode({ kind: "none" })} disabled={pending}>
            Cancel
          </button>
        ) : (
          <button className="admin-btn admin-btn--primary" onClick={() => setMode({ kind: "add-objective" })} disabled={pending}>
            Add objective
          </button>
        )}
      </div>

      {mode.kind === "add-objective" && (
        <ObjectiveForm
          quarter={quarter}
          pending={pending}
          onCancel={() => setMode({ kind: "none" })}
          onSubmit={(d) =>
            run(
              () =>
                createObjective({
                  level: "company",
                  title: d.title,
                  quarter,
                  brand: d.brand || undefined,
                }),
              "Objective added.",
            )
          }
        />
      )}

      {tree.length === 0 && mode.kind !== "add-objective" && <div className="admin-empty">{emptyLabel}</div>}

      {tree.map((o, oi) => (
        <div key={o.id} className="admin-card" style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
          <div className="edges-ohead">
            <span className={`edges-ltag edges-ltag--${o.brand ?? "company"}`}>
              {BRAND_LABELS[o.brand ?? "company"]}
            </span>
            <h3>
              O{oi + 1} · {o.title}
            </h3>
            <span className="edges-ohead-note">
              {Math.round(o.krs.reduce((s, kr) => s + progressPct(kr), 0) / Math.max(1, o.krs.length))}% ·{" "}
              {o.krs.some((kr) => kr.status === "off_track")
                ? "off track"
                : o.krs.some((kr) => kr.status === "at_risk")
                  ? "watch"
                  : "on track"}
            </span>
          </div>

          {mode.kind === "edit-objective" && mode.id === o.id ? (
            <div style={{ padding: 14 }}>
              <ObjectiveEditForm
                objective={o}
                pending={pending}
                onCancel={() => setMode({ kind: "none" })}
                onSubmit={(patch) => run(() => updateObjective(o.id, patch), "Objective saved.")}
              />
            </div>
          ) : (
            o.krs.map((kr, ki) => {
              // Collapsed rows are the click target: click (or Enter) opens the
              // check-in, the most frequent action; Edit lives inside the panel.
              const expanded =
                (mode.kind === "edit-kr" || mode.kind === "checkin") && mode.id === kr.id;
              return (
              <div
                key={kr.id}
                className={`edges-kr${expanded ? "" : " edges-kr--click"}`}
                role={expanded ? undefined : "button"}
                tabIndex={expanded ? undefined : 0}
                title={expanded ? undefined : "Click to check in"}
                onClick={expanded ? undefined : () => setMode({ kind: "checkin", id: kr.id })}
                onKeyDown={
                  expanded
                    ? undefined
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setMode({ kind: "checkin", id: kr.id });
                        }
                      }
                }
              >
                <div className="edges-kr-row">
                  <div className="edges-kr-title">
                    <span style={{ color: "var(--admin-faint)", fontWeight: 750, fontSize: 10, marginRight: 7 }}>
                      KR{oi + 1}.{ki + 1}
                    </span>
                    {kr.title}
                  </div>
                  <span className="edges-owner">
                    <span className="edges-av" title="Accountable human">
                      {initialsById[kr.accountable_person_id] ?? "?"}
                    </span>
                    {kr.executing_agent && (
                      <span className="edges-av edges-av--bot" title={`${kr.executing_agent} agent`}>
                        {agentInitials(kr.executing_agent)}
                      </span>
                    )}
                  </span>
                  <span className="edges-prog">
                    <span className="edges-prog-bar">
                      <i className={barClass(kr)} style={{ width: `${Math.min(100, progressPct(kr))}%` }} />
                    </span>
                    <span className="edges-prog-val">{fmtValue(kr)}</span>
                  </span>
                </div>

                {mode.kind === "edit-kr" && mode.id === kr.id ? (
                  <div style={{ padding: "4px 0 10px" }}>
                    <KrForm
                      kr={kr}
                      pending={pending}
                      onCancel={() => setMode({ kind: "none" })}
                      onSubmit={(d) =>
                        run(
                          () =>
                            updateKr(kr.id, {
                              title: d.title,
                              target_value: d.target === "" ? null : Number(d.target),
                              unit: d.unit,
                              direction: d.direction,
                              delivery_mix: d.mix,
                              executing_agent: d.agent || undefined,
                            }),
                          "Key result saved.",
                        )
                      }
                    />
                  </div>
                ) : mode.kind === "checkin" && mode.id === kr.id ? (
                  <div style={{ padding: "4px 0 10px" }}>
                    <CheckinForm
                      kr={kr}
                      pending={pending}
                      onCancel={() => setMode({ kind: "none" })}
                      onSubmit={(current, status) => run(() => checkInKr(kr.id, { current_value: current, status }), "Checked in.")}
                    />
                    <div className="admin-form-actions" style={{ padding: "6px 0 0" }}>
                      <button className="admin-btn admin-btn--sm" onClick={() => setMode({ kind: "edit-kr", id: kr.id })} disabled={pending}>
                        Edit key result
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
              );
            })
          )}

          {/* Objective-level actions: edit the objective, or add a KR to it. */}
          {mode.kind === "add-kr" && mode.objectiveId === o.id ? (
            <div style={{ padding: 14, borderTop: "1px solid var(--admin-border)" }}>
              <KrForm
                pending={pending}
                onCancel={() => setMode({ kind: "none" })}
                onSubmit={(d) =>
                  run(
                    () =>
                      createKr({
                        objective_id: o.id,
                        accountable_person_id: DAVE_PERSON_ID,
                        title: d.title,
                        target_value: d.target === "" ? null : Number(d.target),
                        unit: d.unit,
                        direction: d.direction,
                        delivery_mix: d.mix,
                        executing_agent: d.agent || undefined,
                      }),
                    "Key result added.",
                  )
                }
              />
            </div>
          ) : (
            mode.kind !== "edit-objective" && (
              <div className="admin-form-actions" style={{ padding: 12, borderTop: "1px solid var(--admin-border)" }}>
                <button className="admin-btn admin-btn--sm" onClick={() => setMode({ kind: "edit-objective", id: o.id })} disabled={pending}>
                  Edit objective
                </button>
                <button className="admin-btn admin-btn--sm" onClick={() => setMode({ kind: "add-kr", objectiveId: o.id })} disabled={pending}>
                  + Key result
                </button>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}

function ObjectiveForm({
  quarter,
  pending,
  onCancel,
  onSubmit,
}: {
  quarter: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (d: { title: string; brand: string }) => void;
}) {
  const [title, setTitle] = useState("");
  const [brand, setBusinessLine] = useState("");
  return (
    <form
      className="admin-card admin-section-card admin-form"
      style={{ marginBottom: 16 }}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, brand });
      }}
    >
      <div className="admin-field">
        <label className="admin-label">Objective (qualitative direction)</label>
        <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Make renewals a system, not a scramble" required />
      </div>
      <div className="admin-field">
        <label className="admin-label">Brand (blank = company-wide)</label>
        <select className="admin-select" value={brand} onChange={(e) => setBusinessLine(e.target.value)}>
          <option value="">company-wide</option>
          {BRANDS.map((l) => (
            <option key={l} value={l}>
              {BRAND_LABELS[l]}
            </option>
          ))}
        </select>
      </div>
      <p className="admin-hint">Cycle: {quarter}</p>
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Create objective"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function ObjectiveEditForm({
  objective,
  pending,
  onCancel,
  onSubmit,
}: {
  objective: ObjectiveWithKrs;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (patch: { title: string; status: string }) => void;
}) {
  const [title, setTitle] = useState(objective.title);
  const [status, setStatus] = useState(objective.status);
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ title, status });
      }}
    >
      <div className="admin-field">
        <label className="admin-label">Objective</label>
        <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <div className="admin-field">
        <label className="admin-label">Status</label>
        <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="active">active</option>
          <option value="done">done</option>
          <option value="dropped">dropped (hides the objective)</option>
        </select>
      </div>
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Save objective"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function KrForm({
  kr,
  pending,
  onCancel,
  onSubmit,
}: {
  kr?: KrRow;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (d: KrDraft) => void;
}) {
  const [d, setD] = useState<KrDraft>(krDraft(kr));
  const activity = looksLikeActivity(d.title);
  function set<K extends keyof KrDraft>(key: K, value: KrDraft[K]) {
    setD((s) => ({ ...s, [key]: value }));
  }
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(d);
      }}
    >
      <div className="admin-field">
        <label className="admin-label">Key result (a measurable outcome, not an activity)</label>
        <input className="admin-input" value={d.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Client retention from 78% to 90%" required />
        {activity && (
          <p className="admin-hint" style={{ color: "#d97706" }}>
            This starts with a doing-verb, which usually means an activity. A key result is the outcome the activity should produce.
          </p>
        )}
      </div>
      <div className="goals-grid">
        <div className="admin-field">
          <label className="admin-label">Target</label>
          <input className="admin-input" type="number" step="any" value={d.target} onChange={(e) => set("target", e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Unit</label>
          <input className="admin-input" value={d.unit} onChange={(e) => set("unit", e.target.value)} placeholder="%, usd, deals…" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Direction</label>
          <select className="admin-select" value={d.direction} onChange={(e) => set("direction", e.target.value as "up" | "down")}>
            <option value="up">up is good</option>
            <option value="down">down is good</option>
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Delivery mix</label>
          <select className="admin-select" value={d.mix} onChange={(e) => set("mix", e.target.value as (typeof DELIVERY_MIXES)[number])}>
            <option value="human">human-led</option>
            <option value="ai">AI-led</option>
            <option value="blended">blended</option>
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Executing agent</label>
          <select className="admin-select" value={d.agent} onChange={(e) => set("agent", e.target.value)}>
            <option value="">none</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="admin-hint">The accountable human stays Dave; agents execute, accountability never delegates to software.</p>
      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
          {pending ? "Saving…" : kr ? "Save key result" : "Create key result"}
        </button>
        <button type="button" className="admin-btn" onClick={onCancel} disabled={pending}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function CheckinForm({
  kr,
  pending,
  onCancel,
  onSubmit,
}: {
  kr: KrRow;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (current: number, status: KrStatus) => void;
}) {
  const [value, setValue] = useState(String(kr.current_value));
  const [status, setStatus] = useState<KrStatus>(kr.status as KrStatus);
  return (
    <form
      className="edges-checkin"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(Number(value), status);
      }}
    >
      <label className="admin-label" style={{ margin: 0 }}>
        Current{kr.unit ? ` (${kr.unit})` : ""}
      </label>
      <input className="admin-input" type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
      <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value as KrStatus)}>
        {KR_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.replace("_", " ")}
          </option>
        ))}
      </select>
      <button type="submit" className="admin-btn admin-btn--primary admin-btn--sm" disabled={pending}>
        {pending ? "Saving…" : "Save check-in"}
      </button>
      <button type="button" className="admin-btn admin-btn--sm" onClick={onCancel} disabled={pending}>
        Cancel
      </button>
      {kr.target_value != null && (
        <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>
          target {kr.direction === "down" ? "≤" : ""} {Number(kr.target_value)}
        </span>
      )}
    </form>
  );
}
