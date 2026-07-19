import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { companyOs } from "@/lib/supabase";
import { sendEventTicketEmail, sendTransactionalEmail } from "@/lib/email";
import { notifyOps } from "@/lib/lark";
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

  if (session.metadata?.type === "token_pack") {
    await handleTokenPackPaid(session);
    return;
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

// Human-token pack paid: flip the purchase (guarded pending → paid, so
// redeliveries no-op), then receipts — client email, accountant email, ops
// Lark — only on the first flip.
async function handleTokenPackPaid(session: Stripe.Checkout.Session) {
  const purchaseId = session.metadata?.token_purchase_id;
  if (!purchaseId) return;

  const { data: purchase, error } = await companyOs
    .from("token_purchases")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", purchaseId)
    .eq("status", "pending")
    .select("id, packs, tokens, amount_cents, company_id, person_id")
    .maybeSingle();
  if (error) {
    console.error("[stripe/webhook] token purchase update failed:", error.message);
    return;
  }
  if (!purchase) return; // redelivery — already flipped

  const [{ data: person }, { data: company }] = await Promise.all([
    companyOs.from("people").select("full_name, email").eq("id", purchase.person_id).maybeSingle(),
    companyOs.from("companies").select("name").eq("id", purchase.company_id).maybeSingle(),
  ]);

  const amountLabel = `$${(purchase.amount_cents / 100).toLocaleString()}`;
  const toEmail = session.customer_email || person?.email;
  if (toEmail) {
    const name = person?.full_name?.split(" ")[0] || "there";
    await sendTransactionalEmail({
      to: toEmail,
      subject: `Your Edge8 human tokens: ${purchase.tokens} hours`,
      html: `
        <p>Hi ${name},</p>
        <p>Thanks — your payment of <strong>${amountLabel}</strong> for ${purchase.packs} ${
          purchase.packs === 1 ? "pack" : "packs"
        } (<strong>${purchase.tokens} human tokens</strong>, 1 token = 1 hour of skilled work) is confirmed.</p>
        <p>Your balance is live in your portal: ${getSiteOrigin()}/portal/tokens</p>
        <p style="margin-top:24px;">Reply to this email any time to put them to work.</p>
        <p>Dave and the Edge8 team</p>
      `.trim(),
      replyTo: "dave@edge8.co",
    });
  }
  if (process.env.ACCOUNTING_EMAIL) {
    await sendTransactionalEmail({
      to: process.env.ACCOUNTING_EMAIL,
      subject: `Token pack purchase: ${company?.name ?? "client"} — ${amountLabel}`,
      html: `<p>${company?.name ?? "A client"} bought ${purchase.packs} human-token ${
        purchase.packs === 1 ? "pack" : "packs"
      } (${purchase.tokens} tokens) for ${amountLabel} via Stripe. Paid by ${toEmail ?? "unknown"}.</p>`,
      replyTo: "dave@edge8.co",
    });
  }
  await notifyOps(
    `🪙 Token packs purchased: ${company?.name ?? "client"} — ${purchase.packs} ${
      purchase.packs === 1 ? "pack" : "packs"
    } / ${purchase.tokens} tokens, ${amountLabel}.`,
  );
}

async function handleFailed(session: Stripe.Checkout.Session) {
  const { error: orderErr } = await companyOs
    .from("orders")
    .update({ status: "expired" })
    .eq("stripe_session_id", session.id)
    .eq("status", "pending");
  if (orderErr) console.error("[stripe/webhook] order expire failed:", orderErr.message);

  if (session.metadata?.type === "token_pack") {
    const purchaseId = session.metadata.token_purchase_id;
    if (purchaseId) {
      const { error } = await companyOs
        .from("token_purchases")
        .update({ status: "expired" })
        .eq("id", purchaseId)
        .eq("status", "pending");
      if (error) console.error("[stripe/webhook] token purchase expire failed:", error.message);
    }
    return;
  }

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
