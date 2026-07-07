import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { InquiriesBoard, type InquiryCard } from "./InquiriesBoard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Inquiries",
  description: "Inbound inquiries from the website and forms.",
};

const ACTIVE_STATUSES = ["new_lead", "contacted", "discovery", "proposal", "won", "lost"];
// The inquiries board is inbound SALES contact only. Event/commerce/legacy-import
// intake (retreat signups, checkout, newsletter, the one-off legacy 'general'
// bulk import) lives in orders/registrations, not here.
const NON_SALES_INQUIRY_TYPES = "(general,retreat,trip,checkout,newsletter)";

type EmbeddedPerson = { full_name: string | null; email: string; do_not_contact: boolean | null };
type Row = {
  id: string;
  type: string | null;
  subject: string | null;
  message: string | null;
  source: string | null;
  status: string | null;
  created_at: string;
  deal_id: string | null;
  person_id: string | null;
  people: EmbeddedPerson | EmbeddedPerson[] | null;
};

export default async function InquiriesPage() {
  let query = companyOs
    .from("inquiries")
    .select(
      "id, type, subject, message, source, status, created_at, deal_id, person_id, people(full_name, email, do_not_contact)",
    )
    .in("status", ACTIVE_STATUSES)
    .not("type", "in", NON_SALES_INQUIRY_TYPES)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data, error } = await query;

  const cards: InquiryCard[] = ((data as Row[] | null) ?? []).map((r) => {
    const p = Array.isArray(r.people) ? r.people[0] : r.people;
    return {
      id: r.id,
      columnId: r.status ?? "new_lead",
      type: r.type,
      subject: r.subject,
      message: r.message,
      source: r.source,
      created_at: r.created_at,
      deal_id: r.deal_id,
      personId: r.person_id,
      personName: p?.full_name ?? null,
      personEmail: p?.email ?? null,
      doNotContact: !!p?.do_not_contact,
    };
  });

  const count = (fn: (c: InquiryCard) => boolean) => cards.filter(fn).length;
  const kpis = {
    fresh: count((c) => c.columnId === "new_lead"),
    contacted: count((c) => c.columnId === "contacted"),
    discussion: count((c) => c.columnId === "discovery" || c.columnId === "proposal"),
    converted: count((c) => !!c.deal_id),
  };

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Inquiries"
        sub={`${cards.length} open · contact-us intake, drag a card to change stage`}
      />
      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error.message}
        </div>
      )}
      <div className="mp-kpi-grid" style={{ marginBottom: 16 }}>
        <MetricCard label="New" value={kpis.fresh} sub="unworked" />
        <MetricCard label="Contacted" value={kpis.contacted} />
        <MetricCard label="In discussion" value={kpis.discussion} />
        <MetricCard label="Converted to deal" value={kpis.converted} />
      </div>
      <InquiriesBoard initialCards={cards} />
    </>
  );
}
