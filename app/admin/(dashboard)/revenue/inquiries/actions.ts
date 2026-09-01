"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { sendTransactionalEmail } from "@/lib/email";
import { promotePersonToLead } from "@/lib/lifecycle";

type Result = { ok: true } | { ok: false; error: string };

// The four working stages plus the two terminal exits. 'qualified' is not
// movable here: promotion goes through promoteInquiryToLead so the person
// also lands in the SDR lead queue.
const STATUSES = new Set(["new_lead", "contacted", "no_action", "spam", "archived"]);

// Statuses that mean the Front Door made first contact (or better). The first
// time an inquiry reaches any of these, we stamp metadata.first_contacted_at —
// the clock the 24h first-call SLA (E8) measures against inquiries.created_at.
const CONTACTED_OR_LATER = new Set(["contacted", "qualified", "discovery_call", "proposal", "won"]);

function refresh() {
  revalidatePath("/admin/revenue/inquiries");
  // The cockpit's "Inquiries to triage" card only shows new_lead; archiving or
  // moving an inquiry must clear it there too, not just on the board.
  revalidatePath("/admin/revenue");
}

// Stamp the first-contact time on the inquiry the first time it reaches
// 'contacted'-or-later. Idempotent: a pre-existing stamp is never overwritten,
// so the metric always reflects the *first* contact. jsonb merge — no schema
// change. Returns the metadata to write, or null if nothing should change.
async function firstContactStamp(id: string, toStatus: string): Promise<Record<string, unknown> | null> {
  if (!CONTACTED_OR_LATER.has(toStatus)) return null;
  const { data } = await companyOs.from("inquiries").select("metadata").eq("id", id).maybeSingle();
  const meta = data?.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : {};
  if (meta.first_contacted_at) return null; // already stamped — keep the original
  return { ...meta, first_contacted_at: new Date().toISOString() };
}

export async function moveInquiryStatus(id: string, status: string): Promise<Result> {
  await requireAdmin();
  if (!STATUSES.has(status)) return { ok: false, error: "Invalid status." };
  const metadata = await firstContactStamp(id, status);
  const updates: Record<string, unknown> = metadata ? { status, metadata } : { status };
  const { error } = await companyOs.from("inquiries").update(updates).eq("id", id);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function archiveInquiry(id: string): Promise<Result> {
  return moveInquiryStatus(id, "archived");
}

export async function markInquirySpam(id: string): Promise<Result> {
  return moveInquiryStatus(id, "spam");
}

// Promote to lead: the inquiry moves to 'qualified' AND the person joins the
// SDR queue on /admin/revenue/leads via the shared lifecycle helper (upserts
// the lead satellite row with a fresh SLA, logs the transition).
export async function promoteInquiryToLead(id: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data: inquiry, error: iErr } = await companyOs
    .from("inquiries")
    .select("person_id")
    .eq("id", id)
    .maybeSingle();
  if (iErr || !inquiry) return { ok: false, error: iErr?.message ?? "Inquiry not found." };
  if (!inquiry.person_id) return { ok: false, error: "No contact attached to this inquiry." };

  const promoted = await promotePersonToLead(inquiry.person_id, {
    reason: "inquiry_promoted",
    changedBy: admin.email,
  });
  if (!promoted.ok) return promoted;

  // Promotion to 'qualified' is a contacted-or-later transition — stamp the
  // first-call clock here too (idempotent) so a promote-without-a-prior-
  // 'contacted' step still records first contact.
  const metadata = await firstContactStamp(id, "qualified");
  const updates: Record<string, unknown> = metadata
    ? { status: "qualified", metadata }
    : { status: "qualified" };
  const { error: uErr } = await companyOs
    .from("inquiries")
    .update(updates)
    .eq("id", id);
  if (uErr) return { ok: false, error: uErr.message };

  refresh();
  revalidatePath("/admin/revenue/leads");
  revalidatePath("/admin/contacts");
  return { ok: true };
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
