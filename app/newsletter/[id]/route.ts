import { getEdition, getEditionDraft, isClearedToSend, newsletterBrandName } from "@/lib/admin/newsletter";
import { renderCampaignHtml } from "@/lib/marketing-email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

// The web version of an edition — what the "View here" button in the email
// opens, and what anyone whose client mangles the layout falls back to.
//
// A ROUTE HANDLER returning the campaign HTML, not a React page. The web
// version has to be the same thing members received; rebuilding it as a page
// would create a second renderer to keep in step, and the first time the two
// disagreed nobody would know which was right. This serves the identical
// output of renderCampaignHtml, so parity is structural rather than
// maintained.
//
// PUBLIC, deliberately and narrowly:
//
//   - Only an edition that is cleared to send (two signatures from two
//     different people) or already published. A draft is 404. Without that
//     gate a guessed id would serve an unreviewed edition, which is the exact
//     thing Phase 3 exists to prevent — and it would do it before anyone had
//     read the words.
//
//   - No personalisation and nothing member-specific is rendered, so there is
//     nothing here a recipient could not already forward. The unsubscribe link
//     is omitted: it is per-person and signed, and a shared page cannot carry
//     one without either leaking a token or offering a dead control.
//
// The id is a uuid, so the URL is not guessable in practice, but the status
// gate is what makes it safe rather than the id.

// Still a 404 in both cases — the page genuinely is not available — but the
// two reasons are different and only one of them is the reader's problem.
//
// "Not published yet" is the reviewer's case: the VIEW HERE button exists in
// the draft from the moment it is written, so anyone checking the edition
// before both signatures are in will click it. Telling them the edition is
// simply unavailable sends them looking for a fault that is not there.
//
// Saying which case applies is safe because reaching it at all requires the
// edition's uuid, which comes from the admin UI or from the draft email. It
// is not something a stranger arrives at.
function unavailable(reason: "not-yet" | "unknown"): Response {
  const notYet = reason === "not-yet";
  const heading = notYet ? "Not published yet" : "Edition not available";
  const body = notYet
    ? "This members&rsquo; update is still being reviewed. It will be here once it has been signed off and sent."
    : "That link may be out of date, or the address may have been mistyped.";

  return new Response(
    `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>${heading} &middot; Australian Payroll Association</title>
</head>
<body style="margin:0;padding:0;background:#F5F6F9;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6F9;padding:48px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#333333;font-size:15px;">
      <tr><td>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#465778;">${heading}</h1>
        <p style="margin:0 0 20px;line-height:1.6;">${body}</p>
        <p style="margin:0;font-size:14px;">
          <a href="https://austpayroll.com.au" style="color:#465778;text-decoration:underline;">austpayroll.com.au</a>
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`,
    {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "x-robots-tag": "noindex, nofollow",
      },
    },
  );
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  // A malformed id would otherwise reach PostgREST and come back as a 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
    return unavailable("unknown");
  }

  const edition = await getEdition(params.id);
  if (!edition) return unavailable("unknown");
  if (edition.status !== "published" && !isClearedToSend(edition)) {
    return unavailable("not-yet");
  }

  const draft = await getEditionDraft(edition.contentId);
  // Signed off but with nothing written is not a state the gate can reach in
  // practice, since a draft is required before review. If it ever does, the
  // reviewer's message is the right one — there is an edition, it just has no
  // content to show.
  if (!draft?.bodyMd?.trim()) return unavailable("not-yet");

  const html = renderCampaignHtml({
    subject: draft.subject,
    preheader: draft.preheader,
    bodyMd: draft.bodyMd,
    // See above: per-person and signed, so a shared page cannot carry one.
    unsubscribeLink: null,
    brandName: await newsletterBrandName(),
  });

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short, because an edition can be corrected after it goes out and the
      // web version is where people go to check. Not no-store: this is the
      // same bytes for everyone and it can absorb a burst on send day.
      "cache-control": "public, max-age=300",
      // A members' update is not something to have indexed: it would compete
      // with austpayroll.com.au on APA's own topics.
      "x-robots-tag": "noindex, nofollow",
    },
  });
}
