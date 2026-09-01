import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { getEditionDetail, trainingWindow } from "@/lib/admin/newsletter";
import { PageHead } from "@/components/admin/PageHead";
import { Badge, type BadgeTone } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { EDITION_STATUS_LABEL, SECTION_META, SECTION_TYPES, describeDetails } from "@/lib/newsletter";
import { EditionControls, IncludeToggle } from "./EditionControls";
import { AddSubmissionForm } from "./AddSubmissionForm";
import { TrainingWindow } from "./TrainingWindow";

export const dynamic = "force-dynamic";

// One edition's intake. Answers the question that used to require chasing five
// people: what has come in, from whom, and what is still missing.

export default async function EditionPage({ params }: { params: { id: string } }) {
  await requireAdmin();
  const detail = await getEditionDetail(params.id);
  if (!detail) notFound();

  const { edition, bySection, tallies, contributors, includedCount } = detail;
  const trainWindow = trainingWindow(edition);
  const short = tallies.filter((t) => t.short);

  const statusTone: BadgeTone =
    edition.status === "open" ? "ok" : edition.status === "cancelled" ? "err" : "neutral";

  return (
    <div>
      <PageHead
        eyebrow={
          <Link href="/admin/revenue/marketing/newsletter" className="admin-cell-muted">
            ← Newsletter
          </Link>
        }
        title={edition.title}
        sub={`${formatDate(edition.periodStart)} – ${formatDate(edition.periodEnd)}${
          edition.deadlineAt ? ` · submissions close ${formatDate(edition.deadlineAt)}` : ""
        }`}
        action={<Badge tone={statusTone}>{EDITION_STATUS_LABEL[edition.status] ?? edition.status}</Badge>}
      />

      <div className="admin-card" style={{ padding: "20px 22px" }}>
        <h2 className="admin-card-title">Where this edition stands</h2>
        <p className="admin-page-sub" style={{ marginTop: 4 }}>
          {includedCount} item{includedCount === 1 ? "" : "s"} included
          {contributors.length > 0 && ` · from ${contributors.join(", ")}`}
        </p>

        {short.length > 0 ? (
          <div className="admin-alert admin-alert--warn" style={{ marginTop: 10 }}>
            Still thin:{" "}
            {short
              .map((t) => `${t.label} (${t.included} of ${t.target})`)
              .join(", ")}
            .
          </div>
        ) : (
          <div className="admin-alert admin-alert--ok" style={{ marginTop: 10 }}>
            Every section has what it needs.
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <EditionControls id={edition.id} status={edition.status} />
        </div>

        <div style={{ marginTop: 14 }}>
          <AddSubmissionForm editionId={edition.id} />
        </div>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--admin-line, rgba(128,128,128,0.25))" }}>
          <TrainingWindow
            id={edition.id}
            from={edition.trainingFrom}
            to={edition.trainingTo}
            fallbackFrom={trainWindow.from.toISOString().slice(0, 10)}
            fallbackTo={trainWindow.to.toISOString().slice(0, 10)}
          />
        </div>
      </div>

      {SECTION_TYPES.map((type) => {
        const items = bySection[type] ?? [];
        const meta = SECTION_META[type];
        return (
          <div key={type} className="admin-card" style={{ padding: "20px 22px", marginTop: 16 }}>
            <div
              style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}
            >
              <h2 className="admin-card-title" style={{ margin: 0 }}>
                {meta.label}
              </h2>
              <Badge tone="neutral">{items.filter((i) => i.included).length} included</Badge>
              {type === "training" && <Badge tone="info">Also pulled from the website</Badge>}
            </div>

            {items.length === 0 ? (
              <p className="admin-page-sub" style={{ marginTop: 8, marginBottom: 0 }}>
                {type === "training"
                  ? "Nothing yet — pull from the training site above, or add a course by hand."
                  : "Nothing submitted yet."}
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 12 }}>
                {items.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      borderTop: "1px solid var(--admin-line, rgba(128,128,128,0.25))",
                      paddingTop: 12,
                      opacity: item.included ? 1 : 0.55,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 12,
                        alignItems: "flex-start",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: "1 1 320px" }}>
                        {item.title && (
                          <strong style={{ display: "block", marginBottom: 2 }}>{item.title}</strong>
                        )}
                        {describeDetails(item.sectionType, item.details).length > 0 && (
                          <p className="admin-page-sub" style={{ margin: "0 0 4px" }}>
                            {describeDetails(item.sectionType, item.details)
                              .map((d) => `${d.label}: ${d.value}`)
                              .join("  ·  ")}
                          </p>
                        )}
                        <p
                          className="admin-page-sub"
                          style={{ margin: 0, whiteSpace: "pre-wrap" }}
                        >
                          {item.body}
                        </p>
                        {item.linkUrl && (
                          <p style={{ margin: "6px 0 0" }}>
                            <a href={item.linkUrl} target="_blank" rel="noopener noreferrer">
                              {item.linkUrl}
                            </a>
                          </p>
                        )}
                        <p
                          className="admin-cell-muted"
                          style={{ margin: "6px 0 0", fontSize: 12 }}
                        >
                          {item.source !== "events"
                            ? item.contributor ?? "Unknown contributor"
                            : item.sectionType === "training"
                              ? "austpayroll.com.au/training"
                              : "Events calendar"}{" "}
                          · {formatDate(item.createdAt)}
                        </p>
                      </div>
                      <IncludeToggle id={item.id} included={item.included} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
