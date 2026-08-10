// Client-facing backlog / AI Program view. Company-scoped: a portal member sees
// their own company's backlog and can (a) set the client priority on any item and
// (b) propose new items for Edge8 to accept. Every read goes through portalRead,
// every write re-checks the item belongs to the actor's company scope before
// touching it (IDOR guard) — see lib/portal/data.ts.

import { companyOs } from "@/lib/supabase";
import type { PortalActor } from "@/lib/portal-auth";
import { portalRead, assertInScope } from "@/lib/portal/data";
import {
  BACKLOG_SELECT,
  isBacklogPriority,
  type BacklogItem,
  type BacklogGroupKey,
} from "@/lib/client-backlog";

type Result = { ok: true } | { ok: false; error: string };

export async function hasBacklog(actor: PortalActor): Promise<boolean> {
  if (actor.companyScope.length === 0) return false;
  const { data } = await portalRead(actor, "client_backlog_items", "id")
    .is("archived_at", null)
    .limit(1);
  return (data ?? []).length > 0;
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
    .order("group_key", { ascending: true })
    .order("sort_order", { ascending: true });
  return (data ?? []) as unknown as BacklogItem[];
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
