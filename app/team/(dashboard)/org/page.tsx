import Link from "next/link";
import { requireTeamMember } from "@/lib/team-auth";
import { getOrgChart, getOpenRoles, type OpenRole, type OrgEntry } from "@/lib/team/data";
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
  // Contractors sit at the bottom of each manager's list: they are not part of
  // the regular 1-1 cadence, so the people a manager runs come first. Entries
  // arrive name-sorted, so a stable sort keeps alphabetical order within each
  // group.
  for (const [key, kids] of map) {
    map.set(key, [...kids].sort((a, b) => rank(a) - rank(b)));
  }
  return map;
}

const rank = (e: OrgEntry) => (e.employmentType === "contract" ? 1 : 0);

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

// Headcount the manager is hiring for, drawn as a dashed placeholder card in
// the same column as their people. Only public reqs link out — an internal req
// has no page for the team to read.
function OpenRoleCard({ role }: { role: OpenRole }) {
  const meta = [role.location, role.employmentType ? EMPLOYMENT_LABEL[role.employmentType] : null]
    .filter(Boolean)
    .join(" · ");
  const inner = (
    <>
      <span className="team-org-name">{role.title}</span>
      <span className="team-org-meta">{meta || "Hiring"}</span>
      <span className="team-org-badge is-open">Open role</span>
    </>
  );
  return role.isPublic && role.slug ? (
    <a
      href={`/careers/${role.slug}`}
      className="team-org-card is-open-role"
      target="_blank"
      rel="noreferrer"
    >
      {inner}
    </a>
  ) : (
    <span className="team-org-card is-open-role">{inner}</span>
  );
}

const EMPLOYMENT_LABEL: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Internship",
  temp: "Temporary",
  advisor: "Advisor",
};

function OrgNode({
  entry,
  map,
  roles,
  depth,
}: {
  entry: OrgEntry;
  map: Map<string | null, OrgEntry[]>;
  roles: Map<string, OpenRole[]>;
  depth: number;
}) {
  const kids = map.get(entry.id) ?? [];
  const open = roles.get(entry.personId) ?? [];
  return (
    <li className="team-org-node">
      <OrgCard entry={entry} isRoot={depth === 0} reports={kids.length ? countReports(entry.id, map) : 0} />
      {(kids.length > 0 || open.length > 0) && (
        // Levels 1–2 fan out horizontally; level 3+ stacks vertically so the
        // chart stays readable at full-team width.
        <ul className={depth >= 1 ? "is-stack" : undefined}>
          {kids.map((k) => (
            <OrgNode key={k.id} entry={k} map={map} roles={roles} depth={depth + 1} />
          ))}
          {/* Vacancies sit after the filled seats: what the manager runs today
              first, what they are hiring for underneath. */}
          {open.map((r) => (
            <li key={r.id} className="team-org-node">
              <OpenRoleCard role={r} />
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function TeamOrgPage() {
  await requireTeamMember();
  const [entries, openRoles] = await Promise.all([getOrgChart(), getOpenRoles()]);
  const map = childrenOf(entries);

  // A req with no hiring manager, or one whose manager is not on the chart,
  // has nowhere to hang — list it under the roster rather than losing it.
  const onChart = new Set(entries.map((e) => e.personId));
  const roles = new Map<string, OpenRole[]>();
  const unassigned: OpenRole[] = [];
  for (const r of openRoles) {
    const key = r.hiringManagerPersonId;
    if (key && onChart.has(key)) roles.set(key, [...(roles.get(key) ?? []), r]);
    else unassigned.push(r);
  }

  const roots = map.get(null) ?? [];
  const openCount = openRoles.length;

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Org Chart"
        sub={`${entries.length} people${openCount ? ` · ${openCount} open ${openCount === 1 ? "role" : "roles"}` : ""} · live from the directory`}
      />

      <div className="team-org-wrap">
        <ul className="team-org">
          {roots.map((r) => (
            <OrgNode key={r.id} entry={r} map={map} roles={roles} depth={0} />
          ))}
        </ul>
      </div>

      {unassigned.length > 0 && (
        <>
          <h2 className="admin-section-label">Open roles without a hiring manager</h2>
          <div className="team-org-unassigned">
            {unassigned.map((r) => (
              <OpenRoleCard key={r.id} role={r} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
