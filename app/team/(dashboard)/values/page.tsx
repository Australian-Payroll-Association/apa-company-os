import { requireTeamMember } from "@/lib/team-auth";
import { companyOs } from "@/lib/supabase";
import { PageHead } from "@/components/admin/PageHead";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Core Values",
  description: "The six values Edge8 works by.",
};

// /team/values — the six core values, company-visible and read-only. Rows live
// in company_os.core_values (seeded by scripts/edges/migrate-core-values.mjs);
// the glyphs are presentation-only, keyed by sort_order.
type ValueRow = { id: string; sort_order: number; title: string; description: string };

const VALUE_ICONS = ["✦", "▲", "◎", "✓", "✎", "☼"];

export default async function TeamValuesPage() {
  await requireTeamMember();

  const res = await companyOs
    .from("core_values")
    .select("id, sort_order, title, description")
    .order("sort_order");
  const values = (res.data ?? []) as ValueRow[];

  return (
    <>
      <PageHead
        eyebrow="Company"
        title="Core Values"
        sub="How we work, whatever we're working on."
      />

      {values.length === 0 && <div className="admin-empty">No core values published yet.</div>}

      <div className="team-values-grid">
        {values.map((v, i) => (
          <div key={v.id} className="team-value-card">
            <span className="team-value-head">
              <span className="team-value-num" aria-hidden>
                {VALUE_ICONS[i % VALUE_ICONS.length]}
              </span>
              <span className="team-value-title">{v.title}</span>
            </span>
            <span className="team-value-body">{v.description}</span>
          </div>
        ))}
      </div>
    </>
  );
}
