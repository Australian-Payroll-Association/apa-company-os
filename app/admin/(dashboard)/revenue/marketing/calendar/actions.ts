"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import type { CalendarChannel, CalendarStatus } from "@/lib/admin/marketing-calendar";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type CampaignResult = { ok: true; campaignId: string } | { ok: false; error: string };

const CHANNELS = new Set<CalendarChannel>(["blog", "email", "linkedin", "facebook"]);
const STATUSES = new Set<CalendarStatus>([
  "idea",
  "drafted",
  "approved",
  "scheduled",
  "published",
  "skipped",
]);

function refresh() {
  revalidatePath("/admin/revenue/marketing/calendar");
}

export async function createEntry(input: {
  title: string;
  channel: string;
  brandId?: string | null;
  publishDate?: string | null;
  pillar?: string | null;
}): Promise<CreateResult> {
  const admin = await requireAdmin();
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the entry a title." };
  if (!CHANNELS.has(input.channel as CalendarChannel)) {
    return { ok: false, error: "Pick a channel." };
  }

  const { data, error } = await companyOs
    .from("marketing_calendar")
    .insert({
      title,
      channel: input.channel,
      brand_id: input.brandId || null,
      publish_date: input.publishDate || null,
      pillar: input.pillar?.trim() || null,
      created_by: admin.email,
    })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Entry was not created." };

  const id = (data as { id: string }).id;
  await recordAudit({
    table: "marketing_calendar",
    recordId: id,
    operation: "insert",
    actor: admin.email,
    context: { title, channel: input.channel },
  });
  refresh();
  return { ok: true, id };
}

export async function updateEntry(
  id: string,
  patch: {
    title?: string;
    brandId?: string | null;
    pillar?: string | null;
    channel?: string;
    publishDate?: string | null;
    copyMd?: string | null;
    assetUrl?: string | null;
    notes?: string | null;
    parentId?: string | null;
  },
): Promise<ActionResult> {
  const admin = await requireAdmin();

  const update: Record<string, unknown> = {};
  if (patch.title !== undefined) {
    const t = patch.title.trim();
    if (!t) return { ok: false, error: "Title cannot be empty." };
    update.title = t;
  }
  if (patch.brandId !== undefined) update.brand_id = patch.brandId || null;
  if (patch.pillar !== undefined) update.pillar = patch.pillar?.trim() || null;
  if (patch.channel !== undefined) {
    if (!CHANNELS.has(patch.channel as CalendarChannel)) {
      return { ok: false, error: "Unknown channel." };
    }
    update.channel = patch.channel;
  }
  if (patch.publishDate !== undefined) update.publish_date = patch.publishDate || null;
  if (patch.copyMd !== undefined) update.copy_md = patch.copyMd || null;
  if (patch.assetUrl !== undefined) update.asset_url = patch.assetUrl?.trim() || null;
  if (patch.notes !== undefined) update.notes = patch.notes || null;
  if (patch.parentId !== undefined) {
    // An entry cannot be its own parent.
    update.parent_id = patch.parentId && patch.parentId !== id ? patch.parentId : null;
  }
  if (Object.keys(update).length === 0) return { ok: true };

  const { error } = await companyOs.from("marketing_calendar").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "marketing_calendar",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { fields: Object.keys(update) },
  });
  refresh();
  return { ok: true };
}

export async function moveEntry(
  id: string,
  status: string,
  sortOrder?: number,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (!STATUSES.has(status as CalendarStatus)) {
    return { ok: false, error: "Unknown status." };
  }

  const update: Record<string, unknown> = { status };
  if (sortOrder !== undefined && Number.isFinite(sortOrder)) update.sort_order = sortOrder;

  const { error } = await companyOs.from("marketing_calendar").update(update).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "marketing_calendar",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { status },
  });
  refresh();
  return { ok: true };
}

export async function deleteEntry(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { error } = await companyOs.from("marketing_calendar").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "marketing_calendar",
    recordId: id,
    operation: "delete",
    actor: admin.email,
  });
  refresh();
  return { ok: true };
}

// Spawns a draft email campaign from an email-channel entry and links them, so
// the calendar reflects the campaign's real send status from then on. The
// entry's brand and publish date carry through; scheduling stays draft-editable
// on the campaign side.
export async function createCampaignFromEntry(id: string): Promise<CampaignResult> {
  const admin = await requireAdmin();

  const { data: entryData, error: entryError } = await companyOs
    .from("marketing_calendar")
    .select("id, title, channel, brand_id, campaign_id, publish_date")
    .eq("id", id)
    .maybeSingle();

  if (entryError) return { ok: false, error: entryError.message };
  if (!entryData) return { ok: false, error: "Entry not found." };

  const entry = entryData as {
    id: string;
    title: string;
    channel: string;
    brand_id: string | null;
    campaign_id: string | null;
    publish_date: string | null;
  };

  if (entry.channel !== "email") {
    return { ok: false, error: "Only email entries can spawn a campaign." };
  }
  if (entry.campaign_id) {
    return { ok: false, error: "This entry already has a campaign." };
  }

  const { data: campaignData, error: campaignError } = await companyOs
    .from("email_campaigns")
    .insert({
      name: entry.title,
      subject: entry.title,
      brand_id: entry.brand_id,
      // A date-only publish target becomes 09:00 local-ish (UTC midnight is
      // fine as a default; the operator refines it in the campaign editor).
      scheduled_at: entry.publish_date ? `${entry.publish_date}T09:00:00Z` : null,
      created_by: admin.email,
    })
    .select("id")
    .maybeSingle();

  if (campaignError) return { ok: false, error: campaignError.message };
  if (!campaignData) return { ok: false, error: "Campaign was not created." };
  const campaignId = (campaignData as { id: string }).id;

  const { error: linkError } = await companyOs
    .from("marketing_calendar")
    .update({ campaign_id: campaignId })
    .eq("id", id);
  if (linkError) return { ok: false, error: linkError.message };

  await recordAudit({
    table: "email_campaigns",
    recordId: campaignId,
    operation: "insert",
    actor: admin.email,
    context: { from_calendar_entry: id, name: entry.title },
  });
  refresh();
  return { ok: true, campaignId };
}
