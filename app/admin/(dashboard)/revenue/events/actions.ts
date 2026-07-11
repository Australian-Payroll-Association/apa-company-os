"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { qrPngDataUrl } from "@/lib/qr";
import { getSiteOrigin } from "@/lib/site-origin";
import {
  eventPath,
  slugify,
  EVENT_TYPES,
  EVENT_STATUSES,
  EVENT_VISIBILITIES,
  type EventType,
  type EventStatus,
  type EventVisibility,
} from "@/lib/events";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/revenue/events");
}

// ─── Create ──────────────────────────────────────────────────────────────────
// Events are born as drafts: review (and add tiers) before flipping to Open.
// Slug = slugified title + start date, deduped with a numeric suffix — it
// drives the public URL and QR, so it never changes after creation.

export type CreateEventInput = {
  title: string;
  type: EventType;
  visibility?: EventVisibility;
  location?: string | null;
  starts_at?: string | null; // YYYY-MM-DD
  ends_at?: string | null;
  capacity?: number | null;
  blurb?: string | null;
};

export async function createEvent(input: CreateEventInput): Promise<Result & { id?: string }> {
  const admin = await requireAdmin();

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Title is required." };
  if (!EVENT_TYPES.includes(input.type)) return { ok: false, error: "Invalid event type." };
  const visibility = input.visibility ?? "public";
  if (!EVENT_VISIBILITIES.includes(visibility)) return { ok: false, error: "Invalid visibility." };
  for (const [label, v] of [
    ["Start date", input.starts_at],
    ["End date", input.ends_at],
  ] as const) {
    if (v && !DATE_RE.test(v)) return { ok: false, error: `${label} must be YYYY-MM-DD.` };
  }
  if (input.starts_at && input.ends_at && input.ends_at < input.starts_at) {
    return { ok: false, error: "End date must be on or after the start date." };
  }
  if (input.capacity != null && (!Number.isFinite(input.capacity) || input.capacity < 0)) {
    return { ok: false, error: "Capacity must be a non-negative number, or blank for uncapped." };
  }

  const base = slugify(input.starts_at ? `${title}-${input.starts_at}` : title);
  if (!base) return { ok: false, error: "Title must contain at least one letter or number." };

  // Dedupe against existing slugs (base, base-2, base-3, ...).
  const { data: taken, error: slugErr } = await companyOs
    .from("events")
    .select("slug")
    .like("slug", `${base}%`);
  if (slugErr) return { ok: false, error: slugErr.message };
  const takenSet = new Set((taken ?? []).map((r) => r.slug));
  let slug = base;
  for (let n = 2; takenSet.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await companyOs
    .from("events")
    .insert({
      slug,
      type: input.type,
      status: "draft",
      visibility,
      title,
      location: input.location?.trim() || null,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
      capacity: input.capacity ?? null,
      blurb: input.blurb?.trim() || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "events",
    recordId: data.id,
    operation: "insert",
    actor: admin.email,
    newData: { slug, type: input.type, title },
    context: { via: "events_new" },
  });
  refresh();
  return { ok: true, id: data.id };
}

// ─── Tiers ───────────────────────────────────────────────────────────────────
// A tier is a company_os.products row (type='event') hanging off the event.
// Price is immutable once people can buy (change = deactivate + add a new
// tier), so the only edit here is the active toggle.

export type AddTierInput = {
  title: string;
  amountUsd: number; // whole dollars from the form; 0 = free
  capacity?: number | null;
  description?: string | null;
};

export async function addEventTier(eventId: string, input: AddTierInput): Promise<Result> {
  const admin = await requireAdmin();

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "Tier name is required." };
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < 0) {
    return { ok: false, error: "Price must be 0 (free) or a positive amount." };
  }
  if (input.capacity != null && (!Number.isFinite(input.capacity) || input.capacity < 1)) {
    return { ok: false, error: "Tier capacity must be at least 1, or blank for uncapped." };
  }
  const amountCents = Math.round(input.amountUsd * 100);

  const { data: event, error: evErr } = await companyOs
    .from("events")
    .select("slug")
    .eq("id", eventId)
    .maybeSingle();
  if (evErr) return { ok: false, error: evErr.message };
  if (!event) return { ok: false, error: "Event not found." };

  const { count } = await companyOs
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);

  // products.slug is globally unique; namespace under the event's slug.
  const base = `${event.slug}-${slugify(title)}`;
  const { data: taken, error: slugErr } = await companyOs
    .from("products")
    .select("slug")
    .like("slug", `${base}%`);
  if (slugErr) return { ok: false, error: slugErr.message };
  const takenSet = new Set((taken ?? []).map((r) => r.slug));
  let slug = base;
  for (let n = 2; takenSet.has(slug); n++) slug = `${base}-${n}`;

  const { data, error } = await companyOs
    .from("products")
    .insert({
      type: "event",
      event_id: eventId,
      slug,
      title,
      tier: slugify(title).replace(/-/g, "_"),
      description: input.description?.trim() || null,
      amount_cents: amountCents,
      currency: "usd",
      capacity: input.capacity ?? null,
      sort_order: count ?? 0,
      active: true,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "products",
    recordId: data.id,
    operation: "insert",
    actor: admin.email,
    newData: { event_id: eventId, title, amount_cents: amountCents },
    context: { via: "events_shelf_add_tier" },
  });
  refresh();
  return { ok: true };
}

export async function setTierActive(eventId: string, tierId: string, active: boolean): Promise<Result> {
  const admin = await requireAdmin();
  const { data, error } = await companyOs
    .from("products")
    .update({ active })
    .eq("id", tierId)
    .eq("event_id", eventId)
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Tier not found." };

  await recordAudit({
    table: "products",
    recordId: tierId,
    operation: "update",
    actor: admin.email,
    newData: { active },
    context: { event_id: eventId, via: "events_shelf_tier_toggle" },
  });
  refresh();
  return { ok: true };
}

// ─── Edit ────────────────────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type EventPatch = {
  title?: string;
  type?: EventType;
  status?: EventStatus;
  visibility?: EventVisibility;
  location?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  capacity?: number | null;
  landing_path?: string | null;
  notes?: string | null;
};

export async function updateEvent(eventId: string, patch: EventPatch): Promise<Result> {
  const admin = await requireAdmin();
  const updates: Record<string, unknown> = {};

  if (patch.title !== undefined) {
    if (!patch.title.trim()) return { ok: false, error: "Title is required." };
    updates.title = patch.title.trim();
  }
  if (patch.type !== undefined) {
    if (!EVENT_TYPES.includes(patch.type)) return { ok: false, error: "Invalid event type." };
    updates.type = patch.type;
  }
  if (patch.status !== undefined) {
    if (!EVENT_STATUSES.includes(patch.status)) return { ok: false, error: "Invalid status." };
    updates.status = patch.status;
  }
  if (patch.visibility !== undefined) {
    if (!EVENT_VISIBILITIES.includes(patch.visibility)) return { ok: false, error: "Invalid visibility." };
    updates.visibility = patch.visibility;
  }
  if (patch.location !== undefined) updates.location = patch.location?.trim() || null;
  if (patch.starts_at !== undefined) {
    if (patch.starts_at !== null && !DATE_RE.test(patch.starts_at)) return { ok: false, error: "Start date must be YYYY-MM-DD." };
    updates.starts_at = patch.starts_at;
  }
  if (patch.ends_at !== undefined) {
    if (patch.ends_at !== null && !DATE_RE.test(patch.ends_at)) return { ok: false, error: "End date must be YYYY-MM-DD." };
    updates.ends_at = patch.ends_at;
  }
  if (
    typeof updates.starts_at === "string" &&
    typeof updates.ends_at === "string" &&
    updates.ends_at < updates.starts_at
  ) {
    return { ok: false, error: "End date must be on or after the start date." };
  }
  if (patch.capacity !== undefined) {
    if (patch.capacity !== null && (!Number.isFinite(patch.capacity) || patch.capacity < 0)) {
      return { ok: false, error: "Capacity must be a non-negative number, or blank for uncapped." };
    }
    updates.capacity = patch.capacity;
  }
  if (patch.landing_path !== undefined) updates.landing_path = patch.landing_path?.trim() || null;
  if (patch.notes !== undefined) updates.notes = patch.notes?.trim() || null;

  if (Object.keys(updates).length === 0) return { ok: true };

  const { data, error } = await companyOs.from("events").update(updates).eq("id", eventId).select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Event not found." };

  await recordAudit({
    table: "events",
    recordId: eventId,
    operation: "update",
    actor: admin.email,
    newData: updates,
    context: { via: "events_shelf" },
  });
  refresh();
  return { ok: true };
}

// ─── Archive / restore ──────────────────────────────────────────────────────
// Reversible (archived_at), not a hard delete: event_id on products/
// event_registrations is ON DELETE SET NULL, so a real delete would silently
// orphan tiers and the roster. Blocked while any registration references the
// event — cancel/close it instead, so the sales history stays discoverable.

export async function archiveEvent(eventId: string): Promise<Result> {
  const admin = await requireAdmin();

  const { count, error: cErr } = await companyOs
    .from("event_registrations")
    .select("id", { count: "exact", head: true })
    .eq("event_id", eventId);
  if (cErr) return { ok: false, error: cErr.message };
  if ((count ?? 0) > 0) {
    return {
      ok: false,
      error: `This event has ${count} registration${count === 1 ? "" : "s"} — set status to Cancelled or Closed instead of archiving, so the sales history stays intact.`,
    };
  }

  const { error } = await companyOs
    .from("events")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", eventId)
    .is("archived_at", null);
  if (error) return { ok: false, error: error.message };

  await recordAudit({ table: "events", recordId: eventId, operation: "archive", actor: admin.email });
  refresh();
  return { ok: true };
}

export async function restoreEvent(eventId: string): Promise<Result> {
  const admin = await requireAdmin();
  const { error } = await companyOs.from("events").update({ archived_at: null }).eq("id", eventId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({ table: "events", recordId: eventId, operation: "restore", actor: admin.email });
  refresh();
  return { ok: true };
}

// ─── Signup QR ───────────────────────────────────────────────────────────────
// The public /events/[slug] signup page ships in PR 4; the link/QR is exposed
// here now so the admin habit ("every event has a shareable signup QR") is in
// place from day one. Until PR 4 ships, the URL resolves to a 404 — that's
// fine to hand out ahead of launch (same "deploy before migrate" posture as
// the RPC), and it means nothing changes here when PR 4 lands.

export async function getEventSignupQr(slug: string): Promise<{ ok: true; url: string; png: string } | { ok: false; error: string }> {
  await requireAdmin();
  try {
    const url = `${getSiteOrigin()}${eventPath(slug)}`;
    const png = await qrPngDataUrl(url);
    return { ok: true, url, png };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to generate QR." };
  }
}
