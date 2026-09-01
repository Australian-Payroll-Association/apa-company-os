import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { listEditions } from "@/lib/admin/newsletter";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { EDITION_STATUS_LABEL, type EditionStatus } from "@/lib/newsletter";
import { NewEditionForm } from "./NewEditionForm";

export const dynamic = "force-dynamic";

export const metadata = { title: "Newsletter" };

function editionTone(status: EditionStatus): BadgeTone {
  switch (status) {
    case "open":
      return "ok";
    case "in_review":
      return "warn";
    case "published":
      return "info";
    case "cancelled":
      return "err";
    default:
      return "neutral";
  }
}

export default async function NewsletterEditionsPage() {
  await requireAdmin();
  const editions = await listEditions();
  const open = editions.find((e) => e.status === "open") ?? null;

  return (
    <div>
      <PageHead
        eyebrow="Marketing"
        title="Newsletter"
        sub="Intake for each edition: what the team has sent in, and what's still thin."
      />

      <NewEditionForm blocked={Boolean(open)} />

      <div className="admin-card" style={{ padding: "20px 22px", marginTop: 16 }}>
        <h2 className="admin-card-title">Editions</h2>
        {editions.length === 0 ? (
          <p className="admin-page-sub" style={{ marginTop: 6, marginBottom: 0 }}>
            No editions yet. Open one above and the team can start contributing.
          </p>
        ) : (
          <div className="admin-table-wrap" style={{ marginTop: 12 }}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Edition</th>
                  <th>Period</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {editions.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/admin/revenue/marketing/newsletter/${e.id}`}>{e.title}</Link>
                    </td>
                    <td className="admin-cell-muted">
                      {formatDate(e.periodStart)} – {formatDate(e.periodEnd)}
                    </td>
                    <td className="admin-cell-muted">
                      {e.deadlineAt ? formatDate(e.deadlineAt) : "—"}
                    </td>
                    <td>
                      <Badge tone={editionTone(e.status)}>
                        {EDITION_STATUS_LABEL[e.status] ?? e.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
