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

// Mirrors the admin Clients list (app/admin/(dashboard)/revenue/clients): the
// default set is active clients — lifecycle customer/evangelist, archived
// excluded. `showInactive` drops the lifecycle filter to reveal every
// non-archived company (leads, prospects, churned) so you can assume any of
// them. "View as" still needs a linked contact; startAssumeSession enforces it.
const CLIENT_STAGES = ["customer", "evangelist"];

export async function listAssumableClients(showInactive = false): Promise<AssumableClient[]> {
  let q = companyOs
    .from("companies")
    .select("id, name, person_companies(is_primary, people(full_name, email))")
    .is("archived_at", null)
    .order("name", { ascending: true });
  if (!showInactive) q = q.in("lifecycle_stage", CLIENT_STAGES);
  const { data } = await q;

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
