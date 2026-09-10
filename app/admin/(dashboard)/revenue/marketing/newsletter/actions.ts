"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import {
  draftEditionContent,
  getEdition,
  rejectEdition,
  saveEditionDraft,
  sendForReview,
  signEdition,
  syncTrainingForEdition,
  trainingWindow,
} from "@/lib/admin/newsletter";
import { createEditionBroadcast, markEditionPublished } from "@/lib/admin/newsletter-publish";
import {
  dismissSuggestion,
  promoteSuggestion,
  scanTopicsForEdition,
} from "@/lib/admin/newsletter-radar";
import { SECTION_META, defaultEditionTitle, isSectionType, sectionUses } from "@/lib/newsletter";

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

// Sessions the training site has stopped advertising, switched off by the
// pull. Always said out loud: a row disappearing from the edition without a
// word is how someone later wonders why a course they expected is missing.
function staleNote(stale: number): string {
  if (stale === 0) return "";
  return ` ${stale} session${stale === 1 ? " is" : "s are"} no longer on the site and ${
    stale === 1 ? "has" : "have"
  } been switched off.`;
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

  // Fill the training table straight away from the default window, so a newly
  // opened edition already shows what the website is advertising.
  await syncTrainingForEdition(id);

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
  // Inputs the section does not render are dropped rather than trusted — the
  // same rule as the /team path, so the two cannot accept different things.
  const title = sectionUses(input.sectionType, "title") ? input.title.trim() : "";
  const body = sectionUses(input.sectionType, "body") ? input.body.trim() : "";

  if (sectionUses(input.sectionType, "body") && !body) {
    return { ok: false, error: "Add some detail — an empty item can't be drafted from." };
  }
  if (title.length > 200) return { ok: false, error: "Keep the heading under 200 characters." };
  if (body.length > 5000) return { ok: false, error: "That's longer than 5,000 characters." };

  const link = sectionUses(input.sectionType, "link") ? input.linkUrl.trim() : "";
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

  // Saving the window IS the request to fill it — a separate button press to
  // see the result of the dates you just set is a step with no decision in it.
  // A failed pull does not fail the save: the window is stored either way, and
  // the message says which half worked so it can be retried with the button.
  const pulled = await syncTrainingForEdition(id);
  refresh(id);
  if (!pulled.ok) {
    return { ok: true, message: `Window saved, but the pull failed: ${pulled.error}` };
  }
  if (pulled.found === 0) {
    return { ok: true, message: "Window saved. No Virtual Classroom courses on the site in that range." };
  }
  return {
    ok: true,
    message: `Window saved — ${pulled.found} session${pulled.found === 1 ? "" : "s"} in range, ${pulled.added} added, ${pulled.updated} already here.${staleNote(pulled.stale)}`,
  };
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
    context: { training_synced: { added: result.added, updated: result.updated, stale: result.stale } },
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
    message: `${result.found} session${result.found === 1 ? "" : "s"} in the window — ${result.added} added, ${result.updated} already here.${staleNote(result.stale)}`,
  };
}

// Hand edits to the draft.
//
// The writer cannot supply what its sources do not carry — a course start time
// the training website never published is the case that prompted this. Rather
// than regenerate and hope, the reviewer fixes the line.
//
// Edits go to the same row the writer wrote, so the inbox preview and
// everything downstream read the corrected text. Regenerating overwrites them,
// which is why the Regenerate button asks first.
export async function saveDraft(
  id: string,
  input: { subject: string; preheader: string; bodyMd: string },
): Promise<Result> {
  const admin = await requireAdmin();
  const result = await saveEditionDraft(id, input);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { draft_edited_by_hand: true },
  });
  refresh(id);
  // Said out loud, never silently. Someone fixing a typo needs to know they
  // have just sent the edition back through the gate.
  return {
    ok: true,
    message: result.signaturesCleared
      ? "Draft saved. The edition left review and both signatures were cleared — it needs signing off again."
      : "Draft saved.",
  };
}

// Topic radar. Scans the ATO, Fair Work, the state revenue offices and the
// workers compensation authorities for changes worth an article this month.
//
// Slow by nature — seven areas, each running its own searches and opening the
// pages it finds — so it is a button rather than something that happens on
// page load.
export async function scanTopics(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await scanTopicsForEdition(id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { topics_scanned: { found: result.found, added: result.added } },
  });
  refresh(id);

  // An area that failed is reported rather than swallowed: "nothing found in
  // long service leave" and "long service leave was never searched" are
  // different facts, and only one of them means there is nothing to write.
  const failed = result.areasFailed.length
    ? ` Could not scan: ${result.areasFailed.join(", ")} — run it again to retry.`
    : "";

  // The window is always stated. It reaches back before the edition month, so
  // a reader who assumed it covered only September needs to see that it did
  // not — and a thin result means something different depending on how much
  // ground was actually covered.
  const window = ` Scanned ${result.from} to ${result.to}.`;

  if (result.found === 0) {
    return { ok: true, message: `No changes found.${window}${failed}` };
  }
  if (result.added === 0) {
    return {
      ok: true,
      message: `${result.found} found, all already on the list.${window}${failed}`,
    };
  }
  return {
    ok: true,
    message: `${result.added} new suggestion${result.added === 1 ? "" : "s"} from ${result.found} found.${window}${failed}`,
  };
}

export async function addSuggestedTopic(suggestionId: string, editionId: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await promoteSuggestion(suggestionId, admin.email);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_topic_suggestions",
    recordId: suggestionId,
    operation: "update",
    actor: admin.email,
    context: { promoted: true, edition_id: editionId },
  });
  refresh(editionId);
  return { ok: true, message: `Added to Article for this edition, switched off until it's written.` };
}

export async function dismissSuggestedTopic(
  suggestionId: string,
  editionId: string,
): Promise<Result> {
  const admin = await requireAdmin();
  const result = await dismissSuggestion(suggestionId, admin.email);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_topic_suggestions",
    recordId: suggestionId,
    operation: "update",
    actor: admin.email,
    context: { dismissed: true },
  });
  refresh(editionId);
  return { ok: true };
}

// Phase 2. Assembles everything included in the edition into one draft, in
// APA's voice, and stores it as the edition's marketing_content row.
//
// Re-runnable: the draft is a starting point, and an editor who adds a missing
// FAQ will want to regenerate rather than hand-patch. Regenerating replaces the
// same content row, so there is always exactly one draft under review.
export async function draftEdition(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await draftEditionContent(id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { drafted: true, content_id: result.contentId, regenerated: result.regenerated },
  });
  refresh(id);

  const cleared = result.signaturesCleared
    ? " Both signatures were cleared — these are different words, so it needs signing off again."
    : "";
  return {
    ok: true,
    message: result.regenerated
      ? `Draft regenerated. Subject: "${result.subject}"${cleared}`
      : `Draft written. Subject: "${result.subject}"`,
  };
}

// ---------------------------------------------------------------------------
// Phase 3 — review
// ---------------------------------------------------------------------------

export async function submitForReview(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await sendForReview(id);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { status: "in_review" },
  });
  refresh(id);
  return { ok: true, message: result.message };
}

// One signature. The action does not say which slot it fills — the data layer
// decides that from what is already signed, so the button cannot be used to
// claim the second signature without the first existing.
export async function signOffEdition(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await signEdition(id, admin.email);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { signed: true },
  });
  refresh(id);
  return { ok: true, message: result.message };
}

export async function sendBackForChanges(id: string, notes: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await rejectEdition(id, admin.email, notes);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { rejected: true, notes: notes.trim().slice(0, 500) },
  });
  refresh(id);
  return { ok: true, message: result.message };
}

// ---------------------------------------------------------------------------
// Phase 4 — publish
// ---------------------------------------------------------------------------

// Hands a signed-off edition to the broadcast system as a DRAFT. There is no
// "send" action here and there should not be: approveBroadcast is the gate,
// and adding a second route to a member's inbox with different rules is the
// one thing a marketing system must never have.
export async function handToBroadcast(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await createEditionBroadcast(id, admin.email);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "email_campaigns",
    recordId: result.broadcastId,
    operation: "insert",
    actor: admin.email,
    context: { from_newsletter_edition: id },
  });
  refresh(id);
  return { ok: true, message: result.message };
}

export async function markPublished(id: string): Promise<Result> {
  const admin = await requireAdmin();
  const result = await markEditionPublished(id, admin.email);
  if (!result.ok) return { ok: false, error: result.error };

  await recordAudit({
    table: "newsletter_editions",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { status: "published" },
  });
  refresh(id);
  return { ok: true, message: "Edition marked as published." };
}
