import { notFound } from "next/navigation";
import { discoveryDb, normalizeOverview } from "@/lib/discovery/data";
import { computeProgress } from "@/lib/discovery/progress";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { getSiteOrigin } from "@/lib/site-origin";
import { DiscoveryReview } from "./DiscoveryReview";
import { ResendInviteButton } from "./ResendInviteButton";

export const dynamic = "force-dynamic";

const one = <T,>(e: T | T[] | null): T | null => (Array.isArray(e) ? (e[0] ?? null) : e);

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  submitted: "Submitted",
  under_review: "Under review",
  report_drafted: "Report drafted",
  completed: "Completed",
};
const STATUS_TONE: Record<string, BadgeTone> = {
  not_started: "neutral",
  in_progress: "info",
  submitted: "warn",
  under_review: "warn",
  report_drafted: "ok",
  completed: "ok",
};

export default async function DiscoveryDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { inviteFailed?: string };
}) {
  const { data: engagement, error } = await discoveryDb
    .from("discovery_engagements")
    .select(
      "id, client_name, status, overview, team_members, access_token, created_at, submitted_at, client_email, client_contact_name, consultant_email, consultant:people!consultant_person_id(full_name, email)",
    )
    .eq("id", params.id)
    .maybeSingle();
  if (error || !engagement) notFound();

  const [{ data: responses }, { data: findings }, { data: evidence }] = await Promise.all([
    discoveryDb.from("discovery_responses").select("question_id, options, text").eq("engagement_id", engagement.id),
    discoveryDb
      .from("discovery_findings")
      .select("id, question_id, status, priority, owner, target_date, notes")
      .eq("engagement_id", engagement.id),
    discoveryDb.from("discovery_evidence_items").select("id, name, status").eq("engagement_id", engagement.id).order("created_at"),
  ]);

  const consultant = one(engagement.consultant as { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null);
  const clientUrl = `${getSiteOrigin()}/discovery/${engagement.access_token}`;
  const preSubmission = !["submitted", "under_review", "report_drafted", "completed"].includes(engagement.status);
  const progress = computeProgress(normalizeOverview(engagement.overview), engagement.team_members ?? [], responses ?? []);

  return (
    <>
      <PageHead
        eyebrow="Payroll 360 Discovery"
        title={engagement.client_name}
        sub={consultant?.full_name ? `Consultant: ${consultant.full_name}` : "No consultant assigned"}
        action={<Badge tone={STATUS_TONE[engagement.status] ?? "neutral"}>{STATUS_LABEL[engagement.status] ?? engagement.status}</Badge>}
      />
      {searchParams.inviteFailed === "1" && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          The invite email to {engagement.client_email} failed to send — the sender address may not be verified yet. Copy the
          client link below and send it manually, or try Resend invite once the sender is fixed.
        </div>
      )}
      <div className="admin-section-card" style={{ marginBottom: 16, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div className="admin-cell-muted" style={{ fontSize: 12 }}>Created</div>
            <div>{formatDate(engagement.created_at)}</div>
          </div>
          <div>
            <div className="admin-cell-muted" style={{ fontSize: 12 }}>Submitted</div>
            <div>{engagement.submitted_at ? formatDate(engagement.submitted_at) : "—"}</div>
          </div>
          <div>
            <div className="admin-cell-muted" style={{ fontSize: 12 }}>Client contact</div>
            <div>
              {engagement.client_email ? (
                <>
                  {engagement.client_contact_name && <>{engagement.client_contact_name} — </>}
                  {engagement.client_email}
                </>
              ) : (
                <span className="admin-cell-muted">Not on file</span>
              )}
            </div>
          </div>
          <div>
            <div className="admin-cell-muted" style={{ fontSize: 12 }}>Sends / alerts from</div>
            <div>{engagement.consultant_email || <span className="admin-cell-muted">System default</span>}</div>
          </div>
          {preSubmission && (
            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="admin-cell-muted" style={{ fontSize: 12 }}>Progress</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: "var(--admin-line, #e2e5ea)", overflow: "hidden" }}>
                  <div style={{ width: `${progress.pct}%`, height: "100%", background: "var(--admin-accent)", borderRadius: 3 }} />
                </div>
                <span style={{ fontSize: 12, whiteSpace: "nowrap" }}>{progress.pct}% ({progress.answered}/{progress.total})</span>
              </div>
            </div>
          )}
        </div>
        {preSubmission && (
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--admin-line, #e2e5ea)", paddingTop: 12 }}>
            <div style={{ flex: 1, minWidth: 260 }}>
              <div className="admin-cell-muted" style={{ fontSize: 12 }}>Client link (not yet submitted — safe to send)</div>
              <code style={{ fontSize: 12, wordBreak: "break-all" }}>{clientUrl}</code>
            </div>
            {engagement.client_email && <ResendInviteButton engagementId={engagement.id} />}
          </div>
        )}
      </div>
      <DiscoveryReview
        engagementId={engagement.id}
        clientName={engagement.client_name}
        overview={normalizeOverview(engagement.overview)}
        teamMembers={engagement.team_members ?? []}
        responses={responses ?? []}
        findings={findings ?? []}
        evidence={evidence ?? []}
      />
    </>
  );
}
