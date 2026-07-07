import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";

// Read counts fresh on every request — this is live operational data.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dashboard",
  description: "Company OS home with today's revenue, talent, and operations numbers.",
};

// Count rows in a table. `head: true` fetches only the count (no rows over the wire).
async function countRows(table: string): Promise<number | null> {
  const { count, error } = await companyOs.from(table).select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US"));

export default async function DashboardPage() {
  const [people, companies, inquiries, deals, jobReqs, applications, orders, bookings] =
    await Promise.all([
      countRows("people"),
      countRows("companies"),
      countRows("inquiries"),
      countRows("deals"),
      countRows("job_requisitions"),
      countRows("applications"),
      countRows("orders"),
      countRows("bookings"),
    ]);

  return (
    <>
      <PageHead
        eyebrow="Company OS"
        title="Dashboard"
        sub="Live overview of the Edge8 Company Database."
      />

      <div className="mp-kpi-grid">
        <MetricCard label="Contacts" value={fmt(people)} href="/admin/contacts" />
        <MetricCard label="Companies" value={fmt(companies)} href="/admin/revenue/companies" />
        <MetricCard label="Inquiries" value={fmt(inquiries)} href="/admin/revenue/inquiries" />
        <MetricCard label="Deals" value={fmt(deals)} href="/admin/revenue/deals" />
        <MetricCard label="Job Reqs" value={fmt(jobReqs)} href="/admin/talent/jobs" />
        <MetricCard label="Applications" value={fmt(applications)} href="/admin/talent/applications" />
        <MetricCard label="Orders" value={fmt(orders)} href="/admin/revenue/orders" />
        <MetricCard label="AIO Pad" value={fmt(bookings)} href="/admin/revenue/bookings" />
      </div>

      <div className="admin-card" style={{ padding: "20px 22px" }}>
        <p className="admin-cell-muted" style={{ fontSize: 14 }}>
          Screens roll out office by office (Revenue first: Leads &amp; Customers and
          Inquiries are live). Per-office KPI strips, pipeline value, and the remaining
          list/detail screens land next. This confirms auth, the brand filter, and live
          reads from <code>company_os</code> all work.
        </p>
      </div>
    </>
  );
}
