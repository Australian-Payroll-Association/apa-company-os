import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { ClientCards } from "@/components/admin/ClientCards";
import { humanize } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Client Hubs",
  description: "Pick a client to open their hub: work board, roadmap, documents, meetings, and team.",
};

const CLIENT_STAGES = ["customer", "evangelist"];

type Row = {
  id: string;
  name: string | null;
  industry: string | null;
  industry_normalized: string | null;
  priority: string | null;
};

// Client Hubs: a launcher that lists active clients as cards. Opening one lands
// on that company's 360, which defaults to the Client Hub tab for clients, so
// the board / roadmap / documents / meetings / team are front and centre.
export default async function ClientHubsPage() {
  const { data } = await companyOs
    .from("companies")
    .select("id, name, industry, industry_normalized, priority")
    .in("lifecycle_stage", CLIENT_STAGES)
    .is("archived_at", null)
    .order("name", { ascending: true });

  const rows = (data ?? []) as Row[];

  return (
    <div>
      <PageHead
        eyebrow="Operating System"
        title="Client Hubs"
        sub={`${rows.length} active ${rows.length === 1 ? "client" : "clients"}. Open one to work their hub.`}
      />
      {rows.length === 0 ? (
        <div className="admin-card admin-section-card" style={{ padding: 22 }}>
          <p className="admin-page-sub" style={{ margin: 0 }}>No active clients yet.</p>
        </div>
      ) : (
        <ClientCards
          rows={rows}
          detailBasePath="/admin/revenue/companies"
          subText={(r) => [r.industry_normalized || r.industry, r.priority ? humanize(r.priority) : null].filter(Boolean).join(" · ")}
        />
      )}
    </div>
  );
}
