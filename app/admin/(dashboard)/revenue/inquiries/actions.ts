"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { sendTransactionalEmail } from "@/lib/email";

type Result = { ok: true } | { ok: false; error: string };

const STATUSES = new Set(["new_lead", "contacted", "discovery", "proposal", "won", "lost", "archived"]);

export async function moveInquiryStatus(id: string, status: string): Promise<Result> {
  await requireAdmin();
  if (!STATUSES.has(status)) return { ok: false, error: "Invalid status." };
  const { error } = await companyOs.from("inquiries").update({ status }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/revenue/inquiries");
  // The cockpit's "Inquiries to triage" card only shows new_lead; archiving or
  // moving an inquiry must clear it there too, not just on the board.
  revalidatePath("/admin/revenue");
  return { ok: true };
}

export async function archiveInquiry(id: string): Promise<Result> {
  return moveInquiryStatus(id, "archived");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function replyToInquiry(input: {
  to: string | null;
  subject: string;
  body: string;
  doNotContact: boolean;
}): Promise<Result> {
  await requireAdmin();
  if (input.doNotContact) return { ok: false, error: "This contact is marked do-not-contact." };
  if (!input.to) return { ok: false, error: "No email address on file for this contact." };
  if (!input.body.trim()) return { ok: false, error: "Message is empty." };
  if (!process.env.RESEND_API_KEY) return { ok: false, error: "Email is not configured (RESEND_API_KEY)." };

  await sendTransactionalEmail({
    to: input.to,
    subject: input.subject.trim() || "Re: your inquiry",
    html: `<div>${escapeHtml(input.body).replace(/\n/g, "<br>")}</div>`,
    replyTo: process.env.ADMIN_EMAILS?.split(",")[0]?.trim(),
  });
  return { ok: true };
}
