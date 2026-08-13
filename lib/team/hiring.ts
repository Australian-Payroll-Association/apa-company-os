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

const OPEN_STATUSES = ["open", "on_hold", "draft"];

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
