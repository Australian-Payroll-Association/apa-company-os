// The interview kit: everything a seated panelist needs to run one interview
// and file their scorecard, on /team. Access is by SEAT — a person may only
// open the kit for an interview they hold a seat on (interview_interviewers),
// and may only ever score as themselves. Blind-first is enforced HERE, on read:
// the other seats' scorecards (humans and the AI panelist) are withheld until
// this viewer has submitted their own. The carry-forward note from earlier
// rounds is always visible; it informs the next round without anchoring this one.

import { companyOs } from "@/lib/supabase";
import type { TeamActor } from "@/lib/team-auth";
import {
  recommendationFromDb,
  DEFAULT_CRITERIA,
  AI_PANELIST_EMAIL,
  type RecommendationKey,
} from "@/lib/admin/interview-panel";
import type { AiScreenSummary } from "@/lib/resume-screen";

type PersonRow = { full_name: string | null; preferred_name: string | null; email: string | null; metadata?: unknown };

const displayName = (p: PersonRow | null): string =>
  p?.preferred_name || p?.full_name || p?.email || "panelist";

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

const isAi = (p: PersonRow | null): boolean => {
  if (!p) return false;
  if (p.email === AI_PANELIST_EMAIL) return true;
  const meta = p.metadata as { is_ai?: boolean } | null;
  return Boolean(meta && meta.is_ai);
};

export type KitScore = { criterion: string; score: number | null; comment: string | null };

export type KitScorecard = {
  recommendation: RecommendationKey | null;
  overallScore: number | null;
  summary: string | null;
  submittedAt: string | null;
  scores: KitScore[];
};

export type KitSeat = {
  name: string;
  isAi: boolean;
  submitted: boolean;
  // Non-null only when revealed (this viewer has submitted their own scorecard).
  scorecard: KitScorecard | null;
};

export type InterviewKit = {
  interviewId: string;
  applicationId: string;
  candidateName: string;
  reqTitle: string;
  stepName: string;
  scheduledAt: string | null;
  durationMinutes: number | null;
  mode: string | null;
  aiRating: number | null;
  aiSummary: AiScreenSummary | null;
  carryForward: string | null;
  criteria: string[];
  myScorecard: KitScorecard | null;
  mySubmitted: boolean;
  revealed: boolean;
  otherSeats: KitSeat[];
};

// Whether this person holds a seat on this interview. The only authorization the
// team scorecard write trusts — never a client-supplied interviewer id.
export async function actorHoldsSeat(personId: string, interviewId: string): Promise<boolean> {
  const { data } = await companyOs
    .from("interview_interviewers")
    .select("interviewer_id")
    .eq("interview_id", interviewId)
    .eq("interviewer_id", personId)
    .maybeSingle();
  return Boolean(data);
}

function buildScorecard(sc: Record<string, unknown> | undefined): KitScorecard | null {
  if (!sc) return null;
  const scores = ((sc.scorecard_scores ?? []) as Record<string, unknown>[])
    .slice()
    .sort((a, b) => ((a.position as number) ?? 0) - ((b.position as number) ?? 0))
    .map((s) => ({
      criterion: s.criterion as string,
      score: (s.score as number | null) ?? null,
      comment: (s.comment as string | null) ?? null,
    }));
  return {
    recommendation: recommendationFromDb(sc.recommendation as string | null),
    overallScore: (sc.overall_score as number | null) ?? null,
    summary: (sc.summary as string | null) ?? null,
    submittedAt: (sc.submitted_at as string | null) ?? null,
    scores,
  };
}

export async function getInterviewKit(actor: TeamActor, interviewId: string): Promise<InterviewKit | null> {
  const { data: iv } = await companyOs
    .from("interviews")
    .select(
      `id, title, scheduled_at, duration_minutes, mode, application_id,
       requisition_loop_steps:requisition_loop_steps!loop_step_id ( name ),
       applications:applications!application_id (
         id, ai_rating, ai_summary,
         job_requisitions:job_requisitions!job_requisition_id ( title ),
         people:people!person_id ( full_name, preferred_name, email )
       ),
       interview_interviewers ( interviewer_id, people!interviewer_id ( full_name, preferred_name, email, metadata ) ),
       interview_scorecards ( interviewer_id, recommendation, overall_score, summary, submitted_at,
         scorecard_scores ( criterion, score, comment, position ) )`,
    )
    .eq("id", interviewId)
    .maybeSingle();
  if (!iv) return null;

  const seats = (iv.interview_interviewers ?? []) as Record<string, unknown>[];
  const iAmSeated = seats.some((s) => s.interviewer_id === actor.personId);
  if (!iAmSeated) return null; // access is by seat; the page turns this into a 404

  const scByInterviewer = new Map<string, Record<string, unknown>>();
  for (const sc of (iv.interview_scorecards ?? []) as Record<string, unknown>[]) {
    scByInterviewer.set(sc.interviewer_id as string, sc);
  }

  const myScorecard = buildScorecard(scByInterviewer.get(actor.personId));
  const mySubmitted = Boolean(myScorecard?.submittedAt);
  const revealed = mySubmitted;

  const otherSeats: KitSeat[] = seats
    .filter((s) => s.interviewer_id !== actor.personId)
    .map((s) => {
      const person = one(s.people as PersonRow | PersonRow[] | null);
      const sc = scByInterviewer.get(s.interviewer_id as string);
      return {
        name: displayName(person),
        isAi: isAi(person),
        submitted: Boolean(sc?.submitted_at),
        // Blind-first: only hand back the actual scorecard once the viewer has
        // committed their own. Until then a client never receives it at all.
        scorecard: revealed ? buildScorecard(sc) : null,
      };
    })
    .sort((a, b) => Number(a.isAi) - Number(b.isAi) || a.name.localeCompare(b.name));

  const app = one(iv.applications as Record<string, unknown> | Record<string, unknown>[] | null);
  const req = one(app?.job_requisitions as Record<string, unknown> | Record<string, unknown>[] | null);
  const step = one(iv.requisition_loop_steps as Record<string, unknown> | Record<string, unknown>[] | null);

  // Rubric for the form: reuse what this viewer scored last time if present,
  // otherwise the default criteria. Per-role rubrics are a later plan item.
  const criteria =
    myScorecard && myScorecard.scores.length > 0
      ? myScorecard.scores.map((s) => s.criterion)
      : [...DEFAULT_CRITERIA];

  const carryForward = await getCarryForward((app?.id as string | null) ?? null, interviewId);

  return {
    interviewId: iv.id as string,
    applicationId: (app?.id as string | null) ?? "",
    candidateName: displayName(one(app?.people as PersonRow | PersonRow[] | null)),
    reqTitle: (req?.title as string | null) ?? "(untitled req)",
    stepName: (step?.name as string | null) || (iv.title as string | null) || "Interview",
    scheduledAt: (iv.scheduled_at as string | null) ?? null,
    durationMinutes: (iv.duration_minutes as number | null) ?? null,
    mode: (iv.mode as string | null) ?? null,
    aiRating: (app?.ai_rating as number | null) ?? null,
    aiSummary: (app?.ai_summary as AiScreenSummary | null) ?? null,
    carryForward,
    criteria,
    myScorecard,
    mySubmitted,
    revealed,
    otherSeats,
  };
}

// The AI panelist's summary from the most recent earlier round for this
// application. Always visible (it carries "still open / ask next round" notes);
// returns null when there is no prior AI scorecard.
async function getCarryForward(applicationId: string | null, currentInterviewId: string): Promise<string | null> {
  if (!applicationId) return null;
  const { data: ai } = await companyOs
    .from("people")
    .select("id")
    .eq("email", AI_PANELIST_EMAIL)
    .maybeSingle();
  const aiPersonId = (ai as { id: string } | null)?.id ?? null;
  if (!aiPersonId) return null;

  const { data: prior } = await companyOs
    .from("interviews")
    .select("id, created_at, interview_scorecards ( interviewer_id, summary, submitted_at )")
    .eq("application_id", applicationId)
    .neq("id", currentInterviewId)
    .order("created_at", { ascending: false });

  for (const round of (prior ?? []) as Record<string, unknown>[]) {
    const scs = (round.interview_scorecards ?? []) as Record<string, unknown>[];
    const aiSc = scs.find((s) => s.interviewer_id === aiPersonId && s.submitted_at && s.summary);
    if (aiSc) return (aiSc.summary as string).trim();
  }
  return null;
}
