import Link from "next/link";
import { notFound } from "next/navigation";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import { MetricCard } from "@/components/admin/MetricCard";
import { Badge, statusTone } from "@/components/admin/Badge";
import { InvitePortalButton } from "@/components/admin/InvitePortalButton";
import { PreviewRow } from "@/components/admin/PreviewRow";
import { getPersonSurveyResponses } from "@/lib/admin/surveys";
import { formatDate, humanize } from "@/lib/admin/format";
import {
  LEAVE_TYPE_LABEL,
  countWorkingDays,
  formatDays,
  formatLeaveBalance,
  statusTone as leaveStatusTone,
} from "@/lib/admin/time-off";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Team member",
  description: "Employment, leave policy, and time-off history for one team member.",
};

// Talent → Team member profile. Everything about one team member (employment,
// leave policy, schedule, balance, time-off history) in one place. Sourced from
// company_os.team_directory — no link into the sales Contact 360.
type DirectoryRow = {
  id: string;
  person_id: string | null;
  full_name: string | null;
  email: string;
  auth_user_id: string | null;
  status: string | null;
  employee_number: string | null;
  employment_type: string | null;
  start_date: string | null;
  end_date: string | null;
  department_name: string | null;
  position_title: string | null;
  manager_name: string | null;
  team: string | null;
  location: string | null;
  leave_policy: string | null;
  work_schedule: string | null;
  used_days: number | string | null;
  total_days: number | string | null;
};

type LeaveRow = {
  id: string;
  leave_type: string;
  status: string;
  start_date: string;
  end_date: string;
  is_half_day: boolean;
  days: number | string | null;
  reason: string | null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
};

export default async function TeamMemberPage({ params }: { params: { id: string } }) {
  const [memberRes, leaveRes] = await Promise.all([
    companyOs.from("team_directory").select("*").eq("id", params.id).maybeSingle(),
    companyOs
      .from("time_off")
      .select("id, leave_type, status, start_date, end_date, is_half_day, days, reason")
      .eq("team_member_id", params.id)
      .order("start_date", { ascending: false })
      .limit(100),
  ]);

  const m = memberRes.data as DirectoryRow | null;
  if (!m) notFound();

  // Survey responses are keyed by person, not team member. Skip the lookup when
  // the directory row has no linked person (nothing could be attributed to it).
  const surveyResponses = m.person_id ? await getPersonSurveyResponses(m.person_id) : [];

  const requests = (leaveRes.data ?? []) as LeaveRow[];
  const name = m.full_name || m.email;
  const total = num(m.total_days);
  const used = num(m.used_days);
  const remaining = total !== null && used !== null ? Math.round((total - used) * 10) / 10 : null;

  return (
    <>
      <PageHead
        eyebrow={<Link href="/admin/talent/team">← Team</Link>}
        title={name}
        sub={[m.position_title, m.email].filter(Boolean).join(" · ")}
        action={
          m.status ? <Badge tone={statusTone(m.status)}>{humanize(m.status)}</Badge> : undefined
        }
      />

      {total !== null && (
        <div className="mp-kpi-grid" style={{ marginBottom: 20 }}>
          <MetricCard label="Entitled" value={formatLeaveBalance(total)} sub="days this period" />
          <MetricCard label="Used" value={formatLeaveBalance(used)} sub="days taken" />
          <MetricCard
            label="Remaining"
            value={remaining !== null ? formatLeaveBalance(remaining) : "—"}
            sub="days left"
          />
        </div>
      )}

      <div className="admin-360">
        <div>
          <div className="admin-card admin-section-card">
            <h2 className="admin-card-title">Employment</h2>
            <dl className="admin-kv">
              <dt>Team</dt>
              <dd>{m.team || "—"}</dd>
              <dt>Department</dt>
              <dd>{m.department_name || "—"}</dd>
              <dt>Position</dt>
              <dd>{m.position_title || "—"}</dd>
              <dt>Approver</dt>
              <dd>{m.manager_name || "—"}</dd>
              <dt>Employment type</dt>
              <dd>{m.employment_type ? humanize(m.employment_type) : "—"}</dd>
              <dt>Employee #</dt>
              <dd>{m.employee_number || "—"}</dd>
              <dt>Location</dt>
              <dd>{m.location || "—"}</dd>
              <dt>Start date</dt>
              <dd>{m.start_date ? formatDate(m.start_date) : "—"}</dd>
              {m.end_date && (
                <>
                  <dt>End date</dt>
                  <dd>{formatDate(m.end_date)}</dd>
                </>
              )}
            </dl>
          </div>

          <div className="admin-card admin-section-card">
            <h2 className="admin-card-title">Leave</h2>
            <dl className="admin-kv">
              <dt>Leave policy</dt>
              <dd>{m.leave_policy || "—"}</dd>
              <dt>Work schedule</dt>
              <dd>{m.work_schedule || "—"}</dd>
            </dl>
          </div>

          <div className="admin-card admin-section-card">
            <h2 className="admin-card-title">Portal access</h2>
            <p className="admin-page-sub" style={{ marginTop: 0 }}>{m.email}</p>
            {m.person_id ? (
              <InvitePortalButton teamMemberId={m.id} provisioned={!!m.auth_user_id} full />
            ) : (
              <span className="admin-cell-muted">No linked person record.</span>
            )}
          </div>
        </div>

        <div>
          <div className="admin-card admin-section-card">
            <h2 className="admin-card-title">Time off ({requests.length})</h2>
            {requests.length === 0 ? (
              <div className="admin-empty">No time-off requests yet.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const days =
                        num(r.days) ?? countWorkingDays(r.start_date, r.end_date, r.is_half_day);
                      const range =
                        r.start_date === r.end_date
                          ? formatDate(r.start_date) + (r.is_half_day ? " (half)" : "")
                          : `${formatDate(r.start_date)} → ${formatDate(r.end_date)}`;
                      return (
                        <tr key={r.id}>
                          <td>
                            {LEAVE_TYPE_LABEL[r.leave_type as keyof typeof LEAVE_TYPE_LABEL] ??
                              humanize(r.leave_type)}
                          </td>
                          <td>{range}</td>
                          <td>{days > 0 ? formatDays(days) : "—"}</td>
                          <td>
                            <Badge tone={leaveStatusTone(r.status)}>{humanize(r.status)}</Badge>
                          </td>
                          <td className="admin-cell-muted">{r.reason || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="admin-card admin-section-card">
            <h2 className="admin-card-title">Survey responses ({surveyResponses.length})</h2>
            {surveyResponses.length === 0 ? (
              <div className="admin-empty">No survey responses yet.</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Survey</th>
                      <th>Submitted</th>
                      <th style={{ textAlign: "right" }}>Answered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {surveyResponses.map((s) => (
                      <PreviewRow
                        key={s.id}
                        title={s.surveyName}
                        eyebrow={`Submitted ${formatDate(s.submittedAt)}`}
                        preview={
                          <div style={{ display: "grid", gap: 14 }}>
                            {s.fields.map((f) => (
                              <div key={f.fieldId}>
                                <div className="admin-cell-muted">{f.label}</div>
                                <div>{f.value ?? "—"}</div>
                              </div>
                            ))}
                          </div>
                        }
                      >
                        <td className="admin-cell-strong">{s.surveyName}</td>
                        <td title={formatDate(s.submittedAt)}>{formatDate(s.submittedAt)}</td>
                        <td className="admin-cell-mono" style={{ textAlign: "right" }}>
                          {s.answeredCount}/{s.fieldCount}
                        </td>
                      </PreviewRow>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
