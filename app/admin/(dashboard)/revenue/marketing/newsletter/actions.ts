"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { getEdition, syncEventsForEdition } from "@/lib/admin/newsletter";
import { defaultEditionTitle } from "@/lib/newsletter";

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
