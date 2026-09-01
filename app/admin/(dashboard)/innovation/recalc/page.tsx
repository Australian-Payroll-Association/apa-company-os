import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { listRuns } from "@/lib/recalc/runs";
import { UploadForm } from "./UploadForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Payroll recalculation",
  description: "Proof of concept: recompute what a client should have been paid from their timesheet and pay data, and diff it against what they actually paid.",
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

  return (
    <>
      <PageHead
        eyebrow="Innovation · Proof of concept"
        title="Payroll recalculation"
        sub="Upload a client's timesheet and pay data, recompute what they should have been paid against an interpretation rule set, and see the variance."
      />

      <div className="admin-alert" style={{ marginBottom: 16 }}>
        v1 proof of concept: CSV input only, one illustrative example rule set, not wired into Report 360 yet. See{" "}
        <code>docs/product/project-recalc-module.md</code>.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 480px) 1fr", gap: 24, alignItems: "start" }}>
        <UploadForm />

        <section className="admin-table-wrap">
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
                      <div className="admin-empty">No runs yet — upload both CSVs to run the engine.</div>
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
                      <td>{r.results ? r.results.totals.flaggedCount : "—"}</td>
                      <td>{formatDate(r.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
