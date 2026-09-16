import { describe, expect, it } from "vitest";
import { parseCourses, parseSessions, resolveCourseDate } from "./newsletter-training";

// The training scraper. These selectors are coupled to HubSpot's template, so
// the point of these tests is not that the parse is clever — it is that a
// template change breaks a test rather than silently emptying the newsletter's
// training table.
//
// Every fixture below is the shape the live site actually emits, including the
// awkward bits: an unpadded day in a checkout link, a session with no Book Now
// button, and sessions listed out of date order.

const from = new Date("2026-09-01T00:00:00Z");
const to = new Date("2026-12-31T23:59:59Z");

function session(opts: { label: string; time?: string; checkout?: string }): string {
  const link = opts.checkout
    ? `<div class="session-list-card--link"><a class="button" href="https://austpayroll.com.au/training/checkout/${opts.checkout}"><span>Book Now</span></a></div>`
    : "";
  return `<div class="session-list-card--item" style="order: 1">
    <div class="session-list-card--detail">
      <span class="session-list-card--date">
        <h5 class="session-list-card--date_date">${opts.label}</h5>
        ${opts.time ? `<span class="session-list-card--date_time">${opts.time}</span>` : ""}
      </span>
      <span class="session-list-card--venue">Virtual</span>
    </div>
    ${link}
  </div>`;
}

describe("parseSessions", () => {
  it("takes the date from the checkout link, not the printed label", () => {
    // The link carries an unambiguous year. The label does not, and inferring
    // one is what the move to detail pages was meant to stop.
    const html = session({
      label: "October 29th",
      time: "8:45am AEDT",
      checkout: "payroll-essentials--2026-10-29",
    });
    const [s] = parseSessions(html, from, to);
    expect(s.date.toISOString().slice(0, 10)).toBe("2026-10-29");
    expect(s.time).toBe("8:45am AEDT");
    expect(s.label).toBe("October 29th");
  });

  it("handles a day that is not zero-padded", () => {
    // The Hospitality Award course's link really does read "--2026-10-1".
    const html = session({
      label: "October 1st",
      time: "8:45am AEDT",
      checkout: "hospitality-award--2026-10-1",
    });
    const [s] = parseSessions(html, from, to);
    expect(s.date.toISOString().slice(0, 10)).toBe("2026-10-01");
  });

  it("falls back to the printed label when there is no Book Now link", () => {
    // Sold out, or bookings closed. Still a real session members ask about.
    const html = session({ label: "November 19th", time: "8:45am AEDT" });
    const [s] = parseSessions(html, from, to);
    expect(s.date.toISOString().slice(0, 10)).toBe("2026-11-19");
  });

  it("keeps a session whose time the page omits, with a null time", () => {
    const html = session({ label: "October 29th", checkout: "x--2026-10-29" });
    const [s] = parseSessions(html, from, to);
    expect(s.time).toBeNull();
  });

  it("returns every session, in the page's own order", () => {
    // SCHADS really does list December before October. The caller sorts; the
    // parse must not quietly drop the ones that look out of sequence.
    const html = [
      session({ label: "December 4th", time: "8:45am AEDT", checkout: "schads--2026-12-04" }),
      session({ label: "October 15th", time: "8:45am AEDT", checkout: "schads--2026-10-15" }),
    ].join("\n");
    const parsed = parseSessions(html, from, to);
    expect(parsed.map((s) => s.date.toISOString().slice(0, 10))).toEqual([
      "2026-12-04",
      "2026-10-15",
    ]);
  });

  it("drops a session it cannot date at all rather than guessing", () => {
    const html = session({ label: "Coming soon", time: "8:45am AEDT" });
    expect(parseSessions(html, from, to)).toHaveLength(0);
  });

  it("returns nothing for a page with no session list", () => {
    expect(parseSessions("<html><body><p>No dates yet.</p></body></html>", from, to)).toEqual([]);
  });
});

describe("resolveCourseDate", () => {
  it("takes the year from the window", () => {
    const d = resolveCourseDate("September 11th", from, to);
    expect(d?.toISOString().slice(0, 10)).toBe("2026-09-11");
  });

  it("rolls into the next year for a December edition advertising January", () => {
    // The case the window exists for: a label with no year, in a window that
    // straddles New Year.
    const d = resolveCourseDate(
      "January 14th",
      new Date("2026-12-01T00:00:00Z"),
      new Date("2027-01-31T23:59:59Z"),
    );
    expect(d?.toISOString().slice(0, 10)).toBe("2027-01-14");
  });

  it("returns null for a date outside the window", () => {
    expect(resolveCourseDate("March 3rd", from, to)).toBeNull();
  });

  it("returns null for anything that is not a date", () => {
    expect(resolveCourseDate("Self Paced Learning", from, to)).toBeNull();
    expect(resolveCourseDate("", from, to)).toBeNull();
    expect(resolveCourseDate("Septober 40th", from, to)).toBeNull();
  });
});

describe("parseCourses", () => {
  const card = `<div class="mv-card tile-card course-card with-title">
    <div class="mv-card__body">
      <h3 class="course-card--title">Payroll Essentials</h3>
      <div class="course-card--description">Two days on the fundamentals.</div>
      <div class="course-card__meta">
        <span class="course-card__meta--label">Date</span>
        <span class="course-card__meta--value">October 29th</span>
        <span class="course-card__meta--label">Format</span>
        <span class="course-card__meta--value">Virtual Classroom</span>
      </div>
    </div>
    <div class="mv-card__aside bg-secondary">
      <span class="mv-pill theme- type-block">$1,395</span>
      <a class="button dummy-button" href="https://austpayroll.com.au/training/detail/payroll-essentials"><span>Learn More</span></a>
    </div>
  </div>`;

  it("reads the catalogue fields off a course card", () => {
    const [c] = parseCourses(card);
    expect(c.title).toBe("Payroll Essentials");
    expect(c.format).toBe("Virtual Classroom");
    expect(c.price).toBe("$1,395");
    expect(c.url).toBe("https://austpayroll.com.au/training/detail/payroll-essentials");
    expect(c.description).toBe("Two days on the fundamentals.");
  });

  it("reads Date and Format by label, not by position", () => {
    // The page does not always emit them in the same order.
    const swapped = card.replace(
      `<span class="course-card__meta--label">Date</span>
        <span class="course-card__meta--value">October 29th</span>
        <span class="course-card__meta--label">Format</span>
        <span class="course-card__meta--value">Virtual Classroom</span>`,
      `<span class="course-card__meta--label">Format</span>
        <span class="course-card__meta--value">Virtual Classroom</span>
        <span class="course-card__meta--label">Date</span>
        <span class="course-card__meta--value">October 29th</span>`,
    );
    const [c] = parseCourses(swapped);
    expect(c.format).toBe("Virtual Classroom");
    expect(c.dateLabel).toBe("October 29th");
  });

  it("decodes entities in a title", () => {
    const [c] = parseCourses(card.replace("Payroll Essentials", "Super &amp; Payday Super"));
    expect(c.title).toBe("Super & Payday Super");
  });

  // The caller treats an empty parse as "the layout changed", not as "no
  // courses", and reports it rather than silently publishing an empty table.
  it("returns nothing when the markup does not match", () => {
    expect(parseCourses("<div class='some-new-template'>Payroll Essentials</div>")).toEqual([]);
  });
});
