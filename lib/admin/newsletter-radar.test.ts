import { describe, expect, it } from "vitest";
import { dedupKey, radarWindow } from "./newsletter-radar";

// The topic radar's two pure rules: what window gets scanned, and what counts
// as the same page twice.

describe("radarWindow", () => {
  // Scanning the edition's own period was the first attempt and it was wrong.
  // Australian payroll changes cluster on 1 July and regulators announce ahead
  // of time, so a September-only scan missed payday super, the annual wage
  // review and the NT payroll tax rate. Measured on the live edition: 6
  // suggestions from September alone, 24 more once July was included.
  it("reaches back two whole months before the period", () => {
    expect(radarWindow("2026-09-01", "2026-09-30")).toEqual({
      from: "2026-07-01",
      to: "2026-09-30",
    });
  });

  it("covers the 1 July changeover from a September edition", () => {
    expect(radarWindow("2026-09-01", "2026-09-30").from <= "2026-07-01").toBe(true);
  });

  it("rolls back over a year boundary", () => {
    expect(radarWindow("2026-01-01", "2026-01-31").from).toBe("2025-11-01");
    expect(radarWindow("2026-02-01", "2026-02-28").from).toBe("2025-12-01");
  });

  it("always starts on the first of a month", () => {
    for (const start of ["2026-03-01", "2026-07-01", "2026-12-01"]) {
      expect(radarWindow(start, "2026-12-31").from.endsWith("-01")).toBe(true);
    }
  });

  it("ends where the period ends", () => {
    expect(radarWindow("2026-09-01", "2026-09-30").to).toBe("2026-09-30");
  });
});

describe("dedupKey", () => {
  // A real scan returned the ATO's "Explaining qualifying earnings" twice —
  // once as ato.gov.au and once as www.ato.gov.au with a spare path segment —
  // and stored both, so the reviewer saw one page as two rows.
  it("treats www and bare host as the same page", () => {
    expect(dedupKey("https://www.ato.gov.au/a/b")).toBe(dedupKey("https://ato.gov.au/a/b"));
  });

  it("ignores scheme, trailing slash, query and case", () => {
    const canonical = dedupKey("https://ato.gov.au/a/b");
    expect(dedupKey("http://ato.gov.au/a/b")).toBe(canonical);
    expect(dedupKey("https://ato.gov.au/a/b/")).toBe(canonical);
    expect(dedupKey("https://ato.gov.au/a/b?utm_source=x")).toBe(canonical);
    expect(dedupKey("https://ATO.GOV.AU/A/B")).toBe(canonical);
  });

  // Different pages must stay different, or a scan silently loses topics.
  it("keeps genuinely different pages apart", () => {
    expect(dedupKey("https://ato.gov.au/a/b")).not.toBe(dedupKey("https://ato.gov.au/a/c"));
    expect(dedupKey("https://ato.gov.au/a")).not.toBe(dedupKey("https://fairwork.gov.au/a"));
  });

  it("does not throw on something that is not a URL", () => {
    expect(dedupKey("not a url")).toBe("not a url");
  });
});
