"use client";

import { useRef, useState, useTransition } from "react";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { Badge } from "@/components/admin/Badge";
import { uploadOnboardingPlan, toggleDay1Task } from "./actions";

// Mirror of CYCLE_STAGES in lib/onboarding-cycle.ts — duplicated here because
// that lib is server-only (service-role client) and this is a client component.
const STAGE_COLUMNS = [
  { key: "preboarding", label: "Preboarding" },
  { key: "day_1", label: "Day 1 · Orientation" },
  { key: "day_8", label: "Day 8 · Feedback" },
  { key: "day_45", label: "45 Day Review" },
  { key: "day_60", label: "60 Day Decision" },
  { key: "day_180", label: "180 Day Stay Interview" },
] as const;

// The Onboarding Cycle board. Columns are states of the calendar, not drag
// targets — stages advance on the clock (daily cron + date math), so there is
// deliberately NO drag-and-drop: a manager cannot move someone to "60 Day
// Decision" and imply a promotion that never fired. All human actions live in
// the card drawer: upload the plan, tick Day 1 activities, follow the review.
// Reuses the admin kanban CSS (sap-*) the same way /team reuses PageHead.

export type BoardCard = {
  id: string;
  columnId: string;
  complete: boolean;
  name: string;
  avatarUrl: string | null;
  positionTitle: string | null;
  startDate: string | null;
  dayNumber: number | null;
  probationEndsOn: string | null;
  contractStartDate: string | null;
  planUploaded: boolean;
  planUploadedAt: string | null;
  day8SurveySentAt: string | null;
  day8Score: number | null;
  day45EmailSentAt: string | null;
  decision: string | null;
  decisionAt: string | null;
  promotedAt: string | null;
  day180SentAt: string | null;
  tasks: { id: string; title: string; done: boolean }[];
};

const STAGE_ACCENTS: Record<string, string> = {
  preboarding: "#94a3b8",
  day_1: "#38bdf8",
  day_8: "#818cf8",
  day_45: "#f59e0b",
  day_60: "#34d399",
  day_180: "#0f2c52",
};

const DECISION_LABEL: Record<string, string> = {
  offer_full_time: "Offer full time",
  extend_probation_30: "Extended 30 days",
  terminate: "Terminate",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function dayLabel(card: BoardCard): string {
  if (card.dayNumber === null) return "No start date";
  if (card.dayNumber < 1) return `Starts in ${1 - card.dayNumber}d`;
  return `Day ${card.dayNumber}`;
}

export function OnboardingBoard({ cards }: { cards: BoardCard[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const selected = cards.find((c) => c.id === selectedId) ?? null;

  function submitPlan(card: BoardCard, file: File) {
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await uploadOnboardingPlan(card.id, fd);
      if (!res.ok) setError(res.error);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  function toggleTask(taskId: string, done: boolean) {
    setError(null);
    startTransition(async () => {
      const res = await toggleDay1Task(taskId, done);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <>
      <div className="sap-kanban">
        {STAGE_COLUMNS.map((col) => {
          const colCards = cards.filter((c) => c.columnId === col.key);
          return (
            <div className="sap-col" key={col.key}>
              <div className="sap-col-head">
                <span className="sap-col-dot" style={{ background: STAGE_ACCENTS[col.key] }} />
                <span className="sap-col-label">{col.label}</span>
                <span className="sap-col-count">{colCards.length}</span>
              </div>
              <div className="sap-col-body">
                {colCards.map((card) => (
                  <div
                    key={card.id}
                    className="sap-card"
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(card.id)}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedId(card.id)}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {card.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.avatarUrl}
                          alt=""
                          width={28}
                          height={28}
                          style={{ borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <span
                          aria-hidden
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: "var(--tint, #eef2f7)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {card.name.slice(0, 1)}
                        </span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="admin-cell-strong" style={{ fontSize: 13 }}>
                          {card.name}
                        </div>
                        <div className="admin-cell-muted" style={{ fontSize: 12 }}>
                          {card.positionTitle ?? "—"}
                        </div>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginTop: 8,
                        fontSize: 11,
                      }}
                    >
                      <Badge>{dayLabel(card)}</Badge>
                      {!card.planUploaded && !card.complete && <Badge tone="err">Plan missing</Badge>}
                      {card.day8Score !== null && <Badge tone="info">Day 8: {card.day8Score}/5</Badge>}
                      {card.decision && (
                        <Badge tone={card.decision === "terminate" ? "err" : "ok"}>
                          {DECISION_LABEL[card.decision] ?? card.decision}
                        </Badge>
                      )}
                      {card.promotedAt && <Badge tone="ok">Full time ✓</Badge>}
                      {card.complete && <Badge tone="ok">Cycle complete ✓</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        eyebrow="Onboarding journey"
        title={selected?.name ?? ""}
      >
        {selected && (
          <div style={{ display: "grid", gap: 20 }}>
            <dl className="admin-kv">
              <div>
                <dt>Position</dt>
                <dd>{selected.positionTitle ?? "—"}</dd>
              </div>
              <div>
                <dt>Day 1</dt>
                <dd>{fmt(selected.startDate)}</dd>
              </div>
              <div>
                <dt>Probation ends</dt>
                <dd>{fmt(selected.probationEndsOn)}</dd>
              </div>
              <div>
                <dt>Contract start</dt>
                <dd>{fmt(selected.contractStartDate)}</dd>
              </div>
            </dl>

            <section>
              <h3 style={{ fontSize: 13, marginBottom: 8 }}>Onboarding plan</h3>
              {selected.planUploaded ? (
                <p style={{ fontSize: 13 }}>
                  Uploaded {fmt(selected.planUploadedAt)} ·{" "}
                  <a href={`/team/onboarding/plan/${selected.id}`} target="_blank" rel="noreferrer">
                    View plan
                  </a>
                </p>
              ) : (
                <p style={{ fontSize: 13 }} className="admin-cell-muted">
                  Not uploaded yet — due one week before Day 1. Daily reminders run until it is here.
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp"
                disabled={pending}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && selected) submitPlan(selected, f);
                }}
                style={{ marginTop: 8, fontSize: 13 }}
              />
            </section>

            <section>
              <h3 style={{ fontSize: 13, marginBottom: 8 }}>Day 1 orientation</h3>
              {selected.tasks.length === 0 ? (
                <p style={{ fontSize: 13 }} className="admin-cell-muted">
                  The three orientation sessions appear here once the journey starts.
                </p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6 }}>
                  {selected.tasks.map((t) => (
                    <li key={t.id} style={{ fontSize: 13 }}>
                      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={pending}
                          onChange={(e) => toggleTask(t.id, e.target.checked)}
                        />
                        <span style={t.done ? { textDecoration: "line-through", opacity: 0.6 } : undefined}>
                          {t.title} · 1 hour
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 style={{ fontSize: 13, marginBottom: 8 }}>Milestones</h3>
              <dl className="admin-kv">
                <div>
                  <dt>Day 8 survey</dt>
                  <dd>
                    {selected.day8Score !== null
                      ? `Answered · ${selected.day8Score}/5`
                      : selected.day8SurveySentAt
                        ? `Sent ${fmt(selected.day8SurveySentAt)} · awaiting answer`
                        : "Sends automatically on Day 8"}
                  </dd>
                </div>
                <div>
                  <dt>45-day review</dt>
                  <dd>
                    {selected.decision
                      ? `${DECISION_LABEL[selected.decision] ?? selected.decision} · ${fmt(selected.decisionAt)}`
                      : selected.day45EmailSentAt
                        ? `Review emailed ${fmt(selected.day45EmailSentAt)} · decision pending`
                        : "Review emails you 15 days before probation ends"}
                  </dd>
                </div>
                <div>
                  <dt>Day 60</dt>
                  <dd>
                    {selected.promotedAt
                      ? `Promoted to full time ${fmt(selected.promotedAt)}`
                      : "Automatic promotion at probation end after a pass decision"}
                  </dd>
                </div>
                <div>
                  <dt>Day 180</dt>
                  <dd>
                    {selected.day180SentAt
                      ? `Stay interview triggered ${fmt(selected.day180SentAt)}`
                      : "Stay-interview prompt goes to the Talent Director on Day 180"}
                  </dd>
                </div>
              </dl>
            </section>

            {error && (
              <p style={{ color: "#b91c1c", fontSize: 13 }} role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </DetailDrawer>
    </>
  );
}
