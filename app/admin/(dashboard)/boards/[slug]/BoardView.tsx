"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KanbanBoard, type KanbanColumn } from "@/components/admin/KanbanBoard";
import { Badge } from "@/components/admin/Badge";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { formatDate } from "@/lib/admin/format";
import {
  STAGE_WON,
  STAGE_LEAD,
  STAGE_NEUTRAL,
  STAGE_PROPOSAL,
  STAGE_DISCOVERY,
  STAGE_CONTRACT,
} from "@/lib/admin/stageColors";
import {
  AGING_DAYS,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  TASK_PRIORITIES,
  SUBJECT_COMMITMENT,
  SUBJECT_BACKLOG_ITEM,
  daysInColumn,
  type TaskPriority,
} from "@/lib/boards/types";
import type { BoardDetail, BoardCard, BoardPerson } from "@/lib/boards/data";
import {
  createCard,
  moveCard,
  updateCard,
  archiveCard,
  createSprint,
  setCardSprint,
  closeSprint,
  setCardRoadmapItem,
  setCardInternal,
  addBoardMember,
  removeBoardMember,
  updateBoard,
  archiveBoard,
  addSubtask,
  toggleSubtask,
} from "./actions";

const NONDONE_ACCENTS = [STAGE_NEUTRAL, STAGE_LEAD, STAGE_PROPOSAL, STAGE_DISCOVERY, STAGE_CONTRACT];

type Card = BoardCard & { columnId: string };

type Form = {
  id: string | null; // null = create
  columnId: string;
  title: string;
  priority: TaskPriority;
  assigneeId: string;
  dueDate: string;
  description: string;
  sprintId: string; // "" = no sprint
  origSprintId: string;
  subjectType: string | null; // commitment cards are not roadmap-linkable
  subjectLabel: string | null;
  roadmapItemId: string; // "" = none
  origRoadmapItemId: string;
  internal: boolean;
  origInternal: boolean;
};

export function BoardView({
  detail,
  canManage = false,
  teamOptions = [],
  clientOptions = [],
}: {
  detail: BoardDetail;
  canManage?: boolean;
  teamOptions?: BoardPerson[];
  clientOptions?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { board, columns, members, cards: sourceCards, sprints, backlogItems } = detail;
  const slug = board.slug;
  const isClientBoard = board.client_company_id != null;

  const activeSprints = useMemo(() => sprints.filter((s) => s.status === "active"), [sprints]);
  const sprintName = useMemo(() => new Map(sprints.map((s) => [s.id, s.name])), [sprints]);

  const [placement, setPlacement] = useState<Record<string, string>>({});
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [sprintFilter, setSprintFilter] = useState<string>(activeSprints[0]?.id ?? "all");
  const [banner, setBanner] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [sprintsOpen, setSprintsOpen] = useState(false);
  const [sprintForm, setSprintForm] = useState({ name: "", startsOn: "", endsOn: "", goal: "" });
  const [rollTarget, setRollTarget] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [boardName, setBoardName] = useState(board.name);
  const [boardDescription, setBoardDescription] = useState(board.description ?? "");
  const [boardClientId, setBoardClientId] = useState(board.client_company_id ?? "");
  const [newMemberId, setNewMemberId] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [saving, startSaving] = useTransition();

  const activeCard = form?.id ? sourceCards.find((c) => c.id === form.id) ?? null : null;

  function addSub() {
    if (!form?.id || !newSubtask.trim()) return;
    setBanner(null);
    startSaving(async () => {
      const r = await addSubtask(form.id!, newSubtask, slug);
      if (!r.ok) return setBanner(r.error);
      setNewSubtask("");
      router.refresh();
    });
  }
  function toggleSub(id: string, done: boolean) {
    setBanner(null);
    startSaving(async () => {
      const r = await toggleSubtask(id, done, slug);
      if (!r.ok) return setBanner(r.error);
      router.refresh();
    });
  }

  const memberIds = new Set(members.map((m) => m.id));
  const addableMembers = teamOptions.filter((p) => !memberIds.has(p.id));

  function saveSettings() {
    setBanner(null);
    startSaving(async () => {
      const r = await updateBoard(
        board.id,
        { name: boardName, description: boardDescription, clientCompanyId: boardClientId || null },
        slug,
      );
      if (!r.ok) return setBanner(r.error);
      router.refresh();
    });
  }
  function addMember() {
    if (!newMemberId) return;
    setBanner(null);
    startSaving(async () => {
      const r = await addBoardMember(board.id, newMemberId, slug);
      if (!r.ok) return setBanner(r.error);
      setNewMemberId("");
      router.refresh();
    });
  }
  function removeMember(personId: string) {
    setBanner(null);
    startSaving(async () => {
      const r = await removeBoardMember(board.id, personId, slug);
      if (!r.ok) return setBanner(r.error);
      router.refresh();
    });
  }
  function archiveThisBoard() {
    if (!confirm(`Archive board "${board.name}"? It disappears from everyone's boards.`)) return;
    setBanner(null);
    startSaving(async () => {
      const r = await archiveBoard(board.id);
      if (!r.ok) return setBanner(r.error);
      router.push("/admin/boards");
    });
  }

  const firstColumn = columns[0]?.id ?? "";

  const kanbanColumns: KanbanColumn[] = useMemo(() => {
    let nd = 0;
    return columns.map((c) => ({
      id: c.id,
      label: c.name,
      accent: c.is_done ? STAGE_WON : NONDONE_ACCENTS[nd++ % NONDONE_ACCENTS.length],
    }));
  }, [columns]);

  const cards: Card[] = useMemo(() => {
    return sourceCards
      .filter((c) => !assigneeFilter || c.assignee_id === assigneeFilter)
      .filter((c) => !priorityFilter || c.priority === priorityFilter)
      .filter((c) =>
        sprintFilter === "all"
          ? true
          : sprintFilter === "backlog"
            ? c.sprint_id == null
            : c.sprint_id === sprintFilter,
      )
      .map((c) => ({ ...c, columnId: placement[c.id] ?? c.board_column_id ?? firstColumn }));
  }, [sourceCards, assigneeFilter, priorityFilter, sprintFilter, placement, firstColumn]);

  const assigneeOptions = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m.name]));
    for (const c of sourceCards) {
      if (c.assignee_id && c.assignee_name && !map.has(c.assignee_id)) map.set(c.assignee_id, c.assignee_name);
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [members, sourceCards]);

  function move(cardId: string, toColumnId: string) {
    const prev = placement;
    setPlacement((p) => ({ ...p, [cardId]: toColumnId }));
    setBanner(null);
    moveCard(cardId, toColumnId, slug).then((r) => {
      if (!r.ok) {
        setPlacement(prev);
        setBanner(`Couldn't move card: ${r.error}`);
      } else {
        router.refresh();
      }
    });
  }

  function openCard(c: Card) {
    setForm({
      id: c.id,
      columnId: c.columnId,
      title: c.title,
      priority: c.priority,
      assigneeId: c.assignee_id ?? "",
      dueDate: c.due_date ?? "",
      description: c.description ?? "",
      sprintId: c.sprint_id ?? "",
      origSprintId: c.sprint_id ?? "",
      subjectType: c.subject_type,
      subjectLabel: c.subject_label,
      roadmapItemId: c.subject_type === SUBJECT_BACKLOG_ITEM ? c.subject_id ?? "" : "",
      origRoadmapItemId: c.subject_type === SUBJECT_BACKLOG_ITEM ? c.subject_id ?? "" : "",
      internal: c.internal,
      origInternal: c.internal,
    });
  }

  function openCreate(columnId: string) {
    const preset = sprintFilter !== "all" && sprintFilter !== "backlog" ? sprintFilter : "";
    setForm({
      id: null,
      columnId,
      title: "",
      priority: "p3",
      assigneeId: "",
      dueDate: "",
      description: "",
      sprintId: preset,
      origSprintId: "",
      subjectType: null,
      subjectLabel: null,
      roadmapItemId: "",
      origRoadmapItemId: "",
      internal: false,
      origInternal: false,
    });
  }

  function save() {
    if (!form) return;
    setBanner(null);
    startSaving(async () => {
      let cardId = form.id;
      if (form.id) {
        const r = await updateCard(
          form.id,
          {
            title: form.title,
            description: form.description,
            priority: form.priority,
            assigneeId: form.assigneeId || null,
            dueDate: form.dueDate || null,
          },
          slug,
        );
        if (!r.ok) return setBanner(r.error);
        if (form.sprintId !== form.origSprintId) {
          const sr = await setCardSprint(form.id, form.sprintId || null, slug);
          if (!sr.ok) return setBanner(sr.error);
        }
      } else {
        const r = await createCard({
          boardId: board.id,
          columnId: form.columnId,
          title: form.title,
          priority: form.priority,
          assigneeId: form.assigneeId || undefined,
          dueDate: form.dueDate || undefined,
          description: form.description || undefined,
          internal: isClientBoard ? form.internal : undefined,
        });
        if (!r.ok) return setBanner(r.error);
        cardId = r.id ?? null;
        if (form.sprintId && cardId) {
          const sr = await setCardSprint(cardId, form.sprintId, slug);
          if (!sr.ok) return setBanner(sr.error);
        }
      }
      // Roadmap link (client boards, non-commitment cards) if it changed.
      if (isClientBoard && form.subjectType !== SUBJECT_COMMITMENT && cardId && form.roadmapItemId !== form.origRoadmapItemId) {
        const rr = await setCardRoadmapItem(cardId, form.roadmapItemId || null, slug);
        if (!rr.ok) return setBanner(rr.error);
      }
      // Internal flag on existing cards (client boards) if it changed. New cards
      // set it atomically in createCard above, so no client-visible window.
      if (isClientBoard && form.id && form.internal !== form.origInternal) {
        const ir = await setCardInternal(form.id, form.internal, slug);
        if (!ir.ok) return setBanner(ir.error);
      }
      setForm(null);
      router.refresh();
    });
  }

  function archive() {
    if (!form?.id) return;
    setBanner(null);
    startSaving(async () => {
      const r = await archiveCard(form.id!, slug);
      if (!r.ok) return setBanner(r.error);
      setForm(null);
      router.refresh();
    });
  }

  function addSprint() {
    if (!sprintForm.name.trim()) return setBanner("Name the sprint.");
    setBanner(null);
    startSaving(async () => {
      const r = await createSprint(
        board.id,
        {
          name: sprintForm.name,
          startsOn: sprintForm.startsOn || undefined,
          endsOn: sprintForm.endsOn || undefined,
          goal: sprintForm.goal || undefined,
        },
        slug,
      );
      if (!r.ok) return setBanner(r.error);
      setSprintForm({ name: "", startsOn: "", endsOn: "", goal: "" });
      router.refresh();
    });
  }

  function closeOne(sprintId: string) {
    setBanner(null);
    startSaving(async () => {
      const target = rollTarget[sprintId] || null;
      const r = await closeSprint(sprintId, target, slug);
      if (!r.ok) return setBanner(r.error);
      if (sprintFilter === sprintId) setSprintFilter("all");
      router.refresh();
    });
  }

  const columnName = (id: string) => columns.find((c) => c.id === id)?.name ?? "—";

  return (
    <>
      <div className="admin-toolbar" style={{ gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="admin-btn admin-btn--primary admin-btn--sm" onClick={() => openCreate(firstColumn)}>
          New card
        </button>
        {sprints.length > 0 && (
          <select
            className="admin-select"
            style={{ maxWidth: 220 }}
            value={sprintFilter}
            onChange={(e) => setSprintFilter(e.target.value)}
            aria-label="Filter by sprint"
          >
            <option value="all">All sprints</option>
            <option value="backlog">Backlog (no sprint)</option>
            {activeSprints.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            {sprints
              .filter((s) => s.status === "closed")
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} (closed)
                </option>
              ))}
          </select>
        )}
        <select
          className="admin-select"
          style={{ maxWidth: 200 }}
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          aria-label="Filter by assignee"
        >
          <option value="">All assignees</option>
          {assigneeOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          className="admin-select"
          style={{ maxWidth: 140 }}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          aria-label="Filter by priority"
        >
          <option value="">All priorities</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
        <button className="admin-btn admin-btn--sm" onClick={() => setSprintsOpen(true)}>
          Sprints
        </button>
        <span className="admin-cell-muted" style={{ marginLeft: "auto", fontSize: 12 }}>
          Amber clock = in column &gt; {AGING_DAYS} days
        </span>
        {canManage && (
          <button className="admin-btn admin-btn--sm" onClick={() => setSettingsOpen(true)}>
            ⚙ Board settings
          </button>
        )}
      </div>

      {banner && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 12 }}>
          {banner}
        </div>
      )}

      <KanbanBoard<Card>
        columns={kanbanColumns}
        cards={cards}
        onMove={move}
        onCardClick={openCard}
        columnFooter={(col) => (
          <button
            className="admin-btn admin-btn--sm"
            style={{ margin: "0 8px 8px", width: "calc(100% - 16px)" }}
            onClick={() => openCreate(col.id)}
          >
            + Add a card
          </button>
        )}
        renderCard={(c) => {
          const days = daysInColumn(c.last_moved_at);
          const aging = days >= AGING_DAYS && c.status !== "done";
          const overdue =
            c.due_date != null && c.status !== "done" && c.due_date < new Date().toISOString().slice(0, 10);
          return (
            <>
              <div className="sap-card-title">{c.title}</div>
              <div className="sap-card-meta">
                <Badge tone={PRIORITY_TONE[c.priority]}>{PRIORITY_LABEL[c.priority]}</Badge>
                {c.subject_type === SUBJECT_COMMITMENT && <Badge tone="ok">Commitment</Badge>}
                {c.subject_type === SUBJECT_BACKLOG_ITEM && <Badge tone="info">Roadmap</Badge>}
                {c.agent && <Badge tone="neutral">Agent</Badge>}
                {c.sprint_id && sprintName.get(c.sprint_id) && (
                  <Badge tone="info">{sprintName.get(c.sprint_id)}</Badge>
                )}
                {c.internal && <Badge tone="neutral">Internal</Badge>}
              </div>
              <div className="sap-card-meta">
                <span className="sap-card-sub">{c.assignee_name ?? "Unassigned"}</span>
                {c.due_date && (
                  <span
                    className="sap-card-sub"
                    style={{ marginLeft: "auto", color: overdue ? "var(--admin-err-ink)" : undefined }}
                  >
                    {formatDate(c.due_date)}
                  </span>
                )}
              </div>
              {c.subtasks.length > 0 && (
                <div className="sap-card-sub" style={{ marginTop: 4 }}>
                  ☑ {c.subtasks.filter((s) => s.done).length}/{c.subtasks.length} subtasks
                </div>
              )}
              {aging && (
                <div className="sap-card-sub" style={{ color: "var(--admin-warn-ink)", marginTop: 4 }}>
                  ◷ {days}d in column
                </div>
              )}
            </>
          );
        }}
      />

      <DetailDrawer
        open={form !== null}
        onClose={() => setForm(null)}
        eyebrow={form?.id ? "Card" : "New card"}
        title={form?.id ? form.title || "Card" : "New card"}
      >
        {form && (
          <div className="admin-form">
            <div className="admin-field">
              <label className="admin-label">Title</label>
              <input
                className="admin-input"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="What needs doing?"
                autoFocus
              />
            </div>

            {form.subjectType === SUBJECT_COMMITMENT && (
              <div
                className="admin-field"
                style={{
                  background: "var(--admin-ok-bg)",
                  color: "var(--admin-ok-ink)",
                  borderRadius: "var(--admin-radius-sm)",
                  padding: "10px 12px",
                }}
              >
                <label className="admin-label" style={{ color: "var(--admin-ok-ink)" }}>
                  Linked commitment
                </label>
                <div>{form.subjectLabel ?? "Coaching commitment"}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  Moving this card to a done column marks the commitment kept.
                </div>
              </div>
            )}

            {form.id && (
              <div className="admin-field">
                <label className="admin-label">Column</label>
                <div className="admin-cell-strong">
                  {columnName(placement[form.id] ?? form.columnId)}
                  <span className="admin-cell-muted" style={{ fontWeight: 400, marginLeft: 8 }}>
                    (drag the card to move)
                  </span>
                </div>
              </div>
            )}

            <div className="admin-field">
              <label className="admin-label">Priority</label>
              <select
                className="admin-select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as TaskPriority })}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-field">
              <label className="admin-label">Assignee</label>
              <select
                className="admin-select"
                value={form.assigneeId}
                onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}
              >
                <option value="">Unassigned</option>
                {assigneeOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            {activeSprints.length > 0 && (
              <div className="admin-field">
                <label className="admin-label">Sprint</label>
                <select
                  className="admin-select"
                  value={form.sprintId}
                  onChange={(e) => setForm({ ...form, sprintId: e.target.value })}
                >
                  <option value="">No sprint (backlog)</option>
                  {activeSprints.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isClientBoard && form.subjectType !== SUBJECT_COMMITMENT && (
              <div className="admin-field">
                <label className="admin-label">Roadmap item</label>
                <select
                  className="admin-select"
                  value={form.roadmapItemId}
                  onChange={(e) => setForm({ ...form, roadmapItemId: e.target.value })}
                >
                  <option value="">Not linked</option>
                  {backlogItems.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {isClientBoard && (
              <div className="admin-field">
                <label className="admin-label" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={form.internal}
                    onChange={(e) => setForm({ ...form, internal: e.target.checked })}
                  />
                  Internal (hidden from the client portal)
                </label>
              </div>
            )}

            <div className="admin-field">
              <label className="admin-label">Due date</label>
              <input
                className="admin-input"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>

            <div className="admin-field">
              <label className="admin-label">Description</label>
              <textarea
                className="admin-textarea"
                rows={4}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            {form.id && (
              <div className="admin-field">
                <label className="admin-label">
                  Subtasks
                  {activeCard && activeCard.subtasks.length > 0
                    ? ` (${activeCard.subtasks.filter((s) => s.done).length}/${activeCard.subtasks.length})`
                    : ""}
                </label>
                {activeCard?.subtasks.map((s) => (
                  <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "4px 0" }}>
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={(e) => toggleSub(s.id, e.target.checked)}
                      disabled={saving}
                    />
                    <span style={{ textDecoration: s.done ? "line-through" : undefined, color: s.done ? "var(--admin-muted)" : undefined }}>
                      {s.title}
                    </span>
                  </label>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input
                    className="admin-input"
                    placeholder="Add a subtask…"
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addSub();
                      }
                    }}
                    style={{ flex: 1 }}
                  />
                  <button className="admin-btn" onClick={addSub} disabled={saving || !newSubtask.trim()}>
                    Add
                  </button>
                </div>
              </div>
            )}

            <div className="admin-form-actions" style={{ display: "flex", gap: 8 }}>
              <button className="admin-btn admin-btn--primary" onClick={save} disabled={saving}>
                {saving ? "Saving…" : form.id ? "Save" : "Create card"}
              </button>
              {form.id && (
                <button className="admin-btn admin-btn--danger" onClick={archive} disabled={saving}>
                  Archive
                </button>
              )}
            </div>
          </div>
        )}
      </DetailDrawer>

      <DetailDrawer open={sprintsOpen} onClose={() => setSprintsOpen(false)} eyebrow="Board" title="Sprints">
        <div className="admin-form">
          <div className="admin-field">
            <label className="admin-label">New sprint</label>
            <input
              className="admin-input"
              placeholder="Name (e.g. Aug 18-29)"
              value={sprintForm.name}
              onChange={(e) => setSprintForm({ ...sprintForm, name: e.target.value })}
            />
          </div>
          <div className="admin-field" style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <label className="admin-label">Starts</label>
              <input
                className="admin-input"
                type="date"
                value={sprintForm.startsOn}
                onChange={(e) => setSprintForm({ ...sprintForm, startsOn: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="admin-label">Ends</label>
              <input
                className="admin-input"
                type="date"
                value={sprintForm.endsOn}
                onChange={(e) => setSprintForm({ ...sprintForm, endsOn: e.target.value })}
              />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">Goal (optional)</label>
            <input
              className="admin-input"
              value={sprintForm.goal}
              onChange={(e) => setSprintForm({ ...sprintForm, goal: e.target.value })}
            />
          </div>
          <div className="admin-form-actions">
            <button className="admin-btn admin-btn--primary" onClick={addSprint} disabled={saving}>
              Add sprint
            </button>
          </div>

          {sprints.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <label className="admin-label">Existing</label>
              {sprints.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 0",
                    borderTop: "1px solid var(--admin-line)",
                    flexWrap: "wrap",
                  }}
                >
                  <span className="admin-cell-strong">{s.name}</span>
                  <Badge tone={s.status === "active" ? "ok" : "neutral"}>{s.status}</Badge>
                  {s.status === "active" && (
                    <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                      <select
                        className="admin-select"
                        value={rollTarget[s.id] ?? ""}
                        onChange={(e) => setRollTarget({ ...rollTarget, [s.id]: e.target.value })}
                        aria-label="Roll unfinished to"
                        style={{ maxWidth: 160 }}
                      >
                        <option value="">Roll to backlog</option>
                        {activeSprints
                          .filter((o) => o.id !== s.id)
                          .map((o) => (
                            <option key={o.id} value={o.id}>
                              Roll to {o.name}
                            </option>
                          ))}
                      </select>
                      <button className="admin-btn admin-btn--sm" onClick={() => closeOne(s.id)} disabled={saving}>
                        Close
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DetailDrawer>

      <DetailDrawer open={settingsOpen} onClose={() => setSettingsOpen(false)} eyebrow="Board" title="Board settings">
        <div className="admin-form">
          <div className="admin-field">
            <label className="admin-label">Name</label>
            <input className="admin-input" value={boardName} onChange={(e) => setBoardName(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">Description</label>
            <textarea
              className="admin-textarea"
              rows={2}
              value={boardDescription}
              onChange={(e) => setBoardDescription(e.target.value)}
              placeholder="What this board is for"
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Client</label>
            <select
              className="admin-select"
              value={boardClientId}
              onChange={(e) => setBoardClientId(e.target.value)}
            >
              <option value="">No client (internal board)</option>
              {clientOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <p className="admin-hint">A client board is read-only in that client&apos;s portal.</p>
          </div>
          <div className="admin-form-actions">
            <button className="admin-btn admin-btn--primary" onClick={saveSettings} disabled={saving}>
              Save
            </button>
          </div>

          <div style={{ marginTop: 18 }}>
            <label className="admin-label">Members ({members.length})</label>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 0",
                  borderTop: "1px solid var(--admin-line)",
                }}
              >
                <span className="admin-cell-strong" style={{ flex: 1 }}>
                  {m.name}
                </span>
                <button className="admin-btn admin-btn--sm" onClick={() => removeMember(m.id)} disabled={saving}>
                  Remove
                </button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <select
                className="admin-select"
                value={newMemberId}
                onChange={(e) => setNewMemberId(e.target.value)}
                aria-label="Add member"
                style={{ flex: 1 }}
              >
                <option value="">Add a member…</option>
                {addableMembers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button className="admin-btn" onClick={addMember} disabled={saving || !newMemberId}>
                Add
              </button>
            </div>
          </div>

          <div style={{ marginTop: 18, borderTop: "1px solid var(--admin-line)", paddingTop: 12 }}>
            <button className="admin-btn admin-btn--danger" onClick={archiveThisBoard} disabled={saving}>
              Archive board
            </button>
          </div>
        </div>
      </DetailDrawer>
    </>
  );
}
