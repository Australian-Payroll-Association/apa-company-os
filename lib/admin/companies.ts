import { companyOs } from "@/lib/supabase";

// Company detail aggregator: the account record plus its linked deals and
// people. Related reads are tolerant (a denied/empty table yields []).

export type Company = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  industry_normalized: string | null;
  size_band: string | null;
  country: string | null;
  website: string | null;
  priority: string | null;
  lifecycle_stage: string;
  notes: string | null;
  billing_address: string | null;
  archived_at: string | null;
  archived_by: string | null;
  created_at: string;
  updated_at: string | null;
};

export type Company360 = {
  company: Company;
  deals: Array<{ id: string; title: string | null; amount_cents: number | null; amount_usd_cents: number | null; currency: string | null; status: string | null; created_at: string }>;
  people: Array<{ id: string; full_name: string | null; email: string; affiliateActive: boolean; affiliateCode: string | null }>;
};

type Embedded<T> = T | T[] | null;
const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

async function safe<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const { data } = await p;
  return data ?? [];
}

export async function getCompany360(id: string): Promise<Company360 | null> {
  const res = await companyOs.from("companies").select("*").eq("id", id).maybeSingle();
  if (res.error || !res.data) return null;
  const company = res.data as Company;

  const [deals, links] = await Promise.all([
    safe(
      companyOs
        .from("deals")
        .select("id, title, amount_cents, amount_usd_cents, currency, status, created_at")
        .eq("company_id", id)
        .order("created_at", { ascending: false }),
    ),
    safe(
      companyOs
        .from("person_companies")
        .select("people(id, full_name, email)")
        .eq("company_id", id),
    ),
  ]);

  type LinkedPerson = { id: string; full_name: string | null; email: string };
  const linkedPeople = (links as Array<{ people: Embedded<LinkedPerson> }>)
    .map((l) => one(l.people))
    .filter((p): p is LinkedPerson => !!p);

  // Affiliate status per contact, so the shelf can activate/deactivate them.
  const personIds = linkedPeople.map((p) => p.id);
  const affiliates = personIds.length
    ? await safe(
        companyOs.from("affiliates").select("person_id, code, active").in("person_id", personIds),
      )
    : [];
  const affByPerson = new Map<string, { code: string; active: boolean }[]>();
  for (const a of affiliates as Array<{ person_id: string; code: string; active: boolean | null }>) {
    const list = affByPerson.get(a.person_id) ?? [];
    list.push({ code: a.code, active: !!a.active });
    affByPerson.set(a.person_id, list);
  }

  const people = linkedPeople.map((p) => {
    const codes = affByPerson.get(p.id) ?? [];
    const activeCode = codes.find((c) => c.active);
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      affiliateActive: !!activeCode,
      affiliateCode: activeCode?.code ?? codes[0]?.code ?? null,
    };
  });

  return {
    company,
    deals: deals as Company360["deals"],
    people,
  };
}
