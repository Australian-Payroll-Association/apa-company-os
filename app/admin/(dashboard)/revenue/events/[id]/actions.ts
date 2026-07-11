"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { getOrCreatePerson } from "@/lib/company-os";
import { newTicketCode } from "@/lib/events-server";
import { SEAT_HOLDING_STATUSES } from "@/lib/events";

type Result = { ok: true; warning?: string } | { ok: false; error: string };

function refresh(eventId: string) {
  revalidatePath(`/admin/revenue/events/${eventId}`);
}

// ─── Manual add ──────────────────────────────────────────────────────────────
// Distinct from the public register_for_event RPC (PR 1): that RPC only
// accepts events with status='open' and auto-waitlists when full, because
// it's built for real public signups. Admin manual-add needs to work on any
// event status (backfilling a past attendee, logging a walk-in after the
// event closed) and always registers directly — an admin adding someone on
// purpose doesn't want them silently waitlisted. If it would exceed
// capacity, the row still gets added but the result carries a warning so the
// admin can raise capacity or accept the overage knowingly.

export type ManualAddInput = {
  email: string;
  name?: string | null;
  phone?: string | null;
  productId?: string | null;
  guestCount?: number;
};

export async function addManualRegistration(eventId: string, input: ManualAddInput): Promise<Result> {
  const admin = await requireAdmin();

  const person = await getOrCreatePerson({ email: input.email, name: input.name, phone: input.phone, source: "admin_manual_add" });
  if (!person.ok) return { ok: false, error: person.error };

  const guestCount = Math.max(0, Math.trunc(input.guestCount ?? 0));

  const { data: event, error: evErr } = await companyOs.from("events").select("capacity").eq("id", eventId).maybeSingle();
  if (evErr) return { ok: false, error: evErr.message };
  if (!event) return { ok: false, error: "Event not found." };

  let warning: string | undefined;
  if (event.capacity !== null) {
    const { count, error: cErr } = await companyOs
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", SEAT_HOLDING_STATUSES);
    if (cErr) return { ok: false, error: cErr.message };
    if ((count ?? 0) + 1 + guestCount > event.capacity) {
      warning = `This exceeds the event's capacity of ${event.capacity} — added anyway since this was a manual add.`;
    }
  }

  const { data: reg, error } = await companyOs
    .from("event_registrations")
    .insert({
      event_id: eventId,
      product_id: input.productId ?? null,
      person_id: person.id,
      attendee_name: input.name?.trim() || null,
      attendee_email: input.email.trim().toLowerCase(),
      status: "registered",
      guest_count: guestCount,
      ticket_code: newTicketCode(),
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "event_registrations",
    recordId: reg.id,
    operation: "insert",
    actor: admin.email,
    newData: { event_id: eventId, person_id: person.id, guest_count: guestCount },
    context: { via: "event_roster_manual_add" },
  });
  refresh(eventId);
  return { ok: true, warning };
}

// ─── Check-in ────────────────────────────────────────────────────────────────

export async function setCheckedIn(eventId: string, registrationId: string, checkedIn: boolean): Promise<Result> {
  const admin = await requireAdmin();

  const { data: reg, error: fErr } = await companyOs
    .from("event_registrations")
    .select("status")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (fErr) return { ok: false, error: fErr.message };
  if (!reg) return { ok: false, error: "Registration not found." };
  const checkInEligible: readonly string[] = SEAT_HOLDING_STATUSES;
  if (!checkInEligible.includes(reg.status) && reg.status !== "attended") {
    return { ok: false, error: `Can't check in a ${reg.status} registration.` };
  }

  const updates = checkedIn
    ? { status: "attended", checked_in_at: new Date().toISOString() }
    : { status: "registered", checked_in_at: null };

  const { error } = await companyOs.from("event_registrations").update(updates).eq("id", registrationId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "event_registrations",
    recordId: registrationId,
    operation: "update",
    actor: admin.email,
    newData: updates,
    context: { via: "event_roster_checkin" },
  });
  refresh(eventId);
  return { ok: true };
}

// ─── Bulk no-show ────────────────────────────────────────────────────────────
// Only touches rows still sitting in registered/confirmed — never overwrites
// attended, cancelled, waitlisted, pending_payment, or already-no_show rows.

export async function markRemainingNoShow(eventId: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data, error } = await companyOs
    .from("event_registrations")
    .update({ status: "no_show" })
    .eq("event_id", eventId)
    .in("status", ["registered", "confirmed"])
    .select("id");
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "event_registrations",
    operation: "bulk_update",
    actor: admin.email,
    newData: { status: "no_show" },
    context: { event_id: eventId, registration_ids: (data ?? []).map((r) => r.id), via: "event_roster_bulk_no_show" },
  });
  refresh(eventId);
  return { ok: true };
}

// ─── Waitlist promote ────────────────────────────────────────────────────────
// Manual only — auto-promotion is out of scope for v1 (design doc §7).

export async function promoteFromWaitlist(eventId: string, registrationId: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data: reg, error: fErr } = await companyOs
    .from("event_registrations")
    .select("status")
    .eq("id", registrationId)
    .eq("event_id", eventId)
    .maybeSingle();
  if (fErr) return { ok: false, error: fErr.message };
  if (!reg) return { ok: false, error: "Registration not found." };
  if (reg.status !== "waitlisted") return { ok: false, error: "This registration isn't on the waitlist." };

  const { error } = await companyOs
    .from("event_registrations")
    .update({ status: "registered", waitlist_position: null })
    .eq("id", registrationId);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "event_registrations",
    recordId: registrationId,
    operation: "update",
    actor: admin.email,
    newData: { status: "registered", waitlist_position: null },
    context: { via: "event_roster_promote" },
  });
  refresh(eventId);
  return { ok: true };
}
