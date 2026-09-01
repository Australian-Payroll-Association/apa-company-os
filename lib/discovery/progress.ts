// Shared completion math for the admin side (list + detail pages). Mirrors
// the field-counting the client survey (DiscoverySurvey.tsx) already does
// for its own progress bar — kept as a separate copy rather than a shared
// import since the client component's version is wired into its own
// useMemo/state and isn't worth threading a dependency into for a handful of
// arithmetic lines; if the two ever drift, this is the one consultants see.

import { DISCOVERY_SECTIONS } from "./questions";
import type { EngagementOverview, TeamMember } from "./data";

type ResponseLike = { question_id: string; options: string[] | null; text: string | null };

export type Progress = { answered: number; total: number; pct: number };

function isAnswered(r: ResponseLike | undefined): boolean {
  if (!r) return false;
  return (r.options?.length ?? 0) > 0 || (r.text ?? "").trim().length > 0;
}

export function computeProgress(
  overview: EngagementOverview,
  teamMembers: TeamMember[],
  responses: ResponseLike[],
): Progress {
  const responseMap: Record<string, ResponseLike> = {};
  responses.forEach((r) => { responseMap[r.question_id] = r; });

  let total = 4 + overview.entities.length * 4 + teamMembers.length * 5;
  let answered = 0;
  Object.values(overview.systems).forEach((v) => { if (v.trim()) answered++; });
  overview.entities.forEach((e) => Object.values(e).forEach((v) => { if (v.trim()) answered++; }));
  teamMembers.forEach((m) => Object.values(m).forEach((v) => { if (v.trim()) answered++; }));

  DISCOVERY_SECTIONS.forEach((section) => {
    section.topics.forEach((topic) => {
      topic.questions.forEach((q) => {
        total++;
        if (isAnswered(responseMap[q.id])) answered++;
      });
    });
  });

  return { answered, total, pct: total > 0 ? Math.round((answered / total) * 100) : 0 };
}
