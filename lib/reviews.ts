import { companyOs } from "@/lib/supabase";
import { getTeamActor, type TeamActor } from "@/lib/team-auth";
import { parseStoredAnswer, type SurveyFieldRow } from "@/lib/admin/surveys";

// Performance reviews domain (docs/plans/2026-08-12-performance-reviews.md).
// company_os.performance_reviews is the system of record: one row per subject
// per cycle per rater (self or manager). The survey runner is only the pen;
// submissions land here via each field's maps_to and NEVER create
// survey_responses rows, so review content stays out of every survey surface.
//
// VISIBILITY (enforced here, not in SQL):
//   subject  — their own self rows, and manager rows about them once FINALIZED
//   manager  — rows they review (any status), and the subject's self row only
//              after their own manager row is submitted (blind drafting)
// Everything is scoped through the actor from lib/team-auth; ids from the
// client are only ever row ids that these checks re-authorize.

export type ReviewType = "probation" | "midyear" | "renewal" | "adhoc" | "annual";
export type RaterKind = "self" | "manager";

export const REVIEW_TYPE_LABEL: Record<ReviewType, string> = {
  probation: "Probation review",
  midyear: "Mid-year check-in",
  renewal: "Renewal review",
  adhoc: "Review",
  annual: "Annual review",
};

// The eleven dimensions, in form order. Six Performance Pulse behaviors kept
// verbatim + five AI craft skills (AI Officer curriculum).
export const REVIEW_DIMENSIONS: { key: string; label: string; aiCraft?: boolean }[] = [
  { key: "role_understanding", label: "Role Understanding & Application" },
  { key: "work_quality", label: "Work Quality & Output" },
  { key: "collaboration", label: "Collaboration & Team Fit" },
  { key: "communication", label: "Communication Skills" },
  { key: "problem_solving", label: "Problem-solving" },
  { key: "learning_innovation", label: "Learning & Innovation" },
  { key: "ai_planning", label: "AI Planning", aiCraft: true },
  { key: "workflow_design", label: "Workflow Design", aiCraft: true },
  { key: "organizing_information", label: "Organizing Information", aiCraft: true },
  { key: "creating_instructions", label: "Creating Instructions", aiCraft: true },
  { key: "ai_building", label: "AI Building", aiCraft: true },
];

// Expected AI-craft rating per career level (the mint marker in the runner).
// Same four levels on both tracks; principal expectation is 4 with 5 as the
// stretch, so the marker sits at 4.
export const LEVEL_EXPECTATION: Record<string, number> = {
  junior: 2,
  collaborator: 3,
  senior: 4,
  principal: 4,
};

// Which seeded survey captures which row.
const SELF_SLUG = "perf-review-self";
const MANAGER_SLUGS: Partial<Record<ReviewType, string>> = {
  probation: "perf-review-manager-probation",
  midyear: "perf-review-manager-midyear",
  renewal: "perf-review-manager-renewal",
  // adhoc reviews carry no scheduled decision; the probation-shaped form is
  // not right for them, so they reuse the self field set via the self survey.
};

export function reviewSurveySlug(row: { rater_kind: string; review_type: string }): string {
  if (row.rater_kind === "self") return SELF_SLUG;
  return MANAGER_SLUGS[row.review_type as ReviewType] ?? SELF_SLUG;
}

export const PERFORMANCE_REVIEW_SLUGS = new Set([SELF_SLUG, ...Object.values(MANAGER_SLUGS)]);

// Survey decision labels -> stored enum.
const DECISION_BY_LABEL: Record<string, string> = {
  "Continue to contract": "continue_to_contract",
  "Extend probation 30 days": "extend_probation",
  Discontinue: "discontinue",
  Renew: "renew",
  "Renew with changes": "renew_with_changes",
  "Do not renew": "do_not_renew",
};

export const DECISION_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(DECISION_BY_LABEL).map(([label, value]) => [value, label]),
);

export type ReviewRow = {
  id: string;
  team_member_id: string;
  reviewer_id: string | null;
  cycle_label: string | null;
  review_type: ReviewType;
  rater_kind: RaterKind;
  status: string;
  submitted_at: string | null;
  ratings: Record<string, number>;
  achievements: string | null;
  improvements: string | null;
  comments: string | null;
  decision: string | null;
  keeper: boolean | null;
  metadata: Record<string, unknown>;
};

const REVIEW_COLUMNS =
  "id, team_member_id, reviewer_id, cycle_label, review_type, rater_kind, status, submitted_at, ratings, achievements, improvements, comments, decision, keeper, metadata";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---- who is who -------------------------------------------------------------

type SubjectInfo = { name: string; careerLevel: string | null; careerTrack: string | null };

async function subjectInfo(teamMemberId: string): Promise<SubjectInfo> {
  const { data } = await companyOs
    .from("team_members")
    .select("career_level, career_track, people!person_id(full_name, first_name, preferred_name)")
    .eq("id", teamMemberId)
    .maybeSingle();
  const p = Array.isArray(data?.people) ? data?.people[0] : data?.people;
  return {
    name: p?.preferred_name || p?.first_name || p?.full_name || "Team member",
    careerLevel: data?.career_level ?? null,
    careerTrack: data?.career_track ?? null,
  };
}

// ---- runner context: authorize an actor to fill a review row ----------------

export type ReviewRunContext = {
  review: ReviewRow;
  subject: SubjectInfo;
  // The subject's name when the actor is reviewing someone else, null on
  // self-assessments (the runner shows a "Reviewing X" chip from it).
  subjectName: string | null;
  // Where the mint "expected" marker sits on AI-craft scales (1-5), or null
  // when the subject has no career level set.
  expectedLevel: number | null;
};

// Loads a review row and checks the logged-in actor is its rater and it is
// still fillable. `slug` guards against submitting e.g. the mid-year form for
// a probation row. Returns null (not found / not yours / wrong form) or
// "closed" (already submitted or finalized).
export async function getReviewRunContext(
  reviewId: string,
  slug: string,
): Promise<ReviewRunContext | "closed" | null> {
  if (!UUID_RE.test(reviewId)) return null;
  const { actor } = await getTeamActor();
  if (!actor) return null;

  const { data } = await companyOs
    .from("performance_reviews")
    .select(REVIEW_COLUMNS)
    .eq("id", reviewId)
    .maybeSingle();
  const review = data as ReviewRow | null;
  if (!review) return null;

  const isRater =
    review.rater_kind === "self"
      ? review.team_member_id === actor.teamMemberId
      : review.reviewer_id === actor.teamMemberId;
  if (!isRater) return null;
  if (reviewSurveySlug(review) !== slug) return null;
  if (review.status !== "open" && review.status !== "draft") return "closed";

  const subject = await subjectInfo(review.team_member_id);
  return {
    review,
    subject,
    subjectName: review.rater_kind === "manager" ? subject.name : null,
    expectedLevel: subject.careerLevel ? (LEVEL_EXPECTATION[subject.careerLevel] ?? null) : null,
  };
}

// ---- submission: validated survey answers -> the review row -----------------

// Applies a validated submission to the row. Answer values are routed by each
// field's config.maps_to ("performance_reviews.<column>", ".ratings.<dim>", or
// ".metadata.<key>"); anything else is ignored. Caller has already authorized
// via getReviewRunContext and validated via validateAnswer.
export async function applyReviewSubmission(
  review: ReviewRow,
  fields: SurveyFieldRow[],
  answers: Map<string, { value: string; value_json: unknown }>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ratings: Record<string, number> = { ...review.ratings };
  const metadata: Record<string, unknown> = { ...review.metadata };
  const patch: Record<string, unknown> = {};

  for (const field of fields) {
    const a = answers.get(field.id);
    if (!a) continue;
    const mapsTo = field.config?.maps_to;
    if (!mapsTo?.startsWith("performance_reviews.")) continue;
    const path = mapsTo.slice("performance_reviews.".length);
    const value = parseStoredAnswer(field, { value: a.value, value_json: a.value_json });

    if (path.startsWith("ratings.")) {
      if (typeof value === "number") ratings[path.slice("ratings.".length)] = value;
    } else if (path.startsWith("metadata.")) {
      metadata[path.slice("metadata.".length)] = value;
    } else if (path === "decision") {
      const decision = DECISION_BY_LABEL[String(value)];
      if (!decision) return { ok: false, error: "Unknown decision option." };
      patch.decision = decision;
    } else if (path === "keeper") {
      if (typeof value === "boolean") patch.keeper = value;
    } else if (path === "achievements" || path === "improvements" || path === "comments") {
      patch[path] = String(value);
    }
  }

  const { error, data } = await companyOs
    .from("performance_reviews")
    .update({
      ...patch,
      ratings,
      metadata,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    // Refuse to overwrite a row that was submitted from another tab meanwhile.
    .in("status", ["open", "draft"])
    .select("id");
  if (error) return { ok: false, error: "Could not save the review." };
  if (!data?.length) return { ok: false, error: "This review was already submitted." };
  return { ok: true };
}

// ---- lists for /team/reviews ------------------------------------------------

export type ReviewListItem = {
  id: string;
  cycleLabel: string | null;
  reviewType: ReviewType;
  raterKind: RaterKind;
  status: string;
  submittedAt: string | null;
  subjectName: string;
  decision: string | null;
};

async function withSubjectNames(rows: ReviewRow[]): Promise<ReviewListItem[]> {
  const ids = [...new Set(rows.map((r) => r.team_member_id))];
  const names = new Map<string, string>();
  if (ids.length) {
    const { data } = await companyOs
      .from("team_members")
      .select("id, people!person_id(full_name, first_name, preferred_name)")
      .in("id", ids);
    for (const tm of (data ?? []) as Array<{ id: string; people: unknown }>) {
      const p = (Array.isArray(tm.people) ? tm.people[0] : tm.people) as {
        full_name: string | null;
        first_name: string | null;
        preferred_name: string | null;
      } | null;
      names.set(tm.id, p?.preferred_name || p?.first_name || p?.full_name || "Team member");
    }
  }
  return rows.map((r) => ({
    id: r.id,
    cycleLabel: r.cycle_label,
    reviewType: r.review_type,
    raterKind: r.rater_kind,
    status: r.status,
    submittedAt: r.submitted_at,
    subjectName: names.get(r.team_member_id) ?? "Team member",
    decision: r.decision,
  }));
}

export type ReviewLists = {
  // Reviews the actor still owes: their own open self-assessments plus open
  // manager reviews of their reports.
  todo: ReviewListItem[];
  // Manager rows the actor submitted (awaiting finalize) or finalized.
  reports: ReviewListItem[];
  // The actor's own history: finalized manager reviews about them + their own
  // submitted self-assessments.
  mine: ReviewListItem[];
};

export async function listReviews(actor: TeamActor): Promise<ReviewLists> {
  const [own, reviewing] = await Promise.all([
    companyOs
      .from("performance_reviews")
      .select(REVIEW_COLUMNS)
      .eq("team_member_id", actor.teamMemberId)
      .order("submitted_at", { ascending: false, nullsFirst: true }),
    companyOs
      .from("performance_reviews")
      .select(REVIEW_COLUMNS)
      .eq("reviewer_id", actor.teamMemberId)
      .eq("rater_kind", "manager")
      .order("submitted_at", { ascending: false, nullsFirst: true }),
  ]);
  const ownRows = (own.data ?? []) as ReviewRow[];
  // Someone who is their own reviewer-of-record (the founder) appears in both
  // queries; de-dup by row id so each row lists once, in the reviewing bucket.
  const reviewingRows = (reviewing.data ?? []) as ReviewRow[];
  const reviewingIds = new Set(reviewingRows.map((r) => r.id));

  const todo = [
    ...ownRows.filter(
      (r) =>
        r.rater_kind === "self" &&
        (r.status === "open" || r.status === "draft") &&
        !reviewingIds.has(r.id),
    ),
    ...reviewingRows.filter((r) => r.status === "open" || r.status === "draft"),
  ];
  const reports = reviewingRows.filter((r) => r.status === "submitted" || r.status === "finalized");
  const mine = [
    ...ownRows.filter(
      (r) => r.rater_kind === "manager" && r.status === "finalized" && !reviewingIds.has(r.id),
    ),
    ...ownRows.filter((r) => r.rater_kind === "self" && r.status === "submitted"),
  ];
  const [todoL, reportsL, mineL] = await Promise.all([
    withSubjectNames(todo),
    withSubjectNames(reports),
    withSubjectNames(mine),
  ]);
  return { todo: todoL, reports: reportsL, mine: mineL };
}

// ---- detail: one cycle, both sides, visibility-checked ----------------------

export type ReviewDetail = {
  anchor: ReviewRow; // the row the id addressed
  subjectName: string;
  expectedLevel: number | null;
  careerLevel: string | null;
  // The two sides, after visibility rules. Either may be null.
  self: ReviewRow | null;
  manager: ReviewRow | null;
  // The actor's relationship to this cycle.
  isSubject: boolean;
  isReviewer: boolean;
  canFinalize: boolean;
};

export async function getReviewDetail(actor: TeamActor, id: string): Promise<ReviewDetail | null> {
  if (!UUID_RE.test(id)) return null;
  const { data } = await companyOs
    .from("performance_reviews")
    .select(REVIEW_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  const anchor = data as ReviewRow | null;
  if (!anchor) return null;

  // Not mutually exclusive: someone who is their own reviewer-of-record (the
  // founder) holds both roles and sees both sides.
  const isSubject = anchor.team_member_id === actor.teamMemberId;
  const isReviewer = anchor.reviewer_id === actor.teamMemberId;
  if (!isSubject && !isReviewer) return null;

  // The sibling row of the same cycle (same subject + cycle_label, other kind).
  let sibling: ReviewRow | null = null;
  if (anchor.cycle_label) {
    const { data: sib } = await companyOs
      .from("performance_reviews")
      .select(REVIEW_COLUMNS)
      .eq("team_member_id", anchor.team_member_id)
      .eq("cycle_label", anchor.cycle_label)
      .neq("rater_kind", anchor.rater_kind)
      .maybeSingle();
    sibling = (sib as ReviewRow | null) ?? null;
  }
  const selfRow = anchor.rater_kind === "self" ? anchor : sibling;
  const managerRow = anchor.rater_kind === "manager" ? anchor : sibling;

  // Visibility:
  //   subject:  own self row always; manager row only once finalized
  //   reviewer: own manager row always; self row only after they submitted
  //             (blind drafting), and only submitted self content
  const managerDone = managerRow?.status === "submitted" || managerRow?.status === "finalized";
  const visibleSelf = isSubject
    ? selfRow
    : isReviewer && managerDone && selfRow?.status === "submitted"
      ? selfRow
      : null;
  // The reviewer always sees their own review; the subject only a finalized one.
  const visibleManager = isReviewer
    ? managerRow
    : managerRow?.status === "finalized"
      ? managerRow
      : null;
  if (!visibleSelf && !visibleManager) return null;

  const subject = await subjectInfo(anchor.team_member_id);
  return {
    anchor,
    subjectName: subject.name,
    careerLevel: subject.careerLevel,
    expectedLevel: subject.careerLevel ? (LEVEL_EXPECTATION[subject.careerLevel] ?? null) : null,
    self: visibleSelf,
    manager: visibleManager,
    isSubject,
    isReviewer,
    canFinalize: isReviewer && managerRow?.status === "submitted",
  };
}

// Finalize a submitted manager review. Probation and renewal require a
// decision; mid-year requires the keeper answer. Once finalized the subject
// can see it.
export async function finalizeReview(
  actor: TeamActor,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Not found." };
  const { data } = await companyOs
    .from("performance_reviews")
    .select(REVIEW_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  const row = data as ReviewRow | null;
  if (!row || row.reviewer_id !== actor.teamMemberId || row.rater_kind !== "manager")
    return { ok: false, error: "Not found." };
  if (row.status !== "submitted") return { ok: false, error: "Only a submitted review can be finalized." };
  if ((row.review_type === "probation" || row.review_type === "renewal") && !row.decision)
    return { ok: false, error: "A decision is required before finalizing." };
  if (row.review_type === "midyear" && row.keeper === null)
    return { ok: false, error: "The keeper question is required before finalizing." };

  const { error } = await companyOs
    .from("performance_reviews")
    .update({ status: "finalized" })
    .eq("id", id)
    .eq("status", "submitted");
  if (error) return { ok: false, error: "Could not finalize." };
  return { ok: true };
}

// ---- cycle creation (used by the scheduler in PR 3 and by admin tooling) ----

// Opens a review cycle: a self row for the subject and a manager row for their
// manager-of-record. Skips rows that already exist for the cycle label.
export async function openReviewCycle(input: {
  teamMemberId: string;
  managerId: string;
  reviewType: Exclude<ReviewType, "annual">;
  cycleLabel: string;
}): Promise<{ created: number }> {
  const base = {
    team_member_id: input.teamMemberId,
    cycle_label: input.cycleLabel,
    review_type: input.reviewType,
    rating_scale: "anchored-v1",
    status: "open",
    source: "portal",
  };
  const rows = [
    { ...base, rater_kind: "self", reviewer_id: input.teamMemberId },
    { ...base, rater_kind: "manager", reviewer_id: input.managerId },
  ];
  let created = 0;
  for (const row of rows) {
    const { data: existing } = await companyOs
      .from("performance_reviews")
      .select("id")
      .eq("team_member_id", input.teamMemberId)
      .eq("cycle_label", input.cycleLabel)
      .eq("rater_kind", row.rater_kind)
      .maybeSingle();
    if (existing) continue;
    const { error } = await companyOs.from("performance_reviews").insert(row);
    if (!error) created++;
  }
  return { created };
}
