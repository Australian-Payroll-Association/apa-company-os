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
