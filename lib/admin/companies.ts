import { companyOs } from "@/lib/supabase";

// Company detail aggregator: the account record plus its linked deals and
// people. Related reads are tolerant (a denied/empty table yields []).

export type Company = {
  id: string;
  name: string | null;
  domain: string | null;
  industry: string | null;
  size_band: string | null;
  country: string | null;
  website: string | null;
  priority: string | null;
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
  people: Array<{ id: string; full_name: string | null; email: string }>;
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

  const people = (links as Array<{ people: Embedded<Company360["people"][number]> }>)
    .map((l) => one(l.people))
    .filter((p): p is Company360["people"][number] => !!p);

  return {
    company,
    deals: deals as Company360["deals"],
    people,
  };
}
