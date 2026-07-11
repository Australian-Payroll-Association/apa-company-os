import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { companyOs } from "@/lib/supabase";
import { sendEventTicketEmail } from "@/lib/email";
import { formatEventDates, ticketPath } from "@/lib/events";
import { getSiteOrigin } from "@/lib/site-origin";

// Stripe webhook — the payment truth this repo has been missing: until now
// orders were written as 'pending' at session-create time and never
// confirmed. Handles two shapes:
//
//  1. Event registrations (session.metadata.type === 'event_registration',
//     created by /events/[slug]): completed → order 'paid' + registration
//     pending_payment → registered + ticket email; expired/failed → seat
//     released (registration cancelled, order expired).
//  2. Everything else with a session id we stamped (saigon-private private
//     sessions, legacy flows): the order found by stripe_session_id is
//     flipped pending → paid/expired. No registration side effects.
//
// Idempotent by construction: every write is guarded by the row's current
// status, so Stripe redeliveries and out-of-order events are no-ops.
//
// Operator setup: add a webhook endpoint in the Stripe dashboard pointing at
// /api/stripe/webhook with checkout.session.completed,
// checkout.session.expired, checkout.session.async_payment_succeeded and
// checkout.session.async_payment_failed, then set STRIPE_WEBHOOK_SECRET
// (prod) / STRIPE_WEBHOOK_TEST_SECRET (dev) from the endpoint's signing
// secret.

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set — event dropped.");
    return NextResponse.json({ error: "Webhook not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("[stripe/webhook] signature verification failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      // completed with payment still processing (async methods) → wait for
      // async_payment_succeeded instead of marking paid early.
      if (event.type === "checkout.session.completed" && session.payment_status === "unpaid") break;
      await handlePaid(session);
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      await handleFailed(event.data.object as Stripe.Checkout.Session);
      break;
    }
    default:
      break; // subscribed events only; anything else is a config drift no-op
  }

  // Always 200 for verified events — a handler error must not make Stripe
  // retry forever against a permanently failing row.
  return NextResponse.json({ received: true });
}

async function handlePaid(session: Stripe.Checkout.Session) {
  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  // Order first (both shapes): pending → paid, guarded by current status.
  const { data: order, error: orderErr } = await companyOs
    .from("orders")
    // No metadata write — a jsonb update would clobber what the checkout
    // flow stored there (booking details). paid-at = updated_at on this row.
    .update({ status: "paid", stripe_payment_intent_id: paymentIntentId })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();
  if (orderErr) console.error("[stripe/webhook] order update failed:", orderErr.message);
  if (!order) {
    // Already paid (redelivery) or an order we never recorded — log and move on.
    console.warn("[stripe/webhook] no pending order for session", session.id);
  }

  if (session.metadata?.type !== "event_registration") return;
  const registrationId = session.metadata.registration_id;
  if (!registrationId) return;

  const { data: reg, error: regErr } = await companyOs
    .from("event_registrations")
    .update({ status: "registered" })
    .eq("id", registrationId)
    .eq("status", "pending_payment")
    .select("id, ticket_code, attendee_name, attendee_email, confirmation_sent_at, events(title, location, starts_at, ends_at, timezone)")
    .maybeSingle();
  if (regErr) {
    console.error("[stripe/webhook] registration update failed:", regErr.message);
    return;
  }
  if (!reg) return; // redelivery — already flipped

  const eventRow = Array.isArray(reg.events) ? reg.events[0] ?? null : reg.events;
  if (!eventRow || !reg.ticket_code || !reg.attendee_email || reg.confirmation_sent_at) return;

  const sent = await sendEventTicketEmail({
    to: reg.attendee_email,
    name: reg.attendee_name,
    eventTitle: eventRow.title,
    dateLabel: formatEventDates(eventRow.starts_at, eventRow.ends_at, eventRow.timezone),
    location: eventRow.location,
    ticketUrl: `${getSiteOrigin()}${ticketPath(reg.ticket_code)}`,
  });
  if (sent) {
    await companyOs
      .from("event_registrations")
      .update({ confirmation_sent_at: new Date().toISOString() })
      .eq("id", reg.id);
  }
}

async function handleFailed(session: Stripe.Checkout.Session) {
  const { error: orderErr } = await companyOs
    .from("orders")
    .update({ status: "expired" })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");
  if (orderErr) console.error("[stripe/webhook] order expire failed:", orderErr.message);

  if (session.metadata?.type !== "event_registration") return;
  const registrationId = session.metadata.registration_id;
  if (!registrationId) return;

  // Release the held seat: cancelled rows don't count against capacity in
  // the register_for_event RPC, so the seat frees up immediately.
  const { error: regErr } = await companyOs
    .from("event_registrations")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", registrationId)
    .eq("status", "pending_payment");
  if (regErr) console.error("[stripe/webhook] registration release failed:", regErr.message);
}
