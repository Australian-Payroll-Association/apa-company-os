import { describe, expect, it } from "vitest";
import { isClearedToSend, trainingWindow } from "./newsletter";
import type { EditionRow } from "./newsletter";

// The review gate's decision function, and the training window.
//
// isClearedToSend is the single predicate Phase 4 asks before it will hand an
// edition to a broadcast, so it is the last thing standing between an unread
// draft and a member's inbox. The sequencing and the "not the same person"
// rules are enforced in signEdition too, but this is the check that runs at
// the moment it matters.

function edition(over: Partial<EditionRow> = {}): EditionRow {
  return {
    id: "e1",
    title: "September 2026",
    periodStart: "2026-09-01",
    periodEnd: "2026-09-30",
    deadlineAt: null,
    trainingFrom: null,
    trainingTo: null,
    status: "in_review",
    contentId: "c1",
    reviewerSignedBy: null,
    reviewerSignedAt: null,
    adminSignedBy: null,
    adminSignedAt: null,
    reviewNotes: null,
    openedBy: null,
    closedAt: null,
    notes: null,
    createdAt: "2026-09-01T00:00:00Z",
    ...over,
  };
}

describe("isClearedToSend", () => {
  it("clears an edition signed by two different people", () => {
    expect(
      isClearedToSend(edition({ reviewerSignedBy: "alice@apa.test", adminSignedBy: "bob@apa.test" })),
    ).toBe(true);
  });

  it("refuses an unsigned edition", () => {
    expect(isClearedToSend(edition())).toBe(false);
  });

  it("refuses one signature, in either slot", () => {
    expect(isClearedToSend(edition({ reviewerSignedBy: "alice@apa.test" }))).toBe(false);
    expect(isClearedToSend(edition({ adminSignedBy: "bob@apa.test" }))).toBe(false);
  });

  // The whole reason for a second signature is that it is a second person. One
  // signature was the fork's model and is not enough for a compliance
  // publication: whoever assembles an edition is the last person able to see
  // what they got wrong in it.
  it("refuses two signatures from the same person", () => {
    expect(
      isClearedToSend(
        edition({ reviewerSignedBy: "alice@apa.test", adminSignedBy: "alice@apa.test" }),
      ),
    ).toBe(false);
  });
});

describe("trainingWindow", () => {
  it("runs from the period start to six weeks past the period end by default", () => {
    const w = trainingWindow(edition());
    expect(w.from.toISOString().slice(0, 10)).toBe("2026-09-01");
    // The July, August and September 2026 editions all advertised past their
    // own month, which is what the tail is for.
    expect(w.to.toISOString().slice(0, 10)).toBe("2026-11-11");
  });

  it("uses an explicit window when the editor sets one", () => {
    const w = trainingWindow(edition({ trainingFrom: "2026-10-01", trainingTo: "2026-12-31" }));
    expect(w.from.toISOString().slice(0, 10)).toBe("2026-10-01");
    expect(w.to.toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("keeps the tail when only a start is set", () => {
    const w = trainingWindow(edition({ trainingFrom: "2026-08-15" }));
    expect(w.from.toISOString().slice(0, 10)).toBe("2026-08-15");
    expect(w.to.toISOString().slice(0, 10)).toBe("2026-11-11");
  });
});
