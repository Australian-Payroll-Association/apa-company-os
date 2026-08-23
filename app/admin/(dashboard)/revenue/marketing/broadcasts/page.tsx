import Link from "next/link";
import type { Metadata } from "next";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { requireAdmin } from "@/lib/admin-auth";
import { listCampaigns, type CampaignStatus } from "@/lib/admin/campaigns";
import { NewBroadcastForm } from "./NewBroadcastForm";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Broadcasts",
  description: "Newsletter and marketing email broadcasts.",
};

const STATUS_TONE: Record<CampaignStatus, "ok" | "warn" | "err" | "info"> = {
  draft: "info",
  approved: "warn",
  sending: "warn",
  sent: "ok",
  cancelled: "err",
};

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  sending: "Sending",
  sent: "Sent",
  cancelled: "Cancelled",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function BroadcastsPage() {
  await requireAdmin();
  const { rows, error } = await listCampaigns();

  return (
    <div>
      <PageHead
        eyebrow="Revenue · Marketing"
        title="Broadcasts"
        sub={`${rows.length} broadcast${rows.length === 1 ? "" : "s"}. Nothing sends without an explicit approval.`}
        action={
          <Link className="admin-btn" href="/admin/revenue/marketing">
            Back to Marketing
          </Link>
        }
      />

      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <section className="admin-card admin-section-card">
        <div className="admin-card-title">New broadcast</div>
        <NewBroadcastForm />
      </section>

      <div className="admin-table-wrap">
        {rows.length === 0 ? (
          <div className="admin-empty">No broadcasts yet.</div>
        ) : (
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Brand</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Sent</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="admin-cell-strong">
                      <Link href={`/admin/revenue/marketing/broadcasts/${row.id}`}>{row.name}</Link>
                    </td>
                    <td className="admin-cell-muted">{row.brandName ?? "—"}</td>
                    <td className="admin-cell-muted">{row.subject}</td>
                    <td>
                      <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </td>
                    <td className="admin-cell-mono">{formatDate(row.createdAt)}</td>
                    <td className="admin-cell-mono">{formatDate(row.sentAt)}</td>
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
