import { describe, expect, it } from "vitest";
import {
  SECTION_META,
  SECTION_TYPES,
  formatFieldValue,
  isEditionStatus,
  isSectionType,
  sectionUses,
  trainingDateRange,
  trainingTimeRange,
} from "./newsletter";

// The newsletter's domain rules. Everything here is shared by /admin, /team and
// the writer, so a change that looks cosmetic in one place lands in all three.

describe("trainingTimeRange", () => {
  // APA's standard course day. The training website publishes a start time and
  // nothing else — no finish time and no duration on the listing, the detail
  // page or the checkout page — so the finish comes from this rule.
  it("maps each known start to its finish, keeping the timezone once", () => {
    expect(trainingTimeRange({ time: "8:45am AEST" })).toBe("8:45am – 4:30pm AEST");
    expect(trainingTimeRange({ time: "10:00am AEDT" })).toBe("10:00am – 4:00pm AEDT");
    expect(trainingTimeRange({ time: "1:00pm AEST" })).toBe("1:00pm – 5:00pm AEST");
  });

  it("tolerates the site reformatting the time", () => {
    // A dot instead of a colon, upper-case meridiem, lower-case zone, stray
    // spacing. The site is consistent today; the parse is not the place to
    // depend on that.
    expect(trainingTimeRange({ time: "8.45 AM aedt" })).toBe("8:45am – 4:30pm AEDT");
    expect(trainingTimeRange({ time: "08:45am AEST" })).toBe("8:45am – 4:30pm AEST");
  });

  // The rule that matters most in a compliance publication: an unrecognised
  // start time gets NO finish rather than a plausible one.
  it("never invents a finish for a start it does not know", () => {
    expect(trainingTimeRange({ time: "9:15am AEST" })).toBe("9:15am AEST");
    expect(trainingTimeRange({ time: "2:30pm" })).toBe("2:30pm");
  });

  it("passes through anything that is not a time, and empty stays empty", () => {
    expect(trainingTimeRange({ time: "TBC" })).toBe("TBC");
    expect(trainingTimeRange({ time: "" })).toBe("");
    expect(trainingTimeRange({})).toBe("");
  });

  it("works without a timezone", () => {
    expect(trainingTimeRange({ time: "8:45am" })).toBe("8:45am – 4:30pm");
  });
});

describe("trainingDateRange", () => {
  it("renders a single day as dd/mm/yyyy", () => {
    expect(trainingDateRange({ date_from: "2026-10-29" })).toBe("29/10/2026");
  });

  it("renders a genuine range with an en dash", () => {
    expect(trainingDateRange({ date_from: "2026-10-30", date_to: "2026-10-31" })).toBe(
      "30/10/2026 – 31/10/2026",
    );
  });

  // A course whose end date equals its start is a one-day course, not a range.
  it("collapses a range whose end matches its start", () => {
    expect(trainingDateRange({ date_from: "2026-10-29", date_to: "2026-10-29" })).toBe("29/10/2026");
  });

  it("returns empty rather than a stray dash when there is no date", () => {
    expect(trainingDateRange({})).toBe("");
  });
});

describe("formatFieldValue", () => {
  const dateField = { key: "date_from", label: "From", type: "date" } as const;
  const textField = { key: "presenter", label: "Presenter", type: "text" } as const;

  // Australian publication: an ISO date left as-is reads as yyyy-mm-dd, and a
  // date that could be read either way round is a date a member acts on wrongly.
  it("renders an ISO date as dd/mm/yyyy", () => {
    expect(formatFieldValue(dateField, "2026-09-01")).toBe("01/09/2026");
  });

  it("leaves a non-date field alone", () => {
    expect(formatFieldValue(textField, "2026-09-01")).toBe("2026-09-01");
  });

  it("leaves a malformed date alone rather than mangling it", () => {
    expect(formatFieldValue(dateField, "next Tuesday")).toBe("next Tuesday");
  });
});

describe("sectionUses", () => {
  // Training submits without a title, body or link: the courses come from the
  // website, and asking a contributor for them invites a hand-typed duplicate.
  it("reports training's three hidden inputs", () => {
    expect(sectionUses("training", "title")).toBe(false);
    expect(sectionUses("training", "body")).toBe(false);
    expect(sectionUses("training", "link")).toBe(false);
  });

  it("reports a normal section as using all three", () => {
    for (const input of ["title", "body", "link"] as const) {
      expect(sectionUses("article", input)).toBe(true);
    }
  });
});

describe("section metadata", () => {
  it("has meta for every declared section type", () => {
    for (const type of SECTION_TYPES) {
      expect(SECTION_META[type]?.label, `no meta for ${type}`).toBeTruthy();
    }
  });

  // SECTION_TYPES is the running order of the newsletter and the contents list
  // is generated from it, so a duplicate would print a section twice.
  it("declares each section exactly once", () => {
    expect(new Set(SECTION_TYPES).size).toBe(SECTION_TYPES.length);
  });

  // Every declared field key is written into the details jsonb bag by both the
  // /team and /admin submit paths, which filter on these keys. A duplicate key
  // within a section would make one of them unreachable.
  it("gives each section's fields distinct keys", () => {
    for (const type of SECTION_TYPES) {
      const keys = (SECTION_META[type].fields ?? []).map((f) => f.key);
      expect(new Set(keys).size, `duplicate field key in ${type}`).toBe(keys.length);
    }
  });
});

describe("type guards", () => {
  it("accepts real values and rejects invented ones", () => {
    expect(isSectionType("training")).toBe(true);
    expect(isSectionType("ask_beryl")).toBe(false);
    expect(isEditionStatus("in_review")).toBe(true);
    expect(isEditionStatus("approved")).toBe(false);
  });
});
