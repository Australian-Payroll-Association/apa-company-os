// Edge8 Onboarding Cycle domain logic (docs/plans/2026-07-22-onboarding-plans-kanban.md).
// One `onboarding_plans` journey per new hire drives the manager kanban at
// /team/onboarding and the daily cron: plan-upload nag (T-7..Day 1) -> Day 8
// feedback survey -> 45-day review -> Day 60 promotion -> Day 180 stay
// interview. Milestone sends are stamped on the journey (idempotent, >= day
// conditions) so a missed cron day self-heals; the plan nag alone is stateless
// and repeats daily by design.
//
// Everything here runs on the service-role client. Callers are the cron route
// (bearer-authed), the survey post-submit processor, and /team reads that have
// already been scoped by lib/team/data.ts.

import { companyOs } from "@/lib/supabase";
import { sendTransactionalEmail } from "@/lib/email";
import { getSiteOrigin } from "@/lib/site-origin";
import { recordAudit } from "@/lib/admin/audit";

export const TALENT_DIRECTOR_EMAIL = "mai@edge8.ai";
export const DAY8_SURVEY_SLUG = "onboarding-day-8-feedback";
export const REVIEW_SURVEY_SLUG = "probation-45-review";

// Kanban columns, in order. `complete` renders inside the Day 180 column.
export const CYCLE_STAGES = [
  { key: "preboarding", label: "Preboarding" },
  { key: "day_1", label: "Day 1 · Orientation" },
  { key: "day_8", label: "Day 8 · Feedback" },
  { key: "day_45", label: "45 Day Review" },
  { key: "day_60", label: "60 Day Decision" },
  { key: "day_180", label: "180 Day Stay Interview" },
] as const;
export type CycleStage = (typeof CYCLE_STAGES)[number]["key"] | "complete";

export type CycleDecision = "offer_full_time" | "extend_probation_30" | "terminate";

// Review survey choice label -> decision enum. Labels must match the seeded
// survey field's config.choices exactly.
export const DECISION_BY_CHOICE: Record<string, CycleDecision> = {
  "Offer full time contract": "offer_full_time",
  "Extend probation 30 days": "extend_probation_30",
  "Terminate employee": "terminate",
};

// The three Day 1 orientation activities, seeded as onboarding_tasks.
const DAY1_TASKS = [
  "HR Handbook with Mai",
  "Intro to Edge8 with Dave",
  "Team Overview with team manager",
] as const;
const DAY1_CATEGORY = "day_1";

// Journeys are only live for people still employed; terminated/alumni journeys
// are skipped, never advanced.
const LIVE_STATUSES = ["active", "pre_start", "on_leave", "notice"];

// ---- date helpers (all on YYYY-MM-DD strings, Saigon-date semantics) --------

export function saigonToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function ms(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

export function addDays(iso: string, days: number): string {
  return new Date(ms(iso) + days * 86400000).toISOString().slice(0, 10);
}

function diffDays(fromISO: string, toISO: string): number {
  return Math.round((ms(toISO) - ms(fromISO)) / 86400000);
}

// Day number on the cycle clock: start_date is Day 1; the day before is 0.
export function cycleDay(startDate: string, todayISO: string): number {
  return diffDays(startDate, todayISO) + 1;
}

// ---- journey rows -----------------------------------------------------------

type PersonEmbed = {
  full_name: string | null;
  preferred_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

export type CycleRow = {
  id: string;
  team_member_id: string;
  stage: CycleStage;
  plan_url: string | null;
  plan_uploaded_at: string | null;
  day8_survey_sent_at: string | null;
  day8_response_id: string | null;
  day45_email_sent_at: string | null;
  day45_response_id: string | null;
  decision: CycleDecision | null;
  decision_at: string | null;
  day60_promoted_at: string | null;
  day180_email_sent_at: string | null;
  completed_at: string | null;
  member: {
    personId: string | null;
    name: string;
    email: string | null;
    avatarUrl: string | null;
    positionTitle: string | null;
    startDate: string | null;
    managerId: string | null;
    status: string | null;
    employmentStage: string | null;
    probationEndsOn: string | null;
    contractStartDate: string | null;
  };
};

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

const displayName = (p: PersonEmbed | null): string =>
  p?.preferred_name || p?.full_name || p?.email || "—";

const CYCLE_SELECT =
  "id, team_member_id, stage, plan_url, plan_uploaded_at, day8_survey_sent_at, day8_response_id, " +
  "day45_email_sent_at, day45_response_id, decision, decision_at, day60_promoted_at, " +
  "day180_email_sent_at, completed_at, " +
  "team_members:team_members!team_member_id(id, person_id, start_date, manager_id, status, " +
  "employment_stage, probation_ends_on, contract_start_date, " +
  "people:people!person_id(full_name, preferred_name, email, avatar_url), " +
  "positions:positions!position_id(title))";

function toCycleRow(raw: Record<string, unknown>): CycleRow {
  const tm = one(raw.team_members as Record<string, unknown> | Record<string, unknown>[] | null);
  const person = one((tm?.people ?? null) as PersonEmbed | PersonEmbed[] | null);
  const pos = one((tm?.positions ?? null) as { title: string | null } | { title: string | null }[] | null);
  return {
    id: raw.id as string,
    team_member_id: raw.team_member_id as string,
    stage: (raw.stage as CycleStage) ?? "preboarding",
    plan_url: (raw.plan_url as string | null) ?? null,
    plan_uploaded_at: (raw.plan_uploaded_at as string | null) ?? null,
    day8_survey_sent_at: (raw.day8_survey_sent_at as string | null) ?? null,
    day8_response_id: (raw.day8_response_id as string | null) ?? null,
    day45_email_sent_at: (raw.day45_email_sent_at as string | null) ?? null,
    day45_response_id: (raw.day45_response_id as string | null) ?? null,
    decision: (raw.decision as CycleDecision | null) ?? null,
    decision_at: (raw.decision_at as string | null) ?? null,
    day60_promoted_at: (raw.day60_promoted_at as string | null) ?? null,
    day180_email_sent_at: (raw.day180_email_sent_at as string | null) ?? null,
    completed_at: (raw.completed_at as string | null) ?? null,
    member: {
      personId: ((tm?.person_id as string | null) ?? null),
      name: displayName(person),
      email: person?.email ?? null,
      avatarUrl: person?.avatar_url ?? null,
      positionTitle: pos?.title ?? null,
      startDate: ((tm?.start_date as string | null) ?? null),
      managerId: ((tm?.manager_id as string | null) ?? null),
      status: ((tm?.status as string | null) ?? null),
      employmentStage: ((tm?.employment_stage as string | null) ?? null),
      probationEndsOn: ((tm?.probation_ends_on as string | null) ?? null),
      contractStartDate: ((tm?.contract_start_date as string | null) ?? null),
    },
  };
}

async function loadCycleRows(teamMemberIds?: string[]): Promise<CycleRow[]> {
  let q = companyOs.from("onboarding_plans").select(CYCLE_SELECT);
  if (teamMemberIds) q = q.in("team_member_id", teamMemberIds);
  const { data } = await q;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(toCycleRow);
}

// /team board read. teamMemberIds MUST already be the actor's scope (the page
// passes actor.teamMemberScope) — this helper does not widen it.
export async function getCycleRowsFor(teamMemberIds: string[]): Promise<CycleRow[]> {
  if (teamMemberIds.length === 0) return [];
  return loadCycleRows(teamMemberIds);
}

// Admin board read: every journey, company-wide. Callers must be behind
// requireAdmin() — this is deliberately NOT reachable from /team code paths.
export async function getAllCycleRows(): Promise<CycleRow[]> {
  return loadCycleRows();
}

// ---- journey creation / backfill -------------------------------------------

async function seedDay1Tasks(teamMemberId: string, dueDate: string | null): Promise<void> {
  const { data: existing } = await companyOs
    .from("onboarding_tasks")
    .select("id")
    .eq("team_member_id", teamMemberId)
    .eq("category", DAY1_CATEGORY)
    .limit(1);
  if ((existing ?? []).length > 0) return;
  const { error } = await companyOs.from("onboarding_tasks").insert(
    DAY1_TASKS.map((title, i) => ({
      team_member_id: teamMemberId,
      title,
      description: "1 hour",
      category: DAY1_CATEGORY,
      status: "todo", // onboarding_tasks CHECK: todo|in_progress|done|blocked|skipped
      due_date: dueDate,
      position: i,
    })),
  );
  if (error) console.error("[onboarding-cycle] day1 task seed failed:", error.message);
}

// Create the journey (and Day 1 checklist) for a team member if none exists.
export async function ensureJourney(teamMemberId: string): Promise<void> {
  const { data: existing } = await companyOs
    .from("onboarding_plans")
    .select("id")
    .eq("team_member_id", teamMemberId)
    .maybeSingle();
  if (existing) return;
  const { error } = await companyOs.from("onboarding_plans").insert({ team_member_id: teamMemberId });
  // A concurrent insert loses on the unique(team_member_id) constraint; fine.
  if (error && !error.message.includes("duplicate")) {
    console.error("[onboarding-cycle] journey insert failed:", error.message);
    return;
  }
  const { data: tm } = await companyOs
    .from("team_members")
    .select("start_date")
    .eq("id", teamMemberId)
    .maybeSingle();
  await seedDay1Tasks(teamMemberId, (tm as { start_date: string | null } | null)?.start_date ?? null);
}

// Every onboarding-stage member gets a journey, and so does ANYONE inside
// their first 180 days regardless of stage (covers hires promoted before this
// feature shipped, and admin-created rows that never passed ensureJourney) —
// the cycle tracks the full first 180 days, not just probation.
export async function backfillJourneys(): Promise<number> {
  const cutoff = addDays(saigonToday(), -179);
  const { data } = await companyOs
    .from("team_members")
    .select("id")
    .or(`employment_stage.in.(pre_boarding,probation),start_date.gte.${cutoff}`)
    .in("status", LIVE_STATUSES);
  const ids = ((data ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return 0;
  const { data: have } = await companyOs
    .from("onboarding_plans")
    .select("team_member_id")
    .in("team_member_id", ids);
  const existing = new Set(((have ?? []) as { team_member_id: string }[]).map((r) => r.team_member_id));
  const missing = ids.filter((id) => !existing.has(id));
  for (const id of missing) await ensureJourney(id);
  return missing.length;
}

// ---- manager / recruiter resolution ----------------------------------------

type Contact = { name: string; email: string | null };

// Forward lookup by team_members id — never the reverse-resolving PostgREST
// embed on the self-referencing manager_id FK (see lib/admin/probation.ts).
async function resolveMemberContacts(ids: string[]): Promise<Map<string, Contact>> {
  const map = new Map<string, Contact>();
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return map;
  const { data } = await companyOs
    .from("team_members")
    .select("id, people:people!person_id(full_name, preferred_name, email)")
    .in("id", unique);
  for (const r of (data ?? []) as Array<{ id: string; people: PersonEmbed | PersonEmbed[] | null }>) {
    const p = one(r.people);
    if (p) map.set(r.id, { name: displayName(p), email: p.email ?? null });
  }
  return map;
}

// Recruiter to CC on the Day 60 congratulations: latest application -> job
// requisition -> recruiter (a team_members id). Direct hires with no
// application fall back to the talent director.
async function recruiterEmailFor(personId: string | null): Promise<string | null> {
  if (!personId) return null;
  const { data: app } = await companyOs
    .from("applications")
    .select("job_requisition_id")
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const reqId = (app as { job_requisition_id: string | null } | null)?.job_requisition_id ?? null;
  if (!reqId) return null;
  const { data: req } = await companyOs
    .from("job_requisitions")
    .select("recruiter_id")
    .eq("id", reqId)
    .maybeSingle();
  const recruiterId = (req as { recruiter_id: string | null } | null)?.recruiter_id ?? null;
  if (!recruiterId) return null;
  const contacts = await resolveMemberContacts([recruiterId]);
  return contacts.get(recruiterId)?.email ?? null;
}

// ---- the daily pass ---------------------------------------------------------

export type CycleRunSummary = {
  date: string;
  journeys: number;
  backfilled: number;
  planNags: number;
  day8Sent: number;
  reviewsSent: number;
  decisionReminders: number;
  promoted: number;
  day180Sent: number;
};

async function patchJourney(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await companyOs
    .from("onboarding_plans")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.error("[onboarding-cycle] journey update failed:", error.message);
}

// The display stage for a journey on a given day. Date-driven, so the board
// self-corrects: columns are states of the clock, not drag targets. The review
// window keys off probation end (probation_ends_on, else Day 60) so a 30-day
// extension moves the Day 45/60 phases with it.
export function computeStage(row: CycleRow, todayISO: string): CycleStage {
  if (row.day180_email_sent_at || row.completed_at) return "complete";
  const start = row.member.startDate;
  if (!start) return "preboarding";
  const d = cycleDay(start, todayISO);
  if (d < 1) return "preboarding";
  if (d >= 180) return "day_180";
  const probEnd = row.member.probationEndsOn ?? addDays(start, 59);
  if (todayISO >= probEnd || row.day60_promoted_at) return "day_60";
  if (todayISO >= addDays(probEnd, -15)) return "day_45";
  if (d >= 8) return "day_8";
  return "day_1";
}

export async function runOnboardingCycle(todayISO: string): Promise<CycleRunSummary> {
  const backfilled = await backfillJourneys();
  const rows = (await loadCycleRows()).filter(
    (r) => r.stage !== "complete" && LIVE_STATUSES.includes(r.member.status ?? ""),
  );
  const managers = await resolveMemberContacts(rows.map((r) => r.member.managerId ?? ""));
  const origin = getSiteOrigin();

  const summary: CycleRunSummary = {
    date: todayISO,
    journeys: rows.length,
    backfilled,
    planNags: 0,
    day8Sent: 0,
    reviewsSent: 0,
    decisionReminders: 0,
    promoted: 0,
    day180Sent: 0,
  };

  for (const row of rows) {
    const start = row.member.startDate;
    if (!start) continue; // no clock to run without a start date
    const d = cycleDay(start, todayISO);
    const probEnd = row.member.probationEndsOn ?? addDays(start, 59);
    const manager = row.member.managerId ? managers.get(row.member.managerId) : undefined;
    const name = row.member.name;
    const boardLink = `${origin}/team/onboarding`;
    // Someone already confirmed full time (promoted before this feature, or by
    // an admin directly) rides the board to Day 180 but must never re-enter
    // the review/decision flow.
    const alreadyFullTime = row.member.employmentStage === "full_time";

    // 1) Plan-link nag: the 7 days before Day 1, daily, deliberately
    //    stateless — it repeats until the plan link is added.
    if (d >= -6 && d <= 0 && !row.plan_url && manager?.email) {
      const ok = await sendTransactionalEmail({
        to: [manager.email, TALENT_DIRECTOR_EMAIL],
        subject: `Onboarding plan needed before Day 1: ${name}`,
        html:
          `<p><strong>${name}</strong> starts on <strong>${start}</strong> (${1 - d} day${1 - d === 1 ? "" : "s"} away) and their onboarding plan link is not added yet.</p>` +
          `<p>Every new hire needs their plan in place one week before Day 1. This reminder repeats daily until the link is added.</p>` +
          `<p><a href="${boardLink}">Add it on your Onboarding board</a></p>`,
        logMeta: { source: "onboarding-cycle", kind: "plan_nag" },
      });
      if (ok) summary.planNags += 1;
    }

    // 2) Day 8 feedback survey to the new hire. Only worth sending while the
    //    first weeks are fresh: past day 30 (journeys backfilled long after
    //    start) stamp it as handled instead of sending a "one week in" email
    //    to someone two months in.
    if (d > 30 && !row.day8_survey_sent_at) {
      await patchJourney(row.id, { day8_survey_sent_at: new Date().toISOString() });
    } else if (d >= 8 && !row.day8_survey_sent_at && row.member.email) {
      const ok = await sendTransactionalEmail({
        to: row.member.email,
        subject: "One week in — 3 quick questions",
        html:
          `<p>Hi ${name},</p>` +
          `<p>You are one week into Edge8. Three quick questions (about a minute) so we can fix anything that is not working:</p>` +
          `<p><a href="${origin}/surveys/${DAY8_SURVEY_SLUG}">Answer the Day 8 survey</a></p>` +
          `<p>Your manager and the talent team read every response.</p>`,
        logMeta: { source: "onboarding-cycle", kind: "day8_survey" },
      });
      if (ok) {
        await patchJourney(row.id, { day8_survey_sent_at: new Date().toISOString() });
        summary.day8Sent += 1;
      }
    }

    // 3) Probation review to the manager, 15 days before probation ends
    //    (Day 45 on the default 60-day window; re-armed by an extension).
    if (
      todayISO >= addDays(probEnd, -15) &&
      !row.day45_email_sent_at &&
      !row.decision &&
      !row.day60_promoted_at &&
      !alreadyFullTime &&
      manager?.email
    ) {
      const ok = await sendTransactionalEmail({
        to: manager.email,
        subject: `Probation review due: ${name}`,
        html:
          `<p><strong>${name}</strong>${row.member.positionTitle ? ` (${row.member.positionTitle})` : ""} finishes probation on <strong>${probEnd}</strong>.</p>` +
          `<p>Complete their review now — one decision: offer full time, extend probation 30 days, or terminate.</p>` +
          `<p><a href="${origin}/surveys/${REVIEW_SURVEY_SLUG}?subject=${row.team_member_id}">Open the review</a></p>`,
        logMeta: { source: "onboarding-cycle", kind: "day45_review" },
      });
      if (ok) {
        await patchJourney(row.id, { day45_email_sent_at: new Date().toISOString() });
        summary.reviewsSent += 1;
      }
    }

    // 4) Decision overdue: 5 days before probation ends with no decision on
    //    file — daily, stateless, CC the talent director. Nothing promotes
    //    automatically until a human decides.
    if (
      todayISO >= addDays(probEnd, -5) &&
      !row.decision &&
      !row.day60_promoted_at &&
      !alreadyFullTime &&
      manager?.email
    ) {
      const ok = await sendTransactionalEmail({
        to: [manager.email, TALENT_DIRECTOR_EMAIL],
        subject: `Probation decision overdue: ${name}`,
        html:
          `<p><strong>${name}</strong>'s probation ends on <strong>${probEnd}</strong> and no decision is recorded.</p>` +
          `<p>Nothing happens automatically until you decide. This reminder repeats daily.</p>` +
          `<p><a href="${origin}/surveys/${REVIEW_SURVEY_SLUG}?subject=${row.team_member_id}">Record the decision</a></p>`,
        logMeta: { source: "onboarding-cycle", kind: "decision_reminder" },
      });
      if (ok) summary.decisionReminders += 1;
    }

    // 5) Day 60 promotion: probation over + manager passed them -> full time,
    //    congratulations to the hire, CC manager + recruiter. Someone already
    //    full time just gets the marker stamped quietly — no writes, no email.
    if (alreadyFullTime && !row.day60_promoted_at) {
      await patchJourney(row.id, { day60_promoted_at: new Date().toISOString() });
    } else if (todayISO >= probEnd && row.decision === "offer_full_time" && !row.day60_promoted_at) {
      const statusPatch = row.member.status === "pre_start" ? { status: "active" } : {};
      const { error } = await companyOs
        .from("team_members")
        .update({ employment_stage: "full_time", ...statusPatch })
        .eq("id", row.team_member_id);
      if (!error) {
        await patchJourney(row.id, { day60_promoted_at: new Date().toISOString() });
        await recordAudit({
          table: "team_members",
          recordId: row.team_member_id,
          operation: "update",
          actor: "onboarding-cycle",
          context: { action: "day60_promotion", probation_end: probEnd },
        });
        summary.promoted += 1;
        if (row.member.email) {
          const recruiter = await recruiterEmailFor(row.member.personId);
          const cc = [...new Set([manager?.email, recruiter ?? TALENT_DIRECTOR_EMAIL].filter(
            (e): e is string => Boolean(e),
          ))];
          await sendTransactionalEmail({
            to: [row.member.email, ...cc],
            subject: `Congratulations ${name} — you're a full-time Edge8 team member!`,
            html:
              `<p>Hi ${name},</p>` +
              `<p><strong>Congratulations!</strong> You passed probation and as of today you are a full-time member of the Edge8 team.</p>` +
              `<p>Thank you for everything you have put in over your first 60 days — we are glad you are here.</p>` +
              `<p>— The Edge8 team</p>`,
            logMeta: { source: "onboarding-cycle", kind: "day60_congrats" },
          });
        }
      } else {
        console.error("[onboarding-cycle] promotion failed:", error.message);
      }
    }

    // 6) Day 180: prompt the Talent Director for the stay interview, close the
    //    journey.
    if (d >= 180 && !row.day180_email_sent_at) {
      const ok = await sendTransactionalEmail({
        to: TALENT_DIRECTOR_EMAIL,
        subject: `180-day stay interview: ${name}`,
        html:
          `<p><strong>${name}</strong>${row.member.positionTitle ? ` (${row.member.positionTitle})` : ""} hits 180 days on <strong>${addDays(start, 179)}</strong>.</p>` +
          `<p>Time for their stay interview: what keeps them here, what would make them leave, what should change.</p>`,
        logMeta: { source: "onboarding-cycle", kind: "day180_stay" },
      });
      if (ok) {
        await patchJourney(row.id, {
          day180_email_sent_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          stage: "complete",
        });
        summary.day180Sent += 1;
        continue;
      }
    }

    // Keep the stored stage in sync with the clock.
    const stage = computeStage(row, todayISO);
    if (stage !== row.stage) await patchJourney(row.id, { stage });
  }

  return summary;
}

// ---- survey post-submit processors -----------------------------------------

// Day 8: link the response to the journey so the board can show the score.
export async function recordDay8Response(personId: string, responseId: string): Promise<void> {
  const { data: tm } = await companyOs
    .from("team_members")
    .select("id")
    .eq("person_id", personId)
    .in("status", LIVE_STATUSES)
    .limit(1)
    .maybeSingle();
  const teamMemberId = (tm as { id: string } | null)?.id;
  if (!teamMemberId) return;
  await ensureJourney(teamMemberId);
  const { data: journey } = await companyOs
    .from("onboarding_plans")
    .select("id, day8_response_id")
    .eq("team_member_id", teamMemberId)
    .maybeSingle();
  const j = journey as { id: string; day8_response_id: string | null } | null;
  if (!j || j.day8_response_id) return;
  await patchJourney(j.id, { day8_response_id: responseId });
}

// 45-day review: record the manager's decision and apply its consequences.
// The subject arrives as a query param on a link only the manager was emailed;
// we still verify the respondent is the subject's manager (or the talent
// director) by email before recording anything. Termination is never executed
// by the system — it notifies the talent director and stops.
export async function processProbationReview(input: {
  subjectTeamMemberId: string;
  responseId: string;
  decisionLabel: string;
  respondentEmail: string | null;
}): Promise<void> {
  const decision = DECISION_BY_CHOICE[input.decisionLabel];
  if (!decision) return;

  const { data: tmData } = await companyOs
    .from("team_members")
    .select(
      "id, person_id, manager_id, start_date, probation_ends_on, " +
        "people:people!person_id(full_name, preferred_name, email)",
    )
    .eq("id", input.subjectTeamMemberId)
    .maybeSingle();
  if (!tmData) return;
  const tm = tmData as unknown as Record<string, unknown>;
  const subjectName = displayName(one(tm.people as PersonEmbed | PersonEmbed[] | null));
  const managerId = (tm.manager_id as string | null) ?? null;

  // Authorize: the respondent's email must match the subject's manager (or the
  // talent director). The survey link is emailed only to the manager, but the
  // endpoint is public, so this check keeps a forwarded link from letting
  // anyone else record the decision.
  const respondent = (input.respondentEmail ?? "").trim().toLowerCase();
  const managerEmail = managerId
    ? (await resolveMemberContacts([managerId])).get(managerId)?.email?.toLowerCase() ?? null
    : null;
  const authorized =
    respondent.length > 0 && (respondent === managerEmail || respondent === TALENT_DIRECTOR_EMAIL);
  if (!authorized) {
    console.error(
      `[onboarding-cycle] review for ${input.subjectTeamMemberId} ignored: respondent ${respondent || "(none)"} is not the manager`,
    );
    return;
  }

  await ensureJourney(input.subjectTeamMemberId);
  const { data: journeyData } = await companyOs
    .from("onboarding_plans")
    .select("id")
    .eq("team_member_id", input.subjectTeamMemberId)
    .maybeSingle();
  const journeyId = (journeyData as { id: string } | null)?.id;
  if (!journeyId) return;

  // The decider's team_members row (for decision_by), resolved by email.
  let decidedBy: string | null = null;
  if (managerEmail && respondent === managerEmail) decidedBy = managerId;

  if (decision === "extend_probation_30") {
    const start = (tm.start_date as string | null) ?? null;
    const currentEnd =
      ((tm.probation_ends_on as string | null) ?? null) ?? (start ? addDays(start, 59) : null);
    if (currentEnd) {
      const newEnd = addDays(currentEnd, 30);
      const { error } = await companyOs
        .from("team_members")
        .update({ probation_ends_on: newEnd, contract_start_date: addDays(newEnd, 1) })
        .eq("id", input.subjectTeamMemberId);
      if (error) console.error("[onboarding-cycle] extension update failed:", error.message);
      else
        await recordAudit({
          table: "team_members",
          recordId: input.subjectTeamMemberId,
          operation: "update",
          actor: respondent,
          context: { action: "probation_extended_30", new_end: newEnd },
        });
    }
    // Re-arm the review for the new window: the next review email fires 15
    // days before the new probation end.
    await patchJourney(journeyId, {
      day45_response_id: input.responseId,
      decision: null,
      decision_at: null,
      decision_by: null,
      day45_email_sent_at: null,
    });
    return;
  }

  await patchJourney(journeyId, {
    day45_response_id: input.responseId,
    decision,
    decision_at: new Date().toISOString(),
    decision_by: decidedBy,
  });
  await recordAudit({
    table: "onboarding_plans",
    recordId: journeyId,
    operation: "update",
    actor: respondent,
    context: { action: "probation_decision", decision },
  });

  if (decision === "terminate") {
    await sendTransactionalEmail({
      to: TALENT_DIRECTOR_EMAIL,
      subject: `Probation decision — terminate: ${subjectName}`,
      html:
        `<p>The manager recorded a <strong>terminate</strong> decision for <strong>${subjectName}</strong> on their probation review.</p>` +
        `<p>Nothing is automated for termination — please run the off-boarding process manually.</p>`,
      logMeta: { source: "onboarding-cycle", kind: "terminate_notice" },
    });
  }
}

// ---- plan link --------------------------------------------------------------
// The plan is a link to wherever the manager wrote it (Google Doc, Lark doc,
// Notion...), stored on the journey row. AUTHORIZATION IS THE CALLER'S JOB —
// the /team action asserts the journey is in the manager's scope first.

export function normalizePlanUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 2000) return null;
  // Accept a pasted link with or without the scheme.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function savePlanLink(
  journeyId: string,
  url: string,
  addedByTeamMemberId: string | null,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const normalized = normalizePlanUrl(url);
  if (!normalized) return { ok: false, error: "Paste a valid link (e.g. a Google Doc URL)." };

  const { error } = await companyOs
    .from("onboarding_plans")
    .update({
      plan_url: normalized,
      plan_uploaded_by: addedByTeamMemberId,
      plan_uploaded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", journeyId);
  if (error) return { ok: false, error: "Could not save the plan link." };
  return { ok: true };
}

// ---- Day 1 checklist + Day 8 score reads for the board ----------------------

export type Day1Task = { id: string; teamMemberId: string; title: string; status: string };

export async function getDay1Tasks(teamMemberIds: string[]): Promise<Day1Task[]> {
  if (teamMemberIds.length === 0) return [];
  const { data } = await companyOs
    .from("onboarding_tasks")
    .select("id, team_member_id, title, status, position")
    .in("team_member_id", teamMemberIds)
    .eq("category", DAY1_CATEGORY)
    .order("position", { ascending: true });
  return ((data ?? []) as Array<{ id: string; team_member_id: string; title: string; status: string }>).map(
    (t) => ({ id: t.id, teamMemberId: t.team_member_id, title: t.title, status: t.status }),
  );
}

// Average Day 8 score (1-5) per response id.
export async function getDay8Scores(responseIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  const ids = responseIds.filter(Boolean);
  if (ids.length === 0) return map;
  const { data } = await companyOs
    .from("survey_answers")
    .select("response_id, value")
    .in("response_id", ids);
  const sums = new Map<string, { total: number; n: number }>();
  for (const a of (data ?? []) as Array<{ response_id: string; value: string | null }>) {
    const n = Number(a.value);
    if (!Number.isFinite(n)) continue;
    const s = sums.get(a.response_id) ?? { total: 0, n: 0 };
    s.total += n;
    s.n += 1;
    sums.set(a.response_id, s);
  }
  for (const [id, s] of sums) if (s.n > 0) map.set(id, Math.round((s.total / s.n) * 10) / 10);
  return map;
}
