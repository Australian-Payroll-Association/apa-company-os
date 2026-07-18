import { requireTeamMember } from "@/lib/team-auth";
import { getOwnProfile, teamRead } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { formatDate, humanize } from "@/lib/admin/format";
import { OnboardingWalkthrough } from "@/components/team/OnboardingWalkthrough";
import { TeamCollage } from "@/components/team/TeamCollage";
import { recentGalleryPhotos, collageAvatars } from "@/lib/gallery";
import { setOnboardingDone } from "./actions";
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
    title: "Org Chart",
    sub: "How Edge8 fits together — who reports to whom, at a glance.",
    ico: "⌥",
    href: "/team/org",
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
  const [collagePhotos, collagePeople] = await Promise.all([
    recentGalleryPhotos(5),
    collageAvatars(10),
  ]);

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

  // The company runs on Saigon time; server renders in UTC, so pin the zone
  // rather than showing the wrong day to everyone at 6am.
  const now = new Date();
  const dateLine = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "numeric", hour12: false }).format(now),
  );
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const heroSub =
    [profile?.departmentName, profile?.positionTitle].filter(Boolean).join(" · ") ||
    (actor.role === "manager" ? "Manager workspace" : "Team workspace");

  const onboardingDone = Boolean(
    (profile?.person?.metadata as Record<string, unknown> | null)?.onboarding_completed_at,
  );

  return (
    <>
      <PageHead eyebrow={dateLine} title={`${greeting}, ${actor.displayName}`} sub={heroSub} />

      <div className="team-glance">
        <div className="team-glance-cell">
          <span className="team-glance-label">Next time off</span>
          <span className="team-glance-value">{nextLeave ? formatDate(nextLeave.start_date) : "None scheduled"}</span>
          <span className="team-glance-note">
            {nextLeave ? (
              `${humanize(nextLeave.leave_type)} · ${nextLeave.status}`
            ) : (
              <Link href="/team/time-off">Request time off →</Link>
            )}
          </span>
        </div>
        <div className="team-glance-cell">
          <span className="team-glance-label">Manager</span>
          <span className="team-glance-value">{profile?.managerName || "—"}</span>
        </div>
        <div className="team-glance-cell">
          <span className="team-glance-label">With Edge8 since</span>
          <span className="team-glance-value">{profile?.start_date ? formatDate(profile.start_date) : "—"}</span>
        </div>
      </div>

      <TeamCollage photos={collagePhotos} avatars={collagePeople} />

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

      <OnboardingWalkthrough
        name={actor.displayName.split(/\s+/)[0]}
        startOpen={!onboardingDone}
        onFinish={setOnboardingDone}
      />
    </>
  );
}
