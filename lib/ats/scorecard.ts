// The scorecard write, shared by admin (/admin/talent) and the team interview
// kit (/team/hiring). One place decides how a scorecard and its per-criterion
// rows are validated and persisted; the callers own authorization, audit, and
// cache revalidation, because the acting identity and the affected paths differ.
//
// Blind-first is NOT enforced here: this is the write. Withholding other seats'
// scorecards on read is the reader's job (getInterviewKit on the team side; the
// client component on the admin side).

import { companyOs } from "@/lib/supabase";
import { RECOMMENDATIONS, recommendationToDb, type RecommendationKey } from "@/lib/admin/interview-panel";

export type Result = { ok: true } | { ok: false; error: string };

export type ScorecardInput = {
  recommendation: RecommendationKey | null;
  overallScore: number | null;
  summary: string;
  scores: { criterion: string; score: number | null; comment: string }[];
};

const REC_KEYS = new Set<string>(RECOMMENDATIONS.map((r) => r.key));

// null passes through; a number in [1,5] is kept (one decimal); anything else
// is "bad" so the caller can reject or drop it.
export function normalizeScore(v: number | null): number | null | "bad" {
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || Number.isNaN(v)) return "bad";
  if (v < 1 || v > 5) return "bad";
  return Math.round(v * 10) / 10;
}

// Upsert one seat's scorecard on (interview_id, interviewer_id), then replace
// its per-criterion score rows. Stamps submitted_at so the seat counts as
// decided. Pure persistence — no auth, no audit, no revalidate.
export async function writeScorecard(
  interviewId: string,
  interviewerId: string,
  input: ScorecardInput,
): Promise<Result> {
  if (input.recommendation !== null && !REC_KEYS.has(input.recommendation)) {
    return { ok: false, error: "Unknown recommendation." };
  }
  const overall = normalizeScore(input.overallScore);
  if (overall === "bad") return { ok: false, error: "Overall score must be between 1 and 5." };

  const stamp = new Date().toISOString();
  const { data: sc, error: scErr } = await companyOs
    .from("interview_scorecards")
    .upsert(
      {
        interview_id: interviewId,
        interviewer_id: interviewerId,
        recommendation: input.recommendation ? recommendationToDb(input.recommendation) : null,
        overall_score: overall,
        summary: input.summary.trim() || null,
        submitted_at: stamp,
        updated_at: stamp,
      },
      { onConflict: "interview_id,interviewer_id" },
    )
    .select("id")
    .single();
  if (scErr || !sc) return { ok: false, error: scErr?.message ?? "Could not save the scorecard." };
  const scorecardId = sc.id as string;

  // Replace criterion rows wholesale — the criteria set can change between saves.
  await companyOs.from("scorecard_scores").delete().eq("scorecard_id", scorecardId);
  const rows = input.scores
    .filter((s) => s.criterion.trim())
    .map((s, i) => {
      const score = normalizeScore(s.score);
      return {
        scorecard_id: scorecardId,
        criterion: s.criterion.trim(),
        score: score === "bad" ? null : score,
        comment: s.comment.trim() || null,
        position: i,
      };
    });
  if (rows.length > 0) {
    const { error: rowErr } = await companyOs.from("scorecard_scores").insert(rows);
    if (rowErr) return { ok: false, error: rowErr.message };
  }
  return { ok: true };
}
