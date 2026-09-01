import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project slip",
  description: "Planned vs elapsed, and days spent waiting on the client.",
};

type SlipRow = {
  board_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  client_response_sla_days: number | null;
  planned_days: number | null;
  elapsed_days: number | null;
  days_waiting_on_client: number | null;
  open_requests: number | null;
};

const num = (v: unknown): number => (v == null ? 0 : Number(v));
const weeks = (days: number | null): string => (days == null ? "—" : `${(days / 7).toFixed(1)}w`);

// Phase 3 of Improved Scheduling & Tracking: the slip decomposition. Each
// project's planned vs elapsed alongside total days-waiting-on-client, so an
// overrun can be split into our load vs the client sitting on a request.
export default async function ProjectSlipPage() {
  await requireAdmin();

  const { data } = await companyOs
    .from("project_slip")
    .select("board_id, name, start_date, end_date, client_response_sla_days, planned_days, elapsed_days, days_waiting_on_client, open_requests")
    .order("name", { ascending: true });

  const rows = (data ?? []) as unknown as SlipRow[];

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/admin/operations/scheduling">← Scheduling</Link>}
        title="Project slip & client requests"
        sub="Planned against elapsed, and how many days each project has spent waiting on the client."
      />

      {rows.length === 0 ? (
        <div className="sched-empty">
          No dated client projects yet. Set a start date on a client board and it appears here.
        </div>
      ) : (
        <div className="sched-tablewrap">
          <table className="sched-table slip-table">
            <thead>
              <tr>
                <th className="sched-name-h">Project</th>
                <th>Planned</th>
                <th>Elapsed</th>
                <th>Overrun</th>
                <th>Waiting on client</th>
                <th>Open requests</th>
                <th>SLA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const planned = num(r.planned_days);
                const elapsed = num(r.elapsed_days);
                const overrun = elapsed - planned;
                const waiting = num(r.days_waiting_on_client);
                return (
                  <tr key={r.board_id}>
                    <td className="sched-name">{r.name}</td>
                    <td className="slip-num">{weeks(r.planned_days)}</td>
                    <td className="slip-num">{weeks(r.elapsed_days)}</td>
                    <td className={`slip-num${overrun > 0 ? " is-over" : ""}`}>
                      {overrun > 0 ? `+${weeks(overrun)}` : "—"}
                    </td>
                    <td className={`slip-num${waiting > 0 ? " is-wait" : ""}`}>
                      {waiting > 0 ? `${waiting}d` : "—"}
                    </td>
                    <td className="slip-num">{r.open_requests ? String(r.open_requests) : "—"}</td>
                    <td className="slip-num">{r.client_response_sla_days ? `${r.client_response_sla_days}d` : "—"}</td>
                    <td className="slip-actions">
                      <Link className="admin-btn admin-btn--sm" href={`/admin/operations/scheduling/slip/${r.board_id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="sched-foot" style={{ marginTop: 16 }}>
        Days-waiting is derived from logged client requests, never stored. Decompose an overrun into
        our load vs waiting-on-client against the response time agreed at kickoff (the SLA).
      </p>
    </div>
  );
}
