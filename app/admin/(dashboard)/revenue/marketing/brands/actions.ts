"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveBrandProfile(
  brandId: string,
  patch: {
    positioning?: string;
    audience?: string;
    voiceMd?: string;
    offer?: string;
    primaryCta?: string;
    contentRulesMd?: string;
  },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!brandId) return { ok: false, error: "Missing brand." };

  const row = {
    brand_id: brandId,
    positioning: patch.positioning?.trim() || null,
    audience: patch.audience?.trim() || null,
    voice_md: patch.voiceMd?.trim() || null,
    offer: patch.offer?.trim() || null,
    primary_cta: patch.primaryCta?.trim() || null,
    content_rules_md: patch.contentRulesMd?.trim() || null,
    updated_by: admin.email,
    updated_at: new Date().toISOString(),
  };

  const { error } = await companyOs
    .from("brand_profiles")
    .upsert(row, { onConflict: "brand_id" });
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "brand_profiles",
    recordId: brandId,
    operation: "update",
    actor: admin.email,
  });
  revalidatePath("/admin/revenue/marketing/brands");
  revalidatePath("/admin/revenue/marketing/campaigns");
  return { ok: true };
}
