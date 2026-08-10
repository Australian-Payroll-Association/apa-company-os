import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { getMyCoaching } from "@/lib/coaching/data";
import { coachingMarkdownToHtml } from "@/lib/coaching/markdown";
import { MyCommitments } from "@/components/coaching/MyCommitments";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "My coaching",
  description: "Your FAST goal, commitments, and 1-1 recaps.",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// /team/my-coaching — the member tier. getMyCoaching selects ONLY
// member-visible fields (goal, OKRs, commitments, PUBLISHED recaps,
// check-ins); the private coaching tier never reaches this page's data.
export default async function MyCoachingPage() {
  const actor = await requireTeamMember();
  const my = await getMyCoaching(actor);
  if (!my) redirect("/team");

  const [okrsHtml, recapsHtml, checkinsHtml] = await Promise.all([
    my.okrsMarkdown ? coachingMarkdownToHtml(my.okrsMarkdown) : Promise.resolve(null),
    Promise.all(my.recaps.map((r) => coachingMarkdownToHtml(r.sharedSummaryMarkdown))),
    Promise.all(my.checkins.map((c) => coachingMarkdownToHtml(c.messageMarkdown))),
  ]);

  return (
    <>
      <PageHead
        title="My coaching"
        sub={`Biweekly 1-1s with ${my.coachName} · next one ${fmt(my.nextOneOnOneOn)}`}
      />

      <div className="coach-profile">
        <section className="admin-card coach-section">
          <div className="admin-card-title">Your FAST goal</div>
          {my.fastGoal ? (
            <>
              <div className="mycoach-goal">{my.fastGoal}</div>
              {my.fastGoalStatus === "draft" && (
                <div className="admin-hint">Still a draft — bring it to your next 1-1 to lock it in.</div>
              )}
            </>
          ) : (
            <div className="admin-empty">
              No FAST goal set yet — that&apos;s the first thing to shape with {my.coachName} in your next 1-1.
            </div>
          )}
          {okrsHtml && (
            <>
              <div className="coach-tier-label" style={{ marginTop: 16 }}>
                Your OKRs
              </div>
              <div className="idea-plan" dangerouslySetInnerHTML={{ __html: okrsHtml }} />
            </>
          )}
        </section>

        <section className="admin-card coach-section">
          <div className="admin-card-title">Your commitments</div>
          <div className="admin-hint">
            Update the status any time — it feeds your next 1-1 and answers the mid-cycle check-in.
          </div>
          <MyCommitments commitments={my.commitments} />
        </section>

        <section className="admin-card coach-section">
          <div className="admin-card-title">1-1 recaps</div>
          {my.recaps.length === 0 && (
            <div className="admin-empty">Recaps from your 1-1s will appear here after each meeting.</div>
          )}
          {my.recaps.map((r, i) => (
            <details key={r.id} className="mycoach-recap" open={i === 0}>
              <summary>
                <strong>{fmt(r.heldOn)}</strong>
              </summary>
              <div className="idea-plan" dangerouslySetInnerHTML={{ __html: recapsHtml[i] }} />
            </details>
          ))}
        </section>

        {my.checkins.length > 0 && (
          <section className="admin-card coach-section">
            <div className="admin-card-title">Check-ins</div>
            {my.checkins.map((c, i) => (
              <details key={c.id} className="mycoach-recap">
                <summary>
                  <strong>{fmt(c.sentAt)}</strong>{" "}
                  {!c.respondedAt && <span className="admin-badge admin-badge--warn">awaiting your update</span>}
                </summary>
                <div className="idea-plan" dangerouslySetInnerHTML={{ __html: checkinsHtml[i] }} />
              </details>
            ))}
          </section>
        )}
      </div>
    </>
  );
}
