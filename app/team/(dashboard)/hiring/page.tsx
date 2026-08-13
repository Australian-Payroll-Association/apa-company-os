import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { getTeamHiring } from "@/lib/team/hiring";

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

function fmt(iso: string | null): string {
  if (!iso) return "-";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// /team/hiring, managers only, for now (Dave, 2026-08-13). Read-only: open
// reqs, who is in flight, the interview loop each role runs, and where this
// manager personally sits in those loops. Everything here is written from
// /admin/talent.
export default async function TeamHiringPage() {
  const actor = await requireTeamMember();
  if (actor.role !== "manager") redirect("/team");

  const { reqs, mySlots, departmentScoped } = await getTeamHiring(actor);
  const totalActive = reqs.reduce((n, r) => n + r.activeCount, 0);

  return (
    <>
      <PageHead
        eyebrow="My Team"
        title="Hiring"
        sub={
          reqs.length === 0
            ? "No open roles"
            : `${reqs.length} open ${reqs.length === 1 ? "role" : "roles"} · ${totalActive} in flight`
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {mySlots.length > 0 && (
          <section className="admin-card coach-section">
            <div className="admin-card-title">Your interviews</div>
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
