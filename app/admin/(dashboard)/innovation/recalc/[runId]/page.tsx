import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { formatCents, formatDate, formatVarianceCents } from "@/lib/admin/format";
import { getRun } from "@/lib/recalc/runs";
import { VarianceExplorer } from "../VarianceExplorer";

export const dynamic = "force-dynamic";

export default async function RecalcRunPage({ params }: { params: { runId: string } }) {
  const admin = await requireAdmin();
  if (!(await canViewSensitive(admin.email))) redirect("/admin");

  const run = await getRun(params.runId);
  if (!run) notFound();

  const employeeCount = run.results ? new Set(run.results.variances.map((v) => v.employeeId)).size : 0;
  const noticeCount = run.results ? run.results.warnings.length + run.results.findings.length + run.results.notModeled.length : 0;

  const flagged = run.results?.variances.filter((v) => v.flagged) ?? [];
  const underpaidCount = flagged.filter((v) => v.varianceCents < 0).length;
  const overpaidCount = flagged.filter((v) => v.varianceCents > 0).length;
  const largest = flagged.length > 0 ? flagged.reduce((a, b) => (Math.abs(b.varianceCents) > Math.abs(a.varianceCents) ? b : a)) : null;

  return (
    <>
      <PageHead
        eyebrow={
          <Link href="/admin/innovation/recalc" className="admin-cell-muted">
            ← Payroll recalculation
          </Link>
        }
        title={run.label || run.id.slice(0, 8)}
        sub={`${run.ruleSetName ?? "Unknown rule set"} · workbook: ${run.workbookFilename ?? "—"} · ${formatDate(run.createdAt)}`}
        action={
          run.results && (
            <a className="admin-btn" href={`/api/admin/recalc/runs/${run.id}/export`} download>
              ⬇ Export to XLSX
            </a>
          )
        }
      />

      {run.status === "error" && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 16 }}>
          {run.errorMessage ?? "This run failed."}
        </div>
      )}

      {run.results && (
        <>
          <div className="mp-kpi-grid">
            <MetricCard label="Employees affected" value={String(employeeCount)} />
            <MetricCard
              label="Flagged lines"
              value={String(run.results.totals.flaggedCount)}
              sub={run.results.totals.flaggedCount > 0 ? "needs review" : "all clear"}
            />
            <MetricCard label="Expected total" value={formatCents(run.results.totals.expectedCents)} />
            <MetricCard label="Actual total" value={formatCents(run.results.totals.actualCents)} />
            <MetricCard
              label="Net variance"
              value={formatVarianceCents(run.results.totals.varianceCents)}
              sub={run.results.totals.varianceCents === 0 ? "matches" : run.results.totals.varianceCents < 0 ? "underpaid" : "overpaid"}
            />
            <MetricCard label="Total lines" value={String(run.results.variances.length)} sub={`across ${employeeCount} employees`} />
            <MetricCard label="Underpaid / Overpaid" value={`${underpaidCount} / ${overpaidCount}`} sub="flagged lines" />
            {largest && (
              <MetricCard label="Largest single variance" value={formatVarianceCents(largest.varianceCents)} sub={`${largest.employeeId} · ${largest.component.replace(/_/g, " ")}`} />
            )}
          </div>

          {noticeCount > 0 && (
            <details
              style={{
                background: "var(--admin-surface)",
                border: "1px solid var(--admin-line)",
                borderRadius: "var(--admin-radius)",
                padding: "14px 16px",
                marginBottom: 20,
              }}
            >
              <summary
                style={{
                  listStyle: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                  color: "var(--admin-ink)",
                  outline: "none",
                }}
              >
                {noticeCount} notice{noticeCount === 1 ? "" : "s"} — warnings, compliance findings, and clauses not evaluated
              </summary>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                {run.results.findings.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Compliance findings (not priced)</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                      {run.results.findings.map((f, i) => (
                        <li key={i}>
                          {f.employeeId} · {formatDate(f.date)} · {f.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {run.results.warnings.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Warnings</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                      {run.results.warnings.slice(0, 30).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                    {run.results.warnings.length > 30 && <div className="admin-cell-muted">+{run.results.warnings.length - 30} more</div>}
                  </div>
                )}
                {run.results.notModeled.length > 0 && (
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Not evaluated by this run</div>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
                      {run.results.notModeled.map((n, i) => (
                        <li key={i}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </details>
          )}

          <VarianceExplorer variances={run.results.variances} />
        </>
      )}
    </>
  );
}
