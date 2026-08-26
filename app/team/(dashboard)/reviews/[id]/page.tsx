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
import type { ReviewTranscriptSummary } from "@/lib/ai/review-summary";
import {
  finalizeReviewAction,
  addReviewTranscriptAction,
  setReviewSummaryIncludedAction,
} from "../actions";

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

// The call-transcript card the reviewer sees: the current draft summary (if a
// transcript has been added) plus the box to add or replace one. The transcript
// and its summary live on the manager row's metadata.transcript_summary.
function ReviewTranscriptCard({
  reviewId,
  summary,
  locked,
}: {
  reviewId: string;
  summary: ReviewTranscriptSummary | null;
  locked: boolean;
}) {
  return (
    <div className="admin-card" style={{ padding: "18px 20px", marginBottom: 16 }}>
      <div className="admin-card-title">Call transcript</div>

      {summary?.ai_status === "pending" && (
        <p className="admin-hint" style={{ marginTop: 8 }}>
          Summarizing the transcript. Refresh in a moment.
        </p>
      )}
      {summary?.ai_status === "error" && (
        <p style={{ marginTop: 8, fontSize: 13 }}>
          <Badge tone="err">Summary failed</Badge>{" "}
          {summary.ai_error ? <span>{summary.ai_error}</span> : null} Re-add the transcript to retry.
        </p>
      )}
      {summary?.ai_status === "ready" && (
        <div style={{ marginTop: 8 }}>
          <Badge tone="neutral">Draft from call</Badge>
          {summary.overview && (
            <p style={{ margin: "8px 0 0", fontSize: 13, whiteSpace: "pre-wrap" }}>{summary.overview}</p>
          )}
          {summary.strengths.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 12 }}>Strengths</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {summary.strengths.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {summary.growth_areas.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 12 }}>Growth areas</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {summary.growth_areas.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </>
          )}
          {summary.dimensions.length > 0 && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, marginTop: 12 }}>By dimension</div>
              <ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 13 }}>
                {summary.dimensions.map((d) => (
                  <li key={d.key}>
                    <strong>{d.label}:</strong> {d.signal}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--admin-line)" }}>
            <div style={{ fontWeight: 700, fontSize: 13 }}>
              From call section{" "}
              {summary.included ? (
                <Badge tone="ok">Folded into review</Badge>
              ) : (
                <Badge tone="neutral">Not in review yet</Badge>
              )}
            </div>
            <p className="admin-hint" style={{ marginTop: 4 }}>
              Edit the text below, then fold it into the overall review as a labeled section.
            </p>
            {!locked && (
              <form action={setReviewSummaryIncludedAction} className="admin-field" style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={reviewId} />
                <textarea
                  name="final_markdown"
                  rows={7}
                  defaultValue={summary.final_markdown ?? summary.section_markdown ?? ""}
                  className="admin-input"
                  style={{ fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
                />
                <div className="admin-form-actions">
                  <button type="submit" name="include" value="1" className="admin-btn admin-btn--primary">
                    {summary.included ? "Update section" : "Fold into review"}
                  </button>
                  {summary.included && (
                    <button type="submit" name="include" value="0" className="admin-btn">
                      Remove from review
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {!locked && (
        <form
          action={addReviewTranscriptAction}
          className="admin-field"
          style={{ marginTop: summary ? 16 : 8 }}
        >
          <input type="hidden" name="id" value={reviewId} />
          <textarea
            name="transcript"
            rows={5}
            placeholder="Paste the call transcript, or upload a file below."
            className="admin-input"
            style={{ fontSize: 13, fontFamily: "inherit", resize: "vertical" }}
          />
          <div className="admin-form-actions">
            <input type="file" name="file" accept=".txt,.vtt,.srt,.md,.markdown,.docx" style={{ fontSize: 13 }} />
            <button type="submit" className="admin-btn admin-btn--primary">
              {summary ? "Replace transcript" : "Add transcript"}
            </button>
          </div>
          <span className="admin-hint" style={{ margin: 0 }}>
            .txt, .vtt, .srt, .md, or .docx (max 10 MB). We summarize it against the review dimensions.
          </span>
        </form>
      )}
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
  const managerSummary =
    (manager?.metadata.transcript_summary as ReviewTranscriptSummary | undefined) ?? null;
  // The folded-in "From call" section, shown read-only to the subject/observer
  // (the reviewer sees and edits it inside their transcript card instead).
  const foldedSection =
    managerSummary?.included && managerSummary.final_markdown ? managerSummary.final_markdown : null;

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

      {detail.isReviewer && manager && (
        <ReviewTranscriptCard
          reviewId={detail.anchor.id}
          summary={managerSummary}
          locked={manager.status === "finalized"}
        />
      )}

      {!detail.isReviewer && foldedSection && (
        <div className="admin-card" style={{ padding: "18px 20px", marginBottom: 16 }}>
          <div className="admin-card-title">From call</div>
          <p style={{ margin: "4px 0 0", fontSize: 13, whiteSpace: "pre-wrap" }}>{foldedSection}</p>
        </div>
      )}

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

      {detail.isReviewer && manager && manager.status !== "finalized" && (
        <div style={{ marginBottom: 16 }}>
          <Link className="admin-btn" href={`/surveys/perf-review-manager?review=${manager.id}`}>
            Edit review
          </Link>
          <p className="admin-hint" style={{ marginTop: 6 }}>
            Change any of your ratings or answers before finalizing. The self-assessment stays as
            {" "}
            {detail.subjectName} wrote it.
          </p>
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
