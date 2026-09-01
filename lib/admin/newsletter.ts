import { companyOs } from "@/lib/supabase";
import { fetchCoursesInWindow } from "@/lib/admin/newsletter-training";
import {
  EVENT_TYPES_BY_SECTION,
  SECTION_META,
  SECTION_TYPES,
  tallySections,
  type EditionStatus,
  type SectionTally,
  type SectionType,
} from "@/lib/newsletter";

// Data layer for the Newsletter Machine's admin side (Revenue -> Marketing ->
// Newsletter). Server-only: reaches company_os through the service-role client
// like the rest of /admin, and every caller is behind requireAdmin().

export type EditionRow = {
  id: string;
  title: string;
  periodStart: string;
  periodEnd: string;
  deadlineAt: string | null;
  /** Window the training pull reads. Null = derive from the period. */
  trainingFrom: string | null;
  trainingTo: string | null;
  status: EditionStatus;
  contentId: string | null;
  reviewerSignedBy: string | null;
  reviewerSignedAt: string | null;
  adminSignedBy: string | null;
  adminSignedAt: string | null;
  reviewNotes: string | null;
  openedBy: string | null;
  closedAt: string | null;
  notes: string | null;
  createdAt: string;
};

const EDITION_COLUMNS =
  "id, title, period_start, period_end, deadline_at, training_from, training_to, status, content_id, reviewer_signed_by, reviewer_signed_at, admin_signed_by, admin_signed_at, review_notes, opened_by, closed_at, notes, created_at";

type DbEdition = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  deadline_at: string | null;
  training_from: string | null;
  training_to: string | null;
  status: string;
  content_id: string | null;
  reviewer_signed_by: string | null;
  reviewer_signed_at: string | null;
  admin_signed_by: string | null;
  admin_signed_at: string | null;
  review_notes: string | null;
  opened_by: string | null;
  closed_at: string | null;
  notes: string | null;
  created_at: string;
};

function toEdition(row: DbEdition): EditionRow {
  return {
    id: row.id,
    title: row.title,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    deadlineAt: row.deadline_at,
    trainingFrom: row.training_from,
    trainingTo: row.training_to,
    status: row.status as EditionStatus,
    contentId: row.content_id,
    reviewerSignedBy: row.reviewer_signed_by,
    reviewerSignedAt: row.reviewer_signed_at,
    adminSignedBy: row.admin_signed_by,
    adminSignedAt: row.admin_signed_at,
    reviewNotes: row.review_notes,
    openedBy: row.opened_by,
    closedAt: row.closed_at,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

export async function listEditions(): Promise<EditionRow[]> {
  const { data, error } = await companyOs
    .from("newsletter_editions")
    .select(EDITION_COLUMNS)
    .order("period_start", { ascending: false });
  if (error) {
    console.error("listEditions failed:", error.message);
    return [];
  }
  return ((data ?? []) as DbEdition[]).map(toEdition);
}

export async function getEdition(id: string): Promise<EditionRow | null> {
  const { data, error } = await companyOs
    .from("newsletter_editions")
    .select(EDITION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toEdition(data as DbEdition);
}

// The single open edition, or null. The DB enforces at most one via a partial
// unique index, so maybeSingle() is safe rather than optimistic.
export async function getOpenEdition(): Promise<EditionRow | null> {
  const { data, error } = await companyOs
    .from("newsletter_editions")
    .select(EDITION_COLUMNS)
    .eq("status", "open")
    .maybeSingle();
  if (error || !data) return null;
  return toEdition(data as DbEdition);
}

export type SubmissionRow = {
  id: string;
  sectionType: SectionType;
  title: string | null;
  body: string | null;
  linkUrl: string | null;
  included: boolean;
  source: "team" | "events";
  eventId: string | null;
  /** Section-specific extras, keyed by SECTION_META[type].fields. */
  details: Record<string, string>;
  contributor: string | null;
  createdAt: string;
};

type DbSubmission = {
  id: string;
  section_type: string;
  title: string | null;
  body: string | null;
  link_url: string | null;
  included: boolean;
  source: string;
  event_id: string | null;
  details: Record<string, string> | null;
  created_at: string;
  people: { full_name: string | null; preferred_name: string | null } | null;
};

export async function listSubmissions(editionId: string): Promise<SubmissionRow[]> {
  const { data, error } = await companyOs
    .from("newsletter_submissions")
    .select(
      "id, section_type, title, body, link_url, included, source, event_id, details, created_at, people:people!person_id(full_name, preferred_name)",
    )
    .eq("edition_id", editionId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("listSubmissions failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown as DbSubmission[]).map((r) => {
    // PostgREST returns an embedded row as an object, or an array when it
    // cannot prove the relationship is to-one. Normalise both.
    const person = Array.isArray(r.people) ? r.people[0] : r.people;
    return {
      id: r.id,
      sectionType: r.section_type as SectionType,
      title: r.title,
      body: r.body,
      linkUrl: r.link_url,
      included: r.included,
      source: r.source === "events" ? "events" : "team",
      eventId: r.event_id,
      details: r.details ?? {},
      contributor: person?.preferred_name || person?.full_name || null,
      createdAt: r.created_at,
    };
  });
}

export type EditionDetail = {
  edition: EditionRow;
  submissions: SubmissionRow[];
  bySection: Record<SectionType, SubmissionRow[]>;
  tallies: SectionTally[];
  contributors: string[];
  includedCount: number;
};

export async function getEditionDetail(id: string): Promise<EditionDetail | null> {
  const edition = await getEdition(id);
  if (!edition) return null;
  const submissions = await listSubmissions(id);

  const bySection = Object.fromEntries(
    SECTION_TYPES.map((t) => [t, [] as SubmissionRow[]]),
  ) as Record<SectionType, SubmissionRow[]>;
  const counts: Record<string, number> = {};
  const contributors = new Set<string>();

  for (const s of submissions) {
    if (bySection[s.sectionType]) bySection[s.sectionType].push(s);
    if (s.included) counts[s.sectionType] = (counts[s.sectionType] ?? 0) + 1;
    if (s.contributor) contributors.add(s.contributor);
  }

  return {
    edition,
    submissions,
    bySection,
    tallies: tallySections(counts),
    contributors: [...contributors].sort((a, b) => a.localeCompare(b)),
    includedCount: submissions.filter((s) => s.included).length,
  };
}

// ---------------------------------------------------------------------------
// Events auto-pull
// ---------------------------------------------------------------------------

type DbEvent = {
  id: string;
  type: string;
  title: string;
  blurb: string | null;
  description: string | null;
  starts_at: string | null;
  landing_path: string | null;
};

// Sections fed by the events model, and the event types behind each.
const AUTO_SECTIONS = SECTION_TYPES.filter((t) => SECTION_META[t].source === "events");

export type SyncResult =
  | { ok: true; added: number; updated: number; sections: number }
  | { ok: false; error: string };

// Materialises training and webinar events into submissions for the edition.
//
// These are stored rather than computed at read time so the admin can exclude a
// specific session and have that decision stick. Re-running syncs in place —
// the (edition_id, event_id) unique index makes a repeat pull an update, never
// a duplicate — so it is safe to press twice, and safe to press again after the
// events calendar changes.
export async function syncEventsForEdition(editionId: string): Promise<SyncResult> {
  const edition = await getEdition(editionId);
  if (!edition) return { ok: false, error: "Edition not found." };

  let added = 0;
  let updated = 0;

  for (const section of AUTO_SECTIONS) {
    const types = EVENT_TYPES_BY_SECTION[section] ?? [];
    if (types.length === 0) continue;

    const { data, error } = await companyOs
      .from("events")
      .select("id, type, title, blurb, description, starts_at, landing_path")
      .in("type", types)
      .in("status", ["published", "open"])
      .eq("visibility", "public")
      .gte("starts_at", edition.periodStart)
      .lte("starts_at", `${edition.periodEnd}T23:59:59Z`)
      .order("starts_at", { ascending: true });
    if (error) return { ok: false, error: error.message };

    const events = (data ?? []) as DbEvent[];
    if (events.length === 0) continue;

    // Which of these already exist on the edition, so the counts reported back
    // are real rather than "however many rows we sent".
    const { data: existingData } = await companyOs
      .from("newsletter_submissions")
      .select("event_id")
      .eq("edition_id", editionId)
      .in(
        "event_id",
        events.map((e) => e.id),
      );
    const existing = new Set(
      ((existingData ?? []) as { event_id: string | null }[])
        .map((r) => r.event_id)
        .filter((v): v is string => Boolean(v)),
    );

    const rows = events.map((e) => ({
      edition_id: editionId,
      person_id: null,
      section_type: section,
      title: e.title,
      body: e.blurb || e.description || null,
      link_url: e.landing_path,
      source: "events",
      event_id: e.id,
    }));

    // included is intentionally absent from the update list: if an admin has
    // already excluded a session, a re-sync must not silently put it back.
    const { error: upsertError } = await companyOs
      .from("newsletter_submissions")
      .upsert(rows, { onConflict: "edition_id,event_id" });
    if (upsertError) return { ok: false, error: upsertError.message };

    for (const e of events) {
      if (existing.has(e.id)) updated += 1;
      else added += 1;
    }
  }

  return { ok: true, added, updated, sections: AUTO_SECTIONS.length };
}

// ---------------------------------------------------------------------------
// Training pull, from austpayroll.com.au/training
// ---------------------------------------------------------------------------

// The training table advertises past the edition month — July's ran to 14
// August, August's to 11 September, September's to 15 October. So the window
// is its own range. When unset it falls back to the period plus six weeks,
// which is roughly what those three editions used.
const TRAINING_TAIL_DAYS = 42;

export function trainingWindow(edition: EditionRow): { from: Date; to: Date } {
  const from = new Date(`${edition.trainingFrom ?? edition.periodStart}T00:00:00Z`);
  if (edition.trainingTo) return { from, to: new Date(`${edition.trainingTo}T23:59:59Z`) };
  const to = new Date(`${edition.periodEnd}T23:59:59Z`);
  to.setUTCDate(to.getUTCDate() + TRAINING_TAIL_DAYS);
  return { from, to };
}

export type TrainingSyncResult =
  | { ok: true; added: number; updated: number; found: number }
  | { ok: false; error: string };

// Reads the public training page and materialises Virtual Classroom courses in
// the window as submissions.
//
// Dedup is on (course link + printed date) rather than a unique index: the site
// gives no stable id, and the same course legitimately runs on several dates.
// Matching in code keeps a re-pull idempotent without inventing a key the
// source doesn't have. `included` is never written on update, so a course an
// admin excluded stays excluded when the pull runs again.
export async function syncTrainingForEdition(editionId: string): Promise<TrainingSyncResult> {
  const edition = await getEdition(editionId);
  if (!edition) return { ok: false, error: "Edition not found." };

  const { from, to } = trainingWindow(edition);
  const fetched = await fetchCoursesInWindow(from, to);
  if (!fetched.ok) return { ok: false, error: fetched.error };

  const { data: existingData, error: readError } = await companyOs
    .from("newsletter_submissions")
    .select("id, link_url, details")
    .eq("edition_id", editionId)
    .eq("section_type", "training");
  if (readError) return { ok: false, error: readError.message };

  // Keyed on the ISO date rather than the printed label: the site can reword
  // "September 3rd" without the course itself changing.
  const key = (url: string | null, date: string) => `${url ?? ""}|${date}`;
  const existing = new Map(
    ((existingData ?? []) as { id: string; link_url: string | null; details: Record<string, string> | null }[]).map(
      (r) => [key(r.link_url, r.details?.date_from ?? ""), r.id],
    ),
  );

  let added = 0;
  let updated = 0;

  for (const course of fetched.courses) {
    const iso = course.date.toISOString().slice(0, 10);
    const match = existing.get(key(course.url, iso));
    const row = {
      title: course.title,
      body: course.description,
      link_url: course.url,
      // date_to is left unset — the site advertises one date per course, and a
      // blank end date is what marks a single-day course.
      details: { date_from: iso, format: course.format },
    };
    if (match) {
      const { error } = await companyOs.from("newsletter_submissions").update(row).eq("id", match);
      if (error) return { ok: false, error: error.message };
      updated += 1;
    } else {
      const { error } = await companyOs.from("newsletter_submissions").insert({
        ...row,
        edition_id: editionId,
        person_id: null,
        section_type: "training",
        source: "events",
      });
      if (error) return { ok: false, error: error.message };
      added += 1;
    }
  }

  return { ok: true, added, updated, found: fetched.courses.length };
}
