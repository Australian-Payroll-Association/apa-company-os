import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { WORK_TYPES } from "@/lib/scheduling";
import { CapabilityMatrix, type CapabilityPerson, type CellState } from "./CapabilityMatrix";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Capability",
  description: "Who can do what, how fast — the assignment matrix.",
};

type MemberRow = {
  person: {
    id: string;
    display_name: string | null;
    full_name: string | null;
    preferred_name: string | null;
    email: string | null;
  } | null;
};

function nameOf(p: NonNullable<MemberRow["person"]>): string {
  return p.preferred_name || p.display_name || p.full_name || p.email || "Unknown";
}

// Phase 2 of Improved Scheduling & Tracking: Adriana's head, written down. Per
// person, per work type — how fast, and whether they like it. Kept fresh at
// project close-out, not by periodic review (that staleness kills every matrix).
export default async function CapabilityPage() {
  await requireAdmin();

  const [membersRes, capsRes] = await Promise.all([
    companyOs
      .from("team_members")
      .select("person:people!person_id(id, display_name, full_name, preferred_name, email)")
      .eq("status", "active"),
    companyOs.from("capability").select("person_id, work_type, level, preference"),
  ]);

  const people: CapabilityPerson[] = ((membersRes.data ?? []) as unknown as MemberRow[])
    .map((m) => m.person)
    .filter((p): p is NonNullable<MemberRow["person"]> => !!p)
    .map((p) => ({ id: p.id, name: nameOf(p) }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const cells: Record<string, CellState> = {};
  for (const c of (capsRes.data ?? []) as {
    person_id: string;
    work_type: string;
    level: string;
    preference: string | null;
  }[]) {
    cells[`${c.person_id}|${c.work_type}`] = { level: c.level as CellState["level"], preference: c.preference as CellState["preference"] };
  }

  return (
    <div>
      <PageHead
        eyebrow={<Link href="/admin/operations/scheduling">← Scheduling</Link>}
        title="Capability matrix"
        sub="Who can do what, and how fast. Set a level per person per work type; it drives assignment."
      />

      {people.length === 0 ? (
        <div className="sched-empty">No active team members yet.</div>
      ) : (
        <CapabilityMatrix people={people} workTypes={WORK_TYPES as readonly string[] as string[]} initialCells={cells} />
      )}

      <p className="sched-foot" style={{ marginTop: 18 }}>
        Work types are a provisional set until the Kantata project-type list is exported (decision, 1&nbsp;Sep&nbsp;2026).
        Durable certifications live in <code>person_qualifications</code>, not here.
      </p>
    </div>
  );
}
