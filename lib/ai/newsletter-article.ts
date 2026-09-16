import Anthropic from "@anthropic-ai/sdk";
import { getBrandProfile, type BrandProfile } from "@/lib/admin/brand-profiles";
import { readTextOutput } from "@/lib/ai/response";
import { decodeStrayEscapes } from "@/lib/ai/newsletter-writer";

// Writes ONE article for the members' update, from one source page.
//
// Deliberately not writeForBrand(), which returns a set of channel
// deliverables — an email, a LinkedIn post, a blog. An article here is a
// section of a larger document that already has its own subject line, welcome
// and contents list, so asking for an email would produce a second email
// inside the first. Same reason lib/ai/newsletter-writer.ts exists separately.
//
// It is also not the edition writer. That one assembles finished material into
// a running order; this one turns a regulator's page into the material.
//
// Same contract as the other writers here: never throws, no-ops without a key.

const MODEL = process.env.ARTICLE_CLAUDE_MODEL || "claude-sonnet-5";

export type ArticleResult =
  | { ok: true; heading: string; bodyMd: string }
  | { ok: false; error: string };

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["heading", "body_md"],
  properties: {
    heading: {
      type: "string",
      description:
        "The article's heading, written for a payroll practitioner — what changed, not the regulator's page title. No markdown, no leading hashes.",
    },
    body_md: {
      type: "string",
      description:
        "The article in Markdown. No top-level heading — the heading field carries that. Paragraphs, bold, lists and links only.",
    },
  },
} as const;

function systemPrompt(profile: BrandProfile): string {
  const s = (v: string | null) => v ?? "(not set)";
  return `You write one article for ${profile.brandName}'s monthly members' update. The readers are Australian payroll professionals who run pay runs and answer for compliance.

# Brand: ${profile.brandName}

## Audience
${s(profile.audience)}

## Voice
${s(profile.voiceMd)}

## Hard rules (never break these)
${s(profile.rulesMd)}

# What you are writing
ONE section of a larger newsletter. The edition already has its own subject line, welcome and contents list, so do not write a greeting, a sign-off, or a subject. Do not repeat the heading inside the body.

Around 200-350 words, plus an "Action for Payroll" list. Lead with what changed and from when. A worked example earns its place when the timing or the calculation is the part people get wrong; skip it when the change is simple.

# Where the facts come from
The source text below and nowhere else. It is the page itself, already fetched.

1. Every figure, rate, threshold, date and citation must appear in that text. Do not supply one from your own knowledge of the topic, however confident you are.
2. Where the page announces a change without giving the new figure, say so plainly and tell the reader to check the source before acting. That is more useful than a number that might be wrong.
3. Do not infer anything from the URL.
4. If the source text is too thin to write 200 words from, write what it supports and say what is missing. A short honest article beats a padded one.
5. Dates in the body read dd/mm/yyyy. This is an Australian publication.

Return through the provided schema only.`;
}

export async function writeArticleSection(input: {
  brandId: string;
  /** The source page's own title, for context only — you may improve on it. */
  sourceTitle: string;
  sourceUrl: string;
  /** The page text, already fetched. */
  sourceText: string;
  /** What the editor or the radar said about why this matters. */
  brief?: string | null;
}): Promise<ArticleResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
    }
    if (!input.sourceText.trim()) {
      // The whole design rests on the page being readable. Writing from a
      // brief alone is how the first version of this system invented a
      // rationale for a Fair Work change out of a URL slug.
      return {
        ok: false,
        error: "The source page could not be read, so there is nothing to write from. Check the link opens.",
      };
    }

    const profile = await getBrandProfile(input.brandId);
    if (!profile) return { ok: false, error: "Brand not found." };
    if (!profile.voiceMd && !profile.rulesMd) {
      return {
        ok: false,
        error: "This brand has no writing profile yet. Fill in Voice and Hard rules under Marketing > Brands.",
      };
    }

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "medium", format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      system: systemPrompt(profile),
      messages: [
        {
          role: "user",
          content: `# Source page
Title as published: ${input.sourceTitle}
URL: ${input.sourceUrl}
${input.brief?.trim() ? `\nWhy it was flagged: ${input.brief.trim()}\n` : ""}
# Text of that page

${input.sourceText}

Write the article.`,
        },
      ],
    });

    const out = readTextOutput("newsletter-article", MODEL, response, "The model declined to write this article.");
    if (!out.ok) return { ok: false, error: out.error };

    let parsed: { heading?: string; body_md?: string };
    try {
      parsed = JSON.parse(out.text);
    } catch {
      return { ok: false, error: "The writer returned something that was not valid JSON." };
    }
    if (!parsed.body_md?.trim()) return { ok: false, error: "The writer returned an empty article." };

    // Same double-escape defence as the edition writer: a model that escapes
    // an en dash twice puts a literal – into the copy.
    return {
      ok: true,
      heading: decodeStrayEscapes(parsed.heading?.trim() || input.sourceTitle),
      bodyMd: decodeStrayEscapes(parsed.body_md.trim()),
    };
  } catch (e) {
    return { ok: false, error: `The article writer failed: ${(e as Error).message}` };
  }
}
