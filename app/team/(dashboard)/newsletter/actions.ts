"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import {
  assertInScope,
  newsletterEditionIsOpen,
  teamInsertOwn,
  teamUpdateInScope,
} from "@/lib/team/data";
import { SECTION_META, isSectionType, type SectionType } from "@/lib/newsletter";

// Newsletter intake, contributor side. teamInsertOwn forces
// person_id = actor.personId server-side, so a contribution can only ever be
// filed as yourself — the form never sends an author.

type Result = { ok: true; id?: string } | { ok: false; error: string };

const MAX_TITLE = 200;
const MAX_BODY = 5000;
const MAX_URL = 500;
const MAX_DETAIL = 200;

function refresh() {
  revalidatePath("/team/newsletter");
}

// Reject anything that isn't a plain http(s) link — a javascript: URL here
// would end up rendered as a clickable href on the admin edition view.
function cleanLink(raw: string): string | null | { error: string } {
  const value = raw.trim();
  if (!value) return null;
  if (value.length > MAX_URL) return { error: "That link is too long." };
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return { error: "That doesn't look like a valid link. Include https:// at the front." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { error: "Links need to be regular http(s) addresses." };
  }
  return parsed.toString();
}

// Section-specific extras (a webinar's date and time). Only keys the section
// actually declares are kept, so a crafted payload cannot smuggle arbitrary
// data into the jsonb bag.
function cleanDetails(
  sectionType: SectionType,
  details: Record<string, string> | undefined,
): Record<string, string> {
  const declared = SECTION_META[sectionType].fields ?? [];
  const out: Record<string, string> = {};
  for (const field of declared) {
    const value = (details?.[field.key] ?? "").trim();
    if (value) out[field.key] = value.slice(0, MAX_DETAIL);
  }
  return out;
}

export async function submitContribution(input: {
  editionId: string;
  sectionType: string;
  title: string;
  body: string;
  linkUrl: string;
  details?: Record<string, string>;
}): Promise<Result> {
  const actor = await requireTeamMember();

  if (!isSectionType(input.sectionType)) {
    return { ok: false, error: "Pick a section." };
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Add some detail — an empty submission can't be drafted from." };
  if (title.length > MAX_TITLE) return { ok: false, error: "Keep the heading under 200 characters." };
  if (body.length > MAX_BODY) return { ok: false, error: "That's longer than 5,000 characters. Trim it or attach a link." };

  const link = cleanLink(input.linkUrl);
  if (link && typeof link === "object") return { ok: false, error: link.error };

  // Re-read the edition's state rather than trusting the page that rendered
  // the form: a tab left open overnight must not post into a closed edition.
  if (!(await newsletterEditionIsOpen(input.editionId))) {
    return { ok: false, error: "This edition has closed for submissions." };
  }

  const { data, error } = await teamInsertOwn(actor, "newsletter_submissions", {
    edition_id: input.editionId,
    section_type: input.sectionType,
    title: title || null,
    body,
    link_url: link,
    source: "team",
    details: cleanDetails(input.sectionType, input.details),
  });
  if (error) return { ok: false, error };

  refresh();
  return { ok: true, id: data?.id };
}

export async function updateContribution(
  id: string,
  input: { title: string; body: string; linkUrl: string },
): Promise<Result> {
  const actor = await requireTeamMember();

  // Strictly self, not the actor's wider scope. personScope includes a
  // manager's reports, and teamUpdateInScope would accept any of them — a
  // manager must not be able to rewrite what someone else submitted. Compare
  // the row's owner to the actor's OWN person id.
  const owner = await assertInScope(actor, "newsletter_submissions", id);
  if (!owner || owner !== actor.personId) return { ok: false, error: "Not found." };

  const title = input.title.trim();
  const body = input.body.trim();
  if (!body) return { ok: false, error: "Add some detail — an empty submission can't be drafted from." };
  if (title.length > MAX_TITLE) return { ok: false, error: "Keep the heading under 200 characters." };
  if (body.length > MAX_BODY) return { ok: false, error: "That's longer than 5,000 characters." };

  const link = cleanLink(input.linkUrl);
  if (link && typeof link === "object") return { ok: false, error: link.error };

  const { ok, error } = await teamUpdateInScope(actor, "newsletter_submissions", id, {
    title: title || null,
    body,
    link_url: link,
  });
  if (!ok) return { ok: false, error: error ?? "Could not save that." };

  refresh();
  return { ok: true, id };
}
