// Client-facing backlog / AI Program view. Company-scoped: a portal member sees
// their own company's backlog and can (a) set the client priority on any item and
// (b) propose new items for Edge8 to accept. Every read goes through portalRead,
// every write re-checks the item belongs to the actor's company scope before
// touching it (IDOR guard) — see lib/portal/data.ts.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { portalRead, assertInScope } from "@/lib/portal/data";
import { isPortalAdmin, canContribute, ROLE_DENIED } from "@/lib/portal/roles";
import {
  BACKLOG_GROUPS,
  BACKLOG_SELECT,
  isBacklogPriority,
  type BacklogItem,
  type BacklogGroupKey,
  type BacklogPriority,
} from "@/lib/client-backlog";

type Result = { ok: true } | { ok: false; error: string };

export async function hasBacklog(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await portalRead(actor, "client_backlog_items", "id")
    .is("archived_at", null)
    .limit(1);
  return (data ?? []).length > 0;
}

export type RoadmapPreviewItem = {
  id: string;
  ref: string | null;
  title: string;
  priority: BacklogPriority;
  groupKey: BacklogGroupKey;
};

const PRIORITY_RANK: Record<BacklogPriority, number> = { now: 0, next: 1, later: 2, park: 3 };
const GROUP_RANK: Record<string, number> = Object.fromEntries(BACKLOG_GROUPS.map((g, i) => [g, i]));

// The next few items on the roadmap for the home page: highest effective
// priority first (client choice wins over Edge8's), parked items excluded.
// Returns the top `limit` plus the total active count for "view all".
export async function getRoadmapPreviewForActor(
  actor: PortalActor,
  limit = 3,
): Promise<{ items: RoadmapPreviewItem[]; total: number }> {
  if (actor.companyScope.length === 0) return { items: [], total: 0 };
  const { data } = await portalRead(
    actor,
    "client_backlog_items",
    "id, ref, title, group_key, edge8_priority, client_priority, sort_order",
  ).is("archived_at", null);
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    ref: string | null;
    title: string;
    group_key: BacklogGroupKey;
    edge8_priority: BacklogPriority;
    client_priority: BacklogPriority | null;
    sort_order: number;
  }>;

  const ranked = rows
    .map((r) => ({ ...r, priority: r.client_priority ?? r.edge8_priority }))
    .filter((r) => r.priority !== "park")
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (GROUP_RANK[a.group_key] ?? 99) - (GROUP_RANK[b.group_key] ?? 99) ||
        a.sort_order - b.sort_order,
    );

  return {
    total: rows.length,
    items: ranked.slice(0, limit).map((r) => ({
      id: r.id,
      ref: r.ref,
      title: r.title,
      priority: r.priority,
      groupKey: r.group_key,
    })),
  };
}

// The client-facing overview shown at the top of the roadmap. Company-scoped;
// returns null when Edge8 has not written one yet.
export async function getOverviewForActor(actor: PortalActor): Promise<string | null> {
  if (actor.companyScope.length === 0) return null;
  const { data } = await portalRead(actor, "client_roadmap_overview", "company_id, body").limit(1);
  const row = (data ?? [])[0] as unknown as { body: string } | undefined;
  const body = row?.body?.trim();
  return body ? body : null;
}

export async function getBacklogForActor(actor: PortalActor): Promise<BacklogItem[]> {
  if (actor.companyScope.length === 0) return [];
  const { data } = await portalRead(actor, "client_backlog_items", BACKLOG_SELECT)
    .is("archived_at", null)
    .order("group_key", { ascending: true });
  const items = (data ?? []) as unknown as BacklogItem[];
  // Effective order within a group is the client's dragged order when set,
  // else Edge8's sort_order. Sort here since PostgREST can't coalesce in order.
  return items.sort(
    (a, b) => (a.client_sort_order ?? a.sort_order) - (b.client_sort_order ?? b.sort_order),
  );
}

// Persist the client's dragged order for one group: writes client_sort_order to
// every item id in the given order. Every id is re-checked against the actor's
// scope AND confirmed to sit in that group before any write (IDOR guard).
export async function reorderGroupForActor(
  actor: PortalActor,
  groupKey: string,
  orderedIds: string[],
): Promise<Result> {
  if (actor.companyScope.length === 0) return { ok: false, error: "No company in scope." };
  if (orderedIds.length === 0) return { ok: true };

  // Load the group's items in scope; the set must match the ids we were given.
  const { data } = await portalRead(actor, "client_backlog_items", "id, group_key, company_id")
    .eq("group_key", groupKey)
    .is("archived_at", null);
  const rows = (data ?? []) as unknown as Array<{ id: string; company_id: string }>;
  const scoped = new Set(rows.map((r) => r.id));
  if (orderedIds.length !== scoped.size || !orderedIds.every((id) => scoped.has(id))) {
    return { ok: false, error: "Item set does not match this group." };
  }
  // Reordering is an admin power, checked per owning company.
  for (const companyId of new Set(rows.map((r) => r.company_id))) {
    if (!isPortalAdmin(actor, companyId)) return { ok: false, error: ROLE_DENIED };
  }

  const now = new Date().toISOString();
  const results = await Promise.all(
    orderedIds.map((id, i) =>
      companyOs
        .from("client_backlog_items")
        .update({ client_sort_order: i * 10, updated_at: now })
        .eq("id", id),
    ),
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  return { ok: true };
}

// The client sets (or clears) their own priority on one item. Ownership is
// re-checked against the actor's company scope before writing.
export async function setClientPriorityForActor(
  actor: PortalActor,
  itemId: string,
  priority: string | null,
): Promise<Result> {
  if (priority !== null && !isBacklogPriority(priority)) {
    return { ok: false, error: "Invalid priority." };
  }
  const owner = await assertInScope(actor, "client_backlog_items", itemId);
  if (!owner) return { ok: false, error: "Item not found." };
  if (!isPortalAdmin(actor, owner)) return { ok: false, error: ROLE_DENIED };

  const { error } = await companyOs
    .from("client_backlog_items")
    .update({ client_priority: priority, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setClientNoteForActor(
  actor: PortalActor,
  itemId: string,
  note: string,
): Promise<Result> {
  const owner = await assertInScope(actor, "client_backlog_items", itemId);
  if (!owner) return { ok: false, error: "Item not found." };
  if (!isPortalAdmin(actor, owner)) return { ok: false, error: ROLE_DENIED };
  const clean = note.trim();
  const { error } = await companyOs
    .from("client_backlog_items")
    .update({ client_note: clean === "" ? null : clean, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// The client proposes a new item. Lands as source='client', status='proposed'
// in the group they picked, defaulting to their chosen priority. company_id is
// resolved from the actor's scope, never trusted from the client.
export async function proposeItemForActor(
  actor: PortalActor,
  input: { companyId: string; groupKey: BacklogGroupKey; title: string; note?: string; priority?: string },
): Promise<Result & { id?: string }> {
  if (!actor.companyScope.includes(input.companyId)) {
    return { ok: false, error: "Not your company." };
  }
  if (!canContribute(actor, input.companyId)) return { ok: false, error: ROLE_DENIED };
  const title = input.title?.trim();
  if (!title) return { ok: false, error: "A short title is required." };
  const priority = isBacklogPriority(input.priority) ? input.priority : "next";

  const { data, error } = await companyOs
    .from("client_backlog_items")
    .insert({
      company_id: input.companyId,
      group_key: input.groupKey,
      title,
      client_note: input.note?.trim() || null,
      edge8_priority: priority,
      client_priority: priority,
      source: "client",
      status: "proposed",
      sort_order: 999,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: data.id };
}
