// /team/hiring, the manager's read on open roles: what is open, who is in
// flight, what the loop is, and where the manager personally sits in it.
//
// SCOPE: the manager's department, read from team_members.department_id.
// NOT positions.department_id: a position row is shared by everyone holding
// that title, so "AI Engineer" is one row spanning three clients and Product,
// and a department there would be meaningless. Department is a property of the
// person.
//
// Admins see every open req regardless of department: a founder scoped to one
// department loses sight of the company's hiring, which is the opposite of the
// point. A manager with no department on file also sees everything, so a
// missing row never yields a blank page.
//
// Read-only throughout: hiring is written from /admin.

import { companyOs } from "@/lib/supabase";
import type { TeamActor } from "@/lib/team-auth";
import { getLoopsForRequisitions, type LoopStep } from "@/lib/ats/loop";

type PersonRow = { full_name: string | null; preferred_name: string | null; email: string | null };

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

const displayName = (p: PersonRow | null): string =>
  p?.preferred_name || p?.full_name || p?.email || "-";

export type HiringCandidate = {
  applicationId: string;
  name: string;
  stageName: string | null;
  appliedAt: string | null;
  rating: number | null;
};

export type HiringReq = {
  id: string;
  title: string;
  status: string;
  headcount: number | null;
  location: string | null;
  employmentType: string | null;
  openedAt: string | null;
  hiringManagerName: string | null;
  hiringManagerIsMe: boolean;
  loop: LoopStep[];
  candidates: HiringCandidate[];
  // Candidates sitting on a non-terminal stage, the number a manager acts on.
  activeCount: number;
};

export type MyLoopSlot = {
  reqId: string;
  reqTitle: string;
  stepName: string;
  durationMinutes: number | null;
  position: number;
  // Candidates currently at the Interview stage on this req, i.e. the people
  // this manager is on the hook to meet.
  waiting: number;
  // Conversations already booked against this step, soonest first. Empty until
  // the Lark ingest has matched a calendar event to it.
  booked: BookedInterview[];
};

export type BookedInterview = {
  interviewId: string;
  candidateName: string;
  scheduledAt: string;
  durationMinutes: number | null;
  status: string | null;
  mode: string | null;
};

export type TeamHiring = {
  reqs: HiringReq[];
  mySlots: MyLoopSlot[];
  departmentScoped: boolean;
};

// A booked interview this manager personally sits on, seen from the day view:
// up next, happening now, a scorecard owed, or already scored. Distinct from
// MyLoopSlot (standing loop membership) — this is one specific conversation.
export type MyInterviewState = "up_next" | "in_progress" | "scorecard_due" | "done";

export type MyInterview = {
  interviewId: string;
  applicationId: string;
  candidateName: string;
  reqTitle: string;
  stepName: string;
  scheduledAt: string;
  durationMinutes: number | null;
  mode: string | null;
  status: string | null;
  state: MyInterviewState;
  isToday: boolean;
};

const OPEN_STATUSES = ["open", "on_hold", "draft"];

// The clock everyone on this team reads. "Today" and the in-progress window are
// judged in Saigon time, not the server's UTC.
const SAIGON_TZ = "Asia/Ho_Chi_Minh";

// YYYY-MM-DD for a moment, as seen in Saigon. en-CA formats ISO-style.
function saigonDateKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: SAIGON_TZ });
}

// Interviews carrying no scorecard need are skipped from the scorecard-due
// backlog: a cancelled conversation is not owed a card.
const DEAD_INTERVIEW_STATUSES = new Set(["cancelled", "canceled", "withdrawn", "no_show"]);
// How far back an unscored interview keeps nagging. Older than this and it has
// aged out of the day view (the record still exists in admin).
const SCORECARD_DUE_WINDOW_DAYS = 30;

// The actor's own department. Null means "not filed", which reads as no filter.
async function actorDepartmentId(actor: TeamActor): Promise<string | null> {
  const { data } = await companyOs
    .from("team_members")
    .select("department_id")
    .eq("id", actor.teamMemberId)
    .maybeSingle();
  return (data as { department_id: string | null } | null)?.department_id ?? null;
}

export async function getTeamHiring(actor: TeamActor): Promise<TeamHiring> {
  // Admins are deliberately unscoped, see the note at the top of the file.
  const departmentId = actor.isAdmin ? null : await actorDepartmentId(actor);

  let reqQuery = companyOs
    .from("job_requisitions")
    .select(
      "id, title, status, headcount, location, employment_type, opened_at, hiring_manager_id, " +
        "people:people!hiring_manager_id(full_name, preferred_name, email)",
    )
    .in("status", OPEN_STATUSES)
    .order("opened_at", { ascending: false });
  if (departmentId) reqQuery = reqQuery.eq("department_id", departmentId);

  const { data: reqRows } = await reqQuery;
  const reqs = ((reqRows ?? []) as unknown as Record<string, unknown>[]);
  if (reqs.length === 0) {
    return { reqs: [], mySlots: [], departmentScoped: Boolean(departmentId) };
  }
  const reqIds = reqs.map((r) => r.id as string);

  const [{ data: stageRows }, { data: appRows }, loops] = await Promise.all([
    companyOs
      .from("application_stages")
      .select("id, job_requisition_id, name, position, is_terminal")
      .in("job_requisition_id", reqIds)
      .order("position"),
    companyOs
      .from("applications")
      .select(
        "id, job_requisition_id, current_stage_id, rating, applied_at, archived_at, " +
          "people:people!person_id(full_name, preferred_name, email)",
      )
      .in("job_requisition_id", reqIds)
      .is("archived_at", null),
    getLoopsForRequisitions(reqIds),
  ]);

  const stages = (stageRows ?? []) as Array<{
    id: string;
    job_requisition_id: string;
    name: string;
    position: number;
    is_terminal: boolean;
  }>;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  // The pipeline's interview stage per req, for "who am I on the hook to meet".
  const interviewStageByReq = new Map<string, string>();
  for (const s of stages) {
    if (!interviewStageByReq.has(s.job_requisition_id) && /interview/i.test(s.name)) {
      interviewStageByReq.set(s.job_requisition_id, s.id);
    }
  }

  const candidatesByReq = new Map<string, HiringCandidate[]>();
  const atInterviewByReq = new Map<string, number>();
  for (const a of ((appRows ?? []) as unknown as Record<string, unknown>[])) {
    const reqId = a.job_requisition_id as string;
    const stageId = (a.current_stage_id as string | null) ?? null;
    const stage = stageId ? stageById.get(stageId) ?? null : null;
    const list = candidatesByReq.get(reqId) ?? [];
    list.push({
      applicationId: a.id as string,
      name: displayName(one(a.people as PersonRow | PersonRow[] | null)),
      stageName: stage?.name ?? null,
      appliedAt: (a.applied_at as string | null) ?? null,
      rating: (a.rating as number | null) ?? null,
    });
    candidatesByReq.set(reqId, list);
    if (stageId && stageId === interviewStageByReq.get(reqId)) {
      atInterviewByReq.set(reqId, (atInterviewByReq.get(reqId) ?? 0) + 1);
    }
  }

  const out: HiringReq[] = reqs.map((r) => {
    const id = r.id as string;
    const list = (candidatesByReq.get(id) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const active = list.filter((c) => {
      const s = stages.find((x) => x.job_requisition_id === id && x.name === c.stageName);
      return s ? !s.is_terminal : true;
    }).length;
    return {
      id,
      title: (r.title as string | null) ?? "(untitled req)",
      status: (r.status as string | null) ?? "open",
      headcount: (r.headcount as number | null) ?? null,
      location: (r.location as string | null) ?? null,
      employmentType: (r.employment_type as string | null) ?? null,
      openedAt: (r.opened_at as string | null) ?? null,
      hiringManagerName: r.hiring_manager_id
        ? displayName(one(r.people as PersonRow | PersonRow[] | null))
        : null,
      hiringManagerIsMe: (r.hiring_manager_id as string | null) === actor.personId,
      loop: loops.get(id) ?? [],
      candidates: list,
      activeCount: active,
    };
  });

  // Booked conversations against these reqs' loop steps. Written by the Lark
  // ingest; absent until a recruiter has actually put something in a calendar.
  const stepIds = out.flatMap((r) => r.loop.map((s) => s.id));
  const bookedByStep = new Map<string, BookedInterview[]>();
  if (stepIds.length > 0) {
    const { data: ivRows } = await companyOs
      .from("interviews")
      .select(
        "id, loop_step_id, scheduled_at, duration_minutes, status, mode, " +
          "applications:applications!application_id(people:people!person_id(full_name, preferred_name, email))",
      )
      .in("loop_step_id", stepIds)
      .not("scheduled_at", "is", null)
      .order("scheduled_at");
    for (const r of ((ivRows ?? []) as unknown as Record<string, unknown>[])) {
      const app = one(r.applications as Record<string, unknown> | Record<string, unknown>[] | null);
      const stepId = r.loop_step_id as string;
      const list = bookedByStep.get(stepId) ?? [];
      list.push({
        interviewId: r.id as string,
        candidateName: displayName(one((app?.people ?? null) as PersonRow | PersonRow[] | null)),
        scheduledAt: r.scheduled_at as string,
        durationMinutes: (r.duration_minutes as number | null) ?? null,
        status: (r.status as string | null) ?? null,
        mode: (r.mode as string | null) ?? null,
      });
      bookedByStep.set(stepId, list);
    }
  }

  // Where this manager personally sits in a loop. Loops reference people, so
  // the match is on personId, never teamMemberId.
  const mySlots: MyLoopSlot[] = [];
  for (const req of out) {
    for (const step of req.loop) {
      if (!step.interviewers.some((iv) => iv.personId === actor.personId)) continue;
      mySlots.push({
        reqId: req.id,
        reqTitle: req.title,
        stepName: step.name,
        durationMinutes: step.durationMinutes,
        position: step.position,
        waiting: atInterviewByReq.get(req.id) ?? 0,
        booked: bookedByStep.get(step.id) ?? [],
      });
    }
  }
  mySlots.sort((a, b) => a.reqTitle.localeCompare(b.reqTitle) || a.position - b.position);

  return { reqs: out, mySlots, departmentScoped: Boolean(departmentId) };
}

// The manager's day: every booked interview they personally sit on that is
// either happening today or overdue a scorecard from them. Seats are read from
// interview_interviewers (the per-interview panel the Lark ingest writes from
// the loop's assigned interviewers), matched on personId. Scoping is implicit:
// an actor only ever sees interviews they hold a seat on, so no department
// filter is needed or wanted here.
export async function getMyInterviewDay(actor: TeamActor): Promise<MyInterview[]> {
  const { data: seatRows } = await companyOs
    .from("interview_interviewers")
    .select(
      "interview_id, " +
        "interviews:interviews!interview_id ( id, title, scheduled_at, duration_minutes, mode, status, application_id, " +
        "requisition_loop_steps:requisition_loop_steps!loop_step_id ( name ), " +
        "applications:applications!application_id ( id, archived_at, " +
        "job_requisitions:job_requisitions!job_requisition_id ( title ), " +
        "people:people!person_id ( full_name, preferred_name, email ) ) )",
    )
    .eq("interviewer_id", actor.personId);

  const rows = (seatRows ?? []) as unknown as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const now = new Date();
  const nowMs = now.getTime();
  const todayKey = saigonDateKey(now);
  const cutoffMs = nowMs - SCORECARD_DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  // First pass: keep the seats that could plausibly appear (real booking, live
  // application, not aged out), so the scorecard lookup only spans those.
  type Candidate = {
    interviewId: string;
    applicationId: string;
    candidateName: string;
    reqTitle: string;
    stepName: string;
    scheduledAt: string;
    startMs: number;
    endMs: number;
    durationMinutes: number | null;
    mode: string | null;
    status: string | null;
    isToday: boolean;
  };
  const candidates: Candidate[] = [];
  for (const r of rows) {
    const iv = one(r.interviews as Record<string, unknown> | Record<string, unknown>[] | null);
    if (!iv) continue;
    const scheduledAt = (iv.scheduled_at as string | null) ?? null;
    if (!scheduledAt) continue;
    const status = (iv.status as string | null) ?? null;
    if (status && DEAD_INTERVIEW_STATUSES.has(status)) continue;
    const app = one(iv.applications as Record<string, unknown> | Record<string, unknown>[] | null);
    if (!app || (app.archived_at as string | null)) continue;

    const startMs = new Date(scheduledAt).getTime();
    if (Number.isNaN(startMs)) continue;
    const isToday = saigonDateKey(new Date(startMs)) === todayKey;
    // A future interview on another day belongs to that day, not this view.
    // Keep today's (any time) and past ones inside the nag window.
    if (!isToday && (startMs > nowMs || startMs < cutoffMs)) continue;

    const durationMinutes = (iv.duration_minutes as number | null) ?? null;
    const step = one(iv.requisition_loop_steps as Record<string, unknown> | Record<string, unknown>[] | null);
    const req = one(app.job_requisitions as Record<string, unknown> | Record<string, unknown>[] | null);
    candidates.push({
      interviewId: iv.id as string,
      applicationId: app.id as string,
      candidateName: displayName(one(app.people as PersonRow | PersonRow[] | null)),
      reqTitle: (req?.title as string | null) ?? "(untitled req)",
      stepName: (step?.name as string | null) || (iv.title as string | null) || "Interview",
      scheduledAt,
      startMs,
      endMs: startMs + (durationMinutes ?? 60) * 60 * 1000,
      durationMinutes,
      mode: (iv.mode as string | null) ?? null,
      status,
      isToday,
    });
  }
  if (candidates.length === 0) return [];

  // Which of these has this actor already scored? A submitted scorecard clears
  // the "due" flag and drops an overdue interview out of the view entirely.
  const submitted = new Set<string>();
  const { data: scRows } = await companyOs
    .from("interview_scorecards")
    .select("interview_id")
    .eq("interviewer_id", actor.personId)
    .not("submitted_at", "is", null)
    .in(
      "interview_id",
      candidates.map((c) => c.interviewId),
    );
  for (const s of (scRows ?? []) as { interview_id: string }[]) submitted.add(s.interview_id);

  const out: MyInterview[] = [];
  for (const c of candidates) {
    const hasScorecard = submitted.has(c.interviewId);
    let state: MyInterviewState;
    if (c.isToday) {
      if (hasScorecard) state = "done";
      else if (nowMs < c.startMs) state = "up_next";
      else if (nowMs <= c.endMs) state = "in_progress";
      else state = "scorecard_due";
    } else {
      // Past, within the window. Only surfaces while a scorecard is still owed.
      if (hasScorecard) continue;
      state = "scorecard_due";
    }
    out.push({
      interviewId: c.interviewId,
      applicationId: c.applicationId,
      candidateName: c.candidateName,
      reqTitle: c.reqTitle,
      stepName: c.stepName,
      scheduledAt: c.scheduledAt,
      durationMinutes: c.durationMinutes,
      mode: c.mode,
      status: c.status,
      state,
      isToday: c.isToday,
    });
  }
  // Soonest first; overdue (earlier) naturally sorts to the top.
  out.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  return out;
}
