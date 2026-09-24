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

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const notFound = () =>
    new Response("<!doctype html><title>Not found</title><p>That edition is not available.</p>", {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });

  // A malformed id would otherwise reach PostgREST and come back as a 500.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(params.id)) {
    return notFound();
  }

  const edition = await getEdition(params.id);
  if (!edition) return notFound();
  if (edition.status !== "published" && !isClearedToSend(edition)) return notFound();

  const draft = await getEditionDraft(edition.contentId);
  if (!draft?.bodyMd?.trim()) return notFound();

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
