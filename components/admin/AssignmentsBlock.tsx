"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAssignment, endAssignment } from "@/app/admin/(dashboard)/talent/team/assignment-actions";
import type { AssignmentForTeamMember, CompanyOption } from "@/lib/admin/staff-assignments";

// "Assignments" block on the team-member detail page — which clients this
// person is dedicated to, with add/end controls.
export function AssignmentsBlock({
  teamMemberId,
  assignments,
  companies,
}: {
  teamMemberId: string;
  assignments: AssignmentForTeamMember[];
  companies: CompanyOption[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [companyId, setCompanyId] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!companyId) return;
    setMsg(null);
    start(async () => {
      const res = await createAssignment({ companyId, teamMemberId, roleTitle });
      if (res.ok) {
        setCompanyId("");
        setRoleTitle("");
        router.refresh();
      } else {
        setMsg(res.error);
      }
    });
  }

  function handleEnd(id: string) {
    if (!window.confirm("End this assignment?")) return;
    setMsg(null);
    start(async () => {
      const res = await endAssignment(id);
      if (res.ok) router.refresh();
      else setMsg(res.error);
    });
  }

  return (
    <div className="admin-card admin-section-card">
      <h2 className="admin-card-title">Client assignments ({assignments.length})</h2>
      {assignments.length === 0 ? (
        <div className="admin-empty">Not assigned to any client yet.</div>
      ) : (
        <div className="admin-list" style={{ marginBottom: 12 }}>
          {assignments.map((a) => (
            <div className="admin-list-row" key={a.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{a.company_name || "—"}</div>
                <div className="admin-list-sub">{a.role_title || "—"}</div>
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
          <label className="admin-label" htmlFor="assign-company">Assign to client</label>
          <select
            id="assign-company"
            className="admin-input"
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Pick a client…</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="admin-field">
          <label className="admin-label" htmlFor="assign-role-title-2">Role (client-visible, optional)</label>
          <input
            id="assign-role-title-2"
            className="admin-input"
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            placeholder="e.g. AI Engineer"
          />
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={pending || !companyId}>
            {pending ? "Assigning…" : "Assign"}
          </button>
        </div>
      </form>
    </div>
  );
}
