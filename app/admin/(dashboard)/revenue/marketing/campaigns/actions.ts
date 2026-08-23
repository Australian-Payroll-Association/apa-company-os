"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import type { MarketingCampaignStatus } from "@/lib/admin/marketing-campaigns";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };

const STATUSES = new Set<MarketingCampaignStatus>(["draft", "active", "done", "archived"]);
const CHANNELS = new Set(["blog", "email", "linkedin", "facebook"]);

function refresh(id?: string) {
  revalidatePath("/admin/revenue/marketing/campaigns");
  if (id) revalidatePath(`/admin/revenue/marketing/campaigns/${id}`);
  // Assets live on the calendar too.
  revalidatePath("/admin/revenue/marketing/calendar");
}

export async function createCampaign(input: {
  name: string;
  brandId?: string | null;
  objective?: string | null;
  pillarId?: string | null;
  startsOn?: string | null;
  endsOn?: string | null;
}): Promise<CreateResult> {
  const admin = await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Give the campaign a name (the idea)." };

  const { data, error } = await companyOs
    .from("marketing_campaigns")
    .insert({
      name,
      brand_id: input.brandId || null,
      objective: input.objective?.trim() || null,
      pillar_id: input.pillarId || null,
      starts_on: input.startsOn || null,
      ends_on: input.endsOn || null,
      created_by: admin.email,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Campaign was not created." };

  const id = (data as { id: string }).id;
  await recordAudit({
    table: "marketing_campaigns",
    recordId: id,
    operation: "insert",
    actor: admin.email,
    context: { name },
  });
  refresh(id);
  return { ok: true, id };
}

export async function updateCampaign(
  id: string,
  patch: {
    name?: string;
    brandId?: string | null;
    objective?: string | null;
    pillarId?: string | null;
    seoGeoMd?: string | null;
    startsOn?: string | null;
    endsOn?: string | null;
    status?: string;
  },
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const update: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const t = patch.name.trim();
    if (!t) return { ok: false, error: "Name cannot be empty." };
    update.name = t;
  }
  if (patch.brandId !== undefined) update.brand_id = patch.brandId || null;
  if (patch.objective !== undefined) update.objective = patch.objective?.trim() || null;
  if (patch.pillarId !== undefined) update.pillar_id = patch.pillarId || null;
  if (patch.seoGeoMd !== undefined) update.seo_geo_md = patch.seoGeoMd || null;
  if (patch.startsOn !== undefined) update.starts_on = patch.startsOn || null;
  if (patch.endsOn !== undefined) update.ends_on = patch.endsOn || null;
  if (patch.status !== undefined) {
    if (!STATUSES.has(patch.status as MarketingCampaignStatus)) {
      return { ok: false, error: "Unknown status." };
    }
    update.status = patch.status;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await companyOs.from("marketing_campaigns").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "marketing_campaigns",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { fields: Object.keys(update) },
  });
  refresh(id);
  return { ok: true };
}

// Creates a new asset (calendar entry) under this campaign, inheriting the
// campaign's brand and pillar so the writer and image steps have the voice.
export async function addAssetToCampaign(
  campaignId: string,
  input: { title: string; channel: string; publishDate?: string | null },
): Promise<CreateResult> {
  const admin = await requireAdmin();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the asset a title." };
  if (!CHANNELS.has(input.channel)) return { ok: false, error: "Pick a channel." };

  const { data: campaign, error: campErr } = await companyOs
    .from("marketing_campaigns")
    .select("id, brand_id, pillar_id")
    .eq("id", campaignId)
    .maybeSingle();
  if (campErr) return { ok: false, error: campErr.message };
  if (!campaign) return { ok: false, error: "Campaign not found." };

  const c = campaign as { id: string; brand_id: string | null; pillar_id: string | null };
  const { data, error } = await companyOs
    .from("marketing_calendar")
    .insert({
      title,
      channel: input.channel,
      brand_id: c.brand_id,
      pillar_id: c.pillar_id,
      campaign_id: campaignId,
      publish_date: input.publishDate || null,
      created_by: admin.email,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Asset was not created." };

  const id = (data as { id: string }).id;
  await recordAudit({
    table: "marketing_calendar",
    recordId: id,
    operation: "insert",
    actor: admin.email,
    context: { title, channel: input.channel, campaign_id: campaignId },
  });
  refresh(campaignId);
  return { ok: true, id };
}
