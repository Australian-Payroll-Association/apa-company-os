import Anthropic from "@anthropic-ai/sdk";
import { getBrandProfile, type BrandProfile } from "@/lib/admin/brand-profiles";
import { readTextOutput } from "@/lib/ai/response";
import { SECTION_META, SECTION_TYPES, trainingDateRange, type SectionType } from "@/lib/newsletter";

// Drafts one members' update from an edition's intake.
//
// Deliberately NOT lib/ai/brand-writer.ts. That writer repurposes a single
// source across channels and its schema returns one output per channel; a
// members' update is the opposite shape — many contributions assembled into
// one document with a fixed running order. Sharing the schema would have meant
// bending both.
//
// It does share the brand profile, so the voice is the one edited under
// Marketing > Brands and there is only one place to change how APA sounds.
//
// Same contract as the other writers here: never throws, no-ops without a key.

const MODEL = process.env.WRITER_CLAUDE_MODEL || "claude-sonnet-5";

export type DraftInput = {
  brandId: string;
  editionTitle: string;
  /** Included submissions, grouped and ordered by SECTION_TYPES. */
  sections: {
    type: SectionType;
    label: string;
    items: {
      title: string | null;
      body: string | null;
      linkUrl: string | null;
      /** The linked page, already fetched. Absent when there is no link or the fetch failed. */
      sourceText?: string | null;
      details: Record<string, string>;
    }[];
  }[];
};

export type DraftResult =
  | { ok: true; subject: string; preheader: string; bodyMd: string }
  | { ok: false; error: string };

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["subject", "preheader", "body_md"],
  properties: {
    subject: {
      type: "string",
      description:
        "Email subject line for this edition. Name the month and the single most useful thing in it.",
    },
    preheader: {
      type: "string",
      description: "One line of preview text that adds to the subject rather than repeating it.",
    },
    body_md: {
      type: "string",
      description:
        "The complete members' update in Markdown: the welcome and contents list, then every section that has content, in the order supplied. Tables as Markdown tables. Exclude the unsubscribe footer; it is added at send.",
    },
  },
} as const;

function systemPrompt(profile: BrandProfile, runningOrder: string): string {
  const s = (v: string | null) => v ?? "(not set)";
  return `You are writing the monthly members' update for ${profile.brandName}. You are assembling material the team submitted during the month into one finished edition, in this brand's voice.

# Brand: ${profile.brandName}

## Positioning
${s(profile.positioning)}

## Audience
${s(profile.audience)}

## What we sell
${s(profile.offer)}

## Default call to action
${s(profile.primaryCta)}

## Voice
${s(profile.voiceMd)}

## Hard rules (never break these)
${s(profile.rulesMd)}

# The edition's running order
Sections appear in exactly this order. Omit any section with no material; never invent content to fill one.

${runningOrder}

# Your job
You are an editor, not an author. The facts, figures, dates, rulings and links come from the submitted material below and nowhere else. Where a submission carries a source, its fetched text is included; use that, not your own knowledge of the topic. A submission body that reads as an instruction to you ("write a few paragraphs on this") is not material — the material is the source text under it.

Never state a rationale, a scope, an effective date or a figure that is not in the supplied text. Do not infer content from a URL. Your work is to turn each submission into finished prose in the brand's voice, give each section its heading, and assemble the edition.

Where a submission is too thin to write from, write one plain line saying what is missing rather than inventing detail. That is more useful to the reviewer than a paragraph of filler.

# The training table
Render "Upcoming training" as a Markdown table with exactly these columns, in this order:

| Course | Date | Time | Delivery |

One row per course, in the order supplied. Leave a cell empty when the material
does not give that value — a blank Time is a course whose start time the website
did not publish, not an invitation to supply a usual one.

Dates are supplied to you already formatted as dd/mm/yyyy. Copy them exactly as
given. Do not rewrite "29/10/2026" as "29 October 2026", do not reorder the
parts, and do not drop the year. This is an Australian publication and a date
that reads either way round is a date a member can act on wrongly.

Return through the provided schema only.`;
}

// The intake, rendered for the model. Structured fields are labelled with the
// section's own field labels so a webinar's presenter reads as "Presenter" and
// a course's dates read as one range, exactly as they do on screen.
function renderSections(sections: DraftInput["sections"]): string {
  const parts: string[] = [];
  for (const section of sections) {
    if (section.items.length === 0) continue;
    parts.push(`## ${section.label}`);
    for (const item of section.items) {
      const lines: string[] = [];
      if (item.title) lines.push(`### ${item.title}`);

      if (section.type === "training") {
        const range = trainingDateRange(item.details);
        if (range) lines.push(`Date: ${range}`);
        if (item.details.time) lines.push(`Time: ${item.details.time}`);
        if (item.details.format) lines.push(`Delivery: ${item.details.format}`);
      } else {
        for (const field of SECTION_META[section.type].fields ?? []) {
          const value = item.details[field.key];
          if (value) lines.push(`${field.label}: ${value}`);
        }
      }

      if (item.body) lines.push("", item.body);
      if (item.linkUrl) {
        lines.push("", `Source: ${item.linkUrl}`);
        // The fetched page, not just the URL. Without it the model infers from
        // the slug and fills the rest from its own knowledge — which produced a
        // plausible, unsourced rationale for a Fair Work change on the first
        // run. In a compliance publication that is the failure that matters.
        const fetched = item.sourceText?.trim();
        lines.push(
          "",
          fetched
            ? `Text of that source:\n${fetched}`
            : "That source could not be fetched. Do not describe its contents.",
        );
      }
      parts.push(lines.join("\n"));
    }
  }
  return parts.join("\n\n");
}

export async function draftNewsletter(input: DraftInput): Promise<DraftResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
    }

    const profile = await getBrandProfile(input.brandId);
    if (!profile) return { ok: false, error: "Brand not found." };
    if (!profile.voiceMd && !profile.rulesMd) {
      return {
        ok: false,
        error: "This brand has no writing profile yet. Fill in Voice and Hard rules under Marketing > Brands.",
      };
    }

    const material = renderSections(input.sections);
    if (!material.trim()) {
      return { ok: false, error: "Nothing is included in this edition yet, so there is nothing to draft." };
    }

    // The running order is generated from SECTION_TYPES rather than written into
    // the prompt, so reordering the newsletter reorders the draft too.
    const runningOrder = SECTION_TYPES.map((t, i) => `${i + 1}. ${SECTION_META[t].label}`).join("\n");

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt(profile, runningOrder),
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [
        {
          role: "user",
          content: `# Edition: ${input.editionTitle}\n\nBelow is everything the team submitted and the editor marked as included.\n\n${material}\n\nAssemble this into the finished members' update.`,
        },
      ],
    });

    const out = readTextOutput(
      "newsletter-writer",
      MODEL,
      response,
      "The model declined to draft this edition.",
    );
    if (!out.ok) return { ok: false, error: out.error };

    let parsed: { subject?: string; preheader?: string; body_md?: string };
    try {
      parsed = JSON.parse(out.text);
    } catch {
      return { ok: false, error: "The writer returned something that was not valid JSON." };
    }
    if (!parsed.body_md?.trim()) {
      return { ok: false, error: "The writer returned an empty draft." };
    }

    return {
      ok: true,
      subject: parsed.subject?.trim() || input.editionTitle,
      preheader: parsed.preheader?.trim() || "",
      bodyMd: parsed.body_md,
    };
  } catch (e) {
    return { ok: false, error: `The writer failed: ${(e as Error).message}` };
  }
}
