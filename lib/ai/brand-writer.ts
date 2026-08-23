import Anthropic from "@anthropic-ai/sdk";
import { getBrandProfile } from "@/lib/admin/brand-profiles";

// The AI writer. Given a brand and a source (a blog post or a brief), it drafts
// content by following the brand's own content_rules_md. Nothing about the
// output is hardwired here: which deliverables to produce, the lens, and the
// per-channel rules all come from the brand profile the admin edits. Same shape
// as lib/ai/idea-plan.ts: never throws, no-ops without a key.

const MODEL = process.env.WRITER_CLAUDE_MODEL || "claude-opus-4-8";

export type WriterOutput = {
  channel: "email" | "linkedin" | "facebook" | "blog";
  title?: string;
  subject?: string; // email only
  preheader?: string; // email only
  bodyMd: string;
};

export type WriterResult =
  | { ok: true; outputs: WriterOutput[] }
  | { ok: false; error: string };

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["outputs"],
  properties: {
    outputs: {
      type: "array",
      description:
        "One entry per deliverable the brand's content rules call for. Produce exactly the channels the rules specify, no more.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["channel", "body_md"],
        properties: {
          channel: { type: "string", enum: ["email", "linkedin", "facebook", "blog"] },
          title: { type: "string", description: "Short internal label for this deliverable." },
          subject: { type: "string", description: "Email subject line. Email channel only." },
          preheader: { type: "string", description: "Email preheader. Email channel only." },
          body_md: {
            type: "string",
            description:
              "The copy in Markdown (headings, bold, lists, links). For email, exclude the unsubscribe footer; it is added automatically.",
          },
        },
      },
    },
  },
} as const;

function systemPrompt(profile: {
  brandName: string;
  positioning: string | null;
  audience: string | null;
  voiceMd: string | null;
  offer: string | null;
  primaryCta: string | null;
  contentRulesMd: string | null;
}): string {
  return `You are the content writer for ${profile.brandName}. Write only in this brand's voice and follow its content rules exactly. These rules, not any default, decide which deliverables you produce and how each channel reads.

# Brand: ${profile.brandName}

## Positioning
${profile.positioning ?? "(not set)"}

## Audience
${profile.audience ?? "(not set)"}

## Voice
${profile.voiceMd ?? "(not set)"}

## What we sell
${profile.offer ?? "(not set)"}

## Default call to action
${profile.primaryCta ?? "(not set)"}

## Content rules (follow these to the letter)
${profile.contentRulesMd ?? "(not set)"}

# Output
Return one output per deliverable the content rules call for. Re-purpose the same core idea per channel; never repeat identical text across channels. Never use em dashes. Do not invent facts, metrics, or quotes that are not in the source. Return through the provided schema only.`;
}

export async function writeForBrand(input: {
  brandId: string;
  sourceText: string;
  sourceUrl?: string | null;
  brief?: string | null;
}): Promise<WriterResult> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return { ok: false, error: "ANTHROPIC_API_KEY is not configured." };
    }

    const profile = await getBrandProfile(input.brandId);
    if (!profile) return { ok: false, error: "Brand not found." };
    if (!profile.contentRulesMd && !profile.voiceMd) {
      return { ok: false, error: "This brand has no writing profile yet. Fill it in under Marketing > Brands." };
    }

    const userMsg = `# Source material

${input.sourceUrl ? `Source URL: ${input.sourceUrl}\n\n` : ""}${input.brief ? `Brief: ${input.brief}\n\n` : ""}${input.sourceText || "(no source text; work from the brief above)"}

Draft the deliverables the content rules specify, re-purposed to this brand's lens.`;

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: systemPrompt(profile),
      output_config: { format: { type: "json_schema", schema: OUTPUT_SCHEMA } },
      messages: [{ role: "user", content: userMsg }],
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The model declined to draft this content." };
    }
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    if (!textBlock) return { ok: false, error: "Model returned no output." };

    const parsed = JSON.parse(textBlock.text) as {
      outputs: { channel: string; title?: string; subject?: string; preheader?: string; body_md: string }[];
    };
    const outputs: WriterOutput[] = (parsed.outputs ?? [])
      .filter((o) => o.body_md && o.channel)
      .map((o) => ({
        channel: o.channel as WriterOutput["channel"],
        title: o.title,
        subject: o.subject,
        preheader: o.preheader,
        bodyMd: o.body_md,
      }));

    if (outputs.length === 0) return { ok: false, error: "The writer produced nothing usable." };
    return { ok: true, outputs };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brand-writer] failed:", msg);
    return { ok: false, error: msg };
  }
}

// Fetches a public URL and reduces it to plain text for use as source material.
// Best-effort: returns empty string on any failure so the caller can fall back
// to a brief.
export async function fetchSourceText(url: string, maxChars = 6000): Promise<string> {
  try {
    const res = await fetch(url, { headers: { "user-agent": "Edge8-Writer/1.0" } });
    if (!res.ok) return "";
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, maxChars);
  } catch {
    return "";
  }
}
