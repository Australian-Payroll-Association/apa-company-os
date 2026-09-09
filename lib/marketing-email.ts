import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { companyOs } from "@/lib/supabase";

// The marketing send path, deliberately separate from lib/email.ts.
//
// sendTransactionalEmail() is used by auth invites, event tickets, and bank
// change alerts. Those must always send, and adding a suppression check there
// would silently break them. Marketing is the opposite: it must never send to
// someone who has not agreed, and it must carry unsubscribe headers.
//
// Two systems, two rules, no shared switch to get wrong.

const resendApiKey = process.env.RESEND_API_KEY;
const resend = resendApiKey ? new Resend(resendApiKey) : null;

const DEFAULT_FROM = process.env.MARKETING_EMAIL_FROM || "Edge8 <hello@edge8.ai>";
const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.edge8.ai").replace(/\/$/, "");

// CAN-SPAM requires a physical postal address on commercial email.
const POSTAL_ADDRESS = process.env.MARKETING_POSTAL_ADDRESS || "Edge8, Ho Chi Minh City, Vietnam";

// ------------------------------------------------------------------- tokens

// Unsubscribe links are signed rather than guessable. The token carries only the
// person id, so the URL never leaks an email address into logs, referrers, or a
// mail scanner's history.
function signingSecret(): string | null {
  return process.env.UNSUBSCRIBE_SECRET || null;
}

export function unsubscribeToken(personId: string): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const sig = createHmac("sha256", secret).update(personId).digest("base64url");
  return `${personId}.${sig}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const secret = signingSecret();
  if (!secret) return null;
  const cut = token.lastIndexOf(".");
  if (cut <= 0) return null;
  const personId = token.slice(0, cut);
  const provided = token.slice(cut + 1);
  const expected = createHmac("sha256", secret).update(personId).digest("base64url");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return personId;
}

// The human-facing confirm page, for the footer link someone clicks.
export function unsubscribeUrl(personId: string): string | null {
  const token = unsubscribeToken(personId);
  if (!token) return null;
  return `${SITE_URL}/unsubscribe/?token=${encodeURIComponent(token)}`;
}

// The endpoint for the List-Unsubscribe header. This MUST be the API route, not
// the page: Gmail and Outlook POST to this URL directly, and an App Router page
// answers GET/HEAD only, so pointing the header at /unsubscribe/ returns 405.
// The recipient sees "unsubscribe failed", stays subscribed, and presses
// "report spam" instead, which is the exact outcome the header exists to avoid.
export function unsubscribePostUrl(personId: string): string | null {
  const token = unsubscribeToken(personId);
  if (!token) return null;
  return `${SITE_URL}/api/unsubscribe/?token=${encodeURIComponent(token)}`;
}

// ----------------------------------------------------------------- rendering

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Small deliberate subset of markdown: headings, bold, italic, links, lists,
// paragraphs. Email clients are not browsers, so a full markdown renderer would
// mostly produce tags that Outlook drops. Everything is escaped first.
// APA's palette, from docs/product/restyle-apa-brand.md. Hardcoded rather than
// read per brand because the brands table carries no colours; the brand NAME is
// passed in, so a guest brand gets its own name in APA's house colours. Move
// these onto the brand record if a second brand ever needs its own palette.
const NAVY = "#465778";
const INK = "#333333";
const CANVAS = "#F5F6F9";

// A table cell that must not be broken across lines. Dates and times only: at
// 600px the training table wrapped "10:00am AEST" onto two lines and split
// date ranges over a line break, which is how a member misreads when a course
// runs. Prose cells are left to wrap — forcing those would push the table
// wider than the email and scroll it sideways instead.
function atomic(cell: string): boolean {
  const s = cell.trim();
  if (!s) return false;
  // dd/mm/yyyy, optionally an en-dash range of two of them
  if (/^\d{1,2}\/\d{1,2}\/\d{4}(\s*[–-]\s*\d{1,2}\/\d{1,2}\/\d{4})?$/.test(s)) return true;
  // 8:45am AEDT, 1.00 pm AEST, 10:00am, and the 8:45am – 4:30pm AEDT range
  const t = String.raw`\d{1,2}[:.]\d{2}\s*(?:am|pm)?`;
  if (new RegExp(`^${t}(\\s*[–-]\\s*${t})?(\\s*[A-Z]{3,4})?$`, "i").test(s)) return true;
  return false;
}

export function renderMarkdown(md: string): string {
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const heading = block.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length + 1; // "# " renders as h2, the subject is h1
      // Sizes are explicit rather than computed. The old formula bottomed out
      // at 14px for an h3, which is under the 15px body size — every section
      // heading in a real edition read as bold body text, so the reader had no
      // way to see where one section ended and the next began.
      const size = level === 2 ? 19 : level === 3 ? 17 : 15;
      out.push(
        `<h${level} style="margin:28px 0 10px;font-size:${size}px;line-height:1.3;color:${NAVY};">${inline(heading[2])}</h${level}>`,
      );
      continue;
    }

    // Markdown tables. The newsletter's training section is one, and without
    // this it reached members as a wall of pipe characters — the most visible
    // section in the edition, arriving broken.
    //
    // A table is a first line of pipe-separated cells followed by a separator
    // row of dashes. Anything else falls through to the paragraph branch, so a
    // stray pipe in prose is still just prose.
    const rows = block.split("\n").map((l) => l.trim());
    if (rows.length >= 2 && rows[0].startsWith("|") && /^\|[\s:|-]+\|$/.test(rows[1])) {
      const cells = (line: string) =>
        line.replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).filter((l) => l.startsWith("|")).map(cells);

      const th = head
        .map(
          (c) =>
            `<th align="left" style="padding:8px 6px;border-bottom:2px solid ${NAVY};font-size:13px;color:${NAVY};">${inline(c)}</th>`,
        )
        .join("");
      const trs = body
        .map(
          (r) =>
            `<tr>${r
              .map(
                (c) =>
                  `<td style="padding:8px 6px;border-bottom:1px solid #e5e7eb;font-size:14px;vertical-align:top;${
                    atomic(c) ? "white-space:nowrap;" : ""
                  }">${inline(c)}</td>`,
              )
              .join("")}</tr>`,
        )
        .join("");
      out.push(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 20px;"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`,
      );
      continue;
    }

    if (/^([-*])\s+/.test(block)) {
      const items = block
        .split("\n")
        .filter((line) => /^([-*])\s+/.test(line.trim()))
        .map((line) => `<li style="margin:0 0 6px;">${inline(line.trim().replace(/^([-*])\s+/, ""))}</li>`)
        .join("");
      out.push(`<ul style="margin:0 0 16px;padding-left:20px;">${items}</ul>`);
      continue;
    }

    out.push(`<p style="margin:0 0 16px;line-height:1.6;">${inline(block.replace(/\n/g, "<br />"))}</p>`);
  }

  return out.join("\n");
}

function inline(text: string): string {
  return esc(text)
    // Quotes are escaped in the href too: esc() covers &<> but a target
    // containing a double quote would otherwise break out of the attribute.
    .replace(
      /\[([^\]]+)\]\(([^)\s]+)\)/g,
      (_m, label: string, href: string) =>
        `<a href="${href.replace(/"/g, "&quot;")}" style="color:${NAVY};text-decoration:underline;">${label}</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
}

export function renderCampaignHtml(opts: {
  subject: string;
  preheader?: string | null;
  bodyMd: string;
  unsubscribeLink: string | null;
  /**
   * The sending brand's name, from the brands record. Falls back to APA rather
   * than to a hardcoded "Edge8", which is what every broadcast said before —
   * inherited from the fork.
   */
  brandName?: string | null;
}): string {
  const brand = opts.brandName?.trim() || "Australian Payroll Association";
  const preheader = opts.preheader?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</div>`
    : "";

  const footerUnsub = opts.unsubscribeLink
    ? `<a href="${opts.unsubscribeLink}" style="color:#6b7280;">Unsubscribe</a>`
    : "Reply to this email to unsubscribe";

  return `<!doctype html>
<html><body style="margin:0;padding:0;background:${CANVAS};">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};font-size:15px;">
      <tr><td>
        <div style="font-weight:700;font-size:18px;letter-spacing:-0.01em;margin-bottom:24px;color:${NAVY};">${esc(brand)}</div>
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${NAVY};">${esc(opts.subject)}</h1>
        ${renderMarkdown(opts.bodyMd)}
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;" />
        <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
          You are receiving this because you are a member or contact of ${esc(brand)}.<br />
          ${esc(POSTAL_ADDRESS)}<br />
          ${footerUnsub}
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

// -------------------------------------------------------------------- sending

export type MarketingSendResult =
  | { ok: true; resendEmailId: string | null }
  | { ok: false; error: string };

// Sends one marketing email. Suppression is NOT checked here on purpose: the
// caller re-checks every recipient against the live CRM immediately before
// calling, so the check cannot be satisfied by a stale list built hours earlier.
export async function sendMarketingEmail(opts: {
  to: string;
  personId: string;
  subject: string;
  preheader?: string | null;
  bodyMd: string;
  from?: string | null;
  replyTo?: string | null;
  campaignId?: string;
  logSource?: string;
  /** Sending brand's name, for the header and footer. Defaults to APA. */
  brandName?: string | null;
}): Promise<MarketingSendResult> {
  if (!resend) {
    return { ok: false, error: "RESEND_API_KEY is not set." };
  }

  // Two different URLs on purpose: the footer link goes to the confirm page a
  // human reads, the header goes to the API route a mail client POSTs to.
  const link = unsubscribeUrl(opts.personId);
  const postLink = unsubscribePostUrl(opts.personId);
  const html = renderCampaignHtml({
    subject: opts.subject,
    preheader: opts.preheader,
    bodyMd: opts.bodyMd,
    unsubscribeLink: link,
    brandName: opts.brandName,
  });

  // RFC 8058. List-Unsubscribe-Post is what makes Gmail and Outlook show a
  // native one-click Unsubscribe button, which is the single biggest lever on
  // staying out of the spam folder: people use it instead of "report spam".
  const headers: Record<string, string> = {};
  if (postLink) {
    headers["List-Unsubscribe"] = `<${postLink}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  try {
    const { data, error } = await resend.emails.send({
      from: opts.from || DEFAULT_FROM,
      to: [opts.to],
      subject: opts.subject,
      html,
      ...(opts.replyTo ? { replyTo: opts.replyTo } : {}),
      ...(Object.keys(headers).length > 0 ? { headers } : {}),
    });

    if (error) return { ok: false, error: error.message };

    // Log to the CRM timeline like every other send. kind must stay 'email';
    // company_os.interactions has a CHECK constraint on it.
    try {
      await companyOs.from("interactions").insert({
        kind: "email",
        subject: opts.subject,
        body: html,
        person_id: opts.personId,
        occurred_at: new Date().toISOString(),
        metadata: {
          source: opts.logSource ?? "marketing",
          format: "html",
          to: opts.to,
          campaign_id: opts.campaignId ?? null,
          resend_email_id: data?.id ?? null,
        },
      });
    } catch (err) {
      console.error("[marketing-email] interaction log failed:", err);
    }

    return { ok: true, resendEmailId: data?.id ?? null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Send failed." };
  }
}
