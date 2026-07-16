import { requireTeamMember } from "@/lib/team-auth";
import { getOwnProfile, teamRead } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatDate, humanize } from "@/lib/admin/format";
import Link from "next/link";

export const dynamic = "force-dynamic";

// Portal home. Everything here is self-scoped: the profile is fetched by the
// actor's own team_member id, and "next time off" is filtered to the actor.
type NextLeave = { start_date: string; end_date: string; leave_type: string; status: string };

// The full employee workspace, designed end-state-first: every touchpoint an
// employee will eventually reach lives here from day one. `href` present means
// the slice has shipped; absent renders a muted "Soon" card. Flip items to live
// by adding their route as each one ships.
type HubItem = { title: string; sub: string; ico: string; href?: string };

const HUB_LIVE: HubItem[] = [
  {
    title: "Time Off",
    sub: "Request leave and track what's approved.",
    ico: "☼",
    href: "/team/time-off",
  },
  {
    title: "My Profile",
    sub: "Your details, role, and emergency contact.",
    ico: "☺",
    href: "/team/profile",
  },
  {
    title: "Team Directory",
    sub: "Find anyone at Edge8 and who they report to.",
    ico: "☷",
    href: "/team/directory",
  },
  {
    title: "Ideas & Innovation",
    sub: "Submit a workflow AI should own; get a product plan back in seconds.",
    ico: "✦",
    href: "/team/ideas",
  },
];

const HUB_SOON: HubItem[] = [
  { title: "Company Announcements", sub: "What's happening across Edge8, in one feed.", ico: "◈" },
  { title: "HR Handbook", sub: "Policies, ways of working, and how we do things.", ico: "▤" },
  { title: "Health Insurance", sub: "Your coverage and how to make a claim.", ico: "♥" },
  { title: "1-1 Schedule", sub: "Your biweekly time with your manager, prepped and tracked.", ico: "◷" },
  { title: "Pulse Survey", sub: "A quick read on how the team is feeling.", ico: "▲" },
  { title: "Feedback", sub: "Give feedback and ask for it, any time.", ico: "✎" },
];

function HubCard({ item }: { item: HubItem }) {
  const body = (
    <>
      <span className="team-hub-ico" aria-hidden>
        {item.ico}
      </span>
      <span className="team-hub-title">
        {item.title}
        {!item.href && <span className="team-hub-soon">Soon</span>}
      </span>
      <span className="team-hub-sub">{item.sub}</span>
    </>
  );
  if (item.href) {
    return (
      <Link href={item.href} className="team-hub-card">
        {body}
      </Link>
    );
  }
  return <div className="team-hub-card is-soon">{body}</div>;
}

export default async function TeamHome() {
  const actor = await requireTeamMember();
  const profile = await getOwnProfile(actor);

  const today = new Date().toISOString().slice(0, 10);
  const { data: leaveRows } = await teamRead(
    actor,
    "time_off",
    "start_date, end_date, leave_type, status",
  )
    .eq("team_member_id", actor.teamMemberId)
    .gte("end_date", today)
    .in("status", ["requested", "approved"])
    .order("start_date", { ascending: true })
    .limit(1);
  const nextLeave = ((leaveRows ?? []) as unknown as NextLeave[])[0] ?? null;

  return (
    <>
      <PageHead
        eyebrow="Workspace"
        title={`Welcome, ${actor.displayName}`}
        sub={actor.role === "manager" ? "Manager workspace" : "Team workspace"}
      />

      <div className="mp-kpi-grid" style={{ marginBottom: 4 }}>
        <MetricCard
          label="Next time off"
          value={nextLeave ? formatDate(nextLeave.start_date) : "None scheduled"}
          sub={nextLeave ? `${humanize(nextLeave.leave_type)} · ${nextLeave.status}` : "Request time off soon"}
        />
        <MetricCard label="Department" value={profile?.departmentName || "—"} sub={profile?.positionTitle || undefined} />
        <MetricCard
          label="Manager"
          value={profile?.managerName || "—"}
          sub={profile?.start_date ? `Started ${formatDate(profile.start_date)}` : undefined}
        />
      </div>

      <h2 className="team-hub-heading">Your workspace</h2>
      <div className="team-hub-grid">
        {HUB_LIVE.map((item) => (
          <HubCard key={item.title} item={item} />
        ))}
      </div>

      <h2 className="team-hub-heading">On the way</h2>
      <div className="team-hub-grid">
        {HUB_SOON.map((item) => (
          <HubCard key={item.title} item={item} />
        ))}
      </div>
    </>
  );
}
