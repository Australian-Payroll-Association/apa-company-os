import { companyOs } from "@/lib/supabase";
import { createDraftBroadcastForContent } from "@/lib/admin/broadcasts";
import { getEdition, getEditionDraft, isClearedToSend } from "@/lib/admin/newsletter";

// Phase 4 — publish.
//
// This stage does exactly one thing: hand a signed-off edition to the broadcast
// system as a DRAFT. It does not build a recipient list, does not approve, and
// does not send.
//
// That restraint is the design, not an omission. /admin already has a send
// pipeline with its own gate — approveBroadcast refuses a broadcast with no
// body or no recipient list, resolveAudience is the single place that decides
// who may receive marketing mail, and the cron worker re-checks every address
// against the live CRM immediately before sending. Reimplementing any of that
// here would create a second path to a member's inbox with different rules,
// which is the one thing a marketing system must never have.
//
// So the newsletter stops at the handover, and the operator finishes the send
// in the broadcast editor where the existing safeguards live.

export type PublishReadiness = {
  ok: boolean;
  checks: { label: string; ok: boolean; detail: string }[];
};

// A pre-flight the operator can read before handing anything over. Reports
// whether each piece of sending configuration is SET — never its value; these
// are secrets and an admin page is not where they get echoed.
export function publishReadiness(): PublishReadiness {
  const checks = [
    {
      label: "Resend API key",
      ok: Boolean(process.env.RESEND_API_KEY),
      detail: process.env.RESEND_API_KEY
        ? "Set."
        : "RESEND_API_KEY is not set, so nothing can send at all.",
    },
    {
      label: "Sender address",
      ok: Boolean(process.env.MARKETING_EMAIL_FROM),
      detail: process.env.MARKETING_EMAIL_FROM
        ? "Set."
        : "MARKETING_EMAIL_FROM is not set, so mail would go out from the fork's default, hello@edge8.ai.",
    },
    {
      label: "Postal address",
      ok: Boolean(process.env.MARKETING_POSTAL_ADDRESS),
      detail: process.env.MARKETING_POSTAL_ADDRESS
        ? "Set."
        : "MARKETING_POSTAL_ADDRESS is not set, so the footer would carry the fork's Ho Chi Minh City address. Commercial email has to state a real one.",
    },
    {
      label: "Unsubscribe signing",
      ok: Boolean(process.env.UNSUBSCRIBE_SECRET),
      detail: process.env.UNSUBSCRIBE_SECRET
        ? "Set."
        : "UNSUBSCRIBE_SECRET is not set, so no unsubscribe link or one-click header can be generated.",
    },
  ];
  return { ok: checks.every((c) => c.ok), checks };
}

export type EditionBroadcast = {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
};

// The broadcast this edition was handed to, if any. Read live rather than
// cached on the edition, so the panel always shows the broadcast's real state
// instead of what it was when the handover happened.
export async function getEditionBroadcast(
  contentId: string | null,
): Promise<EditionBroadcast | null> {
  if (!contentId) return null;
  const { data: content } = await companyOs
    .from("marketing_content")
    .select("broadcast_id")
    .eq("id", contentId)
    .maybeSingle();
  const broadcastId = (content as { broadcast_id: string | null } | null)?.broadcast_id;
  if (!broadcastId) return null;

  const { data } = await companyOs
    .from("email_campaigns")
    .select("id, name, status, scheduled_at, sent_at")
    .eq("id", broadcastId)
    .maybeSingle();
  if (!data) return null;
  const r = data as {
    id: string;
    name: string;
    status: string | null;
    scheduled_at: string | null;
    sent_at: string | null;
  };

  const { count } = await companyOs
    .from("email_campaign_recipients")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", broadcastId);

  return {
    id: r.id,
    name: r.name,
    status: r.status ?? "draft",
    scheduledAt: r.scheduled_at,
    sentAt: r.sent_at,
    recipientCount: count ?? 0,
  };
}

export type PublishResult =
  | { ok: true; broadcastId: string; message: string }
  | { ok: false; error: string };

export async function createEditionBroadcast(
  editionId: string,
  actor: string,
): Promise<PublishResult> {
  const edition = await getEdition(editionId);
  if (!edition) return { ok: false, error: "Edition not found." };

  // The gate. Both signatures, from two different people. Everything Phase 3
  // built is worth nothing if this step can be reached around it.
  if (!isClearedToSend(edition)) {
    return {
      ok: false,
      error: "This edition is not signed off. It needs two signatures, from two different people, before it can be handed to a broadcast.",
    };
  }

  const existing = await getEditionBroadcast(edition.contentId);
  if (existing) {
    return { ok: false, error: `This edition already has a broadcast (${existing.status}).` };
  }

  const draft = await getEditionDraft(edition.contentId);
  if (!draft?.bodyMd?.trim()) {
    return { ok: false, error: "There is no draft body to send." };
  }

  const { data: contentRow } = await companyOs
    .from("marketing_content")
    .select("brand_id")
    .eq("id", edition.contentId!)
    .maybeSingle();

  const broadcastId = await createDraftBroadcastForContent({
    contentId: edition.contentId!,
    name: edition.title,
    subject: draft.subject,
    preheader: draft.preheader,
    bodyMd: draft.bodyMd,
    brandId: (contentRow as { brand_id: string | null } | null)?.brand_id ?? null,
    // Deliberately null. The edition's period start is in the past by the time
    // it is signed off, and a scheduled_at in the past means the cron picks it
    // up on the next tick. The operator sets the send time in the broadcast
    // editor, with the recipient list in front of them.
    publishDate: null,
    createdBy: actor,
  });
  if (!broadcastId) return { ok: false, error: "The broadcast was not created." };

  return {
    ok: true,
    broadcastId,
    message: "Broadcast created as a draft. Build the recipient list and approve it there — nothing sends from here.",
  };
}

// Recording that the edition went out. Deliberately NOT done at handover: an
// edition marked published while its broadcast sits unapproved is a lie the
// rest of the system would then repeat. Only the broadcast actually having
// sent makes it true.
export async function markEditionPublished(
  editionId: string,
  actor: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const edition = await getEdition(editionId);
  if (!edition) return { ok: false, error: "Edition not found." };
  if (edition.status === "published") return { ok: false, error: "Already marked published." };

  const broadcast = await getEditionBroadcast(edition.contentId);
  if (!broadcast) return { ok: false, error: "This edition has no broadcast." };
  if (broadcast.status !== "sent") {
    return {
      ok: false,
      error: `That broadcast is ${broadcast.status}, not sent. An edition is published when it reaches members, not before.`,
    };
  }

  const { error } = await companyOs
    .from("newsletter_editions")
    .update({ status: "published", notes: `Published by ${actor} on ${new Date().toISOString().slice(0, 10)}` })
    .eq("id", editionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
