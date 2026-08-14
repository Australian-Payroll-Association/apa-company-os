"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { writeScorecard, type ScorecardInput } from "@/lib/ats/scorecard";
import { actorHoldsSeat } from "@/lib/team/interview-kit";

type Result = { ok: true } | { ok: false; error: string };

// Submit the signed-in panelist's own scorecard. The interviewer is always the
// actor (never a value from the client), and the write is refused unless the
// actor actually holds a seat on this interview. This is the /team mirror of the
// admin submitScorecard and shares the same write (lib/ats/scorecard).
export async function submitMyScorecard(interviewId: string, input: ScorecardInput): Promise<Result> {
  const actor = await requireTeamMember();
  if (!(await actorHoldsSeat(actor.personId, interviewId))) {
    return { ok: false, error: "You are not on this interview panel." };
  }
  const r = await writeScorecard(interviewId, actor.personId, input);
  if (!r.ok) return r;
  revalidatePath("/team/hiring");
  revalidatePath(`/team/hiring/${interviewId}`);
  return { ok: true };
}
