import { requireTeamMember } from "@/lib/team-auth";
import { getOpenNewsletterEdition, getOwnNewsletterSubmissions } from "@/lib/team/data";
import { PageHead } from "@/components/admin/PageHead";
import { Badge } from "@/components/admin/Badge";
import { formatDate } from "@/lib/admin/format";
import { SECTION_META, isSectionType } from "@/lib/newsletter";
import { ContributeForm } from "./ContributeForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Newsletter",
  description: "Add topics, FAQs and compliance notes to the edition being built.",
};

// Contributor side of the Newsletter Machine. Intake is open all month, not
// just before deadline — that is the whole point of the stage, so this page is
// a standing destination rather than something that appears near the due date.
//
// Training and webinars are absent by design: they come from the events
// calendar automatically, so nobody is asked to type them again.

export default async function TeamNewsletterPage() {
  const actor = await requireTeamMember();
  const edition = await getOpenNewsletterEdition();

  if (!edition) {
    return (
      <div>
        <PageHead
          eyebrow="Newsletter"
          title="Nothing open right now"
          sub="There's no edition taking submissions at the moment."
        />
        <div className="admin-card" style={{ padding: "22px 24px" }}>
          <p className="admin-page-sub" style={{ margin: 0 }}>
            When the next edition opens you'll be able to add topics, FAQs and compliance notes
            here. Anything you spot in the meantime is worth keeping a note of — intake stays open
            for the whole month once it starts.
          </p>
        </div>
      </div>
    );
  }

  const mine = await getOwnNewsletterSubmissions(actor, edition.id);

  return (
    <div>
      <PageHead
        eyebrow="Newsletter"
        title={edition.title}
        sub={
          edition.deadlineAt
            ? `Open for submissions until ${formatDate(edition.deadlineAt)}.`
            : "Open for submissions."
        }
        action={<Badge tone="ok">Open</Badge>}
      />

      <ContributeForm editionId={edition.id} />

      <div className="admin-card" style={{ padding: "22px 24px", marginTop: 16 }}>
        <h2 className="admin-card-title">
          What you&rsquo;ve added {mine.length > 0 && <span style={{ opacity: 0.6 }}>({mine.length})</span>}
        </h2>
        {mine.length === 0 ? (
          <p className="admin-page-sub" style={{ marginTop: 6, marginBottom: 0 }}>
            Nothing yet. Anything you add appears here so you can see what you&rsquo;ve already
            sent — no need to keep your own list.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            {mine.map((s) => (
              <div
                key={s.id}
                style={{
                  borderTop: "1px solid var(--admin-line, rgba(128,128,128,0.25))",
                  paddingTop: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "baseline",
                    flexWrap: "wrap",
                    marginBottom: 4,
                  }}
                >
                  <Badge tone="neutral">
                    {isSectionType(s.sectionType) ? SECTION_META[s.sectionType].label : s.sectionType}
                  </Badge>
                  {s.title && <strong>{s.title}</strong>}
                  <span className="admin-page-sub" style={{ margin: 0, fontSize: 12 }}>
                    {formatDate(s.createdAt)}
                  </span>
                </div>
                <p className="admin-page-sub" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
                  {s.body}
                </p>
                {s.linkUrl && (
                  <p style={{ margin: "6px 0 0" }}>
                    <a href={s.linkUrl} target="_blank" rel="noopener noreferrer">
                      {s.linkUrl}
                    </a>
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
