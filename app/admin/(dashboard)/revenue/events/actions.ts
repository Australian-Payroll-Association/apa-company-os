"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { qrPngDataUrl } from "@/lib/qr";
import {
  eventPath,
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

// company_os has no public grants; production always resolves via the
// incoming request's Host header (matches the checkout route's origin
// derivation). PREVIEW_URL/site fallback only matters for local/CI runs
// with no request context.
function siteOrigin(): string {
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL || "https://www.edge8.ai";
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
    const url = `${siteOrigin()}${eventPath(slug)}`;
    const png = await qrPngDataUrl(url);
    return { ok: true, url, png };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to generate QR." };
  }
}
