// A team member's assigned clients and their (read-only) roadmaps. Scope source:
// company_os.staff_assignments — the active rows for THIS actor's team_member id
// are the only companies they may see here. Every roadmap read is filtered to
// that set, resolved server-side from the actor, never from a passed id. In the
// spirit of lib/team/data.ts: a purpose-built, equally-scoped helper.

import { companyOs } from "@/lib/supabase";
import type { TeamActor } from "@/lib/team-auth";
import {
  BACKLOG_GROUPS,
  BACKLOG_SELECT,
  effectivePriority,
  type BacklogItem,
  type BacklogPriority,
} from "@/lib/client-backlog";

export type ClientCompany = { id: string; name: string; roleTitle: string | null };

const PRIORITY_RANK: Record<BacklogPriority, number> = { now: 0, next: 1, later: 2, park: 3 };
const GROUP_RANK: Record<string, number> = Object.fromEntries(BACKLOG_GROUPS.map((g, i) => [g, i]));

// The client companies this team member is actively assigned to.
export async function getActorClientCompanies(actor: TeamActor): Promise<ClientCompany[]> {
  const { data } = await companyOs
    .from("staff_assignments")
    .select("role_title, company_id, companies:companies!company_id(id, name)")
    .eq("team_member_id", actor.teamMemberId)
    .eq("status", "active");
  const rows = (data ?? []) as Array<{
    role_title: string | null;
    company_id: string;
    companies: { id: string; name: string } | { id: string; name: string }[] | null;
  }>;
  const seen = new Set<string>();
  const out: ClientCompany[] = [];
  for (const r of rows) {
    const c = Array.isArray(r.companies) ? r.companies[0] : r.companies;
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push({ id: c.id, name: c.name, roleTitle: r.role_title });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function hasClientAssignments(actor: TeamActor): Promise<boolean> {
  const { data } = await companyOs
    .from("staff_assignments")
    .select("id")
    .eq("team_member_id", actor.teamMemberId)
    .eq("status", "active")
    .limit(1);
  return (data ?? []).length > 0;
}

async function actorCompanyIds(actor: TeamActor): Promise<Set<string>> {
  return new Set((await getActorClientCompanies(actor)).map((c) => c.id));
}

function orderItems(items: BacklogItem[]): BacklogItem[] {
  return items.sort(
    (a, b) =>
      (GROUP_RANK[a.group_key] ?? 99) - (GROUP_RANK[b.group_key] ?? 99) ||
      (a.client_sort_order ?? a.sort_order) - (b.client_sort_order ?? b.sort_order),
  );
}

export type ClientRoadmap = {
  company: ClientCompany;
  overview: string | null;
  items: BacklogItem[];
};

// Full read-only roadmap for one assigned client. Returns null if the company is
// not in the actor's assignment set (authorization, not just "not found").
export async function getClientRoadmapForActor(
  actor: TeamActor,
  companyId: string,
): Promise<ClientRoadmap | null> {
  const companies = await getActorClientCompanies(actor);
  const company = companies.find((c) => c.id === companyId);
  if (!company) return null;

  const [{ data: itemRows }, { data: overviewRow }] = await Promise.all([
    companyOs
      .from("client_backlog_items")
      .select(BACKLOG_SELECT)
      .eq("company_id", companyId)
      .is("archived_at", null),
    companyOs
      .from("client_roadmap_overview")
      .select("body")
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  const items = orderItems((itemRows ?? []) as unknown as BacklogItem[]);
  const overview = ((overviewRow as { body: string } | null)?.body ?? "").trim() || null;
  return { company, overview, items };
}

export type ClientRoadmapSnippet = {
  company: ClientCompany;
  total: number;
  items: Array<{ id: string; ref: string | null; title: string; priority: BacklogPriority }>;
};

// Home-page snippets: one per assigned client that has a roadmap, each with its
// top few items (highest effective priority first, parked excluded).
export async function getClientRoadmapSnippets(
  actor: TeamActor,
  perClient = 3,
): Promise<ClientRoadmapSnippet[]> {
  const companies = await getActorClientCompanies(actor);
  if (companies.length === 0) return [];
  const ids = companies.map((c) => c.id);

  const { data } = await companyOs
    .from("client_backlog_items")
    .select("id, company_id, ref, title, group_key, edge8_priority, client_priority, sort_order, client_sort_order")
    .in("company_id", ids)
    .is("archived_at", null);
  const rows = (data ?? []) as unknown as Array<
    Pick<BacklogItem, "id" | "company_id" | "ref" | "title" | "group_key" | "edge8_priority" | "client_priority" | "sort_order" | "client_sort_order">
  >;

  const snippets: ClientRoadmapSnippet[] = [];
  for (const company of companies) {
    const mine = rows.filter((r) => r.company_id === company.id);
    if (mine.length === 0) continue;
    const ranked = mine
      .map((r) => ({ ...r, priority: effectivePriority(r) }))
      .filter((r) => r.priority !== "park")
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (GROUP_RANK[a.group_key] ?? 99) - (GROUP_RANK[b.group_key] ?? 99) ||
          (a.client_sort_order ?? a.sort_order) - (b.client_sort_order ?? b.sort_order),
      );
    snippets.push({
      company,
      total: mine.length,
      items: ranked.slice(0, perClient).map((r) => ({ id: r.id, ref: r.ref, title: r.title, priority: r.priority })),
    });
  }
  return snippets;
}
