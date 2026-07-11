"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateQboCustomerIds } from "@/app/admin/(dashboard)/revenue/companies/invoice-actions";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";
import type { AdminInvoice } from "@/lib/admin/invoices";

// Invoices tab on the company 360: the synced QuickBooks ledger plus the
// QBO-customer mapping this company's invoices are pulled from. There is no
// live re-sync button — v1 invoice sync is an operator-run backfill (Supabase
// MCP + QBO MCP), not an in-app QuickBooks API integration. Editing the
// mapping here just corrects/documents which QBO customer(s) feed this
// company ahead of the next manual (or, later, automated) sync.
export function InvoicesTab({
  companyId,
  invoices,
  qboCustomerIds,
}: {
  companyId: string;
  invoices: AdminInvoice[];
  qboCustomerIds: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [ids, setIds] = useState(qboCustomerIds.join(", "));
  const [msg, setMsg] = useState<string | null>(null);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await updateQboCustomerIds(companyId, ids);
      if (res.ok) {
        setMsg("Saved.");
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  return (
    <div>
      {invoices.length === 0 ? (
        <div className="admin-empty">No invoices synced yet.</div>
      ) : (
        <div className="admin-table-wrap" style={{ marginBottom: 16 }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Balance</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.doc_number || "—"}</td>
                  <td>{formatDate(inv.txn_date)}</td>
                  <td>{inv.due_date ? formatDate(inv.due_date) : "—"}</td>
                  <td className="admin-cell-mono">{formatCents(inv.amount_cents, inv.currency)}</td>
                  <td className="admin-cell-mono">{formatCents(inv.balance_cents, inv.currency)}</td>
                  <td>
                    <Badge tone={statusTone(inv.status)}>{humanize(inv.status)}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="admin-form" onSubmit={handleSave}>
        {msg && <div className="admin-alert admin-alert--ok">{msg}</div>}
        <div className="admin-field">
          <label className="admin-label" htmlFor="qbo-customer-ids">QBO customer id(s)</label>
          <input
            id="qbo-customer-ids"
            className="admin-input"
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            placeholder="e.g. 5, 205"
          />
          <p className="admin-cell-muted" style={{ marginTop: 4 }}>
            Comma-separated. Feeds the next manual invoice backfill for this company.
          </p>
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
            {pending ? "Saving…" : "Save mapping"}
          </button>
        </div>
      </form>
    </div>
  );
}
