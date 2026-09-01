import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { formatCents, formatDate } from "@/lib/admin/format";
import { getRun } from "@/lib/recalc/runs";

export const dynamic = "force-dynamic";

export default async function RecalcRunPage({ params }: { params: { runId: string } }) {
  const admin = await requireAdmin();
  if (!(await canViewSensitive(admin.email))) redirect("/admin");

  const run = await getRun(params.runId);
  if (!run) notFound();

  return (
    <>
      <PageHead
        eyebrow={
          <Link href="/admin/innovation/recalc" className="admin-cell-muted">
            ← Payroll recalculation
          </Link>
        }
        title={run.label || run.id.slice(0, 8)}
        sub={`${run.ruleSetName ?? "Unknown rule set"} · timesheet: ${run.timesheetFilename ?? "—"} · pay data: ${run.payDataFilename ?? "—"} · ${formatDate(run.createdAt)}`}
      />

      {run.status === "error" && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 16 }}>
          {run.errorMessage ?? "This run failed."}
        </div>
      )}

      {run.results && (
        <>
          {run.results.warnings.length > 0 && (
            <div className="admin-alert" style={{ marginBottom: 16 }}>
              <strong>{run.results.warnings.length} warning(s):</strong>
              <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                {run.results.warnings.slice(0, 20).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
            <div className="admin-card" style={{ minWidth: 160 }}>
              <div className="admin-cell-muted" style={{ fontSize: 12 }}>
                Expected total
              </div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{formatCents(run.results.totals.expectedCents)}</div>
            </div>
            <div className="admin-card" style={{ minWidth: 160 }}>
              <div className="admin-cell-muted" style={{ fontSize: 12 }}>
                Actual total
              </div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{formatCents(run.results.totals.actualCents)}</div>
            </div>
            <div className="admin-card" style={{ minWidth: 160 }}>
              <div className="admin-cell-muted" style={{ fontSize: 12 }}>
                Net variance
              </div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{formatCents(run.results.totals.varianceCents)}</div>
            </div>
            <div className="admin-card" style={{ minWidth: 160 }}>
              <div className="admin-cell-muted" style={{ fontSize: 12 }}>
                Flagged lines
              </div>
              <div style={{ fontSize: 20, fontWeight: 600 }}>{run.results.totals.flaggedCount}</div>
            </div>
          </div>

          <section className="admin-table-wrap">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Pay period</th>
                    <th>Component</th>
                    <th>Expected</th>
                    <th>Actual</th>
                    <th>Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {run.results.variances.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <div className="admin-empty">No overlapping employee/pay-period data between the two files.</div>
                      </td>
                    </tr>
                  ) : (
                    run.results.variances.map((v, i) => (
                      <tr key={i}>
                        <td>
                          <span className="admin-cell-strong">{v.employeeName || v.employeeId}</span>
                        </td>
                        <td>
                          {formatDate(v.payPeriodStart)} – {formatDate(v.payPeriodEnd)}
                        </td>
                        <td>{v.component.replace(/_/g, " ")}</td>
                        <td>{formatCents(v.expectedCents)}</td>
                        <td>{formatCents(v.actualCents)}</td>
                        <td>
                          {v.flagged ? (
                            <Badge tone={v.varianceCents < 0 ? "err" : "warn"}>{formatCents(v.varianceCents)}</Badge>
                          ) : (
                            formatCents(v.varianceCents)
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </>
  );
}
