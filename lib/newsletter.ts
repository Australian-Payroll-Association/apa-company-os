// Newsletter Machine domain constants, shared by /admin and /team.
//
// Allowed values live here rather than in DB CHECK constraints, following the
// convention set by lib/admin/surveys.ts. That is deliberate: APA's real
// newsletter structure is still to be confirmed, and changing it must stay an
// edit to SECTION_TYPES below rather than a migration.
//
// Server-only code must not be imported from here — this module is pulled into
// client components (the contribution form) for its labels.

export const EDITION_STATUSES = [
  "open", // intake is accepting submissions
  "closed", // intake shut, not yet drafted
  "drafting", // handed to Stage 2
  "in_review", // Stage 3, awaiting one or both signatures
  "published", // sent
  "cancelled",
] as const;
export type EditionStatus = (typeof EDITION_STATUSES)[number];

export const EDITION_STATUS_LABEL: Record<EditionStatus, string> = {
  open: "Open for submissions",
  closed: "Intake closed",
  drafting: "Drafting",
  in_review: "In review",
  published: "Published",
  cancelled: "Cancelled",
};

// APA's real member-update structure, taken from the September 2026 edition.
// Order matters: it is the running order of the newsletter, and the contents
// list at the top of an edition is generated from it.
//
// This replaced the brainstorm's placeholder five. Two corrections worth
// keeping in mind if it is revised again: legislative and regulatory updates
// are the bulk of an edition (the placeholder had them as generic "topic
// ideas"), and "What's on the Members Portal" is a standing section that the
// placeholder missed entirely.
// This IS the running order. Both the August and September 2026 editions run
// legislative items first, then member notices, then the portal, then
// compliance, then the Q&A section, and close on training and the webinar. The
// contents list at the top of an edition is generated from it, so reordering
// this array reorders the newsletter.
// "article" is deliberately one repeatable section rather than a set of typed
// ones. The month's substantive items vary in number and kind — four ATO
// rulings one month, a Fair Work reminder and a members' housekeeping notice
// the next — and splitting them into fixed types (legislative / notice / …)
// forced a taxonomy onto content that does not have one. Submit as many as the
// edition needs; running order within the section is the editor's call.
//
// Ask Beryl is NOT a section: it is material inside the compliance piece.
export const SECTION_TYPES = [
  "article",
  "portal_update",
  "compliance",
  "faq",
  "training",
  "webinar",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

// An extra, section-specific field. Values land in newsletter_submissions.details
// (jsonb) rather than as columns, so a section can gain a field without a
// migration — the same reasoning as keeping the section list in code.
export type ExtraField = {
  key: string;
  label: string;
  type: "text" | "date" | "time";
  placeholder?: string;
};

export type SectionMeta = {
  label: string;
  // Per-section wording for the three shared inputs. A webinar's heading is its
  // subject and its link is where members register; calling both by their
  // generic names made the form read as a form rather than as the section.
  titleLabel?: string;
  bodyLabel?: string;
  linkLabel?: string;
  fields?: ExtraField[];
  // Shown on the form. Written to stop things coming back half-finished, which
  // is the failure the whole intake stage exists to prevent.
  hint: string;
  // How many the edition wants before it is worth drafting. null = no target.
  target: number | null;
  // Where this section is normally filled from:
  //   .team.   — someone types it
  //   .events. — materialised from company_os.events by the auto-pull
  // An events-backed section is STILL typeable. The calendar is often empty or
  // behind, and a section nobody can fill is worse than one filled by hand.
  source: "team" | "events";
  needsLink: boolean;
};

export const SECTION_META: Record<SectionType, SectionMeta> = {
  article: {
    label: "Article for this edition",
    hint: "One article per submission — add as many as the month needs. A legislative or regulatory change, an ATO or Fair Work update, or a reminder for members. Give what changed, the effective date, who it affects, and the source link. Where it turns on a calculation, add a worked example with real dates and figures.",
    target: null,
    source: "team",
    needsLink: true,
  },
  compliance: {
    label: "Compliance",
    hint: "The rule, the exceptions, and the withholding or reporting consequence. Close on what payroll should actually do — this section always ends on an action, not a summary. Include an Ask Beryl conversation here if one illustrates the point.",
    target: 1,
    source: "team",
    needsLink: false,
  },
  faq: {
    label: "FAQ",
    hint: "A question members keep asking, answered by APA in full. Q and A, with the ATO or Fair Work reference. Worked examples and tables are welcome — this is the section that can carry them.",
    target: 2,
    source: "team",
    needsLink: false,
  },
  portal_update: {
    label: "What's on the Members Portal",
    hint: "New or updated resources — calculators, knowledge base articles, portal features. Say what it does for a payroll professional and paste the portal link. Note if it came from member feedback.",
    target: null,
    source: "team",
    needsLink: true,
  },
  training: {
    label: "Upcoming training",
    hint: "One course per submission, as it appears in the table: course name, date with start and finish times and timezone, and delivery (e.g. Virtual Classroom). Mark it NEW! if it is. Published events are pulled in automatically — add anything not in the calendar yet.",
    target: null,
    source: "events",
    needsLink: false,
  },
  webinar: {
    label: "Members webinar",
    hint: "The session's subject, when it runs, where to register, and what it covers. The webinar block sells the session — write the coverage as what attendees will be able to do afterwards, not just a list of topics.",
    titleLabel: "Subject",
    bodyLabel: "What's being covered",
    linkLabel: "Register now link",
    fields: [
      { key: "presenter", label: "Presenter", type: "text", placeholder: "Maria Nikoletatos, Australian Payroll Association" },
      { key: "date", label: "Date", type: "date" },
      { key: "time", label: "Time", type: "text", placeholder: "1:00 pm AEST" },
    ],
    target: 1,
    source: "events",
    needsLink: false,
  },
};

// Every section can be typed into. The events-backed ones are ALSO auto-pulled,
// but they are not withheld from the form.
//
// They were, briefly. The reasoning was that offering them re-introduced the
// manual chasing this stage exists to remove — sound in principle, wrong in
// fact: company_os.events is empty, so the pull returns nothing and there was
// no way to get a webinar into an edition at all. A section nobody can fill is
// worse than one filled by hand. Revisit only if the events calendar becomes
// the reliable source of truth for training and webinars.
export const CONTRIBUTABLE_SECTIONS = SECTION_TYPES;

// Event types that feed each auto-pulled section, mapped to company_os.events.type.
export const EVENT_TYPES_BY_SECTION: Partial<Record<SectionType, string[]>> = {
  training: ["workshop", "micro_session"],
  webinar: ["webinar"],
};

export function isSectionType(value: string): value is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(value);
}

export function isEditionStatus(value: string): value is EditionStatus {
  return (EDITION_STATUSES as readonly string[]).includes(value);
}

// Intake accepts submissions only while the edition is open. Checked on every
// write, so a form left open in a tab cannot post into a closed edition.
export function acceptsSubmissions(status: string): boolean {
  return status === "open";
}

export type SectionTally = {
  type: SectionType;
  label: string;
  included: number;
  target: number | null;
  short: boolean;
};

// What the edition still needs. Drives the "still thin" readout on the admin
// view — the thing that replaces chasing five people to find out.
export function tallySections(
  counts: Record<string, number>,
): SectionTally[] {
  return SECTION_TYPES.map((type) => {
    const meta = SECTION_META[type];
    const included = counts[type] ?? 0;
    return {
      type,
      label: meta.label,
      included,
      target: meta.target,
      short: meta.target !== null && included < meta.target,
    };
  });
}

// Default title for a new edition, e.g. "September 2026". Callers pass the
// period start so this stays testable and timezone-stable.
export function defaultEditionTitle(periodStart: Date): string {
  return periodStart.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}
