import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { ACTIVE_LEAD_STATUSES } from "@/lib/lifecycle";
import { LeadQueue, type QueueRow } from "./LeadQueue";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leads",
  description: "The SDR queue for qualifying inbound and booking meetings.",
};

// The SDR workstation. A queue, not a list: system-ordered (SLA first, then
// oldest promotion), worked top to bottom. Rows come from the lead satellite
// (one row per person being worked); nurture/unqualified leads leave the queue
// but stay on /admin/contacts; customers never appear here.

const WEEKLY_MEETINGS_GOAL = 8;

type Embedded<T> = T | T[] | null;
const one = <T,>(e: Embedded<T>): T | null => (Array.isArray(e) ? e[0] ?? null : e);

type LeadJoinRow = {
  status: string;
  sla_due_at: string | null;
  attempt_count: number;
  created_at: string;
  people: {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    source: string | null;
    archived_at: string | null;
    person_companies: { companies: Embedded<{ name: string | null }> }[] | null;
    person_qualifications: Embedded<{
      goal: string | null;
      plan: string | null;
      challenge: string | null;
      timeline: string | null;
      budget: string | null;
      authority: string | null;
    }>;
    inquiries: { subject: string | null; message: string | null; created_at: string }[] | null;
  } | null;
};

function startOfWeekIso(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString();
}

function startOfDayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export default async function LeadsPage() {
  const nowIso = new Date().toISOString();

  const [queueRes, meetingsRes, connectsRes] = await Promise.all([
    companyOs
      .from("lead")
      .select(
        "status, sla_due_at, attempt_count, created_at, people!person_id!inner(id, full_name, email, phone, source, archived_at, person_companies(companies(name)), person_qualifications!person_id(goal, plan, challenge, timeline, budget, authority), inquiries(subject, message, created_at))",
      )
      .in("status", ACTIVE_LEAD_STATUSES)
      .is("people.archived_at", null)
      .order("sla_due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .limit(200),
    companyOs
      .from("lifecycle_transitions")
      .select("id", { count: "exact", head: true })
      .eq("reason", "meeting_booked")
      .gte("occurred_at", startOfWeekIso()),
    companyOs
      .from("lifecycle_transitions")
      .select("id", { count: "exact", head: true })
      .eq("to_status", "connected")
      .gte("occurred_at", startOfDayIso()),
  ]);

  const rows: QueueRow[] = (((queueRes.data as unknown) as LeadJoinRow[] | null) ?? [])
    .filter((l) => l.people)
    .map((l) => {
      const p = l.people!;
      const qual = one(p.person_qualifications);
      const latestInquiry = (p.inquiries ?? [])
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      return {
        id: p.id,
        name: p.full_name || p.email,
        email: p.email,
        phone: p.phone,
        company: one(p.person_companies?.[0]?.companies ?? null)?.name ?? null,
        source: p.source,
        stage: "lead",
        status: l.status ?? "new",
        slaDueAt: l.sla_due_at,
        attemptCount: l.attempt_count ?? 0,
        inquiry: latestInquiry
          ? {
              subject: latestInquiry.subject,
              message: latestInquiry.message,
              createdAt: latestInquiry.created_at,
            }
          : null,
        qual: {
          goal: qual?.goal ?? "",
          plan: qual?.plan ?? "",
          challenge: qual?.challenge ?? "",
          timeline: qual?.timeline ?? "",
          budget: qual?.budget ?? "",
          authority: qual?.authority ?? "",
        },
      };
    });

  const meetingsBooked = meetingsRes.count ?? 0;
  const connectsToday = connectsRes.count ?? 0;
  const slaOverdue = rows.filter((r) => r.slaDueAt && r.slaDueAt < nowIso).length;

  return (
    <>
      <PageHead
        eyebrow="Revenue"
        title="Leads"
        sub={`${rows.length} in the queue · worked top to bottom, SLA first`}
      />
      {queueRes.error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {queueRes.error.message}
        </div>
      )}
      <div className="mp-kpi-grid" style={{ marginBottom: 16 }}>
        <MetricCard
          label="Meetings booked this week"
          value={`${meetingsBooked} / ${WEEKLY_MEETINGS_GOAL}`}
          sub="handed off to the closer"
        />
        <MetricCard label="Connects today" value={connectsToday} />
        <MetricCard label="Queue remaining" value={rows.length} />
        <MetricCard
          label="SLA overdue"
          value={slaOverdue}
          sub={slaOverdue > 0 ? "respond now" : "all inside SLA"}
        />
      </div>
      <LeadQueue rows={rows} />
    </>
  );
}
