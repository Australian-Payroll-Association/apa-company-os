import { companyOs } from "@/lib/supabase";
import {
  STAGE_LEAD,
  STAGE_NEUTRAL,
  STAGE_PROPOSAL,
  STAGE_CONTRACT,
  STAGE_WON,
  STAGE_LOST,
} from "@/lib/admin/stageColors";

// Marketing calendar reads. The page is tiny (one team's content plan), so this
// lists every entry and the views filter client-side — no paging needed.

export type CalendarChannel = "blog" | "email" | "linkedin" | "facebook";
export type CalendarStatus =
  | "idea"
  | "drafted"
  | "approved"
  | "scheduled"
  | "published"
  | "skipped";

// Board columns, in flow order. Accents mirror the pipeline palette
// (stageColors) since the kanban consumes them as inline-style strings.
export const STATUSES: { id: CalendarStatus; label: string; accent: string }[] = [
  { id: "idea", label: "Idea", accent: STAGE_NEUTRAL },
  { id: "drafted", label: "Drafted", accent: STAGE_LEAD },
  { id: "approved", label: "Approved", accent: STAGE_PROPOSAL },
  { id: "scheduled", label: "Scheduled", accent: STAGE_CONTRACT },
  { id: "published", label: "Published", accent: STAGE_WON },
  { id: "skipped", label: "Skipped", accent: STAGE_LOST },
];

// Channel accents are the platform's own identity color, used only as a chip
// tint so a month grid is scannable by channel. Raw hex mirrors stageColors.
export const CHANNELS: { id: CalendarChannel; label: string; accent: string }[] = [
  { id: "blog", label: "Blog", accent: "#6b7194" },
  { id: "email", label: "Email", accent: "var(--admin-accent)" },
  { id: "linkedin", label: "LinkedIn", accent: "#0a66c2" },
  { id: "facebook", label: "Facebook", accent: "#1877f2" },
];

export const STATUS_LABEL: Record<CalendarStatus, string> = Object.fromEntries(
  STATUSES.map((s) => [s.id, s.label]),
) as Record<CalendarStatus, string>;
export const CHANNEL_LABEL: Record<CalendarChannel, string> = Object.fromEntries(
  CHANNELS.map((c) => [c.id, c.label]),
) as Record<CalendarChannel, string>;
export const CHANNEL_ACCENT: Record<CalendarChannel, string> = Object.fromEntries(
  CHANNELS.map((c) => [c.id, c.accent]),
) as Record<CalendarChannel, string>;

export type BrandOption = { id: string; name: string; slug: string };
export type PillarOption = { id: string; brandId: string; name: string };

export type CalendarEntryRow = {
  id: string;
  title: string;
  brandId: string | null;
  brandName: string | null;
  pillarId: string | null;
  pillarName: string | null;
  channel: CalendarChannel;
  status: CalendarStatus;
  publishDate: string | null; // YYYY-MM-DD
  parentId: string | null;
  campaignId: string | null;
  campaignStatus: string | null;
  copyMd: string | null;
  assetUrl: string | null;
  notes: string | null;
  sortOrder: number;
  createdAt: string;
};

type DbEntry = {
  id: string;
  title: string;
  brand_id: string | null;
  pillar_id: string | null;
  channel: string;
  status: string;
  publish_date: string | null;
  parent_id: string | null;
  campaign_id: string | null;
  copy_md: string | null;
  asset_url: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  brands: { name: string } | { name: string }[] | null;
  marketing_pillars: { name: string } | { name: string }[] | null;
  email_campaigns: { status: string } | { status: string }[] | null;
};

const ENTRY_SELECT =
  "id, title, brand_id, pillar_id, channel, status, publish_date, parent_id, campaign_id, copy_md, asset_url, notes, sort_order, created_at, brands(name), marketing_pillars(name), email_campaigns(status)";

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}

function mapEntry(row: DbEntry): CalendarEntryRow {
  const brand = one(row.brands);
  const pillar = one(row.marketing_pillars);
  const campaign = one(row.email_campaigns);
  return {
    id: row.id,
    title: row.title,
    brandId: row.brand_id,
    brandName: brand?.name ?? null,
    pillarId: row.pillar_id,
    pillarName: pillar?.name ?? null,
    channel: row.channel as CalendarChannel,
    status: row.status as CalendarStatus,
    publishDate: row.publish_date,
    parentId: row.parent_id,
    campaignId: row.campaign_id,
    campaignStatus: campaign?.status ?? null,
    copyMd: row.copy_md,
    assetUrl: row.asset_url,
    notes: row.notes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export async function listEntries(): Promise<{ rows: CalendarEntryRow[]; error?: string }> {
  const { data, error } = await companyOs
    .from("marketing_calendar")
    .select(ENTRY_SELECT)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return { rows: [], error: error.message };
  return { rows: ((data ?? []) as unknown as DbEntry[]).map(mapEntry) };
}

export async function listBrands(): Promise<BrandOption[]> {
  const { data } = await companyOs
    .from("brands")
    .select("id, name, slug")
    .eq("active", true)
    .order("name", { ascending: true });
  return (data ?? []) as BrandOption[];
}

export async function listPillars(): Promise<PillarOption[]> {
  const { data } = await companyOs
    .from("marketing_pillars")
    .select("id, brand_id, name")
    .eq("active", true)
    .order("name", { ascending: true });
  return ((data ?? []) as { id: string; brand_id: string; name: string }[]).map((p) => ({
    id: p.id,
    brandId: p.brand_id,
    name: p.name,
  }));
}
