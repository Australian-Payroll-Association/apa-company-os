import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { Allocations, type AllocationRow, type PersonOption, type ProjectOption, type DealOption } from "./Allocations";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Allocations",
  description: "Book people onto projects — the load behind the schedule.",
};

type PersonEmbed = { display_name: string | null; full_name: string | null; preferred_name: string | null } | null;
type MemberRow = { id: string; person: PersonEmbed };

function nameOf(p: PersonEmbed): string {
  return p?.preferred_name || p?.display_name || p?.full_name || "Unknown";
}

export default async function AllocationsPage() {
  await requireAdmin();

  const [allocRes, membersRes, boardsRes, dealsRes] = await Promise.all([
    companyOs
      .from("staff_assignments")
      .select("id, team_member_id, board_id, company_id, source_deal_id, allocation_hours, schedule_status, start_date, end_date")
      .not("allocation_hours", "is", null),
    companyOs
      .from("team_members")
      .select("id, person:people!person_id(display_name, full_name, preferred_name)")
      .eq("status", "active"),
    companyOs.from("boards").select("id, name, client_company_id").eq("status", "active").is("archived_at", null),
    companyOs.from("deals").select("id, title").eq("status", "open"),
  ]);

  const members = (membersRes.data ?? []) as unknown as MemberRow[];
  const memberName = new Map(members.map((m) => [m.id, nameOf(m.person)]));
  const people: PersonOption[] = members
    .map((m) => ({ teamMemberId: m.id, name: nameOf(m.person) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const boards = (boardsRes.data ?? []) as { id: string; name: string; client_company_id: string | null }[];
  const companyIds = [...new Set(boards.map((b) => b.client_company_id).filter(Boolean))] as string[];
  const companiesRes = companyIds.length
    ? await companyOs.from("companies").select("id, name").in("id", companyIds)
    : { data: [] as { id: string; name: string }[] };
  const companyName = new Map(((companiesRes.data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));

  const projects: ProjectOption[] = boards
    .filter((b) => b.client_company_id) // allocations need a client company
    .map((b) => ({
      boardId: b.id,
      name: b.name,
      clientName: b.client_company_id ? companyName.get(b.client_company_id) ?? null : null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const projectByBoard = new Map(projects.map((p) => [p.boardId, p]));

  const deals = (dealsRes.data ?? []) as { id: string; title: string }[];
  const dealTitle = new Map(deals.map((d) => [d.id, d.title]));
  const dealOptions: DealOption[] = deals.map((d) => ({ id: d.id, title: d.title }));

  const allocations: AllocationRow[] = ((allocRes.data ?? []) as {
    id: string;
    team_member_id: string;
    board_id: string | null;
    source_deal_id: string | null;
    allocation_hours: number;
    schedule_status: string;
    start_date: string | null;
    end_date: string | null;
  }[])
    .map((a) => ({
      id: a.id,
      personName: memberName.get(a.team_member_id) ?? "Unknown",
      projectName: a.board_id ? projectByBoard.get(a.board_id)?.name ?? "Unknown project" : "—",
      clientName: a.board_id ? projectByBoard.get(a.board_id)?.clientName ?? null : null,
      hours: Number(a.allocation_hours),
      scheduleStatus: a.schedule_status as "confirmed" | "tentative",
      startDate: a.start_date,
      endDate: a.end_date,
      dealTitle: a.source_deal_id ? dealTitle.get(a.source_deal_id) ?? null : null,
      sourceDealId: a.source_deal_id,
    }))
    .sort((a, b) => a.personName.localeCompare(b.personName) || a.projectName.localeCompare(b.projectName));

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/admin/operations/scheduling">← Scheduling</Link>}
        title="Allocations"
        sub="Book people onto projects. Each allocation is the weekly load that shows on the schedule."
      />
      <Allocations
        allocations={allocations}
        people={people}
        projects={projects}
        deals={dealOptions}
      />
    </div>
  );
}
