import { companyOs } from "@/lib/supabase";
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
  "id, title, period_start, period_end, deadline_at, status, content_id, reviewer_signed_by, reviewer_signed_at, admin_signed_by, admin_signed_at, review_notes, opened_by, closed_at, notes, created_at";

type DbEdition = {
  id: string;
  title: string;
  period_start: string;
  period_end: string;
  deadline_at: string | null;
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
  created_at: string;
  people: { full_name: string | null; preferred_name: string | null } | null;
};

export async function listSubmissions(editionId: string): Promise<SubmissionRow[]> {
  const { data, error } = await companyOs
    .from("newsletter_submissions")
    .select(
      "id, section_type, title, body, link_url, included, source, event_id, created_at, people:people!person_id(full_name, preferred_name)",
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
