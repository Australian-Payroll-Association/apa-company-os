import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { getCoachRoster, type CoachRosterRow, type RosterAttention } from "@/lib/coaching/data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Coaching",
  description: "Your 1-1 coaching roster: FAST goals, cadence, commitments.",
};

// /team/coaching — the coach's dashboard, the in-app rebuild of the Lark
// "Team Coaching" wiki. Access is granted by coaching_profiles rows, not the
// manager role: a dotted-line coach sees exactly the people whose profile
// carries their coach_id, and nobody else (getCoachRoster injects the scope).
export default async function CoachingDashboardPage() {
  const actor = await requireTeamMember();
  const roster = await getCoachRoster(actor);
  if (roster.length === 0) redirect("/team");

  const attention = roster.flatMap((r) =>
    r.attention.map((a) => ({ name: r.member.name, profileId: r.profileId, a })),
  );

  return (
    <>
      <PageHead
        title="Coaching"
        sub={`${roster.length} ${roster.length === 1 ? "person" : "people"} on your roster · biweekly 1-1s, commitments, and growth trends`}
      />

      {attention.length > 0 && (
        <div className="admin-card coach-attention">
          <div className="admin-card-title">What needs attention</div>
          <ul className="coach-attention-list">
            {attention.map(({ name, profileId, a }, i) => (
              <li key={`${profileId}-${a.kind}-${i}`}>
                <Link href={`/team/coaching/${profileId}`}>{name}</Link> — {attentionLabel(a)}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="coach-roster">
        {roster.map((r) => (
          <RosterCard key={r.profileId} row={r} />
        ))}
      </div>
    </>
  );
}

function attentionLabel(a: RosterAttention): string {
  switch (a.kind) {
    case "overdue":
      return `last 1-1 was ${a.daysSince} days ago, over the cadence`;
    case "never_met":
      return "no 1-1 logged yet";
    case "goal_not_set":
      return "FAST goal not set";
    case "checkin_unanswered":
      return "mid-cycle check-in unanswered";
  }
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const ROOT_LABELS: Record<string, string> = {
  belonging: "Belonging",
  links: "Links",
  sacrifice: "Sacrifice",
  watching: "Watching",
};

function RosterCard({ row }: { row: CoachRosterRow }) {
  return (
    <Link href={`/team/coaching/${row.profileId}`} className="admin-card coach-card">
      <div className="coach-card-head">
        {row.member.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.member.avatarUrl} alt="" width={40} height={40} className="coach-avatar" />
        ) : (
          <span className="coach-avatar coach-avatar--empty" aria-hidden>
            {row.member.name.slice(0, 1)}
          </span>
        )}
        <div>
          <div className="coach-card-name">{row.member.name}</div>
          <div className="coach-card-role">{row.member.positionTitle ?? "—"}</div>
        </div>
        {row.attention.length > 0 && (
          <span className="admin-badge admin-badge--warn coach-card-flag">
            {row.attention.length} flag{row.attention.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      <div className="coach-card-goal">
        {row.activeGoals.length > 0 ? (
          <span>{row.activeGoals.join(" · ")}</span>
        ) : (
          <span className="admin-cell-muted">No active FAST goal</span>
        )}
        {row.activeGoals.length === 0 && <span className="admin-badge admin-badge--err">No goal</span>}
      </div>

      <div className="coach-card-meta">
        <span>
          <strong>{row.heldCount}</strong> 1-1{row.heldCount === 1 ? "" : "s"}
        </span>
        <span>
          Last <strong>{fmt(row.lastHeldOn)}</strong>
        </span>
        <span>
          Next <strong>{fmt(row.nextOneOnOneOn)}</strong>
        </span>
        <span>
          <strong>{row.openCommitments}</strong> open commitment{row.openCommitments === 1 ? "" : "s"}
        </span>
        <span title="Coach / Mentor / Direct on the last logged 1-1 — target 80/15/5">
          Mode{" "}
          <strong>
            {row.lastModeSplit
              ? `${row.lastModeSplit.coach}/${row.lastModeSplit.mentor}/${row.lastModeSplit.direct}`
              : "—"}
          </strong>
        </span>
        <span title="Loose engagement root (retention read)">
          Root <strong>{row.retentionRoot ? ROOT_LABELS[row.retentionRoot] : "—"}</strong>
        </span>
      </div>
    </Link>
  );
}
