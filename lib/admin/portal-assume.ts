import { companyOs } from "@/lib/supabase";

// Reads for the admin "Assume" feature (view the client portal as a specific
// client company). Admin surfaces only.

export type AssumableClient = {
  companyId: string;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
};

type Embedded<T> = T | T[] | null;
const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

async function distinctCompanyIds(table: string): Promise<Set<string>> {
  const { data } = await companyOs.from(table).select("company_id");
  return new Set(((data ?? []) as { company_id: string | null }[]).map((r) => r.company_id).filter((id): id is string => !!id));
}

// "Active client" = any company the client portal already has data for:
// dedicated staff, synced invoices, or an actual portal membership. Derived
// from the portal's own tables rather than a separate flag, so this list
// grows correctly as PR 5 (Projects) and real invites land, with nothing to
// keep in sync by hand.
export async function listAssumableClients(): Promise<AssumableClient[]> {
  const [staffCompanyIds, invoiceCompanyIds, memberCompanyIds] = await Promise.all([
    distinctCompanyIds("staff_assignments"),
    distinctCompanyIds("invoices"),
    distinctCompanyIds("portal_members"),
  ]);
  const companyIds = [...new Set([...staffCompanyIds, ...invoiceCompanyIds, ...memberCompanyIds])];
  if (companyIds.length === 0) return [];

  const { data } = await companyOs
    .from("companies")
    .select("id, name, person_companies(is_primary, people(full_name, email))")
    .in("id", companyIds)
    .is("archived_at", null)
    .order("name", { ascending: true });

  type Row = {
    id: string;
    name: string | null;
    person_companies: { is_primary: boolean; people: Embedded<{ full_name: string | null; email: string }> }[] | null;
  };

  return ((data ?? []) as Row[]).map((c) => {
    const links = c.person_companies ?? [];
    const best = links.find((l) => l.is_primary) ?? links[0] ?? null;
    const person = best ? one(best.people) : null;
    return {
      companyId: c.id,
      companyName: c.name || "—",
      contactName: person?.full_name ?? null,
      contactEmail: person?.email ?? null,
    };
  });
}
