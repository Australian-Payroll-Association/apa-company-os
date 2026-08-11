"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import {
  AGENTS,
  BUSINESS_LINES,
  DAVE_PERSON_ID,
  DELIVERY_MIXES,
  KR_STATUSES,
  LINE_LABELS,
  OFFICES,
  agentInitials,
  looksLikeActivity,
  progressPct,
  type KrNode,
  type KrStatus,
  type ObjectiveNode,
  type StrategyRow,
} from "../edges-shared";
import { checkInKr, createKr, createObjective, updateKr, updateObjective, updateStrategy } from "./actions";

type Chip = { value: string; tone: "ok" | "warn" | "err" };
type Drawer =
  | { kind: "strategy" }
  | { kind: "new-objective" }
  | { kind: "edit-objective"; objective: ObjectiveNode }
  | { kind: "new-kr"; objective: ObjectiveNode }
  | { kind: "edit-kr"; kr: KrNode };

function fmtValue(kr: KrNode): string {
  const t = kr.target_value == null ? null : Number(kr.target_value);
  const c = Number(kr.current_value);
  if (kr.unit === "usd") return `$${(c / 1000).toFixed(c >= 100000 ? 0 : 1)}k`;
  if (kr.unit === "%") return `${c}%`;
  if (kr.unit === "min") return `${c}m`;
  if (kr.unit === "days") return `${c}d`;
  if (t != null && kr.direction === "up" && t <= 20) return `${c}/${t}`;
  return `${c}`;
}

function barClass(kr: KrNode): string {
  const pct = progressPct(kr);
  if (kr.status === "done" || pct >= 100) return "is-done";
  if (kr.status === "at_risk" || kr.status === "off_track") return "is-risk";
  return "";
}

function CastTag({ mix }: { mix: string }) {
  const label = mix === "ai" ? "AI-LED" : mix === "blended" ? "BLENDED" : "HUMAN-LED";
  return <span className={`edges-cast edges-cast--${mix}`}>{label}</span>;
}

function Owners({ kr, initialsById }: { kr: KrNode; initialsById: Record<string, string> }) {
  return (
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
  );
}

type FastPerson = { name: string; goals: { title: string; ladder: string | null }[] };

export function GoalsBoard({
  strategy,
  overview,
  tree,
  quarter,
  initialsById,
  casting,
  fast,
  chips,
}: {
  strategy: StrategyRow | null;
  overview: string | null;
  tree: ObjectiveNode[];
  quarter: string;
  initialsById: Record<string, string>;
  casting: { human: number; blended: number; ai: number };
  fast: FastPerson[];
  chips: { frequent: Chip; specific: Chip; ambitious: Chip; transparent: Chip };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [checkin, setCheckin] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);

  const totalCast = Math.max(1, casting.human + casting.blended + casting.ai);

  // Flat KR list (with labels) for the parent picker in the objective form.
  const parentOptions: { id: string; label: string }[] = [];
  const walk = (nodes: ObjectiveNode[], prefix: string) => {
    nodes.forEach((o, oi) => {
      o.krs.forEach((kr, ki) => {
        parentOptions.push({ id: kr.id, label: `${prefix}${oi + 1}.${ki + 1} · ${kr.title}` });
        kr.children.forEach((child) => walk([child], `${prefix}${oi + 1}.${ki + 1} → `));
      });
    });
  };
  walk(tree, "KR");

  function done(res: { ok: boolean; error?: string }) {
    if (!res.ok) {
      setPageError(res.error ?? "Something went wrong.");
      return false;
    }
    setPageError(null);
    setDrawer(null);
    setCheckin(null);
    startTransition(() => router.refresh());
    return true;
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderChain(children: ObjectiveNode[]) {
    return (
      <div className="edges-chain">
        {children.map((o) => (
          <div key={o.id} className={`edges-node${o.level === "executor" ? " edges-node--executor" : ""}`}>
            <span className="edges-node-level">
              {o.level === "office" ? `Office of ${o.office}` : `Executor${o.owner_agent ? ` · ${o.owner_agent} agent` : ""}`}
            </span>
            <b>O: {o.title}</b>
            {o.krs.map((kr) => (
              <div key={kr.id} className="edges-node-kr">
                KR: {kr.title} <CastTag mix={kr.delivery_mix} />
                <Owners kr={kr} initialsById={initialsById} />
                <button className="edges-minibtn" onClick={() => setDrawer({ kind: "edit-kr", kr })}>
                  Edit
                </button>
                {kr.children.length > 0 && renderChain(kr.children)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {pageError && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {pageError}
        </div>
      )}

      {strategy && (
        <div className="edges-strategy">
          <div className="edges-strategy-head">
            <span className="edges-strategy-label">STRATEGY · {strategy.year}</span>
            <span style={{ flex: 1 }} />
            <a className="edges-strategy-link" href="/team/strategy">
              Full strategy →
            </a>
            <button className="edges-minibtn" onClick={() => setDrawer({ kind: "strategy" })}>
              Edit
            </button>
          </div>
          <p className="edges-strategy-title">{strategy.title}</p>
          {overview && <p className="edges-strategy-body">{overview}</p>}
          <span className="edges-strategy-mini">
            Delivery mix
            <span
              className="edges-mixbar"
              title="Who delivers each key result: a human, a human + agent blend, or an AI agent"
            >
              <i style={{ width: `${(casting.human / totalCast) * 100}%`, background: "#8a8f98" }} />
              <i style={{ width: `${(casting.blended / totalCast) * 100}%`, background: "var(--admin-accent)" }} />
              <i style={{ width: `${(casting.ai / totalCast) * 100}%`, background: "var(--admin-accent-on-dark-strong)" }} />
            </span>
            {casting.human} human-led · {casting.blended} blended · {casting.ai} AI-led
          </span>
        </div>
      )}

      <div className="edges-sect">
        <h2>Company goals</h2>
        <span className="edges-sect-note">
          {quarter.slice(0, 4)} Q{quarter.slice(5)} objectives and key results
        </span>
        <span style={{ flex: 1 }} />
        <button className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => setDrawer({ kind: "new-objective" })}>
          + New objective
        </button>
      </div>

      <div className="edges-chips">
        {(
          [
            ["Frequent", chips.frequent],
            ["Specific", chips.specific],
            ["Ambitious", chips.ambitious],
            ["Transparent", chips.transparent],
          ] as const
        ).map(([label, chip]) => (
          <span key={label} className="edges-chip">
            <span className={`edges-dot edges-dot--${chip.tone}`} />
            {label} <b>{chip.value}</b>
          </span>
        ))}
      </div>

      {tree.length === 0 && <div className="admin-empty">No objectives for {quarter} yet. Add the first one.</div>}

      {tree.map((o, oi) => (
        <div key={o.id} className="admin-card" style={{ padding: 0, marginBottom: 14, overflow: "hidden" }}>
          <div className="edges-ohead">
            <span className={`edges-ltag edges-ltag--${o.business_line ?? "company"}`}>
              {LINE_LABELS[o.business_line ?? "company"]}
            </span>
            <h3>
              O{oi + 1} · {o.title}
            </h3>
            <span className="edges-ohead-note">
              {Math.round(o.krs.reduce((s, kr) => s + progressPct(kr), 0) / Math.max(1, o.krs.length))}% ·{" "}
              {o.krs.some((kr) => kr.status === "off_track") ? "off track" : o.krs.some((kr) => kr.status === "at_risk") ? "watch" : "on track"}
            </span>
            <button className="edges-minibtn" onClick={() => setDrawer({ kind: "edit-objective", objective: o })}>
              Edit
            </button>
            <button className="edges-minibtn" onClick={() => setDrawer({ kind: "new-kr", objective: o })}>
              + Key result
            </button>
          </div>
          {o.krs.map((kr, ki) => (
            <div key={kr.id} className="edges-kr">
              <div className="edges-kr-row">
                <div className="edges-kr-title">
                  <span style={{ color: "var(--admin-faint)", fontWeight: 750, fontSize: 10, marginRight: 7 }}>
                    KR{oi + 1}.{ki + 1}
                  </span>
                  {kr.title}
                </div>
                <CastTag mix={kr.delivery_mix} />
                <Owners kr={kr} initialsById={initialsById} />
                <span className="edges-prog">
                  <span className="edges-prog-bar">
                    <i className={barClass(kr)} style={{ width: `${Math.min(100, progressPct(kr))}%` }} />
                  </span>
                  <span className="edges-prog-val">{fmtValue(kr)}</span>
                </span>
                <button className="edges-minibtn" onClick={() => setCheckin(checkin === kr.id ? null : kr.id)}>
                  Check in
                </button>
                <button className="edges-minibtn" onClick={() => setDrawer({ kind: "edit-kr", kr })}>
                  Edit
                </button>
                {kr.children.length > 0 && (
                  <button className="edges-minibtn" onClick={() => toggleExpand(kr.id)}>
                    Cascade {expanded.has(kr.id) ? "▴" : "▾"}
                  </button>
                )}
              </div>
              {checkin === kr.id && <CheckinForm kr={kr} onDone={done} />}
              {expanded.has(kr.id) && kr.children.length > 0 && renderChain(kr.children)}
            </div>
          ))}
        </div>
      ))}

      <div className="edges-sect">
        <h2>Team goals</h2>
        <span className="edges-sect-note">
          {fast.filter((p) => p.goals.length > 0).length}/{fast.length} set · transparent to the whole team
        </span>
      </div>

      <section className="admin-card" style={{ marginBottom: 14 }}>
        <div className="edges-fast-grid">
          {fast.map((p) => (
            <div key={p.name} className="edges-fast-person">
              <div className="edges-fast-name">{p.name}</div>
              {p.goals.length === 0 && <div className="admin-cell-muted">No active goal</div>}
              {p.goals.map((g, i) => (
                <div key={i} className="edges-fast-goal">
                  <div>{g.title}</div>
                  <div className="admin-cell-muted">{g.ladder ? `⇗ ${g.ladder}` : "No ladder yet"}</div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <DetailDrawer
        open={drawer !== null}
        onClose={() => setDrawer(null)}
        eyebrow="Eight Edges"
        title={
          drawer?.kind === "strategy"
            ? "Edit strategy"
            : drawer?.kind === "new-objective"
              ? "New objective"
              : drawer?.kind === "edit-objective"
                ? "Edit objective"
                : drawer?.kind === "new-kr"
                  ? `New key result · ${drawer.objective.title}`
                  : drawer?.kind === "edit-kr"
                    ? "Edit key result"
                    : ""
        }
      >
        {drawer?.kind === "strategy" && strategy && <StrategyForm strategy={strategy} onDone={done} />}
        {drawer?.kind === "new-objective" && <ObjectiveForm quarter={quarter} parentOptions={parentOptions} onDone={done} />}
        {drawer?.kind === "edit-objective" && <ObjectiveEditForm objective={drawer.objective} onDone={done} />}
        {drawer?.kind === "new-kr" && <KrForm objectiveId={drawer.objective.id} onDone={done} />}
        {drawer?.kind === "edit-kr" && <KrForm kr={drawer.kr} onDone={done} />}
      </DetailDrawer>
    </>
  );
}

function CheckinForm({ kr, onDone }: { kr: KrNode; onDone: (res: { ok: boolean; error?: string }) => boolean }) {
  const [value, setValue] = useState(String(kr.current_value));
  const [status, setStatus] = useState<KrStatus>(kr.status);
  const [busy, setBusy] = useState(false);
  return (
    <div className="edges-checkin">
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
      <button
        className="admin-btn admin-btn--primary admin-btn--sm"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await checkInKr(kr.id, { current_value: Number(value), status });
          setBusy(false);
          onDone(res);
        }}
      >
        {busy ? "Saving…" : "Save check-in"}
      </button>
      {kr.target_value != null && (
        <span style={{ fontSize: 11, color: "var(--admin-muted)" }}>
          target {kr.direction === "down" ? "≤" : ""} {Number(kr.target_value)}
        </span>
      )}
    </div>
  );
}

function StrategyForm({ strategy, onDone }: { strategy: StrategyRow; onDone: (res: { ok: boolean; error?: string }) => boolean }) {
  const [title, setTitle] = useState(strategy.title);
  const [body, setBody] = useState(strategy.body_md ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="admin-form">
      {err && <div className="admin-alert admin-alert--err">{err}</div>}
      <div className="admin-field">
        <label className="admin-label">The strategy line (shows on the banner)</label>
        <textarea className="admin-textarea" rows={3} value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="admin-field">
        <label className="admin-label">The one page (diagnosis, guiding policy, coherent actions)</label>
        <textarea className="admin-textarea" rows={12} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>
      <div className="admin-form-actions">
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await updateStrategy(strategy.id, { title, body_md: body });
            setBusy(false);
            if (!res.ok) setErr(res.error);
            else onDone(res);
          }}
        >
          {busy ? "Saving…" : "Save strategy"}
        </button>
      </div>
    </div>
  );
}

function ObjectiveForm({
  quarter,
  parentOptions,
  onDone,
}: {
  quarter: string;
  parentOptions: { id: string; label: string }[];
  onDone: (res: { ok: boolean; error?: string }) => boolean;
}) {
  const [level, setLevel] = useState<"company" | "office" | "executor">("company");
  const [title, setTitle] = useState("");
  const [office, setOffice] = useState<string>(OFFICES[0]);
  const [line, setLine] = useState<string>("");
  const [parent, setParent] = useState<string>("");
  const [agent, setAgent] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="admin-form">
      {err && <div className="admin-alert admin-alert--err">{err}</div>}
      <div className="admin-field">
        <label className="admin-label">Level</label>
        <select className="admin-select" value={level} onChange={(e) => setLevel(e.target.value as typeof level)}>
          <option value="company">Company</option>
          <option value="office">Office</option>
          <option value="executor">Executor</option>
        </select>
      </div>
      {level !== "company" && (
        <div className="admin-field">
          <label className="admin-label">Serves which key result? (the cascade link)</label>
          <select className="admin-select" value={parent} onChange={(e) => setParent(e.target.value)}>
            <option value="">Pick a parent key result…</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {level === "office" && (
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
      )}
      {level === "executor" && (
        <div className="admin-field">
          <label className="admin-label">Executing agent (leave blank for a human-only objective)</label>
          <select className="admin-select" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">none (human)</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      )}
      {level === "company" && (
        <div className="admin-field">
          <label className="admin-label">Business line (blank = company-wide)</label>
          <select className="admin-select" value={line} onChange={(e) => setLine(e.target.value)}>
            <option value="">company-wide</option>
            {BUSINESS_LINES.map((l) => (
              <option key={l} value={l}>
                {LINE_LABELS[l]}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="admin-field">
        <label className="admin-label">Objective (qualitative direction)</label>
        <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Make renewals a system, not a scramble" />
      </div>
      <div className="admin-form-actions">
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await createObjective({
              level,
              title,
              quarter,
              office: level === "office" ? office : undefined,
              business_line: level === "company" && line ? line : undefined,
              parent_kr_id: level === "company" ? undefined : parent || undefined,
              owner_agent: level === "executor" && agent ? agent : undefined,
            });
            setBusy(false);
            if (!res.ok) setErr(res.error);
            else onDone(res);
          }}
        >
          {busy ? "Saving…" : "Create objective"}
        </button>
      </div>
    </div>
  );
}

function ObjectiveEditForm({
  objective,
  onDone,
}: {
  objective: ObjectiveNode;
  onDone: (res: { ok: boolean; error?: string }) => boolean;
}) {
  const [title, setTitle] = useState(objective.title);
  const [status, setStatus] = useState(objective.status);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="admin-form">
      {err && <div className="admin-alert admin-alert--err">{err}</div>}
      <div className="admin-field">
        <label className="admin-label">Objective</label>
        <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} />
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
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const res = await updateObjective(objective.id, { title, status });
            setBusy(false);
            if (!res.ok) setErr(res.error);
            else onDone(res);
          }}
        >
          {busy ? "Saving…" : "Save objective"}
        </button>
      </div>
    </div>
  );
}

function KrForm({
  objectiveId,
  kr,
  onDone,
}: {
  objectiveId?: string;
  kr?: KrNode;
  onDone: (res: { ok: boolean; error?: string }) => boolean;
}) {
  const [title, setTitle] = useState(kr?.title ?? "");
  const [target, setTarget] = useState(kr?.target_value != null ? String(kr.target_value) : "");
  const [unit, setUnit] = useState(kr?.unit ?? "");
  const [direction, setDirection] = useState<"up" | "down">(kr?.direction ?? "up");
  const [mix, setMix] = useState(kr?.delivery_mix ?? "human");
  const [agent, setAgent] = useState(kr?.executing_agent ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const activity = looksLikeActivity(title);
  return (
    <div className="admin-form">
      {err && <div className="admin-alert admin-alert--err">{err}</div>}
      <div className="admin-field">
        <label className="admin-label">Key result (a measurable outcome, not an activity)</label>
        <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client retention from 78% to 90%" />
        {activity && (
          <p className="admin-hint" style={{ color: "#d97706" }}>
            This starts with a doing-verb, which usually means an activity. A key result is the outcome the activity should
            produce. Sure it's an outcome? Then keep it.
          </p>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
        <div className="admin-field">
          <label className="admin-label">Target</label>
          <input className="admin-input" type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Unit</label>
          <input className="admin-input" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="%, usd, deals…" />
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
          <label className="admin-label">Delivery mix (who delivers this?)</label>
          <select className="admin-select" value={mix} onChange={(e) => setMix(e.target.value as (typeof DELIVERY_MIXES)[number])}>
            <option value="human">human-led</option>
            <option value="ai">AI-led</option>
            <option value="blended">blended</option>
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label">Executing agent</label>
          <select className="admin-select" value={agent} onChange={(e) => setAgent(e.target.value)}>
            <option value="">none</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="admin-hint">The accountable human stays Dave for now; agents execute, accountability never delegates to software.</p>
      <div className="admin-form-actions">
        <button
          className="admin-btn admin-btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const payload = {
              title,
              target_value: target === "" ? null : Number(target),
              unit,
              direction,
              delivery_mix: mix,
              executing_agent: agent || undefined,
            };
            const res = kr
              ? await updateKr(kr.id, payload)
              : await createKr({ ...payload, objective_id: objectiveId!, accountable_person_id: DAVE_PERSON_ID });
            setBusy(false);
            if (!res.ok) setErr(res.error ?? "Something went wrong.");
            else onDone(res);
          }}
        >
          {busy ? "Saving…" : kr ? "Save key result" : "Create key result"}
        </button>
      </div>
    </div>
  );
}
