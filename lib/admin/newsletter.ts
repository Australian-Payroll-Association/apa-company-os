import { companyOs } from "@/lib/supabase";
import { fetchCoursesInWindow } from "@/lib/admin/newsletter-training";
import { draftNewsletter } from "@/lib/ai/newsletter-writer";
import { fetchSourceText } from "@/lib/ai/brand-writer";
import {
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
      // time is omitted rather than stored empty when the detail page had
      // none, so a later pull that finds one is an update, not a no-op.
      details: {
        date_from: iso,
        ...(course.time ? { time: course.time } : {}),
        format: course.format,
      },
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

// ---------------------------------------------------------------------------
// Phase 2 — drafting
// ---------------------------------------------------------------------------

// The draft lands in marketing_content rather than on the edition itself. That
// is what content_id is for, and it keeps the edition on the existing rails:
// createBroadcastFromEntry already turns a marketing_content row into an
// email_campaigns broadcast, so Phase 4 is a wiring job rather than a build.
const HOME_BRAND_FOR_NEWSLETTER = "apa";

// The name shown at the top of the email. Read from the brand record rather
// than hardcoded so the header is not a second place to keep the brand's name
// correct — the fork's template said "Edge8" for exactly that reason.
export async function newsletterBrandName(): Promise<string | null> {
  const { data } = await companyOs
    .from("brands")
    .select("name")
    .eq("slug", HOME_BRAND_FOR_NEWSLETTER)
    .maybeSingle();
  return (data as { name: string | null } | null)?.name ?? null;
}

export type DraftEditionResult =
  | { ok: true; contentId: string; subject: string; regenerated: boolean }
  | { ok: false; error: string };

export async function draftEditionContent(editionId: string): Promise<DraftEditionResult> {
  const detail = await getEditionDetail(editionId);
  if (!detail) return { ok: false, error: "Edition not found." };

  if (detail.edition.status === "published") {
    return { ok: false, error: "This edition has been published. Drafting it again would not change what went out." };
  }

  const { data: brandRow } = await companyOs
    .from("brands")
    .select("id")
    .eq("slug", HOME_BRAND_FOR_NEWSLETTER)
    .maybeSingle();
  const brandId = (brandRow as { id: string } | null)?.id;
  if (!brandId) {
    return { ok: false, error: `No brand with slug "${HOME_BRAND_FOR_NEWSLETTER}". Create it under Marketing > Brands.` };
  }

  // Only what the editor kept. Excluding an item has to mean it stays out of
  // the draft, or the include/exclude controls are decoration.
  const sections = SECTION_TYPES.map((type) => ({
    type,
    label: SECTION_META[type].label,
    items: (detail.bySection[type] ?? [])
      .filter((s) => s.included)
      .map((s) => ({ title: s.title, body: s.body, linkUrl: s.linkUrl, details: s.details })),
  })).filter((s) => s.items.length > 0);

  // Fetch every cited source before drafting. A submission often carries a link
  // and little else — sometimes literally "write a few paragraphs on this" —
  // and without the page the writer infers from the URL slug and fills the rest
  // from its own knowledge. Fetching is best-effort; when it fails the writer is
  // told so and instructed not to describe the source.
  const withSources = await Promise.all(
    sections.map(async (section) => ({
      ...section,
      items: await Promise.all(
        section.items.map(async (item) => ({
          ...item,
          // 30k, not the 6k default. fetchSourceText takes characters from the
          // TOP of the stripped page, and on a regulator's site the top is
          // navigation, breadcrumbs and an on-this-page list. A real edition
          // proved the cost: the Fair Work vehicle allowance notice is 11,405
          // characters, the rate change sits at 6,247, and the 6k default cut
          // off 247 characters short — so the writer correctly reported that
          // the figure was not in its source and published an article that
          // told members nothing. The whole page is cheaper than that.
          sourceText: item.linkUrl ? await fetchSourceText(item.linkUrl, 30000) : null,
        })),
      ),
    })),
  );

  if (sections.length === 0) {
    return { ok: false, error: "Nothing is included in this edition yet, so there is nothing to draft." };
  }

  const drafted = await draftNewsletter({
    brandId,
    editionTitle: detail.edition.title,
    sections: withSources,
  });
  if (!drafted.ok) return { ok: false, error: drafted.error };

  // Re-drafting updates the same row rather than leaving a trail of orphans;
  // the edition points at one piece of content, and that is the one reviewed.
  const row = {
    title: drafted.subject,
    brand_id: brandId,
    channel: "email",
    status: "drafted",
    publish_date: detail.edition.periodStart,
    copy_md: drafted.bodyMd,
    notes: drafted.preheader || null,
  };

  let contentId = detail.edition.contentId;
  const regenerated = Boolean(contentId);

  if (contentId) {
    const { error } = await companyOs.from("marketing_content").update(row).eq("id", contentId);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await companyOs
      .from("marketing_content")
      .insert(row)
      .select("id")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    contentId = (data as { id: string } | null)?.id ?? null;
    if (!contentId) return { ok: false, error: "The draft was written but could not be saved." };
  }

  // Status only moves forward to drafting; an edition already in review keeps
  // its state, so re-drafting does not silently discard a signature.
  const patch: Record<string, unknown> = { content_id: contentId };
  if (detail.edition.status === "open" || detail.edition.status === "closed") {
    patch.status = "drafting";
  }
  const { error: editionError } = await companyOs
    .from("newsletter_editions")
    .update(patch)
    .eq("id", editionId);
  if (editionError) return { ok: false, error: editionError.message };

  return { ok: true, contentId, subject: drafted.subject, regenerated };
}

export type EditionDraft = {
  contentId: string;
  subject: string;
  preheader: string | null;
  bodyMd: string;
  updatedAt: string | null;
};

export async function getEditionDraft(contentId: string | null): Promise<EditionDraft | null> {
  if (!contentId) return null;
  const { data } = await companyOs
    .from("marketing_content")
    .select("id, title, notes, copy_md, created_at")
    .eq("id", contentId)
    .maybeSingle();
  if (!data) return null;
  const r = data as { id: string; title: string | null; notes: string | null; copy_md: string | null; created_at: string | null };
  return {
    contentId: r.id,
    subject: r.title ?? "",
    preheader: r.notes,
    bodyMd: r.copy_md ?? "",
    updatedAt: r.created_at,
  };
}

// Hand edits to a drafted edition.
//
// The writer gets things nearly right and then misses something only a person
// knows — a course whose start time the website never published, a figure the
// source page omitted, a sentence that reads wrong in APA's voice. Without
// this the only remedy was to regenerate and hope, which changes everything to
// fix one line.
//
// Saved to the same marketing_content row the writer uses, so the inbox
// preview, the review gate and eventually the broadcast all read the edited
// text and there is no second copy to diverge.
export async function saveEditionDraft(
  editionId: string,
  input: { subject: string; preheader: string; bodyMd: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const edition = await getEdition(editionId);
  if (!edition) return { ok: false, error: "Edition not found." };
  if (edition.status === "published") {
    return { ok: false, error: "This edition has been published. Editing it now would not change what went out." };
  }
  if (!edition.contentId) {
    return { ok: false, error: "There is no draft to edit yet. Write one first." };
  }

  const subject = input.subject.trim();
  const bodyMd = input.bodyMd.trim();
  if (!subject) return { ok: false, error: "The subject can't be empty." };
  if (!bodyMd) return { ok: false, error: "The body can't be empty." };

  const { error } = await companyOs
    .from("marketing_content")
    .update({
      title: subject,
      notes: input.preheader.trim() || null,
      copy_md: bodyMd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", edition.contentId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
