"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BACKLOG_GROUPS,
  BACKLOG_PRIORITIES,
  BACKLOG_STATUSES,
  GROUP_META,
  PRIORITY_LABEL,
  tokenLabel,
  type BacklogGroupKey,
  type BacklogItem,
  type BacklogPriority,
} from "@/lib/client-backlog";
import {
  acceptProposedItem,
  archiveBacklogItem,
  createBacklogItem,
  restoreBacklogItem,
  setEdge8Priority,
  updateBacklogItem,
  type BacklogItemInput,
} from "./actions";

const STYLES = `
.cbe { --pri-now:#287BE8; --pri-next:#0b8f63; --pri-later:#4a505a; --pri-park:#b06508; }
.cbe .cbe-group { margin-bottom: 20px; }
.cbe .cbe-group-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin:0 0 4px; }
.cbe .cbe-step { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.04em; padding:3px 9px; border-radius:99px; background:rgba(40,123,232,.1); color:#287BE8; }
.cbe .cbe-group-title { font-weight:700; font-size:15px; }
.cbe .cbe-group-intro { color:#797c82; font-size:13px; margin:2px 0 12px; }
.cbe .cbe-item { border:1px solid var(--admin-border,#E6E6E6); border-radius:12px; padding:13px 15px; margin-bottom:9px; background:#fff; }
.cbe .cbe-item.archived { opacity:.55; }
.cbe .cbe-item-top { display:flex; gap:9px; align-items:flex-start; flex-wrap:wrap; }
.cbe .cbe-ref { flex:none; font-size:12px; font-weight:700; color:#287BE8; background:rgba(40,123,232,.1); border-radius:6px; padding:3px 7px; }
.cbe .cbe-title { font-weight:650; font-size:14px; flex:1 1 220px; }
.cbe .cbe-pills { display:flex; gap:4px; flex-wrap:wrap; }
.cbe .cbe-pill { font-size:12px; font-weight:600; padding:4px 11px; border-radius:99px; border:1px solid var(--admin-border,#E6E6E6); background:#fff; color:#797c82; cursor:pointer; font-family:inherit; }
.cbe .cbe-pill:hover { border-color:#287BE8; color:#287BE8; }
.cbe .cbe-pill.on-now { background:var(--pri-now); border-color:var(--pri-now); color:#fff; }
.cbe .cbe-pill.on-next { background:rgba(11,143,99,.15); border-color:var(--pri-next); color:var(--pri-next); }
.cbe .cbe-pill.on-later { background:#f2f4f7; border-color:#b8bfc9; color:var(--pri-later); }
.cbe .cbe-pill.on-park { background:#fff4e5; border-color:#d8871f; color:var(--pri-park); }
.cbe .cbe-body { font-size:13px; margin-top:8px; color:#333; }
.cbe .cbe-body .k { color:#797c82; font-weight:600; }
.cbe .cbe-chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:8px; align-items:center; }
.cbe .cbe-chip { font-size:11px; font-weight:600; color:#797c82; border:1px solid #EAEEF2; border-radius:99px; padding:2px 9px; }
.cbe .cbe-chip.tok { color:#287BE8; border-color:rgba(40,123,232,.15); background:rgba(40,123,232,.08); }
.cbe .cbe-chip.client { color:#0b8f63; border-color:rgba(11,143,99,.25); background:rgba(11,143,99,.1); }
.cbe .cbe-actions { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; }
.cbe .cbe-link { font-size:12px; font-weight:600; color:#287BE8; background:none; border:none; cursor:pointer; padding:0; font-family:inherit; }
.cbe .cbe-link.danger { color:#c0392b; }
.cbe .cbe-form { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px; }
.cbe .cbe-form .full { grid-column:1 / -1; }
.cbe .cbe-form label { font-size:12px; font-weight:600; color:#797c82; display:block; margin-bottom:3px; }
.cbe .cbe-form input, .cbe .cbe-form textarea, .cbe .cbe-form select { width:100%; font-family:inherit; font-size:13px; padding:7px 9px; border:1px solid var(--admin-border,#E6E6E6); border-radius:8px; box-sizing:border-box; }
.cbe .cbe-form textarea { min-height:52px; resize:vertical; }
.cbe .cbe-proposed { border:1px solid #d8871f; background:#fff8ef; border-radius:12px; padding:14px 16px; margin-bottom:18px; }
.cbe .cbe-proposed h3 { margin:0 0 8px; font-size:14px; color:#b06508; }
.cbe .cbe-add { margin-top:6px; }
.cbe .cbe-err { color:#c0392b; font-size:12px; margin-top:6px; }
@media (max-width:640px){ .cbe .cbe-form { grid-template-columns:1fr; } }
`;

type Draft = Partial<BacklogItemInput> & { needsCsv?: string };

function itemToDraft(it: BacklogItem): Draft {
  return {
    group_key: it.group_key,
    title: it.title,
    who: it.who ?? "",
    today_state: it.today_state ?? "",
    build_desc: it.build_desc ?? "",
    needsCsv: (it.needs ?? []).join(", "),
    token_low: it.token_low,
    token_high: it.token_high,
    edge8_priority: it.edge8_priority,
    status: it.status,
  };
}

function draftToInput(d: Draft): BacklogItemInput {
  return {
    group_key: (d.group_key ?? "reports") as BacklogGroupKey,
    title: d.title ?? "",
    who: d.who,
    today_state: d.today_state,
    build_desc: d.build_desc,
    needs: (d.needsCsv ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    token_low: d.token_low === undefined || (d.token_low as unknown as string) === "" ? null : Number(d.token_low),
    token_high: d.token_high === undefined || (d.token_high as unknown as string) === "" ? null : Number(d.token_high),
    edge8_priority: d.edge8_priority,
    status: d.status,
  };
}

export function BacklogAdminEditor({
  companyId,
  items,
  showArchived,
}: {
  companyId: string;
  items: BacklogItem[];
  showArchived: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [addGroup, setAddGroup] = useState<BacklogGroupKey | null>(null);
  const [addDraft, setAddDraft] = useState<Draft>({});
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) {
    setErr(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) setErr(r.error ?? "Something went wrong.");
      else {
        after?.();
        router.refresh();
      }
    });
  }

  const proposed = items.filter((i) => i.status === "proposed");

  function renderItem(it: BacklogItem) {
    const isEditing = editing === it.id;
    const d = drafts[it.id] ?? itemToDraft(it);
    const setD = (patch: Partial<Draft>) => setDrafts((prev) => ({ ...prev, [it.id]: { ...d, ...patch } }));
    const tok = tokenLabel(it.token_low, it.token_high);

    return (
      <div key={it.id} className={`cbe-item${it.archived_at ? " archived" : ""}`}>
        <div className="cbe-item-top">
          {it.ref && <span className="cbe-ref">{it.ref}</span>}
          <span className="cbe-title">{it.title}</span>
          <span className="cbe-pills">
            {BACKLOG_PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                className={`cbe-pill${it.edge8_priority === p ? ` on-${p}` : ""}`}
                disabled={pending}
                onClick={() => run(() => setEdge8Priority(it.id, p))}
                title="Edge8 proposed priority"
              >
                {PRIORITY_LABEL[p]}
              </button>
            ))}
          </span>
        </div>

        <div className="cbe-body">
          {it.who && <div><span className="k">Who: </span>{it.who}</div>}
          {it.today_state && <div><span className="k">Today: </span>{it.today_state}</div>}
          {it.build_desc && <div><span className="k">Build: </span>{it.build_desc}</div>}
          <div className="cbe-chips">
            {(it.needs ?? []).map((n) => <span key={n} className="cbe-chip">{n}</span>)}
            {tok && <span className="cbe-chip tok">est. {tok} Human Tokens</span>}
            {it.source === "client" && <span className="cbe-chip client">client proposed</span>}
            {it.status !== "accepted" && it.source === "edge8" && <span className="cbe-chip">{it.status}</span>}
            {it.client_priority && (
              <span className="cbe-chip client">client set: {PRIORITY_LABEL[it.client_priority]}</span>
            )}
            {it.client_note && <span className="cbe-chip client">note: {it.client_note}</span>}
          </div>
        </div>

        {isEditing && (
          <div className="cbe-form">
            <div className="full">
              <label>Title</label>
              <input value={d.title ?? ""} onChange={(e) => setD({ title: e.target.value })} />
            </div>
            <div>
              <label>Group</label>
              <select value={d.group_key} onChange={(e) => setD({ group_key: e.target.value as BacklogGroupKey })}>
                {BACKLOG_GROUPS.map((g) => <option key={g} value={g}>{GROUP_META[g].title}</option>)}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={d.status} onChange={(e) => setD({ status: e.target.value as BacklogItem["status"] })}>
                {BACKLOG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label>Who</label>
              <input value={d.who ?? ""} onChange={(e) => setD({ who: e.target.value })} />
            </div>
            <div>
              <label>Needs (comma separated)</label>
              <input value={d.needsCsv ?? ""} onChange={(e) => setD({ needsCsv: e.target.value })} />
            </div>
            <div>
              <label>Human Tokens (low)</label>
              <input type="number" value={d.token_low ?? ""} onChange={(e) => setD({ token_low: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div>
              <label>Human Tokens (high)</label>
              <input type="number" value={d.token_high ?? ""} onChange={(e) => setD({ token_high: e.target.value === "" ? null : Number(e.target.value) })} />
            </div>
            <div className="full">
              <label>Today (current state)</label>
              <textarea value={d.today_state ?? ""} onChange={(e) => setD({ today_state: e.target.value })} />
            </div>
            <div className="full">
              <label>Build (what we&apos;d build)</label>
              <textarea value={d.build_desc ?? ""} onChange={(e) => setD({ build_desc: e.target.value })} />
            </div>
          </div>
        )}

        <div className="cbe-actions">
          {it.status === "proposed" && (
            <button type="button" className="cbe-link" disabled={pending} onClick={() => run(() => acceptProposedItem(it.id))}>
              Accept into plan
            </button>
          )}
          {isEditing ? (
            <>
              <button type="button" className="cbe-link" disabled={pending} onClick={() => run(() => updateBacklogItem(it.id, draftToInput(d)), () => setEditing(null))}>
                Save
              </button>
              <button type="button" className="cbe-link" onClick={() => setEditing(null)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="cbe-link" onClick={() => { setDrafts((p) => ({ ...p, [it.id]: itemToDraft(it) })); setEditing(it.id); }}>
              Edit
            </button>
          )}
          {it.archived_at ? (
            <button type="button" className="cbe-link" disabled={pending} onClick={() => run(() => restoreBacklogItem(it.id))}>Restore</button>
          ) : (
            <button type="button" className="cbe-link danger" disabled={pending} onClick={() => run(() => archiveBacklogItem(it.id))}>Archive</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="cbe">
      <style dangerouslySetInnerHTML={{ __html: STYLES }} />
      {err && <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>{err}</div>}

      {proposed.length > 0 && (
        <div className="cbe-proposed">
          <h3>Client proposed {proposed.length} item{proposed.length === 1 ? "" : "s"} — review below</h3>
          <div style={{ fontSize: 13, color: "#8a6512" }}>
            {proposed.map((p) => p.title).join(" · ")}
          </div>
        </div>
      )}

      {BACKLOG_GROUPS.map((g) => {
        const groupItems = items.filter((i) => i.group_key === g);
        const meta = GROUP_META[g];
        return (
          <div key={g} className="cbe-group">
            <div className="cbe-group-head">
              <span className="cbe-step">{meta.step}</span>
              <span className="cbe-group-title">{meta.title}</span>
            </div>
            <div className="cbe-group-intro">{meta.intro}</div>
            {groupItems.map(renderItem)}

            {addGroup === g ? (
              <div className="cbe-item">
                <div className="cbe-form">
                  <div className="full">
                    <label>Title</label>
                    <input autoFocus value={addDraft.title ?? ""} onChange={(e) => setAddDraft({ ...addDraft, title: e.target.value })} />
                  </div>
                  <div>
                    <label>Priority</label>
                    <select value={addDraft.edge8_priority ?? "next"} onChange={(e) => setAddDraft({ ...addDraft, edge8_priority: e.target.value as BacklogPriority })}>
                      {BACKLOG_PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Who</label>
                    <input value={addDraft.who ?? ""} onChange={(e) => setAddDraft({ ...addDraft, who: e.target.value })} />
                  </div>
                  <div className="full">
                    <label>Build (optional)</label>
                    <textarea value={addDraft.build_desc ?? ""} onChange={(e) => setAddDraft({ ...addDraft, build_desc: e.target.value })} />
                  </div>
                </div>
                <div className="cbe-actions">
                  <button type="button" className="cbe-link" disabled={pending} onClick={() => run(() => createBacklogItem(companyId, { ...draftToInput({ ...addDraft, group_key: g }) }), () => { setAddGroup(null); setAddDraft({}); })}>
                    Add item
                  </button>
                  <button type="button" className="cbe-link" onClick={() => { setAddGroup(null); setAddDraft({}); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className="cbe-link cbe-add" onClick={() => { setAddGroup(g); setAddDraft({ edge8_priority: "next" }); }}>
                + Add item to {meta.step}
              </button>
            )}
          </div>
        );
      })}
      {items.length === 0 && !showArchived && (
        <div style={{ color: "#797c82", fontSize: 14 }}>No backlog items yet. Add the first one above.</div>
      )}
    </div>
  );
}
