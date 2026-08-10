// Team Coaching Cycle data access (docs/plans/2026-07-25-team-coaching-cycle.md).
// The ONLY sanctioned path to the coaching_* tables. The coaching relationship
// is coach_id on coaching_profiles — deliberately NOT the org chart's
// manager_id and NOT actor.teamMemberScope, because dotted lines are
// first-class (My reports to Mai but is coached by Dave). That is why these
// tables are not in lib/team/data.ts's SCOPE_ALLOWLIST: their scope column is
// the coach, not the member.
//
// TWO TIERS, ENFORCED HERE:
//   coach tier  — every function prefixed coach* filters coach_id =
//                 actor.teamMemberId (from the JWT-derived actor, never client
//                 input) and re-derives ownership before any write.
//   member tier — every function prefixed my* filters team_member_id =
//                 actor.teamMemberId and selects ONLY member-visible fields:
//                 FAST goal, OKRs, commitments, check-ins, and shared recaps
//                 that have been PUBLISHED. Prep, transcripts, private
//                 summaries, private profile, trends and context never appear
//                 in a member-tier select list.

import { companyOs } from "@/lib/supabase";
import type { TeamActor } from "@/lib/team-auth";

// (getEdgesLadderOptions below is also consumed by lib/coaching/ai.ts to give
// the generators live goal-ladder context.)

// ---- date helpers (YYYY-MM-DD, Saigon-date semantics, onboarding-cycle's) ---

export function saigonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function ms(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  return new Date(ms(iso) + days * 86400000).toISOString().slice(0, 10);
}

export function diffDays(fromISO: string, toISO: string): number {
  return Math.round((ms(toISO) - ms(fromISO)) / 86400000);
}

// ---- shared shapes ----------------------------------------------------------

export type FastGoalStatus = "not_set" | "draft" | "set";
export type GoalStatus = "draft" | "active" | "achieved" | "dropped";
export type PriorityStatus = "active" | "retired";
export type RetentionRoot = "belonging" | "links" | "sacrifice" | "watching";
export type OneOnOneStatus = "scheduled" | "held" | "skipped";
export type CommitmentOwner = "coach" | "member";

export const GOAL_STATUS_LABELS: Record<GoalStatus, string> = {
  draft: "Draft",
  active: "Active",
  achieved: "Achieved",
  dropped: "Dropped",
};

export const RETENTION_ROOT_LABELS: Record<RetentionRoot, string> = {
  belonging: "Belonging (fit)",
  links: "Links",
  sacrifice: "Sacrifice",
  watching: "Watching",
};
export type CommitmentStatus =
  | "open"
  | "on_track"
  | "needs_attention"
  | "completed"
  | "dropped"
  | "blocked";

export const OPEN_COMMITMENT_STATUSES: CommitmentStatus[] = [
  "open",
  "on_track",
  "needs_attention",
  "blocked",
];

export const COMMITMENT_STATUS_LABELS: Record<CommitmentStatus, string> = {
  open: "Open",
  on_track: "On track",
  needs_attention: "Needs attention",
  completed: "Completed",
  dropped: "Dropped",
  blocked: "Blocked",
};

type PersonEmbed = {
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

const displayName = (p: PersonEmbed | null): string =>
  p?.preferred_name || p?.full_name || p?.email || "—";

export type CoachingMember = {
  teamMemberId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  positionTitle: string | null;
};

const MEMBER_EMBED =
  "team_members:team_members!team_member_id(id, " +
  "people:people!person_id(full_name, preferred_name, email, avatar_url), " +
  "positions:positions!position_id(title))";

function toMember(raw: Record<string, unknown>): CoachingMember {
  const tm = one(raw.team_members as Record<string, unknown> | Record<string, unknown>[] | null);
  const person = one((tm?.people ?? null) as PersonEmbed | PersonEmbed[] | null);
  const pos = one((tm?.positions ?? null) as { title: string | null } | { title: string | null }[] | null);
  return {
    teamMemberId: (tm?.id as string) ?? "",
    name: displayName(person),
    email: person?.email ?? null,
    avatarUrl: person?.avatar_url ?? null,
    positionTitle: pos?.title ?? null,
  };
}

export type Commitment = {
  id: string;
  coachingProfileId: string;
  oneOnOneId: string | null;
  title: string;
  owner: CommitmentOwner;
  dueOn: string | null;
  status: CommitmentStatus;
  statusNote: string | null;
  statusUpdatedAt: string | null;
  createdAt: string;
};

function toCommitment(r: Record<string, unknown>): Commitment {
  return {
    id: r.id as string,
    coachingProfileId: r.coaching_profile_id as string,
    oneOnOneId: (r.one_on_one_id as string | null) ?? null,
    title: r.title as string,
    owner: r.owner as CommitmentOwner,
    dueOn: (r.due_on as string | null) ?? null,
    status: r.status as CommitmentStatus,
    statusNote: (r.status_note as string | null) ?? null,
    statusUpdatedAt: (r.status_updated_at as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}

const COMMITMENT_SELECT =
  "id, coaching_profile_id, one_on_one_id, title, owner, due_on, status, status_note, status_updated_at, created_at";

// ---- coach tier -------------------------------------------------------------

export type RosterAttention =
  | { kind: "overdue"; daysSince: number }
  | { kind: "never_met" }
  | { kind: "goal_not_set" }
  | { kind: "checkin_unanswered" };

export type CoachRosterRow = {
  profileId: string;
  member: CoachingMember;
  activeGoals: string[];
  retentionRoot: RetentionRoot | null;
  lastModeSplit: ModeSplit | null;
  cadenceDays: number;
  nextOneOnOneOn: string | null;
  lastHeldOn: string | null;
  heldCount: number;
  openCommitments: number;
  attention: RosterAttention[];
};

const PROFILE_SELECT =
  "id, team_member_id, coach_id, fast_goal, fast_goal_status, okrs_markdown, " +
  "private_profile_markdown, cadence_days, next_one_on_one_on, retention_root, active, " +
  MEMBER_EMBED;

// ---- FAST goals, priorities, OCEAN (v2) -------------------------------------
// Goals are TEAM-WIDE readable (the T in FAST); priorities are coach+member;
// the OCEAN profile is coach-authored and member-visible only once published.

export type EdgesLadder =
  | { kind: "objective"; id: string; label: string }
  | { kind: "key_result"; id: string; label: string }
  | { kind: "metric"; id: string; label: string; target: number | null; direction: "up" | "down"; latestValue: number | null };

export type CoachingGoal = {
  id: string;
  title: string;
  descriptionMarkdown: string | null;
  status: GoalStatus;
  quarterLabel: string | null;
  ladder: EdgesLadder | null;
  sortOrder: number;
};

export type CoachingPriority = {
  id: string;
  title: string;
  detailMarkdown: string | null;
  status: PriorityStatus;
  ladder: EdgesLadder | null;
  sortOrder: number;
};

export type OceanDimension = { rating: string | null; evidence: string | null };

export type OceanProfile = {
  id: string;
  openness: OceanDimension;
  conscientiousness: OceanDimension;
  extraversion: OceanDimension;
  agreeableness: OceanDimension;
  neuroticism: OceanDimension;
  snapshotMarkdown: string | null;
  guidanceMarkdown: string | null;
  published: boolean;
  updatedAt: string;
};

export const OCEAN_DIMENSIONS = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
] as const;
export type OceanDimensionKey = (typeof OCEAN_DIMENSIONS)[number];

// Everything the ladder picker offers, plus latest weekly readings so a
// metric-linked goal can show live progress. All three tables are small.
export type EdgesOptions = {
  objectives: { id: string; label: string }[];
  keyResults: { id: string; label: string }[];
  metrics: { id: string; label: string; target: number | null; direction: "up" | "down"; latestValue: number | null }[];
};

export async function getEdgesLadderOptions(): Promise<EdgesOptions> {
  const [objs, krs, mets] = await Promise.all([
    companyOs.from("objectives").select("id, title, sort_order").order("sort_order"),
    companyOs.from("key_results").select("id, title, sort_order").order("sort_order"),
    companyOs.from("metrics").select("id, name, target, direction").order("name"),
  ]);
  const metricRows = ((mets.data ?? []) as { id: string; name: string; target: number | null; direction: "up" | "down" }[]);
  const latest = new Map<string, number>();
  if (metricRows.length) {
    const { data: readings } = await companyOs
      .from("metric_readings")
      .select("metric_id, week_start, value")
      .in("metric_id", metricRows.map((m) => m.id))
      .order("week_start", { ascending: false });
    for (const r of (readings ?? []) as { metric_id: string; value: number }[]) {
      if (!latest.has(r.metric_id)) latest.set(r.metric_id, r.value);
    }
  }
  return {
    objectives: ((objs.data ?? []) as { id: string; title: string }[]).map((o) => ({ id: o.id, label: o.title })),
    keyResults: ((krs.data ?? []) as { id: string; title: string }[]).map((k) => ({ id: k.id, label: k.title })),
    metrics: metricRows.map((m) => ({
      id: m.id,
      label: m.name,
      target: m.target,
      direction: m.direction,
      latestValue: latest.get(m.id) ?? null,
    })),
  };
}

function resolveLadder(
  r: { objective_id: string | null; key_result_id: string | null; metric_id: string | null },
  edges: EdgesOptions,
): EdgesLadder | null {
  if (r.objective_id) {
    const o = edges.objectives.find((x) => x.id === r.objective_id);
    return o ? { kind: "objective", id: o.id, label: o.label } : null;
  }
  if (r.key_result_id) {
    const k = edges.keyResults.find((x) => x.id === r.key_result_id);
    return k ? { kind: "key_result", id: k.id, label: k.label } : null;
  }
  if (r.metric_id) {
    const m = edges.metrics.find((x) => x.id === r.metric_id);
    return m
      ? { kind: "metric", id: m.id, label: m.label, target: m.target, direction: m.direction, latestValue: m.latestValue }
      : null;
  }
  return null;
}

const GOAL_SELECT =
  "id, coaching_profile_id, title, description_markdown, status, quarter_label, objective_id, key_result_id, metric_id, sort_order";
const PRIORITY_SELECT =
  "id, coaching_profile_id, title, detail_markdown, status, objective_id, key_result_id, metric_id, sort_order";

type LadderRow = { objective_id: string | null; key_result_id: string | null; metric_id: string | null };

function toGoal(r: Record<string, unknown>, edges: EdgesOptions): CoachingGoal {
  return {
    id: r.id as string,
    title: r.title as string,
    descriptionMarkdown: (r.description_markdown as string | null) ?? null,
    status: r.status as GoalStatus,
    quarterLabel: (r.quarter_label as string | null) ?? null,
    ladder: resolveLadder(r as unknown as LadderRow, edges),
    sortOrder: (r.sort_order as number) ?? 0,
  };
}

function toPriority(r: Record<string, unknown>, edges: EdgesOptions): CoachingPriority {
  return {
    id: r.id as string,
    title: r.title as string,
    detailMarkdown: (r.detail_markdown as string | null) ?? null,
    status: r.status as PriorityStatus,
    ladder: resolveLadder(r as unknown as LadderRow, edges),
    sortOrder: (r.sort_order as number) ?? 0,
  };
}

const OCEAN_SELECT =
  "id, coaching_profile_id, openness_rating, openness_evidence, conscientiousness_rating, conscientiousness_evidence, " +
  "extraversion_rating, extraversion_evidence, agreeableness_rating, agreeableness_evidence, " +
  "neuroticism_rating, neuroticism_evidence, snapshot_markdown, guidance_markdown, published, updated_at";

function toOcean(r: Record<string, unknown>): OceanProfile {
  const dim = (k: string): OceanDimension => ({
    rating: (r[`${k}_rating`] as string | null) ?? null,
    evidence: (r[`${k}_evidence`] as string | null) ?? null,
  });
  return {
    id: r.id as string,
    openness: dim("openness"),
    conscientiousness: dim("conscientiousness"),
    extraversion: dim("extraversion"),
    agreeableness: dim("agreeableness"),
    neuroticism: dim("neuroticism"),
    snapshotMarkdown: (r.snapshot_markdown as string | null) ?? null,
    guidanceMarkdown: (r.guidance_markdown as string | null) ?? null,
    published: Boolean(r.published),
    updatedAt: r.updated_at as string,
  };
}

// True if the actor coaches at least one active profile — drives the sidebar
// entry and the /team/coaching gate. Coaching is granted by rows, not role:
// a dotted-line coach may not be anyone's org-chart manager.
export async function isCoach(actor: TeamActor): Promise<boolean> {
  const { count } = await companyOs
    .from("coaching_profiles")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", actor.teamMemberId)
    .eq("active", true);
  return (count ?? 0) > 0;
}

// True if the actor is themselves in a coaching cycle — drives the "My
// coaching" sidebar entry.
export async function isCoached(actor: TeamActor): Promise<boolean> {
  const { count } = await companyOs
    .from("coaching_profiles")
    .select("id", { count: "exact", head: true })
    .eq("team_member_id", actor.teamMemberId)
    .eq("active", true);
  return (count ?? 0) > 0;
}

// The coach's roster with everything the dashboard cards need. One query per
// table, joined in memory — the roster is a handful of people, not a feed.
export async function getCoachRoster(actor: TeamActor): Promise<CoachRosterRow[]> {
  const { data } = await companyOs
    .from("coaching_profiles")
    .select(PROFILE_SELECT)
    .eq("coach_id", actor.teamMemberId)
    .eq("active", true);
  const profiles = ((data ?? []) as unknown as Record<string, unknown>[]);
  if (profiles.length === 0) return [];
  const ids = profiles.map((p) => p.id as string);

  const [meetingsRes, commitmentsRes, checkinsRes, goalsRes] = await Promise.all([
    companyOs
      .from("coaching_one_on_ones")
      .select("coaching_profile_id, held_on, status, mode_coach_pct, mode_mentor_pct, mode_direct_pct")
      .in("coaching_profile_id", ids)
      .is("archived_at", null)
      .eq("status", "held"),
    companyOs
      .from("coaching_commitments")
      .select("coaching_profile_id, status")
      .in("coaching_profile_id", ids)
      .in("status", OPEN_COMMITMENT_STATUSES),
    companyOs
      .from("coaching_checkins")
      .select("coaching_profile_id, sent_at, responded_at")
      .in("coaching_profile_id", ids)
      .order("sent_at", { ascending: false }),
    companyOs
      .from("coaching_goals")
      .select("coaching_profile_id, title, status, sort_order")
      .in("coaching_profile_id", ids)
      .eq("status", "active")
      .order("sort_order"),
  ]);

  const lastHeld = new Map<string, string>();
  const heldCount = new Map<string, number>();
  const lastMode = new Map<string, { held_on: string; split: ModeSplit }>();
  for (const m of (meetingsRes.data ?? []) as Array<{
    coaching_profile_id: string;
    held_on: string;
    mode_coach_pct: number | null;
    mode_mentor_pct: number | null;
    mode_direct_pct: number | null;
  }>) {
    heldCount.set(m.coaching_profile_id, (heldCount.get(m.coaching_profile_id) ?? 0) + 1);
    const cur = lastHeld.get(m.coaching_profile_id);
    if (!cur || m.held_on > cur) lastHeld.set(m.coaching_profile_id, m.held_on);
    if (m.mode_coach_pct != null) {
      const prev = lastMode.get(m.coaching_profile_id);
      if (!prev || m.held_on > prev.held_on) {
        lastMode.set(m.coaching_profile_id, {
          held_on: m.held_on,
          split: { coach: m.mode_coach_pct, mentor: m.mode_mentor_pct ?? 0, direct: m.mode_direct_pct ?? 0 },
        });
      }
    }
  }
  const activeGoals = new Map<string, string[]>();
  for (const g of (goalsRes.data ?? []) as Array<{ coaching_profile_id: string; title: string }>) {
    const list = activeGoals.get(g.coaching_profile_id) ?? [];
    list.push(g.title);
    activeGoals.set(g.coaching_profile_id, list);
  }
  const openCount = new Map<string, number>();
  for (const c of (commitmentsRes.data ?? []) as Array<{ coaching_profile_id: string }>) {
    openCount.set(c.coaching_profile_id, (openCount.get(c.coaching_profile_id) ?? 0) + 1);
  }
  // Latest check-in per profile (rows arrive newest-first).
  const latestCheckin = new Map<string, { sent_at: string; responded_at: string | null }>();
  for (const c of (checkinsRes.data ?? []) as Array<{
    coaching_profile_id: string;
    sent_at: string;
    responded_at: string | null;
  }>) {
    if (!latestCheckin.has(c.coaching_profile_id)) latestCheckin.set(c.coaching_profile_id, c);
  }

  const today = saigonToday();
  const rows = profiles.map((p) => {
    const id = p.id as string;
    const cadence = (p.cadence_days as number) ?? 14;
    const last = lastHeld.get(id) ?? null;
    const attention: RosterAttention[] = [];
    if (!last) attention.push({ kind: "never_met" });
    else {
      const since = diffDays(last, today);
      if (since > cadence + 3) attention.push({ kind: "overdue", daysSince: since });
    }
    const goals = activeGoals.get(id) ?? [];
    if (goals.length === 0) attention.push({ kind: "goal_not_set" });
    const checkin = latestCheckin.get(id);
    if (checkin && !checkin.responded_at && diffDays(checkin.sent_at.slice(0, 10), today) >= 2) {
      attention.push({ kind: "checkin_unanswered" });
    }
    return {
      profileId: id,
      member: toMember(p),
      activeGoals: goals,
      retentionRoot: (p.retention_root as RetentionRoot | null) ?? null,
      lastModeSplit: lastMode.get(id)?.split ?? null,
      cadenceDays: cadence,
      nextOneOnOneOn: (p.next_one_on_one_on as string | null) ?? null,
      lastHeldOn: last,
      heldCount: heldCount.get(id) ?? 0,
      openCommitments: openCount.get(id) ?? 0,
      attention,
    };
  });
  return rows.sort((a, b) => a.member.name.localeCompare(b.member.name));
}

export type ModeSplit = { coach: number; mentor: number; direct: number };

export type OneOnOne = {
  id: string;
  heldOn: string;
  status: OneOnOneStatus;
  prepMarkdown: string | null;
  prepGeneratedAt: string | null;
  transcript: string | null;
  summaryMarkdown: string | null;
  sharedSummaryMarkdown: string | null;
  sharedPublishedAt: string | null;
  modeSplit: ModeSplit | null;
  minutesToken: string | null;
  transcriptSource: "minutes_auto" | "minutes_link" | "manual" | null;
  aiModel: string | null;
  aiError: string | null;
};

const MEETING_SELECT =
  "id, coaching_profile_id, held_on, status, prep_markdown, prep_generated_at, transcript, " +
  "summary_markdown, shared_summary_markdown, shared_published_at, " +
  "mode_coach_pct, mode_mentor_pct, mode_direct_pct, minutes_token, transcript_source, ai_model, ai_error";

function toOneOnOne(r: Record<string, unknown>): OneOnOne {
  return {
    id: r.id as string,
    heldOn: r.held_on as string,
    status: r.status as OneOnOneStatus,
    prepMarkdown: (r.prep_markdown as string | null) ?? null,
    prepGeneratedAt: (r.prep_generated_at as string | null) ?? null,
    transcript: (r.transcript as string | null) ?? null,
    summaryMarkdown: (r.summary_markdown as string | null) ?? null,
    sharedSummaryMarkdown: (r.shared_summary_markdown as string | null) ?? null,
    sharedPublishedAt: (r.shared_published_at as string | null) ?? null,
    modeSplit:
      r.mode_coach_pct == null
        ? null
        : {
            coach: r.mode_coach_pct as number,
            mentor: r.mode_mentor_pct as number,
            direct: r.mode_direct_pct as number,
          },
    minutesToken: (r.minutes_token as string | null) ?? null,
    transcriptSource: (r.transcript_source as "minutes_auto" | "minutes_link" | "manual" | null) ?? null,
    aiModel: (r.ai_model as string | null) ?? null,
    aiError: (r.ai_error as string | null) ?? null,
  };
}

export type Checkin = {
  id: string;
  sentAt: string;
  messageMarkdown: string;
  respondedAt: string | null;
};

export type TrendReport = {
  id: string;
  period: string;
  reportMarkdown: string | null;
  aiError: string | null;
  createdAt: string;
};

export type CoachProfileDetail = {
  profileId: string;
  member: CoachingMember;
  goals: CoachingGoal[];
  priorities: CoachingPriority[];
  ocean: OceanProfile | null;
  retentionRoot: RetentionRoot | null;
  edges: EdgesOptions;
  okrsMarkdown: string | null;
  privateProfileMarkdown: string | null;
  cadenceDays: number;
  nextOneOnOneOn: string | null;
  meetings: OneOnOne[];
  commitments: Commitment[];
  checkins: Checkin[];
  trends: TrendReport[];
};

// Ownership assertion for every coach-side read/write that takes a profile id
// from the client. Returns the raw profile row iff the actor is its coach.
export async function assertCoachOwnsProfile(
  actor: TeamActor,
  profileId: string,
): Promise<Record<string, unknown> | null> {
  if (!profileId) return null;
  const { data } = await companyOs
    .from("coaching_profiles")
    .select(PROFILE_SELECT)
    .eq("id", profileId)
    .eq("coach_id", actor.teamMemberId)
    .maybeSingle();
  return (data as unknown as Record<string, unknown>) ?? null;
}

export async function getCoachProfileDetail(
  actor: TeamActor,
  profileId: string,
): Promise<CoachProfileDetail | null> {
  const p = await assertCoachOwnsProfile(actor, profileId);
  if (!p) return null;

  const [meetings, commitments, checkins, trends, goals, priorities, ocean, edges] = await Promise.all([
    companyOs
      .from("coaching_one_on_ones")
      .select(MEETING_SELECT)
      .eq("coaching_profile_id", profileId)
      .is("archived_at", null)
      .order("held_on", { ascending: false }),
    companyOs
      .from("coaching_commitments")
      .select(COMMITMENT_SELECT)
      .eq("coaching_profile_id", profileId)
      .order("created_at", { ascending: false }),
    companyOs
      .from("coaching_checkins")
      .select("id, sent_at, message_markdown, responded_at")
      .eq("coaching_profile_id", profileId)
      .order("sent_at", { ascending: false }),
    companyOs
      .from("coaching_trends")
      .select("id, period, report_markdown, ai_error, created_at")
      .eq("coaching_profile_id", profileId)
      .order("period", { ascending: false }),
    companyOs
      .from("coaching_goals")
      .select(GOAL_SELECT)
      .eq("coaching_profile_id", profileId)
      .order("sort_order")
      .order("created_at"),
    companyOs
      .from("coaching_priorities")
      .select(PRIORITY_SELECT)
      .eq("coaching_profile_id", profileId)
      .order("sort_order")
      .order("created_at"),
    companyOs
      .from("coaching_ocean_profiles")
      .select(OCEAN_SELECT)
      .eq("coaching_profile_id", profileId)
      .maybeSingle(),
    getEdgesLadderOptions(),
  ]);

  return {
    profileId,
    member: toMember(p),
    goals: ((goals.data ?? []) as unknown as Record<string, unknown>[]).map((g) => toGoal(g, edges)),
    priorities: ((priorities.data ?? []) as unknown as Record<string, unknown>[]).map((x) => toPriority(x, edges)),
    ocean: ocean.data ? toOcean(ocean.data as unknown as Record<string, unknown>) : null,
    retentionRoot: (p.retention_root as RetentionRoot | null) ?? null,
    edges,
    okrsMarkdown: (p.okrs_markdown as string | null) ?? null,
    privateProfileMarkdown: (p.private_profile_markdown as string | null) ?? null,
    cadenceDays: (p.cadence_days as number) ?? 14,
    nextOneOnOneOn: (p.next_one_on_one_on as string | null) ?? null,
    meetings: ((meetings.data ?? []) as unknown as Record<string, unknown>[]).map(toOneOnOne),
    commitments: ((commitments.data ?? []) as unknown as Record<string, unknown>[]).map(toCommitment),
    checkins: ((checkins.data ?? []) as unknown as Array<Record<string, unknown>>).map((c) => ({
      id: c.id as string,
      sentAt: c.sent_at as string,
      messageMarkdown: c.message_markdown as string,
      respondedAt: (c.responded_at as string | null) ?? null,
    })),
    trends: ((trends.data ?? []) as unknown as Record<string, unknown>[]).map((t) => ({
      id: t.id as string,
      period: t.period as string,
      reportMarkdown: (t.report_markdown as string | null) ?? null,
      aiError: (t.ai_error as string | null) ?? null,
      createdAt: t.created_at as string,
    })),
  };
}

type Result = { ok: true } | { ok: false; error: string };

async function patchProfile(profileId: string, patch: Record<string, unknown>): Promise<Result> {
  const { error } = await companyOs
    .from("coaching_profiles")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", profileId);
  return error ? { ok: false, error: "Could not save." } : { ok: true };
}

async function patchMeeting(meetingId: string, patch: Record<string, unknown>): Promise<Result> {
  const { error } = await companyOs
    .from("coaching_one_on_ones")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", meetingId);
  return error ? { ok: false, error: "Could not save." } : { ok: true };
}

// Every coach-side mutation below asserts ownership first (IDOR: never trust a
// client-supplied id as the authorization subject).

// Ladder input from the picker: at most one Edges target.
export type LadderInput =
  | { kind: "none" }
  | { kind: "objective" | "key_result" | "metric"; id: string };

function ladderColumns(ladder: LadderInput): Record<string, string | null> {
  return {
    objective_id: ladder.kind === "objective" ? ladder.id : null,
    key_result_id: ladder.kind === "key_result" ? ladder.id : null,
    metric_id: ladder.kind === "metric" ? ladder.id : null,
  };
}

export async function coachAddGoal(
  actor: TeamActor,
  profileId: string,
  input: { title: string; status: GoalStatus; quarterLabel: string | null; ladder: LadderInput },
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Write the goal first." };
  if (!(input.status in GOAL_STATUS_LABELS)) return { ok: false, error: "Bad status." };
  const { error } = await companyOs.from("coaching_goals").insert({
    coaching_profile_id: profileId,
    title,
    status: input.status,
    quarter_label: input.quarterLabel?.trim() || null,
    ...ladderColumns(input.ladder),
  });
  return error ? { ok: false, error: "Could not add the goal." } : { ok: true };
}

async function assertCoachOwnsRow(
  actor: TeamActor,
  table: "coaching_goals" | "coaching_priorities",
  id: string,
): Promise<boolean> {
  if (!id) return false;
  const { data } = await companyOs
    .from(table)
    .select("id, coaching_profiles:coaching_profiles!coaching_profile_id(coach_id)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return false;
  const prof = one(
    (data as unknown as Record<string, unknown>).coaching_profiles as
      | { coach_id: string }
      | { coach_id: string }[]
      | null,
  );
  return prof?.coach_id === actor.teamMemberId;
}

export async function coachUpdateGoal(
  actor: TeamActor,
  goalId: string,
  patch: { title?: string; status?: GoalStatus; quarterLabel?: string | null; ladder?: LadderInput },
): Promise<Result> {
  if (!(await assertCoachOwnsRow(actor, "coaching_goals", goalId)))
    return { ok: false, error: "Not found." };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "The goal needs a title." };
    update.title = t;
  }
  if (patch.status !== undefined) {
    if (!(patch.status in GOAL_STATUS_LABELS)) return { ok: false, error: "Bad status." };
    update.status = patch.status;
  }
  if (patch.quarterLabel !== undefined) update.quarter_label = patch.quarterLabel?.trim() || null;
  if (patch.ladder !== undefined) Object.assign(update, ladderColumns(patch.ladder));
  const { error } = await companyOs.from("coaching_goals").update(update).eq("id", goalId);
  return error ? { ok: false, error: "Could not update the goal." } : { ok: true };
}

export async function coachAddPriority(
  actor: TeamActor,
  profileId: string,
  input: { title: string; detail: string; ladder: LadderInput },
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Write the priority first." };
  const { count } = await companyOs
    .from("coaching_priorities")
    .select("id", { count: "exact", head: true })
    .eq("coaching_profile_id", profileId);
  const { error } = await companyOs.from("coaching_priorities").insert({
    coaching_profile_id: profileId,
    title,
    detail_markdown: input.detail.trim() || null,
    sort_order: count ?? 0,
    ...ladderColumns(input.ladder),
  });
  return error ? { ok: false, error: "Could not add the priority." } : { ok: true };
}

export async function coachUpdatePriority(
  actor: TeamActor,
  priorityId: string,
  patch: { title?: string; detail?: string; status?: PriorityStatus; ladder?: LadderInput },
): Promise<Result> {
  if (!(await assertCoachOwnsRow(actor, "coaching_priorities", priorityId)))
    return { ok: false, error: "Not found." };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "The priority needs a title." };
    update.title = t;
  }
  if (patch.detail !== undefined) update.detail_markdown = patch.detail.trim() || null;
  if (patch.status !== undefined) {
    if (patch.status !== "active" && patch.status !== "retired") return { ok: false, error: "Bad status." };
    update.status = patch.status;
  }
  if (patch.ladder !== undefined) Object.assign(update, ladderColumns(patch.ladder));
  const { error } = await companyOs.from("coaching_priorities").update(update).eq("id", priorityId);
  return error ? { ok: false, error: "Could not update the priority." } : { ok: true };
}

// OCEAN: coach writes; publish is the member-visibility gate (mirrors the
// shared-recap publish flow).
export type OceanInput = {
  dims: Record<OceanDimensionKey, { rating: string; evidence: string }>;
  snapshot: string;
  guidance: string;
};

export async function coachSaveOcean(
  actor: TeamActor,
  profileId: string,
  input: OceanInput,
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  const row: Record<string, unknown> = {
    snapshot_markdown: input.snapshot.trim() || null,
    guidance_markdown: input.guidance.trim() || null,
    updated_at: new Date().toISOString(),
  };
  for (const k of OCEAN_DIMENSIONS) {
    row[`${k}_rating`] = input.dims[k]?.rating.trim() || null;
    row[`${k}_evidence`] = input.dims[k]?.evidence.trim() || null;
  }
  const { data: existing } = await companyOs
    .from("coaching_ocean_profiles")
    .select("id")
    .eq("coaching_profile_id", profileId)
    .maybeSingle();
  const { error } = existing
    ? await companyOs
        .from("coaching_ocean_profiles")
        .update(row)
        .eq("id", (existing as { id: string }).id)
    : await companyOs
        .from("coaching_ocean_profiles")
        .insert({ ...row, coaching_profile_id: profileId, published: false });
  return error ? { ok: false, error: "Could not save the OCEAN profile." } : { ok: true };
}

export async function coachPublishOcean(
  actor: TeamActor,
  profileId: string,
  publish: boolean,
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  const { data } = await companyOs
    .from("coaching_ocean_profiles")
    .select("id, snapshot_markdown, guidance_markdown")
    .eq("coaching_profile_id", profileId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Write the OCEAN profile first." };
  const r = data as { id: string; snapshot_markdown: string | null; guidance_markdown: string | null };
  if (publish && !r.snapshot_markdown?.trim() && !r.guidance_markdown?.trim())
    return { ok: false, error: "Write the snapshot or guidance before publishing." };
  const { error } = await companyOs
    .from("coaching_ocean_profiles")
    .update({ published: publish, updated_at: new Date().toISOString() })
    .eq("id", r.id);
  return error ? { ok: false, error: "Could not update publishing." } : { ok: true };
}

export async function coachSetRetentionRoot(
  actor: TeamActor,
  profileId: string,
  root: RetentionRoot | null,
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  if (root !== null && !(root in RETENTION_ROOT_LABELS)) return { ok: false, error: "Bad root." };
  return patchProfile(profileId, { retention_root: root });
}

// C/M/D mode split on a held 1-1 — all three or nothing, summing to 100
// (the DB check enforces the same).
export async function coachSetModeSplit(
  actor: TeamActor,
  meetingId: string,
  split: ModeSplit | null,
): Promise<Result> {
  const owned = await assertCoachOwnsMeeting(actor, meetingId);
  if (!owned) return { ok: false, error: "Not found." };
  if (split) {
    const vals = [split.coach, split.mentor, split.direct];
    if (vals.some((v) => !Number.isInteger(v) || v < 0 || v > 100))
      return { ok: false, error: "Percentages must be whole numbers 0-100." };
    if (split.coach + split.mentor + split.direct !== 100)
      return { ok: false, error: "The three percentages must sum to 100." };
  }
  return patchMeeting(meetingId, {
    mode_coach_pct: split?.coach ?? null,
    mode_mentor_pct: split?.mentor ?? null,
    mode_direct_pct: split?.direct ?? null,
  });
}

// Attach a Lark Minutes link to a 1-1. The transcript pull itself is the
// cron's job (minutes_auto) or a later manual import; storing the token now
// keeps the meeting joined to its recording.
export async function coachSetMinutesLink(
  actor: TeamActor,
  meetingId: string,
  url: string,
): Promise<Result> {
  const owned = await assertCoachOwnsMeeting(actor, meetingId);
  if (!owned) return { ok: false, error: "Not found." };
  const m = url.trim().match(/minutes\/([a-z0-9]+)/i);
  if (!m) return { ok: false, error: "Paste a Lark Minutes link (…/minutes/…)." };
  return patchMeeting(meetingId, { minutes_token: m[1], transcript_source: "minutes_link" });
}

export async function coachSetCadence(
  actor: TeamActor,
  profileId: string,
  cadenceDays: number,
  nextOneOnOneOn: string | null,
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  const days = Math.round(cadenceDays);
  if (!Number.isFinite(days) || days < 7 || days > 90)
    return { ok: false, error: "Cadence must be between 7 and 90 days." };
  if (nextOneOnOneOn && !/^\d{4}-\d{2}-\d{2}$/.test(nextOneOnOneOn))
    return { ok: false, error: "Bad date." };
  return patchProfile(profileId, { cadence_days: days, next_one_on_one_on: nextOneOnOneOn });
}

export async function coachSetPrivateProfile(
  actor: TeamActor,
  profileId: string,
  markdown: string,
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  return patchProfile(profileId, { private_profile_markdown: markdown.trim() || null });
}

export async function coachSetOkrs(
  actor: TeamActor,
  profileId: string,
  markdown: string,
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  return patchProfile(profileId, { okrs_markdown: markdown.trim() || null });
}

// Create a 1-1 row. `held` logs a meeting that already happened (transcript
// flow follows); `scheduled` books the next one and mirrors the date onto the
// profile so cadence math and the cron see it.
export async function coachCreateOneOnOne(
  actor: TeamActor,
  profileId: string,
  heldOn: string,
  status: Extract<OneOnOneStatus, "scheduled" | "held">,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(heldOn)) return { ok: false, error: "Bad date." };
  if (status !== "scheduled" && status !== "held") return { ok: false, error: "Bad status." };
  const { data, error } = await companyOs
    .from("coaching_one_on_ones")
    .insert({ coaching_profile_id: profileId, held_on: heldOn, status })
    .select("id")
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Could not create the 1-1." };
  if (status === "scheduled") await patchProfile(profileId, { next_one_on_one_on: heldOn });
  return { ok: true, id: (data as { id: string }).id };
}

// Meeting-scoped ownership: the meeting must belong to a profile this actor
// coaches. Returns { meeting, profileId } or null.
export async function assertCoachOwnsMeeting(
  actor: TeamActor,
  meetingId: string,
): Promise<{ meeting: OneOnOne; profileId: string } | null> {
  if (!meetingId) return null;
  const { data } = await companyOs
    .from("coaching_one_on_ones")
    .select(`${MEETING_SELECT}, coaching_profiles:coaching_profiles!coaching_profile_id(coach_id)`)
    .eq("id", meetingId)
    .is("archived_at", null)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  const prof = one(r.coaching_profiles as { coach_id: string } | { coach_id: string }[] | null);
  if (prof?.coach_id !== actor.teamMemberId) return null;
  return { meeting: toOneOnOne(r), profileId: r.coaching_profile_id as string };
}

// Save the transcript and mark the meeting held. The AI summary runs after
// this (lib/coaching/ai.ts); saving the raw transcript never blocks on it.
export async function coachSaveTranscript(
  actor: TeamActor,
  meetingId: string,
  transcript: string,
): Promise<Result> {
  const owned = await assertCoachOwnsMeeting(actor, meetingId);
  if (!owned) return { ok: false, error: "Not found." };
  const text = transcript.trim();
  if (!text) return { ok: false, error: "Paste the transcript first." };
  if (text.length > 400_000) return { ok: false, error: "Transcript is too long." };
  return patchMeeting(meetingId, { transcript: text, status: "held" });
}

// Coach edits of the two summary tiers. Editing the shared recap does NOT
// publish it; publish is its own explicit action.
export async function coachSaveSummaries(
  actor: TeamActor,
  meetingId: string,
  summaryMarkdown: string,
  sharedSummaryMarkdown: string,
): Promise<Result> {
  const owned = await assertCoachOwnsMeeting(actor, meetingId);
  if (!owned) return { ok: false, error: "Not found." };
  return patchMeeting(meetingId, {
    summary_markdown: summaryMarkdown.trim() || null,
    shared_summary_markdown: sharedSummaryMarkdown.trim() || null,
  });
}

// The publish gate: only after this does the member see the shared recap.
export async function coachPublishSharedRecap(
  actor: TeamActor,
  meetingId: string,
  publish: boolean,
): Promise<Result> {
  const owned = await assertCoachOwnsMeeting(actor, meetingId);
  if (!owned) return { ok: false, error: "Not found." };
  if (publish && !owned.meeting.sharedSummaryMarkdown?.trim())
    return { ok: false, error: "Write the shared recap before publishing." };
  return patchMeeting(meetingId, {
    shared_published_at: publish ? new Date().toISOString() : null,
  });
}

export async function coachArchiveMeeting(actor: TeamActor, meetingId: string): Promise<Result> {
  const owned = await assertCoachOwnsMeeting(actor, meetingId);
  if (!owned) return { ok: false, error: "Not found." };
  return patchMeeting(meetingId, { archived_at: new Date().toISOString() });
}

export async function coachAddCommitment(
  actor: TeamActor,
  profileId: string,
  input: { title: string; owner: CommitmentOwner; dueOn: string | null; oneOnOneId?: string | null },
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Write the commitment first." };
  if (title.length > 500) return { ok: false, error: "Keep the commitment under 500 characters." };
  if (input.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(input.dueOn)) return { ok: false, error: "Bad date." };
  const owner: CommitmentOwner = input.owner === "coach" ? "coach" : "member";
  const { error } = await companyOs.from("coaching_commitments").insert({
    coaching_profile_id: profileId,
    one_on_one_id: input.oneOnOneId ?? null,
    title,
    owner,
    due_on: input.dueOn,
  });
  return error ? { ok: false, error: "Could not add the commitment." } : { ok: true };
}

async function assertCoachOwnsCommitment(
  actor: TeamActor,
  commitmentId: string,
): Promise<Record<string, unknown> | null> {
  if (!commitmentId) return null;
  const { data } = await companyOs
    .from("coaching_commitments")
    .select(`${COMMITMENT_SELECT}, coaching_profiles:coaching_profiles!coaching_profile_id(coach_id)`)
    .eq("id", commitmentId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  const prof = one(r.coaching_profiles as { coach_id: string } | { coach_id: string }[] | null);
  return prof?.coach_id === actor.teamMemberId ? r : null;
}

export async function coachUpdateCommitment(
  actor: TeamActor,
  commitmentId: string,
  patch: { status?: CommitmentStatus; statusNote?: string; title?: string; dueOn?: string | null },
): Promise<Result> {
  const row = await assertCoachOwnsCommitment(actor, commitmentId);
  if (!row) return { ok: false, error: "Not found." };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "The commitment needs a title." };
    update.title = t;
  }
  if (patch.dueOn !== undefined) {
    if (patch.dueOn && !/^\d{4}-\d{2}-\d{2}$/.test(patch.dueOn)) return { ok: false, error: "Bad date." };
    update.due_on = patch.dueOn;
  }
  if (patch.status !== undefined) {
    if (!(patch.status in COMMITMENT_STATUS_LABELS)) return { ok: false, error: "Bad status." };
    update.status = patch.status;
    update.status_updated_by = actor.teamMemberId;
    update.status_updated_at = new Date().toISOString();
    update.closed_at =
      patch.status === "completed" || patch.status === "dropped" ? new Date().toISOString() : null;
  }
  if (patch.statusNote !== undefined) update.status_note = patch.statusNote.trim() || null;
  const { error } = await companyOs.from("coaching_commitments").update(update).eq("id", commitmentId);
  return error ? { ok: false, error: "Could not update the commitment." } : { ok: true };
}

// ---- member tier ------------------------------------------------------------
// Selects are FIXED member-visible column lists. Widening one is a security
// decision, not a tweak.

export type MemberRecap = {
  id: string;
  heldOn: string;
  sharedSummaryMarkdown: string;
  sharedPublishedAt: string;
};

export type MyCoaching = {
  profileId: string;
  coachName: string;
  goals: CoachingGoal[];
  priorities: CoachingPriority[];
  // The member's own OCEAN profile — present ONLY when the coach published it.
  ocean: OceanProfile | null;
  okrsMarkdown: string | null;
  cadenceDays: number;
  nextOneOnOneOn: string | null;
  commitments: Commitment[];
  recaps: MemberRecap[];
  checkins: Checkin[];
};

export async function getMyCoaching(actor: TeamActor): Promise<MyCoaching | null> {
  const { data } = await companyOs
    .from("coaching_profiles")
    .select("id, coach_id, okrs_markdown, cadence_days, next_one_on_one_on")
    .eq("team_member_id", actor.teamMemberId)
    .eq("active", true)
    .maybeSingle();
  if (!data) return null;
  const p = data as unknown as Record<string, unknown>;
  const profileId = p.id as string;

  // Coach display name via forward lookup (never the self-FK reverse embed).
  const { data: coachRow } = await companyOs
    .from("team_members")
    .select("people:people!person_id(full_name, preferred_name, email)")
    .eq("id", p.coach_id as string)
    .maybeSingle();
  const coachPerson = one(
    ((coachRow as unknown as Record<string, unknown> | null)?.people ?? null) as
      | PersonEmbed
      | PersonEmbed[]
      | null,
  );

  const [recaps, commitments, checkins, goals, priorities, ocean, edges] = await Promise.all([
    companyOs
      .from("coaching_one_on_ones")
      .select("id, held_on, shared_summary_markdown, shared_published_at")
      .eq("coaching_profile_id", profileId)
      .is("archived_at", null)
      .not("shared_published_at", "is", null)
      .order("held_on", { ascending: false }),
    companyOs
      .from("coaching_commitments")
      .select(COMMITMENT_SELECT)
      .eq("coaching_profile_id", profileId)
      .order("created_at", { ascending: false }),
    companyOs
      .from("coaching_checkins")
      .select("id, sent_at, message_markdown, responded_at")
      .eq("coaching_profile_id", profileId)
      .order("sent_at", { ascending: false }),
    companyOs
      .from("coaching_goals")
      .select(GOAL_SELECT)
      .eq("coaching_profile_id", profileId)
      .in("status", ["draft", "active", "achieved"])
      .order("sort_order")
      .order("created_at"),
    companyOs
      .from("coaching_priorities")
      .select(PRIORITY_SELECT)
      .eq("coaching_profile_id", profileId)
      .eq("status", "active")
      .order("sort_order"),
    // Member tier: the published gate lives IN the query, not in the view.
    companyOs
      .from("coaching_ocean_profiles")
      .select(OCEAN_SELECT)
      .eq("coaching_profile_id", profileId)
      .eq("published", true)
      .maybeSingle(),
    getEdgesLadderOptions(),
  ]);

  return {
    profileId,
    coachName: displayName(coachPerson),
    goals: ((goals.data ?? []) as unknown as Record<string, unknown>[]).map((g) => toGoal(g, edges)),
    priorities: ((priorities.data ?? []) as unknown as Record<string, unknown>[]).map((x) => toPriority(x, edges)),
    ocean: ocean.data ? toOcean(ocean.data as unknown as Record<string, unknown>) : null,
    okrsMarkdown: (p.okrs_markdown as string | null) ?? null,
    cadenceDays: (p.cadence_days as number) ?? 14,
    nextOneOnOneOn: (p.next_one_on_one_on as string | null) ?? null,
    commitments: ((commitments.data ?? []) as unknown as Record<string, unknown>[]).map(toCommitment),
    recaps: ((recaps.data ?? []) as unknown as Record<string, unknown>[])
      .filter((r) => (r.shared_summary_markdown as string | null)?.trim())
      .map((r) => ({
        id: r.id as string,
        heldOn: r.held_on as string,
        sharedSummaryMarkdown: r.shared_summary_markdown as string,
        sharedPublishedAt: r.shared_published_at as string,
      })),
    checkins: ((checkins.data ?? []) as unknown as Record<string, unknown>[]).map((c) => ({
      id: c.id as string,
      sentAt: c.sent_at as string,
      messageMarkdown: c.message_markdown as string,
      respondedAt: (c.responded_at as string | null) ?? null,
    })),
  };
}

// ---- team-wide tier ---------------------------------------------------------
// FAST goals are Transparent (the T): any signed-in team member can read
// anyone's ACTIVE goals — title, status, quarter, and ladder only. Nothing
// else from the coaching tables crosses this boundary.

export type TeamMemberGoal = {
  title: string;
  status: GoalStatus;
  quarterLabel: string | null;
  ladderLabel: string | null;
};

export async function getTeamMemberActiveGoals(teamMemberId: string): Promise<TeamMemberGoal[]> {
  if (!teamMemberId) return [];
  const { data: prof } = await companyOs
    .from("coaching_profiles")
    .select("id")
    .eq("team_member_id", teamMemberId)
    .eq("active", true)
    .maybeSingle();
  if (!prof) return [];
  const [{ data }, edges] = await Promise.all([
    companyOs
      .from("coaching_goals")
      .select(GOAL_SELECT)
      .eq("coaching_profile_id", (prof as { id: string }).id)
      .eq("status", "active")
      .order("sort_order")
      .order("created_at"),
    getEdgesLadderOptions(),
  ]);
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const g = toGoal(r, edges);
    return {
      title: g.title,
      status: g.status,
      quarterLabel: g.quarterLabel,
      ladderLabel: g.ladder?.label ?? null,
    };
  });
}

// Member status update on a commitment on their OWN profile — status + note
// only, never title/due date/owner. Also stamps the latest unanswered check-in
// as responded, closing the mid-cycle loop.
export async function myUpdateCommitmentStatus(
  actor: TeamActor,
  commitmentId: string,
  status: CommitmentStatus,
  note: string,
): Promise<Result> {
  if (!(status in COMMITMENT_STATUS_LABELS)) return { ok: false, error: "Bad status." };
  const { data } = await companyOs
    .from("coaching_commitments")
    .select(
      "id, coaching_profile_id, coaching_profiles:coaching_profiles!coaching_profile_id(team_member_id)",
    )
    .eq("id", commitmentId)
    .maybeSingle();
  if (!data) return { ok: false, error: "Not found." };
  const r = data as unknown as Record<string, unknown>;
  const prof = one(r.coaching_profiles as { team_member_id: string } | { team_member_id: string }[] | null);
  if (prof?.team_member_id !== actor.teamMemberId) return { ok: false, error: "Not found." };

  const { error } = await companyOs
    .from("coaching_commitments")
    .update({
      status,
      status_note: note.trim() || null,
      status_updated_by: actor.teamMemberId,
      status_updated_at: new Date().toISOString(),
      closed_at: status === "completed" || status === "dropped" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commitmentId);
  if (error) return { ok: false, error: "Could not update the commitment." };

  // Mark the newest unanswered check-in responded (fire-and-forget semantics).
  const profileId = r.coaching_profile_id as string;
  const { data: checkin } = await companyOs
    .from("coaching_checkins")
    .select("id")
    .eq("coaching_profile_id", profileId)
    .is("responded_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (checkin) {
    await companyOs
      .from("coaching_checkins")
      .update({ responded_at: new Date().toISOString() })
      .eq("id", (checkin as { id: string }).id);
  }
  return { ok: true };
}
