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

// PLACEHOLDER STRUCTURE — the five inputs named in the brainstorm. APA's actual
// section list is still to be supplied; when it arrives, replace this array and
// SECTION_META below. Nothing else needs to change: the form, the admin view and
// the completeness check all derive from these.
export const SECTION_TYPES = [
  "topic_idea",
  "faq",
  "compliance",
  "training",
  "webinar",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

export type SectionMeta = {
  label: string;
  // Shown on the form. Written to stop things coming back half-finished, which
  // is the failure the whole intake stage exists to prevent.
  hint: string;
  // How many the edition wants before it is worth drafting. null = no target.
  target: number | null;
  // 'team'   — a person types it
  // 'events' — materialised from company_os.events, not offered on the form
  source: "team" | "events";
  needsLink: boolean;
};

export const SECTION_META: Record<SectionType, SectionMeta> = {
  topic_idea: {
    label: "Topic idea or link",
    hint: "One idea per submission. If it came from something you read, paste the link — the draft will reference it.",
    target: null,
    source: "team",
    needsLink: false,
  },
  faq: {
    label: "FAQ",
    hint: "A question a member actually asked, and the answer you gave. Write the answer in full — a one-line note cannot be drafted from.",
    target: 2,
    source: "team",
    needsLink: false,
  },
  compliance: {
    label: "Compliance piece",
    hint: "What changed, when it takes effect, and who it affects. Include the source (award, ruling, ATO update) so the draft can cite it.",
    target: 1,
    source: "team",
    needsLink: false,
  },
  training: {
    label: "Upcoming training",
    hint: "Pulled automatically from published events in this edition's date range.",
    target: null,
    source: "events",
    needsLink: false,
  },
  webinar: {
    label: "Next webinar",
    hint: "Pulled automatically from published webinar events in this edition's date range.",
    target: 1,
    source: "events",
    needsLink: false,
  },
};

// Sections a person can submit against. The events-sourced ones are excluded:
// offering them on the form is exactly the manual chasing this removes.
export const CONTRIBUTABLE_SECTIONS = SECTION_TYPES.filter(
  (t) => SECTION_META[t].source === "team",
);

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
