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
        <div
          style={{
            display: "grid",
            // auto-fit (not the shared .mp-kpi-grid's auto-fill) so these
            // profile cards share the full row width when there are fewer
            // than would fit at the minimum — auto-fill instead leaves empty
            // trailing tracks and pins every card to the 212px floor, which
            // also starves the admin-kv dt/dd grid inside each card down to
            // a near-zero value column.
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 16,
            marginBottom: 20,
          }}
        >
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
