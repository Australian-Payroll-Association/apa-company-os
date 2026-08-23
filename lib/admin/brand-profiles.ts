import { companyOs } from "@/lib/supabase";

// Brand writing profiles: the voice + rules the campaign editor shows and the
// AI writer reads. One per brand; only active brands are surfaced.

export type BrandProfile = {
  brandId: string;
  brandName: string;
  positioning: string | null;
  audience: string | null;
  voiceMd: string | null;
  offer: string | null;
  primaryCta: string | null;
  contentRulesMd: string | null;
};

type DbRow = {
  id: string;
  name: string;
  brand_profiles:
    | {
        positioning: string | null;
        audience: string | null;
        voice_md: string | null;
        offer: string | null;
        primary_cta: string | null;
        content_rules_md: string | null;
      }
    | {
        positioning: string | null;
        audience: string | null;
        voice_md: string | null;
        offer: string | null;
        primary_cta: string | null;
        content_rules_md: string | null;
      }[]
    | null;
};

function map(row: DbRow): BrandProfile {
  const p = Array.isArray(row.brand_profiles) ? row.brand_profiles[0] ?? null : row.brand_profiles;
  return {
    brandId: row.id,
    brandName: row.name,
    positioning: p?.positioning ?? null,
    audience: p?.audience ?? null,
    voiceMd: p?.voice_md ?? null,
    offer: p?.offer ?? null,
    primaryCta: p?.primary_cta ?? null,
    contentRulesMd: p?.content_rules_md ?? null,
  };
}

const SELECT =
  "id, name, brand_profiles(positioning, audience, voice_md, offer, primary_cta, content_rules_md)";

// All active brands, each with its profile (which may be empty until edited).
export async function listBrandProfiles(): Promise<BrandProfile[]> {
  const { data } = await companyOs
    .from("brands")
    .select(SELECT)
    .eq("active", true)
    .order("name", { ascending: true });
  return ((data ?? []) as unknown as DbRow[]).map(map);
}

export async function getBrandProfile(brandId: string): Promise<BrandProfile | null> {
  const { data } = await companyOs
    .from("brands")
    .select(SELECT)
    .eq("id", brandId)
    .maybeSingle();
  if (!data) return null;
  return map(data as unknown as DbRow);
}
