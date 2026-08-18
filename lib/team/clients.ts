// A team member's assigned clients and their (read-only) roadmaps. Scope source:
// company_os.staff_assignments — the active rows for THIS actor's team_member id
// are the only companies they may see here. Every roadmap read is filtered to
// that set, resolved server-side from the actor, never from a passed id. In the
// spirit of lib/team/data.ts: a purpose-built, equally-scoped helper.

import { companyOs } from "@/lib/supabase";
import type { TeamActor } from "@/lib/team-auth";
import {
  listDocumentsForCompanies,
  getDocumentRow,
  signedDownloadForPath,
  createSignedDocumentUpload,
  recordDocument,
  deleteDocumentRow,
  type ClientDocument,
  type DocResult,
} from "@/lib/client-documents";
import {
  BACKLOG_SELECT,
  ROADMAP_GROUPS_SELECT,
  effectivePriority,
  groupRank,
  type BacklogItem,
  type BacklogPriority,
  type RoadmapGroup,
} from "@/lib/client-backlog";

export type ClientCompany = { id: string; name: string; roleTitle: string | null };

const PRIORITY_RANK: Record<BacklogPriority, number> = { now: 0, next: 1, later: 2, park: 3 };

// Active roadmap groups for a set of companies, in display order.
async function groupsForCompanies(companyIds: string[]): Promise<RoadmapGroup[]> {
  if (companyIds.length === 0) return [];
  const { data } = await companyOs
    .from("client_roadmap_groups")
    .select(ROADMAP_GROUPS_SELECT)
    .in("company_id", companyIds)
    .is("archived_at", null)
    .order("sort_order", { ascending: true });
  return (data ?? []) as unknown as RoadmapGroup[];
}

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

function orderItems(items: BacklogItem[], rank: Map<string, number>): BacklogItem[] {
  return items.sort(
    (a, b) =>
      (rank.get(a.group_key) ?? 9999) - (rank.get(b.group_key) ?? 9999) ||
      (a.client_sort_order ?? a.sort_order) - (b.client_sort_order ?? b.sort_order),
  );
}

export type ClientRoadmap = {
  company: ClientCompany;
  overview: string | null;
  groups: RoadmapGroup[];
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

  const [{ data: itemRows }, groups, { data: overviewRow }] = await Promise.all([
    companyOs
      .from("client_backlog_items")
      .select(BACKLOG_SELECT)
      .eq("company_id", companyId)
      .is("archived_at", null),
    groupsForCompanies([companyId]),
    companyOs
      .from("client_roadmap_overview")
      .select("body")
      .eq("company_id", companyId)
      .maybeSingle(),
  ]);

  const items = orderItems((itemRows ?? []) as unknown as BacklogItem[], groupRank(groups));
  const overview = ((overviewRow as { body: string } | null)?.body ?? "").trim() || null;
  return { company, overview, groups, items };
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

  const [{ data }, allGroups] = await Promise.all([
    companyOs
      .from("client_backlog_items")
      .select("id, company_id, ref, title, group_key, edge8_priority, client_priority, sort_order, client_sort_order")
      .in("company_id", ids)
      .is("archived_at", null),
    groupsForCompanies(ids),
  ]);
  const rows = (data ?? []) as unknown as Array<
    Pick<BacklogItem, "id" | "company_id" | "ref" | "title" | "group_key" | "edge8_priority" | "client_priority" | "sort_order" | "client_sort_order">
  >;

  const snippets: ClientRoadmapSnippet[] = [];
  for (const company of companies) {
    const mine = rows.filter((r) => r.company_id === company.id);
    if (mine.length === 0) continue;
    const rank = groupRank(allGroups.filter((g) => g.company_id === company.id));
    const ranked = mine
      .map((r) => ({ ...r, priority: effectivePriority(r) }))
      .filter((r) => r.priority !== "park")
      .sort(
        (a, b) =>
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          (rank.get(a.group_key) ?? 9999) - (rank.get(b.group_key) ?? 9999) ||
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

// Read-only client documents for an assigned company (title, date, uploader,
// download; no writes on /team). Same authorization rule as the roadmap above:
// the company must be in the actor's active assignment set.
export async function getClientDocumentsForActor(
  actor: TeamActor,
  companyId: string,
): Promise<ClientDocument[] | null> {
  const companies = await actorCompanyIds(actor);
  if (!companies.has(companyId)) return null;
  return listDocumentsForCompanies([companyId]);
}

// The actor's email, from their own person row. uploaded_by on
// program_documents is an email everywhere; TeamActor doesn't carry one.
export async function getActorEmail(actor: TeamActor): Promise<string | null> {
  const { data } = await companyOs
    .from("people")
    .select("email")
    .eq("id", actor.personId)
    .maybeSingle();
  return (data as { email: string | null } | null)?.email ?? null;
}

// Team members may add documents to an assigned client's vault. Same
// authorization rule as reads: the company must be in the actor's active
// assignment set, resolved server-side; the ids in the input are never trusted.

export async function signedClientDocumentUploadForActor(
  actor: TeamActor,
  input: { companyId: string; filename: string },
): Promise<DocResult<{ signedUrl: string; path: string }>> {
  const companies = await actorCompanyIds(actor);
  if (!companies.has(input.companyId)) return { ok: false, error: "Not found." };
  return createSignedDocumentUpload({ companyId: input.companyId, filename: input.filename });
}

export async function recordClientDocumentForActor(
  actor: TeamActor,
  input: { companyId: string; path: string; filename: string; sizeBytes: number | null },
): Promise<DocResult> {
  const companies = await actorCompanyIds(actor);
  if (!companies.has(input.companyId)) return { ok: false, error: "Not found." };
  const email = await getActorEmail(actor);
  if (!email) return { ok: false, error: "Could not resolve your account email." };
  return recordDocument({ ...input, uploadedBy: email });
}

// Uploader-only delete, same rule as the client portal: the document must be
// in the actor's assignment scope AND carry their email as uploader.
export async function deleteOwnClientDocumentForActor(
  actor: TeamActor,
  documentId: string,
): Promise<DocResult> {
  const row = await getDocumentRow(documentId);
  if (!row) return { ok: false, error: "Not found." };
  const companies = await actorCompanyIds(actor);
  if (!companies.has(row.companyId)) return { ok: false, error: "Not found." };
  const email = await getActorEmail(actor);
  if (!email || (row.uploadedBy ?? "").toLowerCase() !== email.toLowerCase()) {
    return { ok: false, error: "You can only delete documents you uploaded." };
  }
  return deleteDocumentRow(row);
}

// Signed download for a document of an assigned company, IDOR-guarded on the
// assignment scope.
export async function signedClientDocumentDownloadForActor(
  actor: TeamActor,
  documentId: string,
): Promise<{ ok: true; url: string; filename: string } | { ok: false; error: string }> {
  const row = await getDocumentRow(documentId);
  if (!row) return { ok: false, error: "Not found." };
  const companies = await actorCompanyIds(actor);
  if (!companies.has(row.companyId)) return { ok: false, error: "Not found." };
  const r = await signedDownloadForPath(row.storagePath, row.filename);
  if (!r.ok) return r;
  return { ok: true, url: r.url, filename: row.filename };
}
