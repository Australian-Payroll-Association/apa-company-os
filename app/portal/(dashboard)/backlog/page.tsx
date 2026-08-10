import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { getBacklogForActor, getOverviewForActor } from "@/lib/portal/backlog";
import { PageHead } from "@/components/admin/PageHead";
import { BotText } from "@/components/assistant/BotText";
import { BacklogPortalView } from "./BacklogPortalView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roadmap",
};

export default async function PortalBacklogPage() {
  const actor = await requirePortalMember();
  const [items, overview] = await Promise.all([
    getBacklogForActor(actor),
    getOverviewForActor(actor),
  ]);

  // v1: propose against the single company in scope. Multi-company portal users
  // are rare; when present we use the first — refine with a picker if needed.
  const companyId = actor.companyScope[0] ?? "";

  return (
    <>
      <PageHead
        eyebrow={<Link href="/portal/projects">← Programs</Link>}
        title="Roadmap"
        sub="Every opportunity from your workflow audits, grouped and prioritised. Set your own priority on any item, and propose new ones for Edge8 to pick up."
      />
      {overview && (
        <section className="admin-card admin-section-card" style={{ marginBottom: 18, maxWidth: 940 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
          <div className="portal-roadmap-overview" style={{ fontSize: 14, lineHeight: 1.65 }}>
            <BotText text={overview} />
          </div>
        </section>
      )}
      <BacklogPortalView items={items} companyId={companyId} />
    </>
  );
}
