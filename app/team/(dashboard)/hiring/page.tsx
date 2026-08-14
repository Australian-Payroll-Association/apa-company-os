import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { getTeamHiring, getMyInterviewDay, type MyInterviewState } from "@/lib/team/hiring";

export const dynamic = "force-dynamic";

export const metadata = { title: "Hiring" };

// Booked times render in Saigon: everyone reading this page is on that clock.
function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Time only, for the day strip where the date is a given.
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// State to chip: colour and label for a booked interview on the day strip.
const INTERVIEW_STATE_CHIP: Record<MyInterviewState, { className: string; label: string }> = {
  up_next: { className: "admin-badge admin-badge--info", label: "Up next" },
  in_progress: { className: "admin-badge admin-badge--info admin-badge--dot", label: "In progress" },
  scorecard_due: { className: "admin-badge admin-badge--warn", label: "Scorecard due" },
  done: { className: "admin-badge admin-badge--ok", label: "Scored" },
};

// /team/hiring, managers only, for now (Dave, 2026-08-13). Read-only: open
// reqs, who is in flight, the interview loop each role runs, and where this
// manager personally sits in those loops. Everything here is written from
// /admin/talent.
export default async function TeamHiringPage() {
  const actor = await requireTeamMember();
  if (actor.role !== "manager") redirect("/team");

  const [{ reqs, mySlots, departmentScoped }, myDay] = await Promise.all([
    getTeamHiring(actor),
    getMyInterviewDay(actor),
  ]);
  const totalActive = reqs.reduce((n, r) => n + r.activeCount, 0);
  const dueCount = myDay.filter((i) => i.state === "scorecard_due").length;

  return (
    <>
      <PageHead
        eyebrow="My Team"
        title="Hiring"
        sub={
          reqs.length === 0
            ? "No open roles"
            : `${reqs.length} open ${reqs.length === 1 ? "role" : "roles"} · ${totalActive} in flight` +
              (myDay.length > 0 ? ` · ${myDay.length} interview${myDay.length === 1 ? "" : "s"} for you` : "")
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {myDay.length > 0 && (
          <section className="admin-card coach-section">
            <div className="admin-card-title">
              Your interviews{" "}
              {dueCount > 0 && (
                <span className="admin-badge admin-badge--warn">
                  {dueCount} scorecard{dueCount === 1 ? "" : "s"} due
                </span>
              )}
            </div>
            <div className="admin-hint">Today, and any conversation still waiting on your scorecard.</div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
              {myDay.map((iv) => {
                const chip = INTERVIEW_STATE_CHIP[iv.state];
                return (
                  <div key={iv.interviewId} className="loop-step loop-step--read">
                    <span className="loop-step-num" style={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmtTime(iv.scheduledAt)}
                    </span>
                    <div className="loop-step-body">
                      <div className="loop-step-head">
                        <strong>{iv.candidateName}</strong>
                        <span className={chip.className}>{chip.label}</span>
                      </div>
                      <div className="admin-cell-muted" style={{ fontSize: 13 }}>
                        {[
                          iv.stepName,
                          iv.reqTitle,
                          iv.durationMinutes != null ? `${iv.durationMinutes} min` : null,
                          iv.mode,
                          iv.isToday ? null : `was ${fmtWhen(iv.scheduledAt)}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {mySlots.length > 0 && (
          <section className="admin-card coach-section">
            <div className="admin-card-title">Your loops</div>
            <div className="admin-hint">
              The loops you are named in. Times appear here once the interview is booked.
            </div>
            {mySlots.map((s) => (
              <div key={`${s.reqId}-${s.stepName}-${s.position}`} className="loop-step loop-step--read">
                <span className="loop-step-num">{s.position}</span>
                <div className="loop-step-body">
                  <div className="loop-step-head">
                    <strong>{s.stepName}</strong>
                    <span className="admin-cell-muted">
                      {s.reqTitle}
                      {s.durationMinutes != null ? ` · ${s.durationMinutes} min` : ""}
                    </span>
                  </div>
                  {s.booked.length > 0 ? (
                    <div className="loop-step-booked">
                      {s.booked.map((b) => (
                        <div key={b.interviewId}>
                          <strong>{fmtWhen(b.scheduledAt)}</strong> with {b.candidateName}
                          {b.mode ? ` · ${b.mode}` : ""}
                          {b.status && b.status !== "scheduled" ? ` · ${b.status}` : ""}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="admin-cell-muted" style={{ fontSize: 13 }}>
                      {s.waiting === 0
                        ? "Nobody at the interview stage yet"
                        : `${s.waiting} candidate${s.waiting === 1 ? "" : "s"} at the interview stage, nothing booked`}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {reqs.length === 0 && (
          <section className="admin-card coach-section">
            <div className="admin-empty">
              No open roles{departmentScoped ? " in your department" : ""} right now.
            </div>
          </section>
        )}

        {reqs.map((req) => (
          <section key={req.id} className="admin-card coach-section">
            <div className="admin-card-title">
              {req.title}{" "}
              <span className="admin-cell-muted">
                ({req.activeCount} in flight
                {req.headcount ? ` · ${req.headcount} to hire` : ""})
              </span>
            </div>
            <div className="admin-hint">
              {[
                req.hiringManagerName
                  ? `Hiring manager: ${req.hiringManagerIsMe ? "you" : req.hiringManagerName}`
                  : null,
                req.location,
                req.employmentType,
                req.openedAt ? `opened ${fmt(req.openedAt)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>

            <div className="admin-label" style={{ marginTop: 14 }}>
              Interview loop
            </div>
            {req.loop.length === 0 ? (
              <div className="admin-empty">
                No loop defined for this role yet. It is set on the requisition in Admin.
              </div>
            ) : (
              req.loop.map((step, i) => (
                <div key={step.id} className="loop-step loop-step--read">
                  <span className="loop-step-num">{i + 1}</span>
                  <div className="loop-step-body">
                    <div className="loop-step-head">
                      <strong>{step.name}</strong>
                      {step.durationMinutes != null && (
                        <span className="admin-cell-muted">{step.durationMinutes} min</span>
                      )}
                    </div>
                    <div className="loop-step-people">
                      {step.interviewers.length === 0 ? (
                        <span className="admin-cell-muted">No interviewer assigned</span>
                      ) : (
                        step.interviewers.map((iv) => (
                          <span key={iv.personId} className="admin-badge">
                            {iv.name}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}

            <div className="admin-label" style={{ marginTop: 16 }}>
              Candidates
            </div>
            {req.candidates.length === 0 ? (
              <div className="admin-empty">Nobody has applied yet.</div>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Stage</th>
                    <th>Applied</th>
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {req.candidates.map((c) => (
                    <tr key={c.applicationId}>
                      <td>{c.name}</td>
                      <td>{c.stageName ?? "-"}</td>
                      <td>{fmt(c.appliedAt)}</td>
                      <td>{c.rating ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
