"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment, endAssignment, setAssignmentVisibility } from "@/app/admin/(dashboard)/talent/team/assignment-actions";
import { ASSIGNMENT_ROLES, type AssignmentForCompany, type TeamMemberOption } from "@/lib/admin/staff-assignments";
import { Badge } from "@/components/admin/Badge";

// "Assigned staff" card on the company 360 — who from Edge8 is dedicated to
// this client, with add/end controls.
export function AssignedStaffCard({
  companyId,
  assignments,
  teamMembers,
}: {
  companyId: string;
  assignments: AssignmentForCompany[];
  teamMembers: TeamMemberOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [teamMemberId, setTeamMemberId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [clientVisible, setClientVisible] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!teamMemberId) return;
    setMsg(null);
    start(async () => {
      const res = await createAssignment({ companyId, teamMemberId, roleTitle, clientVisible });
      if (res.ok) {
        setTeamMemberId("");
        setRoleTitle("");
        setClientVisible(true);
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  function toggleVisible(id: string, next: boolean) {
    setMsg(null);
    start(async () => {
      const res = await setAssignmentVisibility(id, next);
      if (res.ok) router.refresh();
      else setMsg(res.error);
    });
  }

  function handleEnd(id: string) {
    if (!window.confirm("End this assignment? It will no longer show for the client.")) return;
    setMsg(null);
    start(async () => {
      const res = await endAssignment(id);
      if (res.ok) router.refresh();
      else setMsg(res.error);
    });
  }

  return (
    <div className="admin-card admin-section-card">
      <h2 className="admin-card-title">Assigned staff ({assignments.length})</h2>
      {assignments.length === 0 ? (
        <div className="admin-empty">No dedicated staff assigned yet.</div>
      ) : (
        <div className="admin-list" style={{ marginBottom: 12 }}>
          {assignments.map((a) => (
            <div className="admin-list-row" key={a.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{a.full_name || a.email || "Unknown"}</div>
                <div className="admin-list-sub" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {a.role_title || a.position_title || "No role set"}
                  {a.client_visible ? (
                    <Badge tone="ok">On client team</Badge>
                  ) : (
                    <Badge tone="neutral">Internal only</Badge>
                  )}
                </div>
              </div>
              <div className="admin-list-aside" style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <button
                  className="admin-btn admin-btn--sm"
                  disabled={pending}
                  onClick={() => toggleVisible(a.id, !a.client_visible)}
                  title={a.client_visible ? "Hide from the client's team roster" : "Show on the client's team roster"}
                >
                  {a.client_visible ? "Make internal" : "Show to client"}
                </button>
                <button
                  className="admin-btn admin-btn--sm admin-btn--danger"
                  disabled={pending}
                  onClick={() => handleEnd(a.id)}
                >
                  End
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form className="admin-form" onSubmit={handleAdd}>
        {msg && <div className="admin-alert admin-alert--err">{msg}</div>}
        <div className="admin-field">
          <label className="admin-label" htmlFor="assign-team-member">Add staff</label>
          <select
            id="assign-team-member"
            className="admin-input"
            value={teamMemberId}
            onChange={(e) => setTeamMemberId(e.target.value)}
          >
            <option value="">Pick a team member…</option>
            {teamMembers.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="assign-role-title">Role (client-visible label, optional)</label>
          <select
            id="assign-role-title"
            className="admin-input"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
          >
            <option value="">No role</option>
            {ASSIGNMENT_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={clientVisible} onChange={(e) => setClientVisible(e.target.checked)} />
            Show on the client&apos;s team roster
          </label>
          <div className="admin-cell-muted" style={{ fontSize: 12, marginTop: 2 }}>
            Uncheck for internal-only staff who should see the account but not appear to the client.
          </div>
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={pending || !teamMemberId}>
            {pending ? "Assigning…" : "Assign"}
          </button>
        </div>
      </form>
    </div>
  );
}
