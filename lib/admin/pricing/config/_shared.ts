// Shared helpers for pricing configs. `pp` builds a member/non-member cent pair
// from DOLLAR figures (the workbook is in dollars); it multiplies by 100 so the
// config reads exactly like the cited cells. Non-member is required — pass it
// explicitly (the source gives both columns for every verified service).

import type { PricePair } from "../types";

export function pp(memberDollars: number, nonMemberDollars: number | null): PricePair {
  return {
    memberCents: Math.round(memberDollars * 100),
    nonMemberCents: nonMemberDollars === null ? null : Math.round(nonMemberDollars * 100),
  };
}
