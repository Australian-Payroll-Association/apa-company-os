"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { marketingMarkdownToHtml } from "@/lib/marketing/markdown";
import { generateEntryImage } from "@/lib/ai/brand-image";
import { listAssetImages, setSelectedImage, type AssetImage } from "@/lib/admin/marketing-images";

type CopyResult = { ok: true; html: string } | { ok: false; error: string };
type ImagesResult = { ok: true; images: AssetImage[] } | { ok: false; error: string };

function refresh(campaignId: string, assetId: string) {
  revalidatePath(`/admin/revenue/marketing/campaigns/${campaignId}/assets/${assetId}`);
  revalidatePath(`/admin/revenue/marketing/campaigns/${campaignId}`);
  revalidatePath("/admin/revenue/marketing/calendar");
}

// Saves the post copy and returns the freshly rendered HTML so the detail page
// can update its preview without a full reload.
export async function saveAssetCopy(
  campaignId: string,
  assetId: string,
  copyMd: string,
): Promise<CopyResult> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from("marketing_calendar")
    .update({ copy_md: copyMd || null })
    .eq("id", assetId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "marketing_calendar",
    recordId: assetId,
    operation: "update",
    actor: admin.email,
    context: { fields: ["copy_md"] },
  });
  refresh(campaignId, assetId);
  return { ok: true, html: await marketingMarkdownToHtml(copyMd) };
}

// Generates a new image version (kept, not overwritten) and returns the full
// version list so the gallery re-syncs.
export async function regenerateAssetImage(campaignId: string, assetId: string): Promise<ImagesResult> {
  const admin = await requireAdmin();
  const r = await generateEntryImage(assetId, admin.email);
  if (!r.ok) return { ok: false, error: r.error };
  refresh(campaignId, assetId);
  return { ok: true, images: await listAssetImages(assetId) };
}

// Marks an earlier version as the selected one (revert), returns the fresh list.
export async function selectAssetImage(
  campaignId: string,
  assetId: string,
  imageId: string,
): Promise<ImagesResult> {
  await requireAdmin();
  const r = await setSelectedImage(assetId, imageId);
  if (!r.ok) return { ok: false, error: r.error };
  refresh(campaignId, assetId);
  return { ok: true, images: await listAssetImages(assetId) };
}
