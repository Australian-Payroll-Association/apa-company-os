"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { getEdition, syncEventsForEdition, syncTrainingForEdition, trainingWindow } from "@/lib/admin/newsletter";
import { SECTION_META, defaultEditionTitle, isSectionType } from "@/lib/newsletter";

// Newsletter Machine, admin side. Editions are opened and closed by hand (a
// deliberate decision — no cron opens one for you), and every write is audited
// like the rest of /admin.

type Result = { ok: true; message?: string } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

function refresh(id?: string) {
  revalidatePath("/admin/revenue/marketing/newsletter");
  if (id) revalidatePath(`/admin/revenue/marketing/newsletter/${id}`);
  revalidatePath("/team/newsletter");
}

// Month bounds for a YYYY-MM string, as plain dates. Built with Date.UTC so the
// month never shifts under the server's timezone — a period that slides by a
// day would silently change which events the auto-pull picks up.
function monthBounds(month: string): { start: string; end: string; label: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) return null;
  const start = new Date(Date.UTC(year, mon - 1, 1));
  const end = new Date(Date.UTC(year, mon, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    label: start,
  };
}

export async function openEdition(input: {
  month: string;
  deadline: string;
  title?: string;
}): Promise<CreateResult> {
  const admin = await requireAdmin();

  const bounds = monthBounds(input.month);
  if (!bounds) return { ok: false, error: "Pick a month." };

  const title = (input.title ?? "").trim() || defaultEditionTitle(bounds.label);
  const deadlineAt = input.deadline ? new Date(input.deadline).toISOString() : null;
  if (input.deadline && Number.isNaN(Date.parse(input.deadline))) {
    return { ok: false, error: "That deadline isn't a valid date." };
  }

  const { data, error } = await companyOs
    .from("newsletter_editions")
    .insert({
      title,
      period_start: bounds.start,
      period_end: bounds.end,
      deadline_at: deadlineAt,
      status: "open",
      opened_by: admin.email,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // The partial unique index on status='open' is the guard, so this is the
    // expected path when someone opens a second edition in another tab.
    if (/newsletter_editions_single_open_idx|duplicate key/i.test(error.message)) {
      return { ok: false, error: "An edition is already open. Close it before opening another." };
    }
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Edition was not created." };

  const id = (data as { id: string }).id;
  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "insert",
    actor: admin.email,
    newData: { title, period_start: bounds.start, period_end: bounds.end },
  });

  // Pull training and webinars straight away, so the admin opens the edition
  // and immediately sees what the calendar already covers.
  await syncEventsForEdition(id);

  refresh(id);
  return { ok: true, id };
}

export async function closeEdition(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const edition = await getEdition(id);
  if (!edition) return { ok: false, error: "Edition not found." };
  if (edition.status !== "open") return { ok: false, error: "This edition is not open." };

  const now = new Date().toISOString();
  const { error } = await companyOs
    .from("newsletter_editions")
    .update({ status: "closed", closed_at: now })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { status: "closed" },
  });
  refresh(id);
  return { ok: true, message: "Intake closed." };
}

export async function reopenEdition(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const edition = await getEdition(id);
  if (!edition) return { ok: false, error: "Edition not found." };
  if (edition.status !== "closed") {
    return { ok: false, error: "Only a closed edition can be reopened." };
  }

  const { error } = await companyOs
    .from("newsletter_editions")
    .update({ status: "open", closed_at: null })
    .eq("id", id);
  if (error) {
    if (/newsletter_editions_single_open_idx|duplicate key/i.test(error.message)) {
      return { ok: false, error: "Another edition is open. Close that one first." };
    }
    return { ok: false, error: error.message };
  }

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { status: "open", reopened: true },
  });
  refresh(id);
  return { ok: true, message: "Intake reopened." };
}

export async function pullEvents(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await syncEventsForEdition(id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { events_synced: { added: result.added, updated: result.updated } },
  });
  refresh(id);

  if (result.added === 0 && result.updated === 0) {
    return {
      ok: true,
      message: "No published training or webinars fall in this edition's dates.",
    };
  }
  return {
    ok: true,
    message: `${result.added} added, ${result.updated} already here.`,
  };
}

export async function setSubmissionIncluded(
  submissionId: string,
  included: boolean,
): Promise<Result> {
  const admin = await requireAdmin();

  const { data, error: readError } = await companyOs
    .from("newsletter_submissions")
    .select("id, edition_id")
    .eq("id", submissionId)
    .maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  if (!data) return { ok: false, error: "Submission not found." };
  const editionId = (data as { edition_id: string }).edition_id;

  const { error } = await companyOs
    .from("newsletter_submissions")
    .update({ included })
    .eq("id", submissionId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "newsletter_submissions",
    recordId: submissionId,
    operation: "update",
    actor: admin.email,
    context: { included },
  });
  refresh(editionId);
  return { ok: true };
}

// Admin-side contribution. The /team form is the main path, but the person
// assembling an edition is the most likely to notice a gap and want to fill it
// on the spot — sending them to another portal to do it was pure friction.
//
// Attribution is resolved from the admin's own email so the item is credited to
// a real person, exactly as a /team submission would be. An admin with no
// people record still gets to contribute; the row is simply unattributed.
export async function addSubmissionAsAdmin(input: {
  editionId: string;
  sectionType: string;
  title: string;
  body: string;
  linkUrl: string;
  details?: Record<string, string>;
}): Promise<Result> {
  const admin = await requireAdmin();

  if (!isSectionType(input.sectionType)) return { ok: false, error: "Pick a section." };
  const title = input.title.trim();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Add some detail — an empty item can't be drafted from." };
  if (title.length > 200) return { ok: false, error: "Keep the heading under 200 characters." };
  if (body.length > 5000) return { ok: false, error: "That's longer than 5,000 characters." };

  const link = input.linkUrl.trim();
  if (link) {
    try {
      const parsed = new URL(link);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return { ok: false, error: "Links need to be regular http(s) addresses." };
      }
    } catch {
      return { ok: false, error: "That doesn't look like a valid link. Include https:// at the front." };
    }
  }

  const edition = await getEdition(input.editionId);
  if (!edition) return { ok: false, error: "Edition not found." };
  if (edition.status !== "open" && edition.status !== "closed") {
    return { ok: false, error: `A ${edition.status} edition can no longer take new items.` };
  }

  // Credit the admin's own people record when there is one.
  const { data: person } = await companyOs
    .from("people")
    .select("id")
    .eq("email", admin.email)
    .maybeSingle();

  const { data: row, error } = await companyOs
    .from("newsletter_submissions")
    .insert({
      edition_id: input.editionId,
      person_id: (person as { id: string } | null)?.id ?? null,
      section_type: input.sectionType,
      title: title || null,
      body,
      link_url: link || null,
      source: "team",
      // Only the keys this section declares — the same filter the /team path
      // applies, so a crafted payload cannot write arbitrary jsonb.
      details: Object.fromEntries(
        (SECTION_META[input.sectionType].fields ?? [])
          .map((f) => [f.key, (input.details?.[f.key] ?? "").trim().slice(0, 200)])
          .filter(([, v]) => v),
      ),
    })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "newsletter_submissions",
    recordId: (row as { id: string } | null)?.id ?? null,
    operation: "insert",
    actor: admin.email,
    newData: { edition_id: input.editionId, section_type: input.sectionType, added_from: "admin" },
  });
  refresh(input.editionId);
  return { ok: true, message: `Added to ${SECTION_META[input.sectionType].label}.` };
}

// The training window the pull reads. Left unset it falls back to the edition
// period plus six weeks; set explicitly when a month should advertise further
// ahead or stop sooner.
export async function setTrainingWindow(
  id: string,
  input: { from: string; to: string },
): Promise<Result> {
  const admin = await requireAdmin();
  const edition = await getEdition(id);
  if (!edition) return { ok: false, error: "Edition not found." };

  const from = input.from.trim() || null;
  const to = input.to.trim() || null;
  for (const [label, value] of [["from", from], ["to", to]] as const) {
    if (value && Number.isNaN(Date.parse(value))) {
      return { ok: false, error: `The ${label} date isn't valid.` };
    }
  }
  if (from && to && from > to) {
    return { ok: false, error: "The window ends before it starts." };
  }

  const { error } = await companyOs
    .from("newsletter_editions")
    .update({ training_from: from, training_to: to })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { training_from: from, training_to: to },
  });
  refresh(id);
  return { ok: true, message: "Training window saved." };
}

// Reads austpayroll.com.au/training and materialises the Virtual Classroom
// courses in the window. Replaces the events-table pull for training: events is
// empty, and the site is where training actually lives.
export async function pullTraining(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await syncTrainingForEdition(id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { training_synced: { added: result.added, updated: result.updated } },
  });
  refresh(id);

  if (result.found === 0) {
    const edition = await getEdition(id);
    const w = edition ? trainingWindow(edition) : null;
    return {
      ok: true,
      message: w
        ? `No Virtual Classroom courses on the site between ${w.from.toISOString().slice(0, 10)} and ${w.to.toISOString().slice(0, 10)}.`
        : "No courses found in the window.",
    };
  }
  return {
    ok: true,
    message: `${result.found} course${result.found === 1 ? "" : "s"} in the window — ${result.added} added, ${result.updated} already here.`,
  };
}
