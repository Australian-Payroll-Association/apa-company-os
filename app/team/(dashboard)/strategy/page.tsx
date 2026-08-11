import { remark } from "remark";
import remarkHtml from "remark-html";
import { requireTeamMember } from "@/lib/team-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";
import type { StrategyRow } from "@/app/admin/(dashboard)/edges/edges-shared";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Strategy",
  description: "The company strategy for the year, visible to the whole team.",
};

// /team/strategy — read-only, company-visible view of the latest strategies
// row. Edited from /admin/edges/goals; content updates are DB writes, not code.
export default async function TeamStrategyPage() {
  await requireTeamMember();

  const res = await companyOs
    .from("strategies")
    .select("id, year, title, body_md")
    .order("year", { ascending: false })
    .limit(1);
  const strategy = (res.data?.[0] as StrategyRow | undefined) ?? null;

  const bodyHtml = strategy?.body_md
    ? String(await remark().use(remarkHtml, { sanitize: true }).process(strategy.body_md))
    : null;

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Strategy"
        sub={strategy ? `${strategy.year}` : undefined}
      />

      {!strategy && <div className="admin-empty">No strategy published yet.</div>}

      {strategy && (
        <div className="admin-card" style={{ maxWidth: 720 }}>
          <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55, margin: 0 }}>{strategy.title}</p>
          {bodyHtml && (
            <div
              className="idea-plan"
              style={{ marginTop: 12 }}
              dangerouslySetInnerHTML={{ __html: bodyHtml }}
            />
          )}
        </div>
      )}
    </>
  );
}
