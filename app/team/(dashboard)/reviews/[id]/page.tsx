import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import {
  getReviewDetail,
  REVIEW_DIMENSIONS,
  REVIEW_TYPE_LABEL,
  DECISION_LABEL,
  type ReviewRow,
} from "@/lib/reviews";
import { finalizeReviewAction } from "../actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Review",
  description: "One review cycle: both sides, on the same scale.",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function TextBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 13 }}>{label}</div>
      <p style={{ margin: "4px 0 0", fontSize: 13, whiteSpace: "pre-wrap" }}>{value}</p>
    </div>
  );
}

// /team/reviews/[id] — one cycle, both sides. Visibility is decided in
// getReviewDetail (subject sees finalized-only manager content; the manager
// sees the self-assessment only after submitting their own), so this page
// renders exactly what the lib returns and nothing else.
export default async function ReviewDetailPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  const actor = await requireTeamMember();
  const detail = await getReviewDetail(actor, params.id);
  if (!detail) notFound();

  const { self, manager } = detail;
  const showGap = Boolean(self && manager);
  const anchorRow = manager ?? self;
  const decision = manager?.decision ?? null;

  return (
    <>
      <PageHead
        eyebrow={<Link href="/team/reviews">Reviews</Link>}
        title={`${REVIEW_TYPE_LABEL[detail.anchor.review_type] ?? "Review"}: ${detail.subjectName}`}
        sub={[
          detail.careerLevel
            ? `${detail.careerLevel[0].toUpperCase()}${detail.careerLevel.slice(1)} level`
            : null,
          anchorRow?.submitted_at ? `Submitted ${fmtDate(anchorRow.submitted_at)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />

      {searchParams?.error && (
        <div className="admin-card" style={{ padding: "12px 16px", marginBottom: 14 }}>
          <Badge tone="err">Not finalized</Badge>{" "}
          <span style={{ fontSize: 13 }}>{searchParams.error}</span>
        </div>
      )}

      <div className="admin-card" style={{ padding: "18px 20px", marginBottom: 16 }}>
        <div className="admin-card-title">Ratings</div>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dimension</th>
                {self && <th>Self</th>}
                {manager && <th>Manager</th>}
                {showGap && <th>Gap</th>}
                {detail.expectedLevel !== null && <th>Expected</th>}
              </tr>
            </thead>
            <tbody>
              {REVIEW_DIMENSIONS.map((d) => {
                const sv = self?.ratings[d.key];
                const mv = manager?.ratings[d.key];
                if (sv === undefined && mv === undefined) return null;
                const gap = sv !== undefined && mv !== undefined ? sv - mv : null;
                return (
                  <tr key={d.key}>
                    <td>{d.label}</td>
                    {self && <td>{sv ?? ""}</td>}
                    {manager && <td>{mv ?? ""}</td>}
                    {showGap && (
                      <td>
                        {gap === null || gap === 0 ? (
                          gap === 0 ? "0" : ""
                        ) : (
                          <Badge tone={Math.abs(gap) >= 2 ? "warn" : "neutral"}>
                            {gap > 0 ? `self +${gap}` : `manager +${-gap}`}
                          </Badge>
                        )}
                      </td>
                    )}
                    {detail.expectedLevel !== null && (
                      <td>{d.aiCraft ? detail.expectedLevel : ""}</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(
        [
          manager ? { row: manager, title: "Manager review" } : null,
          self ? { row: self, title: detail.isSubject ? "Your self-assessment" : "Self-assessment" } : null,
        ].filter(Boolean) as { row: ReviewRow; title: string }[]
      ).map(({ row, title }) => (
        <div key={row.id} className="admin-card" style={{ padding: "18px 20px", marginBottom: 16 }}>
          <div className="admin-card-title">{title}</div>
          <TextBlock label="Achievements" value={row.achievements} />
          <TextBlock label="Areas for Improvement" value={row.improvements} />
          <TextBlock label="Additional comments" value={row.comments} />
          {row.rater_kind === "manager" && row.review_type === "midyear" && row.keeper !== null && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Keeper question</div>
              <p style={{ margin: "4px 0 0", fontSize: 13 }}>
                {row.keeper ? "Yes, would fight to keep them" : "No"}
                {row.keeper && (
                  <>
                    {" "}
                    <Badge tone="ok">High performer</Badge>
                  </>
                )}
              </p>
              {typeof row.metadata.twice_as_valuable === "string" && row.metadata.twice_as_valuable && (
                <TextBlock
                  label="What would make them twice as valuable"
                  value={row.metadata.twice_as_valuable}
                />
              )}
            </div>
          )}
          {!row.achievements && !row.improvements && !row.comments && row.rater_kind === "self" && (
            <p className="admin-hint">Ratings only, no written answers.</p>
          )}
        </div>
      ))}

      {decision && (
        <div className="admin-card" style={{ padding: "18px 20px", marginBottom: 16 }}>
          <div className="admin-card-title">Decision</div>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            {DECISION_LABEL[decision] ?? decision}
          </p>
          {typeof manager?.metadata.renewal_changes === "string" && manager.metadata.renewal_changes && (
            <TextBlock label="Role or scope changes" value={manager.metadata.renewal_changes} />
          )}
        </div>
      )}

      {detail.canFinalize && (
        <form action={finalizeReviewAction} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input type="hidden" name="id" value={manager!.id} />
          <button type="submit" className="admin-btn admin-btn--primary">
            Finalize review
          </button>
          <span className="admin-hint" style={{ margin: 0 }}>
            Finalizing makes this review visible to {detail.subjectName}.
          </span>
        </form>
      )}
    </>
  );
}
