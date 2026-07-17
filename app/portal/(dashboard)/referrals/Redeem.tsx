"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatCents } from "@/lib/admin/format";
import { chooseRedemption } from "./actions";

// The affiliate's per-commission choice: take it as 20% work credit or 10%
// cash. Shown for pending commissions, and (as "switch") for chosen ones that
// haven't been paid out yet.
export function Redeem({
  commissionId,
  choice,
  workCreditCents,
  cashCents,
  paidOut,
}: {
  commissionId: string;
  choice: "work_credit" | "cash" | null;
  workCreditCents: number;
  cashCents: number;
  paidOut: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function pick(next: "work_credit" | "cash") {
    setErr(null);
    start(async () => {
      const r = await chooseRedemption(commissionId, next);
      if (!r.ok) setErr(r.error);
      else router.refresh();
    });
  }

  if (paidOut) return null;

  if (choice == null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button type="button" className="admin-btn admin-btn--primary admin-btn--sm" disabled={pending} onClick={() => pick("work_credit")}>
            Take {formatCents(workCreditCents, "usd")} work credit
          </button>
          <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => pick("cash")}>
            Take {formatCents(cashCents, "usd")} cash
          </button>
        </div>
        {err && <span style={{ color: "var(--admin-err-ink)", fontSize: 12 }}>{err}</span>}
      </div>
    );
  }

  const other = choice === "work_credit" ? "cash" : "work_credit";
  const otherAmt = choice === "work_credit" ? cashCents : workCreditCents;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end" }}>
      <button type="button" className="admin-btn admin-btn--sm" disabled={pending} onClick={() => pick(other)}>
        Switch to {other === "cash" ? `${formatCents(otherAmt, "usd")} cash` : `${formatCents(otherAmt, "usd")} work credit`}
      </button>
      {err && <span style={{ color: "var(--admin-err-ink)", fontSize: 12 }}>{err}</span>}
    </div>
  );
}
