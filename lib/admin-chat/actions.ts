// Server-only. Executors for the assistant's privileged tools. Both are only
// ever called from app/api/admin/chat/route.ts AFTER the privileged admin
// clicked Approve on the exact payload in the chat UI.

import { companyOs } from "@/lib/supabase";
import { recordAudit } from "@/lib/admin/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { runApprovedWrite } from "./db";

export type ActionOutcome = {
  ok: boolean;
  // Goes back to the model as the tool_result.
  resultForModel: string;
  // One-liner for the widget's tool chip.
  chipDetail: string;
};

// Best-effort table name for the audit row; the full SQL goes in context.
function tableFromSql(sql: string): string {
  const m = /^\s*(?:insert\s+into|update)\s+(?:only\s+)?("?[\w.]+"?)/i.exec(sql);
  return (m?.[1] ?? "unknown").replace(/"/g, "").replace(/^company_os\./i, "");
}

export async function performApprovedWrite(
  input: Record<string, unknown>,
  adminEmail: string,
): Promise<ActionOutcome> {
  const sql = typeof input.sql === "string" ? input.sql : "";
  const res = await runApprovedWrite(sql);
  if (!res.ok) {
    return { ok: false, resultForModel: res.error, chipDetail: sql };
  }
  await recordAudit({
    table: tableFromSql(sql),
    operation: res.command,
    actor: adminEmail,
    context: { source: "admin_chatbot", sql },
  });
  return {
    ok: true,
    resultForModel: JSON.stringify({
      command: res.command,
      affectedRows: res.affectedRows,
      ...(res.rows.length ? { returning: res.rows } : {}),
    }),
    chipDetail: sql,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_SUBJECT_CHARS = 200;
const MAX_BODY_CHARS = 10_000;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Plain text -> minimal HTML: blank lines split paragraphs, single newlines
// become <br>. The admin approved the plain text, so no other markup is added.
function bodyToHtml(body: string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export async function performApprovedEmail(
  input: Record<string, unknown>,
  adminEmail: string,
): Promise<ActionOutcome> {
  const to = typeof input.to === "string" ? input.to.trim() : "";
  const subject = typeof input.subject === "string" ? input.subject.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";

  const fail = (error: string): ActionOutcome => ({
    ok: false,
    resultForModel: error,
    chipDetail: to,
  });
  if (!EMAIL_RE.test(to) || /[,;]/.test(to)) {
    return fail("`to` must be exactly one valid email address.");
  }
  if (!subject || subject.length > MAX_SUBJECT_CHARS) {
    return fail(`Subject is required (max ${MAX_SUBJECT_CHARS} chars).`);
  }
  if (!body || body.length > MAX_BODY_CHARS) {
    return fail(`Body is required (max ${MAX_BODY_CHARS} chars).`);
  }

  const sent = await sendTransactionalEmail({
    to,
    subject,
    html: bodyToHtml(body),
    replyTo: adminEmail,
  });
  if (!sent) {
    return fail("The email provider did not accept the send. Do not retry blindly.");
  }

  // CRM trail: log the send as an outbound interaction, attached to the person
  // if the address matches one. Best-effort — a logging failure never undoes a
  // send that already happened.
  let personId: string | null = null;
  try {
    const { data } = await companyOs
      .from("people")
      .select("id")
      .eq("email", to)
      .is("archived_at", null)
      .maybeSingle();
    personId = data?.id ?? null;
    const { error } = await companyOs.from("interactions").insert({
      kind: "email",
      subject,
      body,
      person_id: personId,
      occurred_at: new Date().toISOString(),
      metadata: { source: "admin_chatbot", to, sent_by: adminEmail },
    });
    if (error) console.error("admin-chat: interaction log failed:", error.message);
  } catch (err) {
    console.error("admin-chat: interaction log failed:", err);
  }

  return {
    ok: true,
    resultForModel: JSON.stringify({
      sent: true,
      to,
      subject,
      loggedToInteractions: true,
      matchedPersonId: personId,
    }),
    chipDetail: to,
  };
}
