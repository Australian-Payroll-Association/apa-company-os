"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment, endAssignment } from "@/app/admin/(dashboard)/talent/team/assignment-actions";
import type { AssignmentForCompany, TeamMemberOption } from "@/lib/admin/staff-assignments";

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
  const [msg, setMsg] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!teamMemberId) return;
    setMsg(null);
    start(async () => {
      const res = await createAssignment({ companyId, teamMemberId, roleTitle });
      if (res.ok) {
        setTeamMemberId("");
        setRoleTitle("");
        router.refresh();
      } else {
        setMsg(res.error);
      }
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
                <div className="admin-list-sub">{a.role_title || a.position_title || "—"}</div>
              </div>
              <div className="admin-list-aside">
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
          <label className="admin-label" htmlFor="assign-role-title">Role (client-visible, optional)</label>
          <input
            id="assign-role-title"
            className="admin-input"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="e.g. AI Engineer"
          />
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
