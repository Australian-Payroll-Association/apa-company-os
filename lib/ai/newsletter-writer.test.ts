import { describe, expect, it } from "vitest";
import { decodeStrayEscapes } from "./newsletter-writer";

// A real edition shipped with nine of these in its training table. The model
// double-escaped the en dash in its JSON, so JSON.parse — doing exactly the
// right thing — produced a six-character string instead of a dash.

const BS = String.fromCharCode(92); // a real backslash, kept out of the literals below

describe("decodeStrayEscapes", () => {
  it("turns a literal escape into the character it names", () => {
    expect(decodeStrayEscapes(`10:00am ${BS}u2013 4:00pm AEST`)).toBe("10:00am – 4:00pm AEST");
  });

  it("decodes every occurrence, not just the first", () => {
    const row = `| A | 11/09/2026 | 10:00am ${BS}u2013 4:00pm | B |`;
    const twice = `${row}\n${row}`;
    expect(twice.split(`${BS}u2013`).length - 1).toBe(2);
    expect(decodeStrayEscapes(twice)).not.toContain(`${BS}u`);
    expect((decodeStrayEscapes(twice).match(/–/g) ?? []).length).toBe(2);
  });

  it("handles other characters the model might escape", () => {
    expect(decodeStrayEscapes(`caf${BS}u00e9`)).toBe("café");
    expect(decodeStrayEscapes(`${BS}u201cquoted${BS}u201d`)).toBe("“quoted”");
  });

  it("leaves text that already has the real character alone", () => {
    const clean = "10:00am – 4:00pm AEST";
    expect(decodeStrayEscapes(clean)).toBe(clean);
  });

  // Narrow on purpose. A newsletter body has no legitimate use for \uXXXX,
  // but it may well contain other backslashes, and a broader unescape would
  // start corrupting real text.
  it("does not touch other backslash sequences", () => {
    for (const s of [`C:${BS}Users${BS}temp`, `${BS}n not a newline`, `100${BS}% sure`, `${BS}*escaped star`]) {
      expect(decodeStrayEscapes(s)).toBe(s);
    }
  });

  it("does not touch an incomplete escape", () => {
    expect(decodeStrayEscapes(`${BS}u201`)).toBe(`${BS}u201`);
    expect(decodeStrayEscapes(`${BS}uZZZZ`)).toBe(`${BS}uZZZZ`);
  });

  it("is a no-op on empty text", () => {
    expect(decodeStrayEscapes("")).toBe("");
  });
});
