import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatCents, formatDate } from "@/lib/admin/format";
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

const STEPS = [
  { n: 1, title: "Download the template", body: "One .xlsx workbook, 9 tabs — the same structure used across every engagement." },
  { n: 2, title: "Fill it in", body: "Employee attributes, rosters, worked shifts, payslip data, allowances — one row per record." },
  { n: 3, title: "Upload & review", body: "The engine recomputes what MA000019 says should have been paid, and flags anything more than $1 off." },
];

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
        sub="Recompute what should have been paid under the active rule set, and see the variance."
        action={
          <a className="admin-btn" href="/api/admin/recalc/template" download>
            ⬇ Download blank template
          </a>
        }
      />

      <div className="admin-card" style={{ marginBottom: 20 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20 }}>
          {STEPS.map((s) => (
            <div key={s.n} style={{ display: "flex", gap: 12 }}>
              <div
                style={{
                  flex: "0 0 auto",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--admin-accent-soft)",
                  color: "var(--admin-accent-strong)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {s.n}
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>{s.title}</div>
                <div className="admin-cell-muted" style={{ fontSize: 13 }}>{s.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-alert" style={{ marginBottom: 20 }}>
        Runs against MA000019 (Banking, Finance and Insurance Award 2020) — some clauses are simplified or not evaluated at all; each run lists
        exactly which. See <code>docs/product/project-recalc-module.md</code>. Not yet wired into Report 360.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 420px) 1fr", gap: 24, alignItems: "start" }}>
        <UploadForm />

        <section>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Runs</h2>
            {runs.length > 0 && (
              <span className="admin-cell-muted" style={{ fontSize: 12 }}>
                {runs.length} run{runs.length === 1 ? "" : "s"} · {totalFlagged} flagged line{totalFlagged === 1 ? "" : "s"} total
              </span>
            )}
          </div>
          <div className="admin-table-wrap">
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Label</th>
                    <th>Rule set</th>
                    <th>Status</th>
                    <th>Flagged</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="admin-empty">No runs yet — download the template, fill it in, and upload it to run the engine.</div>
                      </td>
                    </tr>
                  ) : (
                    runs.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link href={`/admin/innovation/recalc/${r.id}`} className="admin-cell-strong">
                            {r.label || r.id.slice(0, 8)}
                          </Link>
                        </td>
                        <td>{r.ruleSetName ?? "—"}</td>
                        <td>
                          <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                        </td>
                        <td>
                          {r.results ? (
                            <Badge tone={r.results.totals.flaggedCount > 0 ? "err" : "ok"}>{r.results.totals.flaggedCount}</Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{formatDate(r.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
