import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
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

  let items: BacklogItem[] = [];
  if (selected) {
    let query = companyOs
      .from("client_backlog_items")
      .select(BACKLOG_SELECT)
      .eq("company_id", selected.id)
      .order("group_key", { ascending: true })
      .order("sort_order", { ascending: true });
    if (!showArchived) query = query.is("archived_at", null);
    const { data } = await query;
    items = (data ?? []) as unknown as BacklogItem[];
  }

  const proposedCount = items.filter((i) => i.status === "proposed").length;

  return (
    <>
      <PageHead
        eyebrow="Operations"
        title="Client Backlog"
        sub={
          selected
            ? `${selected.name} · ${items.length} item${items.length === 1 ? "" : "s"}${proposedCount ? ` · ${proposedCount} client proposal${proposedCount === 1 ? "" : "s"} to review` : ""}`
            : "Pick a client to view and edit their AI Program backlog."
        }
        action={<CompanyPicker clients={clients} selectedId={companyId} showArchived={showArchived} />}
      />

      {!selected ? (
        <div className="admin-card" style={{ padding: 22 }}>
          <p style={{ margin: 0, color: "var(--admin-muted, #797c82)" }}>
            Select a client above. The backlog is what the client sees in their portal — Edge8
            authors items and proposes priorities; the client re-prioritises and can propose their
            own items for you to accept here.
          </p>
        </div>
      ) : (
        <BacklogAdminEditor companyId={selected.id} items={items} showArchived={showArchived} />
      )}
    </>
  );
}
