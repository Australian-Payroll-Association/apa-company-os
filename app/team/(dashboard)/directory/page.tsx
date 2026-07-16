import { requireTeamMember } from "@/lib/team-auth";
import { getDirectory } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Directory",
  description: "Who's who at Edge8: roles, departments, and reporting lines.",
};

// "Đặng Phương Mai" -> "PM", "Dave" -> "DA".
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const raw = parts.length >= 2 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return raw.toUpperCase();
}

// /team/directory — read-only, company-visible roster. getDirectory() returns a
// FIXED safe column list (names/roles only — no contact details, and never the
// team_directory view, which carries leave balances).
export default async function TeamDirectoryPage() {
  await requireTeamMember();
  const entries = await getDirectory();

  return (
    <>
      <PageHead
        eyebrow="Me"
        title="Directory"
        sub={`${entries.length} ${entries.length === 1 ? "person" : "people"}`}
      />

      {entries.length === 0 ? (
        <div className="admin-empty">No team members found.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Position</th>
                <th>Department</th>
                <th>Location</th>
                <th>Manager</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="admin-cell-strong">
                    <span className="dir-name">
                      <span className="dir-avatar" aria-hidden>
                        {e.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.avatarUrl} alt="" />
                        ) : (
                          <span>{initials(e.name)}</span>
                        )}
                      </span>
                      {e.name}
                    </span>
                  </td>
                  <td>{e.positionTitle || <span className="admin-cell-muted">—</span>}</td>
                  <td>{e.departmentName || <span className="admin-cell-muted">—</span>}</td>
                  <td>{e.location || <span className="admin-cell-muted">—</span>}</td>
                  <td>{e.managerName || <span className="admin-cell-muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
