import { requireTeamMember } from "@/lib/team-auth";
import { getOwnProfile, teamRead } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { formatDate, humanize } from "@/lib/admin/format";
import { OnboardingWalkthrough } from "@/components/team/OnboardingWalkthrough";
import { TeamCollage } from "@/components/team/TeamCollage";
import { StartHerePanel, bucketForRole } from "@/components/team/StartHerePanel";
import { randomGalleryPhotos, collageAvatars } from "@/lib/gallery";
import { allPosts } from "@/lib/postData";
import { setOnboardingDone } from "./actions";
import Link from "next/link";

// The core teaching every new hire reads first; the rest of the "Start here"
// panel is the newest posts by date.
const CORE_TEACHING_SLUG = "the-other-50-percent-of-leadership";

export const dynamic = "force-dynamic";

// Portal home. Everything here is self-scoped: the profile is fetched by the
// actor's own team_member id, and "next time off" is filtered to the actor.
type NextLeave = { start_date: string; end_date: string; leave_type: string; status: string };

// The full employee workspace, designed end-state-first: every touchpoint an
// employee will eventually reach lives here from day one. Shipped slices are
// cards in HUB_LIVE; unshipped ones sit in HUB_SOON as a quiet pill row. Ship
// an item by moving it to HUB_LIVE with its route as `href`.
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
  if (!item.href) return null;
  return (
    <Link href={item.href} className="team-hub-card">
      <span className="team-hub-ico" aria-hidden>
        {item.ico}
      </span>
      <span className="team-hub-title">{item.title}</span>
      <span className="team-hub-sub">{item.sub}</span>
    </Link>
  );
}

export default async function TeamHome() {
  const actor = await requireTeamMember();
  const profile = await getOwnProfile(actor);
  // Exactly four photos and four faces, drawn fresh on every load — a fixed
  // composition with rotating content, not a wall of everything.
  const [collagePhotos, collagePeople] = await Promise.all([
    randomGalleryPhotos(4),
    collageAvatars(4),
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

  // The "Start here" panel is a first-use state, not a separate page: shown
  // while the actor is in pre-boarding or probation (employment_stage), then it
  // drops away once they are confirmed.
  const isFirstUse =
    profile?.employmentStage === "pre_boarding" || profile?.employmentStage === "probation";
  const coreTeaching = allPosts.find((p) => p.slug === CORE_TEACHING_SLUG) ?? null;
  const recentPosts = [...allPosts]
    .filter((p) => p.slug !== CORE_TEACHING_SLUG)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);
  const roleBucket = bucketForRole(
    profile?.positionTitle ?? null,
    profile?.departmentName ?? null,
  );

  return (
    <>
      <PageHead eyebrow={dateLine} title={`${greeting}, ${actor.displayName}`} sub={heroSub} />

      {/* People first: the band of faces and moments sits directly under the
          greeting, then the personal facts, then the tools. */}
      <TeamCollage photos={collagePhotos} avatars={collagePeople} />

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

      {isFirstUse && coreTeaching && (
        <StartHerePanel
          coreTeaching={coreTeaching}
          recentPosts={recentPosts}
          roleBucket={roleBucket}
        />
      )}

      <h2 className="team-hub-heading">Your workspace</h2>
      <div className="team-hub-grid">
        {HUB_LIVE.map((item) => (
          <HubCard key={item.title} item={item} />
        ))}
      </div>

      {/* Coming features state the ambition without competing with the live
          tools: one quiet row of pills instead of a second card grid. */}
      <h2 className="team-hub-heading">On the way</h2>
      <div className="team-soon-row">
        {HUB_SOON.map((item) => (
          <span key={item.title} className="team-soon-pill" title={item.sub}>
            <span aria-hidden>{item.ico}</span> {item.title}
          </span>
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
