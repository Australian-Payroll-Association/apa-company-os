import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth";
import { getOrgChart, type OrgEntry } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Org Chart",
  description: "How Edge8 fits together: the reporting tree, live from the directory.",
};

// /team/org — the reporting tree, read-only and company-visible like the
// directory. Built entirely from team_members.manager_id: roots are people
// with no manager. Everyone is expected to have a manager, so a person with
// none surfaces as a root rather than being dropped.
function childrenOf(entries: OrgEntry[]): Map<string | null, OrgEntry[]> {
  const ids = new Set(entries.map((e) => e.id));
  const map = new Map<string | null, OrgEntry[]>();
  for (const e of entries) {
    // A manager outside the roster (e.g. departed) would orphan the subtree —
    // surface it at the top level rather than dropping it silently.
    const key = e.managerId && ids.has(e.managerId) ? e.managerId : null;
    map.set(key, [...(map.get(key) ?? []), e]);
  }
  return map;
}

function countReports(id: string, map: Map<string | null, OrgEntry[]>): number {
  const kids = map.get(id) ?? [];
  return kids.length + kids.reduce((n, k) => n + countReports(k.id, map), 0);
}

function OrgCard({ entry, isRoot, reports }: { entry: OrgEntry; isRoot?: boolean; reports?: number }) {
  const meta = [entry.positionTitle, entry.departmentName].filter(Boolean).join(" · ");
  // Blue badge / orange badge, the Microsoft way: FTE blue, contractor orange.
  const isContractor = entry.employmentType === "contract";
  return (
    <Link href={`/team/directory/${entry.id}`} className={`team-org-card${isRoot ? " is-root" : ""}`}>
      <span className="team-org-name">{entry.name}</span>
      {(meta || reports) && (
        <span className="team-org-meta">
          {meta || "—"}
          {reports ? ` · ${reports} ${reports === 1 ? "report" : "reports"}` : ""}
        </span>
      )}
      <span className={`team-org-badge ${isContractor ? "is-contract" : "is-fte"}`}>
        {isContractor ? "Contractor" : "FTE"}
      </span>
    </Link>
  );
}

function OrgNode({
  entry,
  map,
  depth,
}: {
  entry: OrgEntry;
  map: Map<string | null, OrgEntry[]>;
  depth: number;
}) {
  const kids = map.get(entry.id) ?? [];
  return (
    <li className="team-org-node">
      <OrgCard entry={entry} isRoot={depth === 0} reports={kids.length ? countReports(entry.id, map) : 0} />
      {kids.length > 0 && (
        // Levels 1–2 fan out horizontally; level 3+ stacks vertically so the
        // chart stays readable at full-team width.
        <ul className={depth >= 1 ? "is-stack" : undefined}>
          {kids.map((k) => (
            <OrgNode key={k.id} entry={k} map={map} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function TeamOrgPage() {
  await requireTeamMember();
  const entries = await getOrgChart();
  const map = childrenOf(entries);

  const roots = map.get(null) ?? [];

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Org Chart"
        sub={`${entries.length} people · live from the directory`}
      />

      <div className="team-org-wrap">
        <ul className="team-org">
          {roots.map((r) => (
            <OrgNode key={r.id} entry={r} map={map} depth={0} />
          ))}
        </ul>
      </div>
    </>
  );
}
