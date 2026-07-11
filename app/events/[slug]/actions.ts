"use server";

import { companyOs } from "@/lib/supabase";
import { getOrCreatePerson } from "@/lib/company-os";
import { promotePersonToLead } from "@/lib/lifecycle";
import { registerForEvent } from "@/lib/events-server";
import { sendEventTicketEmail } from "@/lib/email";
import { getSiteOrigin } from "@/lib/site-origin";
import { formatEventDates, ticketPath } from "@/lib/events";

// Public registration for /events/[slug]. Free path only — paid tiers hand
// off to Stripe in PR 5; until then the server rejects them outright (the UI
// routes paid tiers to the event's bespoke landing page or /contact, but a
// hand-crafted POST must hit the same wall).

export type PublicRegisterInput = {
  name: string;
  email: string;
  phone?: string;
  productId?: string | null;
  guestCount?: number;
};

export type PublicRegisterResult =
  | {
      ok: true;
      status: "registered" | "waitlisted";
      alreadyRegistered: boolean;
      ticketPath: string | null;
      waitlistPosition: number | null;
    }
  | { ok: false; error: string };

const MAX_GUESTS = 4;

// The RPC raises these as exception messages; map to human copy.
const RPC_ERRORS: Record<string, string> = {
  event_not_found: "This event no longer exists.",
  event_not_open: "Registration isn't open for this event.",
  product_not_for_event: "That ticket doesn't belong to this event.",
  tier_full: "That ticket type is sold out. Pick another, or try again later.",
};

export async function registerForEventPublic(
  slug: string,
  input: PublicRegisterInput
): Promise<PublicRegisterResult> {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  if (!name) return { ok: false, error: "Your name is required." };
  if (!email || !email.includes("@")) return { ok: false, error: "A valid email is required." };
  const guestCount = Math.min(MAX_GUESTS, Math.max(0, Math.trunc(input.guestCount ?? 0)));

  const { data: event, error: evErr } = await companyOs
    .from("events")
    .select("id, slug, title, status, location, starts_at, ends_at, timezone, landing_path")
    .eq("slug", slug)
    .is("archived_at", null)
    .maybeSingle();
  if (evErr) return { ok: false, error: "Something went wrong. Please try again." };
  if (!event) return { ok: false, error: "This event no longer exists." };
  if (event.status !== "open") return { ok: false, error: "Registration isn't open for this event." };

  if (input.productId) {
    const { data: tier, error: tErr } = await companyOs
      .from("products")
      .select("id, amount_cents, active")
      .eq("id", input.productId)
      .eq("event_id", event.id)
      .maybeSingle();
    if (tErr) return { ok: false, error: "Something went wrong. Please try again." };
    if (!tier || !tier.active) return { ok: false, error: "That ticket is no longer available." };
    if (tier.amount_cents > 0) {
      return { ok: false, error: "Paid registration for this event isn't online yet. Reach out via the contact page and we'll reserve your seat." };
    }
  }

  const person = await getOrCreatePerson({ email, name, phone: input.phone || null, source: "event_signup" });
  if (!person.ok) return { ok: false, error: person.error };

  let result;
  try {
    result = await registerForEvent({
      eventId: event.id,
      personId: person.id,
      productId: input.productId ?? null,
      attendeeName: name,
      attendeeEmail: email,
      guestCount,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    return { ok: false, error: RPC_ERRORS[raw] ?? "Something went wrong. Please try again." };
  }

  // CRM: event registrants enter the lead queue (no inquiry row — inquiries
  // are contact-us only per the 2026-07-06 CRM cleanup; the registration row
  // itself is the activity record). Best-effort, never blocks the signup.
  try {
    await promotePersonToLead(person.id, { reason: "event_registration" });
  } catch (err) {
    console.error("event signup lead promotion failed:", err);
  }

  // The RPC's idempotency check can hand back an existing row in any held
  // state. pending_payment can't be created by this free path, but a row
  // from the paid flow (PR 5) must not be reported — or ticket-emailed — as
  // registered.
  if (result.status === "pending_payment") {
    return {
      ok: false,
      error: "You already have a registration awaiting payment for this event. Check your email for the payment link.",
    };
  }
  const status = result.status === "waitlisted" ? "waitlisted" : "registered";

  // Confirmation email, idempotent via confirmation_sent_at — covers both a
  // fresh registration and an already_registered repeat whose original send
  // failed or was skipped (no RESEND_API_KEY in preview).
  if (status === "registered" && result.ticket_code) {
    const { data: reg } = await companyOs
      .from("event_registrations")
      .select("confirmation_sent_at")
      .eq("id", result.registration_id)
      .maybeSingle();
    if (reg && !reg.confirmation_sent_at) {
      const sent = await sendEventTicketEmail({
        to: email,
        name,
        eventTitle: event.title,
        dateLabel: formatEventDates(event.starts_at, event.ends_at, event.timezone),
        location: event.location,
        ticketUrl: `${getSiteOrigin()}${ticketPath(result.ticket_code)}`,
      });
      if (sent) {
        await companyOs
          .from("event_registrations")
          .update({ confirmation_sent_at: new Date().toISOString() })
          .eq("id", result.registration_id);
      }
    }
  }

  return {
    ok: true,
    status,
    alreadyRegistered: result.already_registered,
    ticketPath: result.ticket_code ? ticketPath(result.ticket_code) : null,
    waitlistPosition: result.waitlist_position,
  };
}
