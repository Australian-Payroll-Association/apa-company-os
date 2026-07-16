"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
} from "react";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import type { ContractorRow } from "./contractor-shared";
import { updateContractorRates } from "./actions";

// Client-owned shelf for the contractors roster (vendors pattern): one drawer
// at the provider level, rows push the selected contractor into context.

const ShelfContext = createContext<{ open: (row: ContractorRow) => void } | null>(null);

export function ContractorsShelfProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<ContractorRow | null>(null);

  return (
    <ShelfContext.Provider value={{ open: setSelected }}>
      {children}
      <DetailDrawer
        open={!!selected}
        onClose={() => setSelected(null)}
        eyebrow="Contractor"
        title={selected?.full_name ?? selected?.email ?? ""}
      >
        {selected && <ContractorShelfBody row={selected} />}
      </DetailDrawer>
    </ShelfContext.Provider>
  );
}

export function ContractorShelfRow({ row, children }: { row: ContractorRow; children: ReactNode }) {
  const ctx = useContext(ShelfContext);

  function hitsInnerInteractive(e: { target: EventTarget; currentTarget: HTMLTableRowElement }) {
    const hit = (e.target as HTMLElement).closest("a,button,input,select,label,[role=button]");
    return !!hit && hit !== e.currentTarget;
  }

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if (hitsInnerInteractive(e)) return;
    ctx?.open(row);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      if (hitsInnerInteractive(e)) return;
      e.preventDefault();
      ctx?.open(row);
    }
  }

  return (
    <tr className="is-clickable" onClick={onClick} onKeyDown={onKeyDown} tabIndex={0} role="button" aria-haspopup="dialog">
      {children}
    </tr>
  );
}

function kv(label: string, value: ReactNode) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  );
}

const toDollars = (cents: number | null) => (cents === null ? "" : String(cents / 100));

function ContractorShelfBody({ row }: { row: ContractorRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [hourly, setHourly] = useState(toDollars(row.hourly_rate_cents));
  const [overtime, setOvertime] = useState(toDollars(row.overtime_rate_cents));
  const [currency, setCurrency] = useState(row.currency || "usd");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setEditing(false);
    setHourly(toDollars(row.hourly_rate_cents));
    setOvertime(toDollars(row.overtime_rate_cents));
    setCurrency(row.currency || "usd");
    setReason("");
    setError(null);
  }, [row]);

  function save() {
    setError(null);
    const h = Math.round(Number(hourly) * 100);
    const o = Math.round(Number(overtime) * 100);
    startTransition(async () => {
      const r = await updateContractorRates({
        teamMemberId: row.team_member_id,
        hourlyRateCents: h,
        overtimeRateCents: o,
        currency,
        changeReason: reason,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="admin-shelf-sections">
      <section>
        <div className="admin-shelf-heading">Details</div>
        <dl className="admin-kv">
          {kv("Email", row.email)}
          {kv("Position", row.position)}
          {kv("Department", row.department)}
          {kv("Status", humanize(row.status))}
          {kv("Start date", formatDate(row.start_date))}
        </dl>
      </section>

      <section>
        <div className="admin-shelf-heading">
          Pay rates
          {!editing && (
            <button type="button" className="admin-btn" onClick={() => setEditing(true)}>
              Edit rates
            </button>
          )}
        </div>
        {editing ? (
          <div style={{ display: "grid", gap: 10 }}>
            <label className="admin-field">
              <span>Hourly rate ({currency.toUpperCase()})</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={hourly}
                onChange={(e) => setHourly(e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Overtime rate ({currency.toUpperCase()})</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={overtime}
                onChange={(e) => setOvertime(e.target.value)}
              />
            </label>
            <label className="admin-field">
              <span>Currency</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="usd">USD</option>
                <option value="vnd">VND</option>
              </select>
            </label>
            <label className="admin-field">
              <span>Change reason (optional)</span>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Annual review" />
            </label>
            {error && <div className="admin-alert admin-alert--err">{error}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="admin-btn admin-btn--primary" onClick={save} disabled={pending}>
                {pending ? "Saving…" : "Save rates"}
              </button>
              <button type="button" className="admin-btn" onClick={() => setEditing(false)} disabled={pending}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <dl className="admin-kv">
            {kv("Hourly", row.hourly_rate_cents !== null ? `${formatCents(row.hourly_rate_cents, row.currency)}/h` : "Not set")}
            {kv(
              "Overtime",
              row.overtime_rate_cents !== null ? `${formatCents(row.overtime_rate_cents, row.currency)}/h` : "Not set",
            )}
          </dl>
        )}
      </section>
    </div>
  );
}
