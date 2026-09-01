import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { listRuns } from "@/lib/recalc/runs";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payroll recalculation",
  description: "Recompute what a client should have been paid under MA000019 from their pay review data gathering workbook, and diff it against what they actually paid.",
};

function statusTone(status: string): BadgeTone {
  switch (status) {
    case "done":
      return "ok";
    case "error":
      return "err";
    case "calculating":
      return "warn";
    default:
      return "neutral";
  }
}

export default async function RecalcPage() {
  const admin = await requireAdmin();
  // Nav-level convenience only (see AdminSidebar's `superAdmin` items) — this
  // is the real, server-side gate. Payroll dollar data is sensitive, same
  // posture as the compensation module.
  if (!(await canViewSensitive(admin.email))) redirect("/admin");

  const runs = await listRuns();
  const totalFlagged = runs.reduce((sum, r) => sum + (r.results?.totals.flaggedCount ?? 0), 0);

  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Innovation"
        title="Payroll recalculation"
        sub="Download the template, fill it in, upload it — the engine recomputes what MA000019 says should have been paid and flags anything more than $1 off."
        action={
          <a className="admin-btn" href="/api/admin/recalc/template" download>
            ⬇ Download blank template
          </a>
        }
      />

      <div className="mp-kpi-grid">
        <MetricCard label="Runs" value={String(runs.length)} />
        <MetricCard label="Flagged lines (all runs)" value={String(totalFlagged)} sub={totalFlagged > 0 ? "worth reviewing" : "all clear so far"} />
        <MetricCard label="Rule set" value="MA000019" sub="Banking, Finance & Insurance Award 2020" />
      </div>

      <div className="admin-alert" style={{ marginBottom: 24 }}>
        Some clauses are simplified or not evaluated at all — each run lists exactly which. See{" "}
        <code>docs/product/project-recalc-module.md</code>. Not yet wired into Report 360.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 380px) 1fr", gap: 24, alignItems: "start" }}>
        <UploadForm />

        <section>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 10px", fontFamily: "var(--font-display)" }}>Runs</h2>
          {runs.length === 0 ? (
            <p className="tsheet-empty">No runs yet — download the template, fill it in, and upload it to run the engine.</p>
          ) : (
            <div className="tsheet-rowlist">
              {runs.map((r) => (
                <Link key={r.id} href={`/admin/innovation/recalc/${r.id}`} className="tsheet-row" style={{ textDecoration: "none", gridTemplateColumns: "1fr auto auto auto" }}>
                  <div className="tsheet-row-main">
                    <span className="tsheet-row-project">{r.label || r.id.slice(0, 8)}</span>
                    <span className="tsheet-row-client">{r.ruleSetName ?? "—"}</span>
                  </div>
                  <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                  {r.results ? (
                    <Badge tone={r.results.totals.flaggedCount > 0 ? "err" : "ok"}>{r.results.totals.flaggedCount} flagged</Badge>
                  ) : (
                    <span className="tsheet-row-hours">—</span>
                  )}
                  <span className="tsheet-row-client">{formatDate(r.createdAt)}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
