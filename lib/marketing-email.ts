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
// The outline on APA's call-to-action buttons, from the newsletter masthead.
const GOLD = "#C9A227";

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

// A heading's anchor id, and the target of a contents link.
//
// Used on BOTH sides on purpose. The writer produces a contents entry as
// "[Award Transport Payment Changes](#Award Transport Payment Changes)" — the
// heading's own words after the hash — and this turns that and the heading
// itself into the same string. A model that guesses a slug format instead
// still lands on the right section, because slugging an already-slugged
// string is a no-op.
//
// Markdown emphasis and links are stripped first: a heading is occasionally
// written with bold in it, and "**FBT**: changes" and "FBT: changes" have to
// reach the same id.
function slug(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// Percent-decode an in-page target before slugging it.
//
// The writer is told to repeat the heading's words after the hash, and it
// often URL-encodes them on the way — "#Article%20for%20this%20edition". Left
// alone that slugs to "article-20for-20this-20edition" and matches nothing, so
// six of seven contents links in a real edition went nowhere while looking
// perfectly fine in the Markdown.
//
// Malformed input throws rather than returning the string, so the raw value is
// the fallback: a heading containing a literal "%" would otherwise take the
// whole render down.
function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

// An image, email-safe.
//
// width as an ATTRIBUTE as well as CSS: Outlook's Word engine ignores much of
// the style block and sizes from the attribute. display:block kills the few
// pixels of descender gap clients add under an inline image, and border:0
// stops the blue link border a wrapped image gets in older Outlook.
//
// The alt text matters more here than on the web. A large share of recipients
// block images by default, and for them the alt IS the masthead.
function imageHtml(alt: string, src: string, opts: { flush?: boolean } = {}): string {
  const margin = opts.flush ? "0" : "0 0 20px";
  return `<img src="${src.replace(/"/g, "&quot;")}" alt="${esc(alt)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;margin:${margin};" />`;
}

// A masthead is the FIRST thing in the body and runs edge to edge, so it is
// split off before the rest is rendered into the padded card. Returned as a
// pair rather than handled inside renderMarkdown, because the flush treatment
// is a property of where it sits in the wrapper, not of the image itself.
function splitLeadingImage(md: string): { leading: string | null; rest: string } {
  const trimmed = md.replace(/^\s+/, "");
  const match = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*(?:\n|$)/.exec(trimmed);
  if (!match) return { leading: null, rest: md };
  return {
    leading: imageHtml(match[1], match[2], { flush: true }),
    rest: trimmed.slice(match[0].length),
  };
}

export function renderMarkdown(md: string): string {
  const blocks = md.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: string[] = [];

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    // A block that is nothing but an image. The masthead is the case this
    // exists for, and it is carried in the BODY rather than added by the
    // template: renderCampaignHtml is shared by every marketing broadcast, so
    // a masthead added there would put a "Members Update" banner on a one-off
    // promo, and one added only to the preview would not survive the handover
    // to a broadcast — the preview would be showing something the send does
    // not produce.
    // A button. Marked explicitly with {button} rather than inferred from "a
    // paragraph containing only a link", because the writer emits lone links
    // for sources and one of them would eventually turn into a call to action
    // nobody asked for.
    //
    // A bordered link, not a filled one: the fill colour would have to survive
    // Outlook, and an outline in APA's gold degrades to a plain bordered box
    // everywhere instead of to an invisible white-on-white label.
    const button = /^\[([^\]]+)\]\(([^)\s]+)\)\{button\}$/.exec(block);
    if (button) {
      out.push(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td align="center">` +
          `<a href="${button[2].replace(/"/g, "&quot;")}" style="display:inline-block;padding:12px 28px;border:2px solid ${GOLD};border-radius:24px;color:${NAVY};font-size:14px;font-weight:700;letter-spacing:0.04em;text-decoration:none;">${inline(button[1])}</a>` +
          `</td></tr></table>`,
      );
      continue;
    }

    const lone = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(block);
    if (lone) {
      out.push(imageHtml(lone[1], lone[2]));
      continue;
    }

    const heading = block.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length + 1; // "# " renders as h2, the subject is h1
      // Sizes are explicit rather than computed. The old formula bottomed out
      // at 14px for an h3, which is under the 15px body size — every section
      // heading in a real edition read as bold body text, so the reader had no
      // way to see where one section ended and the next began.
      const size = level === 2 ? 19 : level === 3 ? 17 : 15;
      // An id on every heading, so the contents list at the top of an edition
      // can jump to its section. Both the id and the link's target run through
      // the same slug(), so a contents entry written as the heading's own text
      // lands on it without the writer having to guess a slug format.
      out.push(
        `<h${level} id="${slug(heading[2])}" style="margin:28px 0 10px;font-size:${size}px;line-height:1.3;color:${NAVY};">${inline(heading[2])}</h${level}>`,
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

    if (/^\s*([-*])\s+/.test(block)) {
      // One level of nesting, because the contents list uses it: "What is on
      // the Members Portal" carries the individual portal items beneath it.
      // The previous version trimmed every line before testing, so an indented
      // bullet came out at the same level as its parent and the structure was
      // silently lost.
      //
      // The child <ul> goes INSIDE its parent <li>, which is the valid shape;
      // a <ul> as a sibling of an <li> renders in most clients and is the kind
      // of thing one of them eventually gets wrong.
      const items: { text: string; children: string[] }[] = [];
      for (const line of block.split("\n")) {
        const match = /^(\s*)([-*])\s+(.*)$/.exec(line);
        if (!match) continue;
        const [, indent, , text] = match;
        if (indent.length >= 2 && items.length > 0) {
          items[items.length - 1].children.push(text);
        } else {
          items.push({ text, children: [] });
        }
      }

      const li = (text: string, nested: string) =>
        `<li style="margin:0 0 6px;">${inline(text)}${nested}</li>`;
      const rendered = items
        .map((item) =>
          li(
            item.text,
            item.children.length
              ? `<ul style="margin:6px 0 0;padding-left:20px;">${item.children
                  .map((c) => li(c, ""))
                  .join("")}</ul>`
              : "",
          ),
        )
        .join("");
      out.push(`<ul style="margin:0 0 16px;padding-left:20px;">${rendered}</ul>`);
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
      // The target may contain SPACES. A contents entry is written as the
      // heading's own words after a hash — "(#Award Transport Payment
      // Changes)" — and the old [^)\s]+ silently refused to match it, so the
      // entry rendered as plain text and the link was simply absent. External
      // URLs never contain a raw space, so nothing is lost by allowing them.
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_m, label: string, href: string) => {
        // An in-page target goes through the same slug as the heading ids, so
        // "#Award Transport Payment Changes" and "#award-transport-payment-changes"
        // both resolve. Everything else is an external URL and is left alone
        // apart from escaping a quote that would break out of the attribute.
        const target = href.startsWith("#")
          ? `#${slug(decodeFragment(href.slice(1)))}`
          : href.replace(/"/g, "&quot;");
        return `<a href="${target}" style="color:${NAVY};text-decoration:underline;">${label}</a>`;
      },
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

  // A body that opens with an image is carrying a masthead. Any broadcast can
  // do it; the newsletter is simply the one that always does.
  const { leading: masthead, rest: body } = splitLeadingImage(opts.bodyMd);
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
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:${INK};font-size:15px;">
      ${
        masthead
          ? // Its own row, with no padding, so it runs edge to edge the way a
            // masthead is meant to. The padding moved off the table and onto
            // the content cell below to make room for it; a leading image
            // inset by 32px reads as a picture in the body rather than a
            // header.
            `<tr><td style="padding:0;line-height:0;">${masthead}</td></tr>`
          : ""
      }
      <tr><td style="padding:32px;">
        ${
          // The brand name is the fallback header. A masthead already carries
          // the logo and the publication's name, so printing it again is just
          // saying "Australian Payroll Association" twice above the subject.
          masthead
            ? ""
            : `<div style="font-weight:700;font-size:18px;letter-spacing:-0.01em;margin-bottom:24px;color:${NAVY};">${esc(brand)}</div>`
        }
        <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${NAVY};">${esc(opts.subject)}</h1>
        ${renderMarkdown(body)}
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
