import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { formatCents, formatDate } from "@/lib/admin/format";
import { getRun } from "@/lib/recalc/runs";
import { VarianceExplorer } from "../VarianceExplorer";

export const dynamic = "force-dynamic";

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "err" | "ok" }) {
  return (
    <div className="admin-card" style={{ flex: "1 1 180px" }}>
      <div className="admin-cell-muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 30,
          fontWeight: 700,
          marginTop: 4,
          color: tone === "err" ? "var(--admin-err-ink)" : tone === "ok" ? "var(--admin-ok-ink)" : "var(--admin-ink)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default async function RecalcRunPage({ params }: { params: { runId: string } }) {
  const admin = await requireAdmin();
  if (!(await canViewSensitive(admin.email))) redirect("/admin");

  const run = await getRun(params.runId);
  if (!run) notFound();

  const employeeCount = run.results ? new Set(run.results.variances.map((v) => v.employeeId)).size : 0;
  const noticeCount = run.results ? run.results.warnings.length + run.results.findings.length + run.results.notModeled.length : 0;

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
      />

      {run.status === "error" && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 16 }}>
          {run.errorMessage ?? "This run failed."}
        </div>
      )}

      {run.results && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <StatTile label="Employees affected" value={String(employeeCount)} />
            <StatTile label="Flagged lines" value={String(run.results.totals.flaggedCount)} tone={run.results.totals.flaggedCount > 0 ? "err" : "ok"} />
            <StatTile label="Expected total" value={formatCents(run.results.totals.expectedCents)} />
            <StatTile label="Actual total" value={formatCents(run.results.totals.actualCents)} />
            <StatTile
              label="Net variance"
              value={formatCents(run.results.totals.varianceCents)}
              tone={run.results.totals.varianceCents === 0 ? "ok" : run.results.totals.varianceCents < 0 ? "err" : undefined}
            />
          </div>

          {noticeCount > 0 && (
            <details className="admin-card" style={{ marginBottom: 20 }}>
              <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
                {noticeCount} notice{noticeCount === 1 ? "" : "s"} — warnings, compliance findings, and clauses not evaluated
              </summary>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 14 }}>
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
