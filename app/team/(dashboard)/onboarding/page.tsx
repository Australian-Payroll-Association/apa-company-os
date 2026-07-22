import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import {
  getCycleRowsFor,
  getDay1Tasks,
  getDay8Scores,
  computeStage,
  cycleDay,
  saigonToday,
  addDays,
} from "@/lib/onboarding-cycle";
import { OnboardingBoard, type BoardCard } from "./OnboardingBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Onboarding",
  description: "Your reports' onboarding journeys, from pre-boarding to the 180-day stay interview.",
};

// /team/onboarding — the Edge8 Onboarding Cycle board, manager-only (the
// sidebar shows My Team only to managers; this guard covers direct URLs).
// Every read is scoped to actor.teamMemberScope: a manager sees exactly their
// own reports' journeys, nothing else.
export default async function TeamOnboardingPage() {
  const actor = await requireTeamMember();
  if (actor.role !== "manager") redirect("/team");

  const today = saigonToday();
  const rows = await getCycleRowsFor(actor.teamMemberScope);
  const [tasks, scores] = await Promise.all([
    getDay1Tasks(rows.map((r) => r.team_member_id)),
    getDay8Scores(rows.map((r) => r.day8_response_id ?? "").filter(Boolean)),
  ]);

  const tasksByMember = new Map<string, { id: string; title: string; done: boolean }[]>();
  for (const t of tasks) {
    const arr = tasksByMember.get(t.teamMemberId) ?? [];
    arr.push({ id: t.id, title: t.title, done: t.status === "done" });
    tasksByMember.set(t.teamMemberId, arr);
  }

  const cards: BoardCard[] = rows.map((r) => {
    const stage = computeStage(r, today);
    const start = r.member.startDate;
    return {
      id: r.id,
      columnId: stage === "complete" ? "day_180" : stage,
      complete: stage === "complete",
      name: r.member.name,
      avatarUrl: r.member.avatarUrl,
      positionTitle: r.member.positionTitle,
      startDate: start,
      dayNumber: start ? cycleDay(start, today) : null,
      probationEndsOn: r.member.probationEndsOn ?? (start ? addDays(start, 59) : null),
      contractStartDate: r.member.contractStartDate,
      planUploaded: Boolean(r.plan_path),
      planUploadedAt: r.plan_uploaded_at,
      day8SurveySentAt: r.day8_survey_sent_at,
      day8Score: r.day8_response_id ? scores.get(r.day8_response_id) ?? null : null,
      day45EmailSentAt: r.day45_email_sent_at,
      decision: r.decision,
      decisionAt: r.decision_at,
      promotedAt: r.day60_promoted_at,
      day180SentAt: r.day180_email_sent_at,
      tasks: tasksByMember.get(r.team_member_id) ?? [],
    };
  });

  return (
    <>
      <PageHead
        title="Onboarding"
        sub={`${cards.length} journey${cards.length === 1 ? "" : "s"} · the cycle runs itself — upload each plan before Day 1 and decide at the 45-day review`}
      />
      {cards.length === 0 ? (
        <div className="admin-empty">
          None of your reports are in onboarding right now. New hires appear here automatically from
          pre-boarding through their 180-day stay interview.
        </div>
      ) : (
        <OnboardingBoard cards={cards} />
      )}
    </>
  );
}
