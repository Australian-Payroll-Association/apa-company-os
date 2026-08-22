"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { getCampaignStats } from "@/lib/admin/campaigns";
import {
  listEntries,
  type CalendarChannel,
  type CalendarEntryRow,
  type CalendarStatus,
  type PillarOption,
} from "@/lib/admin/marketing-calendar";

type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult = { ok: true; id: string } | { ok: false; error: string };
type CampaignResult = { ok: true; campaignId: string } | { ok: false; error: string };
type RepurposeResult = { ok: true; entries: CalendarEntryRow[] } | { ok: false; error: string };
type PillarResult = { ok: true; pillar: PillarOption } | { ok: false; error: string };

// The repurposing waterfall: a core asset (usually blog) becomes social + email
// derivatives, staggered over the following days.
const DERIVATIVES: { channel: CalendarChannel; offsetDays: number }[] = [
  { channel: "linkedin", offsetDays: 1 },
  { channel: "facebook", offsetDays: 2 },
  { channel: "email", offsetDays: 4 },
];

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

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
  pillarId?: string | null;
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
      pillar_id: input.pillarId || null,
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
    pillarId?: string | null;
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
  if (patch.pillarId !== undefined) update.pillar_id = patch.pillarId || null;
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

// Manual social path: record where a blog/LinkedIn/Facebook entry went live and
// move it to 'published'. URL is optional (a post may have no shareable link).
export async function markPosted(id: string, url: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const { error } = await companyOs
    .from("marketing_calendar")
    .update({ status: "published", posted_url: url.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "marketing_calendar",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { status: "published", posted: true },
  });
  refresh();
  return { ok: true };
}

// Delivery numbers for an entry's linked campaign, fetched lazily when the
// drawer opens (so the board list doesn't pay for stats it isn't showing).
export type EntryPerformance = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
};

export async function getEntryPerformance(campaignId: string): Promise<EntryPerformance> {
  await requireAdmin();
  const s = await getCampaignStats(campaignId);
  return { sent: s.sent, delivered: s.delivered, opened: s.opened, clicked: s.clicked };
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

export async function createPillar(brandId: string, name: string): Promise<PillarResult> {
  const admin = await requireAdmin();
  const trimmed = name.trim();
  if (!brandId) return { ok: false, error: "Pick a brand for the pillar." };
  if (!trimmed) return { ok: false, error: "Give the pillar a name." };

  const { data, error } = await companyOs
    .from("marketing_pillars")
    .insert({ brand_id: brandId, name: trimmed, created_by: admin.email })
    .select("id, brand_id, name")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "That pillar already exists for this brand." };
    return { ok: false, error: error.message };
  }
  if (!data) return { ok: false, error: "Pillar was not created." };

  const row = data as { id: string; brand_id: string; name: string };
  await recordAudit({
    table: "marketing_pillars",
    recordId: row.id,
    operation: "insert",
    actor: admin.email,
    context: { name: trimmed },
  });
  refresh();
  return { ok: true, pillar: { id: row.id, brandId: row.brand_id, name: row.name } };
}

export async function deactivatePillar(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  // Soft-remove: entries already tagged with it keep their pillar_id.
  const { error } = await companyOs
    .from("marketing_pillars")
    .update({ active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "marketing_pillars",
    recordId: id,
    operation: "update",
    actor: admin.email,
    context: { active: false },
  });
  refresh();
  return { ok: true };
}

// Spawns channel derivatives from a core asset, each linked back via parent_id
// and dated a few days after the parent (the repurposing waterfall). Skips the
// parent's own channel. Returns the full entry list so the client re-syncs.
export async function repurposeEntry(id: string): Promise<RepurposeResult> {
  const admin = await requireAdmin();

  const { data, error } = await companyOs
    .from("marketing_calendar")
    .select("id, title, brand_id, channel, pillar_id, publish_date")
    .eq("id", id)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Entry not found." };

  const parent = data as {
    id: string;
    title: string;
    brand_id: string | null;
    channel: string;
    pillar_id: string | null;
    publish_date: string | null;
  };

  const baseDate = parent.publish_date ?? new Date().toISOString().slice(0, 10);
  const children = DERIVATIVES.filter((d) => d.channel !== parent.channel).map((d) => ({
    title: parent.title,
    brand_id: parent.brand_id,
    pillar_id: parent.pillar_id,
    channel: d.channel,
    status: "idea",
    publish_date: addDays(baseDate, d.offsetDays),
    parent_id: parent.id,
    created_by: admin.email,
  }));

  if (children.length === 0) return { ok: false, error: "Nothing to repurpose." };

  const { error: insertError } = await companyOs.from("marketing_calendar").insert(children);
  if (insertError) return { ok: false, error: insertError.message };

  await recordAudit({
    table: "marketing_calendar",
    recordId: id,
    operation: "bulk_update",
    actor: admin.email,
    context: { repurposed_into: children.map((c) => c.channel) },
  });
  refresh();

  const { rows, error: listError } = await listEntries();
  if (listError) return { ok: false, error: listError };
  return { ok: true, entries: rows };
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
