import { sendTransactionalEmail } from "@/lib/email";
import { notifyOps } from "@/lib/lark";

// Notification on client submission — mirrors lib/contractor-notify.ts: email
// is the primary channel (skipped gracefully if no consultant is assigned or
// RESEND_API_KEY is unset), the ops ping is best-effort and never blocks.

export async function notifyConsultantOfSubmission(opts: {
  engagementId: string;
  clientName: string;
  consultantEmail: string | null;
  consultantName: string | null;
  // Per-engagement sender/notify address (discovery_engagements.consultant_email)
  // — a second, possibly different recipient from the linked consultant person,
  // typed at creation. Deduped against consultantEmail below.
  extraNotifyEmail: string | null;
  reviewUrl: string;
}): Promise<void> {
  await notifyOps(
    `📋 Payroll 360 discovery submitted: ${opts.clientName}. Review: ${opts.reviewUrl}`,
  );

  const recipients = Array.from(
    new Set([opts.consultantEmail, opts.extraNotifyEmail].filter((e): e is string => !!e?.trim())),
  );
  if (!recipients.length) return;
  const first = opts.consultantName?.trim().split(" ")[0] || "there";
  const html = `
    <p>Hi ${first},</p>
    <p><strong>${opts.clientName}</strong> has completed and submitted their 360 Payroll Review discovery questionnaire.</p>
    <p style="margin:20px 0;"><a href="${opts.reviewUrl}" style="display:inline-block;background:#04102D;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Review submission</a></p>
    <p style="font-size:13px;color:#64748b;">Or copy this link: ${opts.reviewUrl}</p>
  `.trim();
  await sendTransactionalEmail({
    to: recipients,
    subject: `Discovery submitted: ${opts.clientName}`,
    html,
    logMeta: { source: "discovery_submission", engagement_id: opts.engagementId },
  });
}

// The client-facing invite — sent once at creation and available to resend
// from the detail page. `senderEmail` is the per-engagement consultant_email:
// used as both the From override and the reply-to, so the client's reply
// lands in the consultant's own inbox rather than a shared notifications
// address. sendTransactionalEmail's `from` override only actually delivers
// once that address's domain is verified in Resend — until austpayroll.com.au
// is, this will fail and fall back to being logged as a failed send; callers
// should surface that to the admin rather than assume the client got it.
export async function sendClientInvite(opts: {
  engagementId: string;
  clientName: string;
  clientEmail: string;
  contactName: string | null;
  senderEmail: string | null;
  discoveryUrl: string;
}): Promise<boolean> {
  const greeting = opts.contactName?.trim().split(" ")[0] || "there";
  const html = `
    <p>Hi ${greeting},</p>
    <p>Ahead of your 360 Payroll Review, we'd like you to complete a short discovery questionnaire covering your current systems, processes, and team — it shapes the workshop and the review itself.</p>
    <p style="margin:20px 0;"><a href="${opts.discoveryUrl}" style="display:inline-block;background:#04102D;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Start the questionnaire</a></p>
    <p style="font-size:13px;color:#64748b;">Or copy this link: ${opts.discoveryUrl}</p>
    <p>You can save your progress and come back to it — nothing is final until you submit.</p>
  `.trim();
  return sendTransactionalEmail({
    to: opts.clientEmail,
    subject: `${opts.clientName} — 360 Payroll Review discovery questionnaire`,
    html,
    from: opts.senderEmail || undefined,
    replyTo: opts.senderEmail || undefined,
    logMeta: { source: "discovery_invite", engagement_id: opts.engagementId },
  });
}
