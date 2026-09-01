import { notFound } from "next/navigation";
import { discoveryDb, normalizeOverview } from "@/lib/discovery/data";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { getSiteOrigin } from "@/lib/site-origin";
import { DiscoveryReview } from "./DiscoveryReview";

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

export default async function DiscoveryDetailPage({ params }: { params: { id: string } }) {
  const { data: engagement, error } = await discoveryDb
    .from("discovery_engagements")
    .select(
      "id, client_name, status, overview, team_members, access_token, created_at, submitted_at, consultant:people!consultant_person_id(full_name, email)",
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

  return (
    <>
      <PageHead
        eyebrow="Payroll 360 Discovery"
        title={engagement.client_name}
        sub={consultant?.full_name ? `Consultant: ${consultant.full_name}` : "No consultant assigned"}
        action={<Badge tone={STATUS_TONE[engagement.status] ?? "neutral"}>{STATUS_LABEL[engagement.status] ?? engagement.status}</Badge>}
      />
      <div className="admin-section-card" style={{ marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
        <div>
          <div className="admin-cell-muted" style={{ fontSize: 12 }}>Created</div>
          <div>{formatDate(engagement.created_at)}</div>
        </div>
        <div>
          <div className="admin-cell-muted" style={{ fontSize: 12 }}>Submitted</div>
          <div>{engagement.submitted_at ? formatDate(engagement.submitted_at) : "—"}</div>
        </div>
        {engagement.status !== "submitted" && engagement.status !== "under_review" && engagement.status !== "report_drafted" && engagement.status !== "completed" && (
          <div style={{ flex: 1, minWidth: 260 }}>
            <div className="admin-cell-muted" style={{ fontSize: 12 }}>Client link (not yet submitted — safe to send)</div>
            <code style={{ fontSize: 12, wordBreak: "break-all" }}>{clientUrl}</code>
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
