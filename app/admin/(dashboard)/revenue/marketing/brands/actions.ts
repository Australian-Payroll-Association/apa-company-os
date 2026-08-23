"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type ActionResult = { ok: true } | { ok: false; error: string };

// camelCase field -> db column. Only keys present in the patch are written, so a
// per-tab save never wipes the other tabs' fields.
const FIELD_MAP: Record<string, string> = {
  positioning: "positioning",
  audience: "audience",
  offer: "offer",
  primaryCta: "primary_cta",
  authorMd: "author_md",
  voiceMd: "voice_md",
  rulesMd: "rules_md",
  channelsMd: "channels_md",
  processMd: "process_md",
  blogStylesMd: "blog_styles_md",
  editingLensMd: "editing_lens_md",
  seoLensMd: "seo_lens_md",
  imageStyleMd: "image_style_md",
};

export async function saveBrandProfile(
  brandId: string,
  patch: Partial<Record<keyof typeof FIELD_MAP, string>>,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!brandId) return { ok: false, error: "Missing brand." };

  const row: Record<string, unknown> = {
    brand_id: brandId,
    updated_by: admin.email,
    updated_at: new Date().toISOString(),
  };
  for (const [key, column] of Object.entries(FIELD_MAP)) {
    const value = patch[key as keyof typeof FIELD_MAP];
    if (value !== undefined) row[column] = value.trim() || null;
  }

  const { error } = await companyOs.from("brand_profiles").upsert(row, { onConflict: "brand_id" });
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "brand_profiles",
    recordId: brandId,
    operation: "update",
    actor: admin.email,
    context: { fields: Object.keys(patch) },
  });
  revalidatePath("/admin/revenue/marketing/brands");
  revalidatePath(`/admin/revenue/marketing/brands`);
  revalidatePath("/admin/revenue/marketing/campaigns");
  return { ok: true };
}
