import { supabase, companyOs } from "@/lib/supabase";
import { getBrandProfile } from "@/lib/admin/brand-profiles";
import { imageStyleLabel } from "@/lib/marketing/style-catalogues";

// Generates one image for a calendar entry from its image brief + chosen image
// style + the brand's image guidance, using Google's Gemini image model, and
// stores it in the public `marketing` bucket. Same contract as the writer: never
// throws, no-ops without a key. Model is env-overridable because these names move.

const MODEL = process.env.IMAGE_MODEL || "gemini-2.5-flash-image";

type Result = { ok: true; url: string } | { ok: false; error: string };

function buildPrompt(
  title: string,
  brief: string | null,
  styleLabel: string | null,
  brandGuidance: string | null,
): string {
  return `Create a single marketing image for a post titled "${title}".

Aesthetic style: ${styleLabel || "clean editorial"}.

Brand image guidance (use only these colors and this typeface):
${brandGuidance || "(none provided)"}

Image brief:
${brief || "(none provided; work from the title and style)"}

Produce one high-quality image, no borders. Use only the brand's palette and typeface. Set any headline in normal sentence case. Do not add logos, watermarks, or stock-photo captions.`;
}

export async function generateEntryImage(entryId: string): Promise<Result> {
  try {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!key) return { ok: false, error: "GEMINI_API_KEY is not configured." };

    const { data, error } = await companyOs
      .from("marketing_calendar")
      .select("id, title, brand_id, image_brief_md, image_style")
      .eq("id", entryId)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Entry not found." };

    const entry = data as {
      id: string;
      title: string;
      brand_id: string | null;
      image_brief_md: string | null;
      image_style: string | null;
    };

    const profile = entry.brand_id ? await getBrandProfile(entry.brand_id) : null;
    const styleLabel = imageStyleLabel(entry.image_style);
    const prompt = buildPrompt(entry.title, entry.image_brief_md, styleLabel, profile?.imageStyleMd ?? null);

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: `Image API error ${res.status}: ${body.slice(0, 200)}` };
    }

    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { inlineData?: { mimeType?: string; data?: string } }[] } }[];
    };
    const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
    if (!part?.inlineData?.data) return { ok: false, error: "The model returned no image." };

    const mime = part.inlineData.mimeType || "image/png";
    const ext = mime.includes("jpeg") ? "jpg" : mime.includes("webp") ? "webp" : "png";
    const buffer = Buffer.from(part.inlineData.data, "base64");
    const path = `entries/${entryId}/${crypto.randomUUID()}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("marketing")
      .upload(path, buffer, { contentType: mime, upsert: false });
    if (upErr) return { ok: false, error: upErr.message };

    const { data: pub } = supabase.storage.from("marketing").getPublicUrl(path);
    const { error: dbErr } = await companyOs
      .from("marketing_calendar")
      .update({ image_url: pub.publicUrl })
      .eq("id", entryId);
    if (dbErr) return { ok: false, error: dbErr.message };

    return { ok: true, url: pub.publicUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[brand-image] failed:", msg);
    return { ok: false, error: msg };
  }
}
