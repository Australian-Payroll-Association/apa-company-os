import { describe, expect, it } from "vitest";
import { renderCampaignHtml, renderMarkdown } from "./marketing-email";

// The email template. Email clients are not browsers, so everything here is
// inline styles and tables — and none of it is visible until it reaches an
// inbox, which is exactly why it wants tests.

const NAVY = "#465778";

const TABLE = `| Course | Date | Time | Delivery |
|---|---|---|---|
| Payroll Essentials | 29/10/2026 | 8:45am – 4:30pm AEDT | Virtual Classroom |
| Advanced Payroll | 30/10/2026 | 8:45am – 4:30pm AEDT | Virtual Classroom |`;

describe("renderMarkdown — tables", () => {
  // The training section is a Markdown table. Before this branch existed it
  // reached members as a wall of pipe characters.
  it("renders a table with a header row and one row per line", () => {
    const html = renderMarkdown(TABLE);
    expect(html).toContain("<table");
    expect((html.match(/<th /g) ?? []).length).toBe(4);
    expect((html.match(/<tr>/g) ?? []).length).toBe(3); // header + two body rows
  });

  it("keeps an empty cell as an empty cell", () => {
    // A course whose start time the website never published. The column has to
    // stay aligned rather than the row shifting left.
    const html = renderMarkdown(`| Course | Time |
|---|---|
| Sold Out Course |  |`);
    expect((html.match(/<td /g) ?? []).length).toBe(2);
  });

  it("leaves a stray pipe in prose as prose", () => {
    const html = renderMarkdown("A pipe | in a sentence is still a sentence.");
    expect(html).not.toContain("<table");
    expect(html).toContain("<p ");
  });

  it("does not treat a pipe line without a separator row as a table", () => {
    const html = renderMarkdown("| not | a table |\n| still not |");
    expect(html).not.toContain("<table");
  });
});

describe("renderMarkdown — dates and times never wrap", () => {
  // "10:00am AEST" split over two lines at 600px is how a member misreads when
  // a course runs. Prose cells still wrap, or the table would push the email
  // sideways.
  const cell = (html: string, text: string) => {
    const match = new RegExp(`<td style="([^"]*)"[^>]*>${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</td>`).exec(html);
    return match?.[1] ?? "";
  };

  it("holds a dd/mm/yyyy date on one line", () => {
    expect(cell(renderMarkdown(TABLE), "29/10/2026")).toContain("white-space:nowrap");
  });

  it("holds a time range on one line", () => {
    expect(cell(renderMarkdown(TABLE), "8:45am – 4:30pm AEDT")).toContain("white-space:nowrap");
  });

  it("holds a two-day date range on one line", () => {
    const html = renderMarkdown(`| Course | Date |
|---|---|
| Advanced Payroll | 30/10/2026 – 31/10/2026 |`);
    expect(cell(html, "30/10/2026 – 31/10/2026")).toContain("white-space:nowrap");
  });

  it("lets a prose cell wrap", () => {
    expect(cell(renderMarkdown(TABLE), "Payroll Essentials")).not.toContain("white-space:nowrap");
    expect(cell(renderMarkdown(TABLE), "Virtual Classroom")).not.toContain("white-space:nowrap");
  });
});

describe("renderMarkdown — headings, lists, links", () => {
  // The old size formula bottomed out at 14px for an h3 — under the 15px body
  // size — so every section heading in a real edition read as bold body text.
  it("renders section headings larger than the 15px body, in navy", () => {
    const html = renderMarkdown("## Upcoming training");
    const size = Number(/font-size:(\d+)px/.exec(html)?.[1]);
    expect(size).toBeGreaterThan(15);
    expect(html).toContain(NAVY);
  });

  it("renders lists and inline emphasis", () => {
    const html = renderMarkdown("- one\n- two");
    expect((html.match(/<li /g) ?? []).length).toBe(2);
    expect(renderMarkdown("**bold**")).toContain("<strong>bold</strong>");
  });

  it("renders a link and escapes a quote in its target", () => {
    const html = renderMarkdown('[FWO](https://fairwork.gov.au/a"b)');
    expect(html).toContain('href="https://fairwork.gov.au/a&quot;b"');
  });
});

describe("renderMarkdown — escaping", () => {
  it("escapes markup in content", () => {
    const html = renderMarkdown("5 < 6 & <script>alert(1)</script>");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes markup inside a table cell", () => {
    const html = renderMarkdown(`| A |\n|---|\n| <img src=x> |`);
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;img");
  });
});

describe("renderCampaignHtml", () => {
  const base = {
    subject: "September 2026 members' update",
    preheader: null,
    bodyMd: "Hello.",
    unsubscribeLink: null,
  };

  // The fork hardcoded "Edge8" in the header and again in the footer, so every
  // APA newsletter would have gone out under another company's name.
  it("uses the brand name it is given, in both places", () => {
    const html = renderCampaignHtml({ ...base, brandName: "Australian Payroll Association" });
    expect((html.match(/Australian Payroll Association/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain(">Edge8<");
  });

  it("falls back to APA rather than to the fork's name", () => {
    const html = renderCampaignHtml(base);
    expect(html).toContain("Australian Payroll Association");
  });

  it("escapes a brand name and a subject", () => {
    const html = renderCampaignHtml({ ...base, subject: "A & B", brandName: "X <b>Y</b>" });
    expect(html).toContain("A &amp; B");
    expect(html).not.toContain("X <b>Y</b>");
  });

  it("renders the body through the markdown renderer", () => {
    const html = renderCampaignHtml({ ...base, bodyMd: TABLE });
    expect(html).toContain("<table");
  });

  it("hides the preheader from the visible email", () => {
    const html = renderCampaignHtml({ ...base, preheader: "What changed this month" });
    expect(html).toMatch(/display:none[^"]*">What changed this month/);
  });

  it("offers a reply-to route when there is no unsubscribe link", () => {
    // Never a dead or missing unsubscribe: a recipient with no way out presses
    // "report spam" instead, which is the outcome the footer exists to avoid.
    expect(renderCampaignHtml(base)).toContain("Reply to this email to unsubscribe");
  });

  it("uses the unsubscribe link when there is one", () => {
    const html = renderCampaignHtml({ ...base, unsubscribeLink: "https://x.test/u?token=abc" });
    expect(html).toContain('href="https://x.test/u?token=abc"');
  });
});

describe("contents links jump to their section", () => {
  // Every entry in the edition's contents list is a link to the section it
  // names. The writer repeats the heading's own words after a hash rather than
  // guessing a slug, so both sides go through the same normalisation.
  const ids = (html: string) => [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  const anchors = (html: string) => [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);

  it("gives every heading an id", () => {
    const html = renderMarkdown("## Upcoming training\n\nBody.");
    expect(ids(html)).toEqual(["upcoming-training"]);
  });

  it("resolves a target written as the heading's own words", () => {
    // The form the prompt asks for. The href contains SPACES, which the link
    // pattern used to reject outright — the entry rendered as plain text and
    // the link was simply missing.
    const html = renderMarkdown(
      "- [Award Transport Payment Changes](#Award Transport Payment Changes)\n\n## Award Transport Payment Changes\n\nBody.",
    );
    expect(anchors(html)).toEqual(["award-transport-payment-changes"]);
    expect(ids(html)).toContain("award-transport-payment-changes");
  });

  it("resolves a target already written as a slug", () => {
    const html = renderMarkdown("- [Upcoming training](#upcoming-training)\n\n## Upcoming training\n\nB.");
    expect(anchors(html)[0]).toBe(ids(html)[0]);
  });

  it("matches a heading carrying markdown emphasis", () => {
    const html = renderMarkdown(
      "- [FBT changes](#**FBT**: changes from 1 April 2027)\n\n### **FBT**: changes from 1 April 2027\n\nB.",
    );
    expect(anchors(html)[0]).toBe(ids(html)[0]);
  });

  it("leaves external URLs alone", () => {
    const html = renderMarkdown("[ATO](https://www.ato.gov.au/a?b=1&c=2)");
    expect(html).toContain('href="https://www.ato.gov.au/a?b=1&amp;c=2"');
  });

  it("does not turn bracketed prose into a link", () => {
    const html = renderMarkdown("Check the rate (and the effective date) before paying.");
    expect(html).not.toContain("<a ");
  });
});

describe("nested contents entries", () => {
  // The Members Portal section lists its individual items beneath it. The
  // previous renderer trimmed every line before testing for a bullet, so an
  // indented entry came out level with its parent and the structure was
  // silently lost.
  const NESTED = `- [What is on the Members Portal](#What is on the Members Portal)
  - [New search function](#New search function)
  - [Redundancy calculator](#Redundancy calculator)
- [Compliance](#Compliance)`;

  it("nests an indented entry rather than flattening it", () => {
    const html = renderMarkdown(NESTED);
    expect((html.match(/<ul /g) ?? []).length).toBe(2);
    expect((html.match(/<li /g) ?? []).length).toBe(4);
  });

  it("puts the child list inside its parent item, not beside it", () => {
    // <ul> as a sibling of <li> renders in most clients and is the kind of
    // thing one of them eventually gets wrong.
    const html = renderMarkdown(NESTED);
    expect(html).toMatch(/Members Portal<\/a><ul /);
    expect(html).not.toMatch(/<\/li><ul /);
  });

  it("still resolves every nested entry to a heading id", () => {
    const html = renderMarkdown(`${NESTED}\n\n## New search function\n\nBody.`);
    expect(html).toContain('href="#new-search-function"');
    expect(html).toContain('id="new-search-function"');
  });

  it("leaves a flat list flat", () => {
    const html = renderMarkdown("- one\n- two\n- three");
    expect((html.match(/<ul /g) ?? []).length).toBe(1);
    expect((html.match(/<li /g) ?? []).length).toBe(3);
  });
});

describe("percent-encoded contents targets", () => {
  // The writer is told to repeat the heading's words after the hash, and it
  // often URL-encodes them on the way. Left undecoded these slug to
  // "article-20for-20this-20edition" and match nothing — six of seven links in
  // a real edition went nowhere while looking correct in the Markdown.
  it("resolves an encoded target to its heading", () => {
    const html = renderMarkdown(
      "- [Article for this edition](#Article%20for%20this%20edition)\n\n## Article for this edition\n\nBody.",
    );
    expect(html).toContain('href="#article-for-this-edition"');
    expect(html).toContain('id="article-for-this-edition"');
  });

  it("resolves an encoded colon and dollar sign", () => {
    const html = renderMarkdown(
      "- [x](#FBT%3A%20cap%20of%20%24270%2C830)\n\n## FBT: cap of $270,830\n\nBody.",
    );
    const id = /id="([^"]+)"/.exec(html)?.[1];
    expect(/href="#([^"]+)"/.exec(html)?.[1]).toBe(id);
  });

  it("survives a target that is not valid percent-encoding", () => {
    // A heading with a literal "%" in it. decodeURIComponent throws on this,
    // and an exception here would take the whole render down.
    expect(() => renderMarkdown("- [x](#levy rises to 1.7% from July)")).not.toThrow();
  });
});
