import { requirePortalMember } from "@/lib/portal-auth";
import { getInvoicesForActor } from "@/lib/portal/invoices";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, statusTone } from "@/components/admin/Badge";
import { formatCents, formatDate, humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

// Client-facing invoice ledger. Every field here comes from
// lib/portal/invoices.ts's hard-restricted column list — `memo` is never
// selected, so there is nothing to accidentally leak in rendering.
export default async function PortalInvoicesPage() {
  const actor = await requirePortalMember();
  const invoices = await getInvoicesForActor(actor);
  const openTotal = invoices.reduce((sum, inv) => sum + inv.balanceCents, 0);

  return (
    <>
      <PageHead
        eyebrow="Client Portal"
        title="Invoices"
        sub={openTotal > 0 ? `${formatCents(openTotal, "usd")} outstanding` : "You're all paid up."}
      />

      {invoices.length === 0 ? (
        <div className="admin-card admin-section-card">
          <div className="admin-empty">No invoices yet.</div>
        </div>
      ) : (
        invoices.map((inv) => (
          <div className="admin-card admin-section-card" key={inv.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h2 className="admin-card-title" style={{ marginBottom: 2 }}>
                  Invoice {inv.docNumber || inv.id.slice(0, 8)}
                </h2>
                <div className="admin-cell-muted">
                  {formatDate(inv.txnDate)}
                  {inv.dueDate ? ` · due ${formatDate(inv.dueDate)}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="admin-cell-mono" style={{ fontSize: 18 }}>
                  {formatCents(inv.amountCents, inv.currency)}
                </div>
                <Badge tone={statusTone(inv.status)}>{humanize(inv.status)}</Badge>
              </div>
            </div>

            {inv.balanceCents > 0 && (
              <p className="admin-page-sub" style={{ marginTop: 8 }}>
                {formatCents(inv.balanceCents, inv.currency)} outstanding
                {inv.paymentLink && (
                  <>
                    {" · "}
                    <a href={inv.paymentLink} target="_blank" rel="noreferrer">
                      Pay now
                    </a>
                  </>
                )}
              </p>
            )}

            {inv.lines.length > 0 && (
              <details style={{ marginTop: 12 }}>
                <summary className="admin-cell-muted" style={{ cursor: "pointer" }}>
                  Line items ({inv.lines.length})
                </summary>
                <div className="admin-table-wrap" style={{ marginTop: 8 }}>
                  <table className="admin-table">
                    <thead>
                      <tr>
                        <th>Description</th>
                        <th style={{ textAlign: "right" }}>Qty</th>
                        <th style={{ textAlign: "right" }}>Rate</th>
                        <th style={{ textAlign: "right" }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inv.lines.map((line, i) => (
                        <tr key={i}>
                          <td>{line.description || line.item_name || "—"}</td>
                          <td style={{ textAlign: "right" }}>{line.quantity}</td>
                          <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                            {formatCents(Math.round(line.rate * 100), inv.currency)}
                          </td>
                          <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                            {formatCents(Math.round(line.amount * 100), inv.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </div>
        ))
      )}
    </>
  );
}
