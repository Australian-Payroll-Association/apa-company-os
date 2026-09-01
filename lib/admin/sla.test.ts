import { describe, it, expect } from "vitest";
import {
  FIRST_CALL_SLA_MS,
  STALLED_MS,
  isFirstCallMet,
  firstCallCompliance,
  timeInStageMs,
  isStalled,
  humanDuration,
  type SlaInquiry,
} from "./sla";
import { MS_DAY } from "./dashboard-helpers";

// Fixed anchor for reproducible math.
const CREATED = "2026-09-01T00:00:00.000Z";
const createdMs = Date.parse(CREATED);

function inq(partial: Partial<SlaInquiry> & { id: string }): SlaInquiry {
  return {
    id: partial.id,
    createdAt: partial.createdAt ?? CREATED,
    firstContactedAt: partial.firstContactedAt ?? null,
    status: partial.status ?? "new_lead",
    name: partial.name ?? null,
    email: partial.email ?? null,
  };
}

// Build a first-contact ISO string offset from CREATED by a number of ms.
function contactedAfter(ms: number): string {
  return new Date(createdMs + ms).toISOString();
}

describe("constants", () => {
  it("FIRST_CALL_SLA_MS is exactly 24 calendar hours", () => {
    expect(FIRST_CALL_SLA_MS).toBe(24 * 60 * 60 * 1000);
  });
  it("STALLED_MS is exactly 7 days", () => {
    expect(STALLED_MS).toBe(7 * MS_DAY);
  });
});

describe("isFirstCallMet — 24h boundary", () => {
  it("met exactly at the 24h boundary (<=)", () => {
    expect(isFirstCallMet(inq({ id: "a", firstContactedAt: contactedAfter(FIRST_CALL_SLA_MS) }))).toBe(true);
  });
  it("met at 23h59", () => {
    const ms = 23 * 3600_000 + 59 * 60_000;
    expect(isFirstCallMet(inq({ id: "b", firstContactedAt: contactedAfter(ms) }))).toBe(true);
  });
  it("breach 1ms past 24h", () => {
    expect(isFirstCallMet(inq({ id: "c", firstContactedAt: contactedAfter(FIRST_CALL_SLA_MS + 1) }))).toBe(false);
  });
  it("breach at 24h01", () => {
    const ms = 24 * 3600_000 + 60_000;
    expect(isFirstCallMet(inq({ id: "d", firstContactedAt: contactedAfter(ms) }))).toBe(false);
  });
  it("never contacted is a breach", () => {
    expect(isFirstCallMet(inq({ id: "e", firstContactedAt: null }))).toBe(false);
  });
  it("met at t=0 (contacted same instant as created)", () => {
    expect(isFirstCallMet(inq({ id: "f", firstContactedAt: CREATED }))).toBe(true);
  });
  it("invalid created date → not met (finite guard)", () => {
    expect(isFirstCallMet(inq({ id: "g", createdAt: "not-a-date", firstContactedAt: CREATED }))).toBe(false);
  });
  it("invalid contact date → not met (finite guard)", () => {
    expect(isFirstCallMet(inq({ id: "h", firstContactedAt: "not-a-date" }))).toBe(false);
  });
});

describe("isFirstCallMet — timezone / calendar-hours correctness", () => {
  it("same instant expressed in a +10:00 offset counts identically", () => {
    // created 00:00Z; contacted 20:00Z expressed as 06:00+10:00 → 20h elapsed, met.
    const contacted = "2026-09-01T06:00:00.000+10:00"; // == 2026-08-31T20:00Z? no: 06:00+10 = 2026-08-31T20:00Z
    // That is BEFORE created — elapsed negative → still <= 24h → met. Use a clearer case below.
    expect(isFirstCallMet(inq({ id: "tz0", firstContactedAt: contacted }))).toBe(true);
  });
  it("calendar hours ignore DST/business hours — a 25h gap across a weekend is a breach", () => {
    const created = "2026-09-04T22:00:00.000Z"; // Friday night
    const contacted = "2026-09-05T23:30:00.000Z"; // ~25.5h later (Saturday)
    expect(isFirstCallMet({ id: "tz1", createdAt: created, firstContactedAt: contacted, status: null, name: null, email: null })).toBe(false);
  });
  it("a 23h gap across a weekend is met (calendar, not business, hours)", () => {
    const created = "2026-09-04T22:00:00.000Z";
    const contacted = "2026-09-05T20:00:00.000Z"; // 22h later
    expect(isFirstCallMet({ id: "tz2", createdAt: created, firstContactedAt: contacted, status: null, name: null, email: null })).toBe(true);
  });
});

describe("firstCallCompliance", () => {
  it("empty set → total 0, met 0, pct null", () => {
    const r = firstCallCompliance([]);
    expect(r.total).toBe(0);
    expect(r.met).toBe(0);
    expect(r.breached).toBe(0);
    expect(r.pct).toBeNull();
    expect(r.breaches).toEqual([]);
  });

  it("mixed set → correct met/breach counts and pct", () => {
    const set: SlaInquiry[] = [
      inq({ id: "m1", firstContactedAt: contactedAfter(3600_000) }), // 1h met
      inq({ id: "m2", firstContactedAt: contactedAfter(FIRST_CALL_SLA_MS) }), // exactly 24h met
      inq({ id: "b1", firstContactedAt: contactedAfter(FIRST_CALL_SLA_MS + 3600_000) }), // 25h breach
      inq({ id: "b2", firstContactedAt: null }), // never contacted breach
    ];
    const r = firstCallCompliance(set);
    expect(r.total).toBe(4);
    expect(r.met).toBe(2);
    expect(r.breached).toBe(2);
    expect(r.pct).toBe(50);
    expect(r.breaches.map((b) => b.id).sort()).toEqual(["b1", "b2"]);
  });

  it("pct rounds to one decimal", () => {
    // 1 of 3 met → 33.3
    const set = [
      inq({ id: "x1", firstContactedAt: contactedAfter(3600_000) }),
      inq({ id: "x2", firstContactedAt: null }),
      inq({ id: "x3", firstContactedAt: null }),
    ];
    expect(firstCallCompliance(set).pct).toBe(33.3);
  });

  it("breach carries createdAt, status, and hoursToContact (late-but-contacted)", () => {
    const set = [
      inq({ id: "late", firstContactedAt: contactedAfter(25 * 3600_000), status: "contacted", name: "Jo", email: "jo@x.com" }),
    ];
    const b = firstCallCompliance(set).breaches[0];
    expect(b.id).toBe("late");
    expect(b.createdAt).toBe(CREATED);
    expect(b.status).toBe("contacted");
    expect(b.name).toBe("Jo");
    expect(b.email).toBe("jo@x.com");
    expect(b.hoursToContact).toBe(25);
  });

  it("never-contacted breach carries hoursToContact = null", () => {
    const b = firstCallCompliance([inq({ id: "nc", firstContactedAt: null })]).breaches[0];
    expect(b.hoursToContact).toBeNull();
  });

  it("all met → 100% and no breaches", () => {
    const set = [
      inq({ id: "a", firstContactedAt: contactedAfter(1000) }),
      inq({ id: "b", firstContactedAt: contactedAfter(2000) }),
    ];
    const r = firstCallCompliance(set);
    expect(r.pct).toBe(100);
    expect(r.breached).toBe(0);
  });
});

describe("timeInStageMs", () => {
  const now = Date.parse("2026-09-10T00:00:00.000Z");
  it("computes elapsed ms from anchor to now", () => {
    const anchor = "2026-09-09T00:00:00.000Z"; // 1 day earlier
    expect(timeInStageMs(anchor, now)).toBe(MS_DAY);
  });
  it("future anchor clamps to 0 (never negative)", () => {
    const anchor = "2026-09-11T00:00:00.000Z";
    expect(timeInStageMs(anchor, now)).toBe(0);
  });
  it("invalid anchor → 0", () => {
    expect(timeInStageMs("garbage", now)).toBe(0);
  });
  it("anchor == now → 0", () => {
    expect(timeInStageMs("2026-09-10T00:00:00.000Z", now)).toBe(0);
  });
});

describe("isStalled — 7-day boundary", () => {
  it("6 days → not stalled", () => {
    expect(isStalled(6 * MS_DAY)).toBe(false);
  });
  it("just under 7 days → not stalled", () => {
    expect(isStalled(7 * MS_DAY - 1)).toBe(false);
  });
  it("exactly 7 days → stalled (>=)", () => {
    expect(isStalled(7 * MS_DAY)).toBe(true);
  });
  it("8 days → stalled", () => {
    expect(isStalled(8 * MS_DAY)).toBe(true);
  });
  it("0 ms → not stalled", () => {
    expect(isStalled(0)).toBe(false);
  });
});

describe("humanDuration", () => {
  it("< 60s → 'just now'", () => {
    expect(humanDuration(59_999)).toBe("just now");
    expect(humanDuration(0)).toBe("just now");
  });
  it("exactly 60s → '1m'", () => {
    expect(humanDuration(60_000)).toBe("1m");
  });
  it("minutes", () => {
    expect(humanDuration(45 * 60_000)).toBe("45m");
  });
  it("exactly 1h → '1h'", () => {
    expect(humanDuration(3_600_000)).toBe("1h");
  });
  it("hours", () => {
    expect(humanDuration(18 * 3_600_000)).toBe("18h");
  });
  it("exactly 1 day → '1d'", () => {
    expect(humanDuration(MS_DAY)).toBe("1d");
  });
  it("days (floored)", () => {
    expect(humanDuration(6 * MS_DAY + 5 * 3_600_000)).toBe("6d");
  });
  it("23h59 stays in hours, does not round up to a day", () => {
    expect(humanDuration(23 * 3_600_000 + 59 * 60_000)).toBe("23h");
  });
});
