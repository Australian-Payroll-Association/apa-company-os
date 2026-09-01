import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { fromISODate, todayISO } from "@/lib/timesheet";
import { ClientRequests, type RequestRow } from "./ClientRequests";

export const dynamic = "force-dynamic";

export const metadata = { title: "Project requests" };

function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86_400_000);
}

export default async function SlipDetailPage({ params }: { params: { boardId: string } }) {
  await requireAdmin();

  const [boardRes, reqRes] = await Promise.all([
    companyOs
      .from("boards")
      .select("id, name, client_company_id, start_date, end_date, client_response_sla_days, status")
      .eq("id", params.boardId)
      .maybeSingle(),
    companyOs
      .from("client_requests")
      .select("id, asked_on, description, answered_on, note")
      .eq("board_id", params.boardId)
      .order("asked_on", { ascending: false }),
  ]);

  const board = boardRes.data as
    | { id: string; name: string; client_response_sla_days: number | null }
    | null;
  if (!board) notFound();

  const today = todayISO();
  const sla = board.client_response_sla_days;
  const raw = (reqRes.data ?? []) as unknown as {
    id: string;
    asked_on: string;
    description: string;
    answered_on: string | null;
    note: string | null;
  }[];

  const requests: RequestRow[] = raw.map((r) => {
    const waiting = daysBetween(r.asked_on, r.answered_on ?? today);
    return {
      id: r.id,
      askedOn: r.asked_on,
      description: r.description,
      answeredOn: r.answered_on,
      note: r.note,
      daysWaiting: waiting,
      breachedSla: sla != null && r.answered_on == null && waiting > sla,
    };
  });

  const openCount = requests.filter((r) => r.answeredOn == null).length;
  const totalWaiting = requests.reduce((s, r) => s + r.daysWaiting, 0);

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/admin/operations/scheduling/slip">← Project slip</Link>}
        title={board.name}
        sub="Log each information request and the day it was answered. Days-waiting feeds the slip decomposition."
      />

      <div className="mp-kpi-grid">
        <MetricCard label="Open requests" value={String(openCount)} sub="awaiting the client" />
        <MetricCard label="Total days waiting" value={`${totalWaiting}d`} sub="across all requests" />
        <MetricCard label="Response SLA" value={sla ? `${sla}d` : "—"} sub="agreed at kickoff" />
      </div>

      <ClientRequests boardId={board.id} requests={requests} slaDays={sla} today={today} />
    </div>
  );
}
