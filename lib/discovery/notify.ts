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
  reviewUrl: string;
}): Promise<void> {
  await notifyOps(
    `📋 Payroll 360 discovery submitted: ${opts.clientName}. Review: ${opts.reviewUrl}`,
  );

  if (!opts.consultantEmail) return;
  const first = opts.consultantName?.trim().split(" ")[0] || "there";
  const html = `
    <p>Hi ${first},</p>
    <p><strong>${opts.clientName}</strong> has completed and submitted their 360 Payroll Review discovery questionnaire.</p>
    <p style="margin:20px 0;"><a href="${opts.reviewUrl}" style="display:inline-block;background:#04102D;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 28px;border-radius:10px;">Review submission</a></p>
    <p style="font-size:13px;color:#64748b;">Or copy this link: ${opts.reviewUrl}</p>
  `.trim();
  await sendTransactionalEmail({
    to: opts.consultantEmail,
    subject: `Discovery submitted: ${opts.clientName}`,
    html,
    logMeta: { source: "discovery_submission", engagement_id: opts.engagementId },
  });
}
