import Link from "next/link";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { firstParam, type SearchParamsObj } from "@/lib/admin/url";
import { BACKLOG_SELECT, type BacklogItem } from "@/lib/client-backlog";
import { CompanyPicker } from "./CompanyPicker";
import { BacklogAdminEditor } from "./BacklogAdminEditor";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client Backlog",
  description: "Per-client AI Program backlog — items, priorities and client proposals.",
};

const CLIENT_STAGES = ["customer", "evangelist"];

type ClientOption = { id: string; name: string };

export default async function ClientBacklogPage({ searchParams }: { searchParams: SearchParamsObj }) {
  const companyId = firstParam(searchParams.company) ?? "";
  const showArchived = firstParam(searchParams.archived) === "1";

  const { data: companyRows } = await companyOs
    .from("companies")
    .select("id, name")
    .in("lifecycle_stage", CLIENT_STAGES)
    .is("archived_at", null)
    .order("name", { ascending: true });
  const clients = (companyRows ?? []) as ClientOption[];

  const selected = clients.find((c) => c.id === companyId) ?? null;

  // ── Detail view: one client's backlog ──────────────────────────────
  if (selected) {
    let query = companyOs
      .from("client_backlog_items")
      .select(BACKLOG_SELECT)
      .eq("company_id", selected.id)
      .order("group_key", { ascending: true })
      .order("sort_order", { ascending: true });
    if (!showArchived) query = query.is("archived_at", null);
    const { data } = await query;
    const items = (data ?? []) as unknown as BacklogItem[];
    const proposedCount = items.filter((i) => i.status === "proposed").length;

    return (
      <>
        <PageHead
          eyebrow={<Link href="/admin/operations/client-backlog">← All clients</Link>}
          title={selected.name}
          sub={`${items.length} item${items.length === 1 ? "" : "s"}${proposedCount ? ` · ${proposedCount} client proposal${proposedCount === 1 ? "" : "s"} to review` : ""}`}
          action={<CompanyPicker clients={clients} selectedId={companyId} showArchived={showArchived} />}
        />
        <BacklogAdminEditor companyId={selected.id} items={items} showArchived={showArchived} />
      </>
    );
  }

  // ── Index view: all clients with backlog counts ────────────────────
  const clientIds = clients.map((c) => c.id);
  const countsByCompany = new Map<string, { total: number; proposals: number }>();
  if (clientIds.length > 0) {
    const { data: rows } = await companyOs
      .from("client_backlog_items")
      .select("company_id, status")
      .in("company_id", clientIds)
      .is("archived_at", null);
    for (const r of (rows ?? []) as Array<{ company_id: string; status: string }>) {
      const c = countsByCompany.get(r.company_id) ?? { total: 0, proposals: 0 };
      c.total += 1;
      if (r.status === "proposed") c.proposals += 1;
      countsByCompany.set(r.company_id, c);
    }
  }

  // Clients with a backlog first (most proposals, then most items), then the rest A–Z.
  const withBacklog = clients
    .filter((c) => countsByCompany.has(c.id))
    .sort((a, b) => {
      const ca = countsByCompany.get(a.id)!;
      const cb = countsByCompany.get(b.id)!;
      return cb.proposals - ca.proposals || cb.total - ca.total || a.name.localeCompare(b.name);
    });
  const withoutBacklog = clients.filter((c) => !countsByCompany.has(c.id));

  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Client Backlog"
        sub="Each client's AI Program backlog — what they see in their portal. Open one to edit items, set priorities, and review their proposals."
      />

      <div className="admin-card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="admin-table">
          <thead>
            <tr>
              <th>Client</th>
              <th style={{ width: 110, textAlign: "right" }}>Items</th>
              <th style={{ width: 200 }}>To review</th>
            </tr>
          </thead>
          <tbody>
            {[...withBacklog, ...withoutBacklog].map((c) => {
              const counts = countsByCompany.get(c.id);
              return (
                <tr key={c.id}>
                  <td>
                    <Link href={`/admin/operations/client-backlog?company=${c.id}`} className="admin-cell-strong">
                      {c.name}
                    </Link>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {counts ? counts.total : <span className="admin-cell-muted">—</span>}
                  </td>
                  <td>
                    {counts && counts.proposals > 0 ? (
                      <Badge tone="warn">
                        {counts.proposals} proposal{counts.proposals === 1 ? "" : "s"}
                      </Badge>
                    ) : counts ? (
                      <span className="admin-cell-muted">—</span>
                    ) : (
                      <span className="admin-cell-muted">no backlog yet</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {clients.length === 0 && (
              <tr>
                <td colSpan={3} className="admin-cell-muted" style={{ padding: 18 }}>
                  No client companies found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
