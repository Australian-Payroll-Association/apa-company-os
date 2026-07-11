import { requirePortalMember } from "@/lib/portal-auth";
import { getAssignedTeam } from "@/lib/portal/team";
import { PageHead } from "@/components/admin/PageHead";
import { formatDate } from "@/lib/admin/format";

export const dynamic = "force-dynamic";

// Client-facing team roster: the Edge8 staff dedicated to this client, scoped
// through company_os.staff_assignments. Directory-safe fields only — see
// lib/portal/team.ts for the column contract (no balances, no employee_number,
// no manager chain).
export default async function PortalTeamPage() {
  const actor = await requirePortalMember();
  const team = await getAssignedTeam(actor);

  return (
    <>
      <PageHead eyebrow="Client Portal" title="Team" sub="Your dedicated Edge8 team." />

      {team.length === 0 ? (
        <div className="admin-card admin-section-card">
          <div className="admin-empty">No dedicated staff assigned yet.</div>
        </div>
      ) : (
        <div className="mp-kpi-grid">
          {team.map((m) => (
            <div className="admin-card admin-section-card" key={m.teamMemberId}>
              <h2 className="admin-card-title">{m.fullName || "Team member"}</h2>
              <dl className="admin-kv">
                <dt>Role</dt>
                <dd>{m.roleTitle || m.positionTitle || "—"}</dd>
                <dt>Location</dt>
                <dd>{m.location || "—"}</dd>
                <dt>Schedule</dt>
                <dd>{m.workSchedule || "—"}</dd>
                {m.startDate && (
                  <>
                    <dt>With you since</dt>
                    <dd>{formatDate(m.startDate)}</dd>
                  </>
                )}
              </dl>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
