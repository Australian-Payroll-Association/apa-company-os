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
export type OneOnOneStatus = "scheduled" | "held" | "skipped";
export type CommitmentOwner = "coach" | "member";
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
  fastGoal: string | null;
  fastGoalStatus: FastGoalStatus;
  cadenceDays: number;
  nextOneOnOneOn: string | null;
  lastHeldOn: string | null;
  heldCount: number;
  openCommitments: number;
  attention: RosterAttention[];
};

const PROFILE_SELECT =
  "id, team_member_id, coach_id, fast_goal, fast_goal_status, okrs_markdown, " +
  "private_profile_markdown, cadence_days, next_one_on_one_on, active, " +
  MEMBER_EMBED;

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

  const [meetingsRes, commitmentsRes, checkinsRes] = await Promise.all([
    companyOs
      .from("coaching_one_on_ones")
      .select("coaching_profile_id, held_on, status")
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
  ]);

  const lastHeld = new Map<string, string>();
  const heldCount = new Map<string, number>();
  for (const m of (meetingsRes.data ?? []) as Array<{ coaching_profile_id: string; held_on: string }>) {
    heldCount.set(m.coaching_profile_id, (heldCount.get(m.coaching_profile_id) ?? 0) + 1);
    const cur = lastHeld.get(m.coaching_profile_id);
    if (!cur || m.held_on > cur) lastHeld.set(m.coaching_profile_id, m.held_on);
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
    if ((p.fast_goal_status as FastGoalStatus) !== "set") attention.push({ kind: "goal_not_set" });
    const checkin = latestCheckin.get(id);
    if (checkin && !checkin.responded_at && diffDays(checkin.sent_at.slice(0, 10), today) >= 2) {
      attention.push({ kind: "checkin_unanswered" });
    }
    return {
      profileId: id,
      member: toMember(p),
      fastGoal: (p.fast_goal as string | null) ?? null,
      fastGoalStatus: (p.fast_goal_status as FastGoalStatus) ?? "not_set",
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
  aiModel: string | null;
  aiError: string | null;
};

const MEETING_SELECT =
  "id, coaching_profile_id, held_on, status, prep_markdown, prep_generated_at, transcript, " +
  "summary_markdown, shared_summary_markdown, shared_published_at, ai_model, ai_error";

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
  fastGoal: string | null;
  fastGoalStatus: FastGoalStatus;
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

  const [meetings, commitments, checkins, trends] = await Promise.all([
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
  ]);

  return {
    profileId,
    member: toMember(p),
    fastGoal: (p.fast_goal as string | null) ?? null,
    fastGoalStatus: (p.fast_goal_status as FastGoalStatus) ?? "not_set",
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

export async function coachSetFastGoal(
  actor: TeamActor,
  profileId: string,
  goal: string,
  status: FastGoalStatus,
): Promise<Result> {
  if (!(await assertCoachOwnsProfile(actor, profileId))) return { ok: false, error: "Not found." };
  if (!["not_set", "draft", "set"].includes(status)) return { ok: false, error: "Bad status." };
  const trimmed = goal.trim();
  return patchProfile(profileId, {
    fast_goal: trimmed || null,
    fast_goal_status: trimmed ? status : "not_set",
  });
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
  fastGoal: string | null;
  fastGoalStatus: FastGoalStatus;
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
    .select("id, coach_id, fast_goal, fast_goal_status, okrs_markdown, cadence_days, next_one_on_one_on")
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

  const [recaps, commitments, checkins] = await Promise.all([
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
  ]);

  return {
    profileId,
    coachName: displayName(coachPerson),
    fastGoal: (p.fast_goal as string | null) ?? null,
    fastGoalStatus: (p.fast_goal_status as FastGoalStatus) ?? "not_set",
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
