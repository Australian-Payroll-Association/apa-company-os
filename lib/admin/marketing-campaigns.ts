import { companyOs } from "@/lib/supabase";
import type { CalendarChannel, CalendarStatus } from "@/lib/admin/marketing-calendar";

// Reads for the campaign umbrella: a campaign is the founder's idea (goal, dates,
// pillar, SEO/GEO plan) that spawns assets across channels. Assets are
// marketing_calendar rows linked by campaign_id. The volume is small (one team's
// plan), so these list without paging.

export type MarketingCampaignStatus = "draft" | "active" | "done" | "archived";

export const CAMPAIGN_STATUSES: { id: MarketingCampaignStatus; label: string }[] = [
  { id: "draft", label: "Draft" },
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
  { id: "archived", label: "Archived" },
];

// Asset statuses that count as "built" (past the drafting stage) for the
// campaign progress bar.
const BUILT_STATUSES = new Set<CalendarStatus>(["approved", "scheduled", "published"]);

// Channel display order.
const CHANNEL_ORDER: CalendarChannel[] = ["blog", "email", "linkedin", "facebook"];

export type CampaignAsset = {
  id: string;
  title: string;
  channel: CalendarChannel;
  status: CalendarStatus;
  publishDate: string | null;
  broadcastId: string | null;
  broadcastStatus: string | null;
  imageUrl: string | null;
};

export type MarketingCampaignRow = {
  id: string;
  name: string;
  objective: string | null;
  seoGeoMd: string | null;
  status: MarketingCampaignStatus;
  brandId: string | null;
  brandName: string | null;
  pillarId: string | null;
  pillarName: string | null;
  startsOn: string | null;
  endsOn: string | null;
  createdAt: string;
  assetCount: number;
  builtCount: number;
  channels: CalendarChannel[];
};

type DbCampaign = {
  id: string;
  name: string;
  objective: string | null;
  seo_geo_md: string | null;
  status: string;
  brand_id: string | null;
  pillar_id: string | null;
  starts_on: string | null;
  ends_on: string | null;
  created_at: string;
  brands: { name: string } | { name: string }[] | null;
  marketing_pillars: { name: string } | { name: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

const CAMPAIGN_SELECT =
  "id, name, objective, seo_geo_md, status, brand_id, pillar_id, starts_on, ends_on, created_at, brands(name), marketing_pillars(name)";

type AssetAgg = { count: number; built: number; channels: Set<string> };

function aggregate(assets: { campaign_id: string | null; channel: string; status: string }[]): Map<string, AssetAgg> {
  const byCampaign = new Map<string, AssetAgg>();
  for (const a of assets) {
    if (!a.campaign_id) continue;
    const acc = byCampaign.get(a.campaign_id) ?? { count: 0, built: 0, channels: new Set<string>() };
    acc.count += 1;
    if (BUILT_STATUSES.has(a.status as CalendarStatus)) acc.built += 1;
    acc.channels.add(a.channel);
    byCampaign.set(a.campaign_id, acc);
  }
  return byCampaign;
}

function mapCampaign(c: DbCampaign, agg: AssetAgg | undefined): MarketingCampaignRow {
  const channels = agg ? CHANNEL_ORDER.filter((ch) => agg.channels.has(ch)) : [];
  return {
    id: c.id,
    name: c.name,
    objective: c.objective,
    seoGeoMd: c.seo_geo_md,
    status: c.status as MarketingCampaignStatus,
    brandId: c.brand_id,
    brandName: one(c.brands)?.name ?? null,
    pillarId: c.pillar_id,
    pillarName: one(c.marketing_pillars)?.name ?? null,
    startsOn: c.starts_on,
    endsOn: c.ends_on,
    createdAt: c.created_at,
    assetCount: agg?.count ?? 0,
    builtCount: agg?.built ?? 0,
    channels,
  };
}

export async function listCampaigns(): Promise<{ rows: MarketingCampaignRow[]; error?: string }> {
  const { data, error } = await companyOs
    .from("marketing_campaigns")
    .select(CAMPAIGN_SELECT)
    .order("created_at", { ascending: false });
  if (error) return { rows: [], error: error.message };

  const { data: assetData } = await companyOs
    .from("marketing_calendar")
    .select("campaign_id, channel, status")
    .not("campaign_id", "is", null);
  const agg = aggregate((assetData ?? []) as { campaign_id: string | null; channel: string; status: string }[]);

  const rows = ((data ?? []) as DbCampaign[]).map((c) => mapCampaign(c, agg.get(c.id)));
  return { rows };
}

export async function getCampaign(id: string): Promise<MarketingCampaignRow | null> {
  const { data, error } = await companyOs
    .from("marketing_campaigns")
    .select(CAMPAIGN_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;

  const { data: assetData } = await companyOs
    .from("marketing_calendar")
    .select("campaign_id, channel, status")
    .eq("campaign_id", id);
  const agg = aggregate((assetData ?? []) as { campaign_id: string | null; channel: string; status: string }[]);
  return mapCampaign(data as DbCampaign, agg.get(id));
}

const ASSET_SELECT =
  "id, title, channel, status, publish_date, broadcast_id, image_url, email_campaigns!broadcast_id(status)";

export async function listCampaignAssets(campaignId: string): Promise<CampaignAsset[]> {
  const { data } = await companyOs
    .from("marketing_calendar")
    .select(ASSET_SELECT)
    .eq("campaign_id", campaignId)
    .order("publish_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    title: string;
    channel: string;
    status: string;
    publish_date: string | null;
    broadcast_id: string | null;
    image_url: string | null;
    email_campaigns: { status: string } | { status: string }[] | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    title: r.title,
    channel: r.channel as CalendarChannel,
    status: r.status as CalendarStatus,
    publishDate: r.publish_date,
    broadcastId: r.broadcast_id,
    broadcastStatus: one(r.email_campaigns)?.status ?? null,
    imageUrl: r.image_url,
  }));
}
