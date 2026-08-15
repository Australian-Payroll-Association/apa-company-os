import type { Metadata } from "next";
import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { isPortalAdmin, canContribute } from "@/lib/portal/roles";
import { getBacklogForActor, getGroupsForActor, getOverviewForActor } from "@/lib/portal/backlog";
import { PageHead } from "@/components/admin/PageHead";
import { BotText } from "@/components/assistant/BotText";
import { BacklogPortalView } from "./BacklogPortalView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Roadmap",
};

export default async function PortalBacklogPage() {
  const actor = await requirePortalMember();
  const [items, groups, overview] = await Promise.all([
    getBacklogForActor(actor),
    getGroupsForActor(actor),
    getOverviewForActor(actor),
  ]);

  // v1: propose against the single company in scope. Multi-company portal users
  // are rare; when present we use the first — refine with a picker if needed.
  const companyId = actor.companyScope[0] ?? "";
  // Role gates (PR 2): only admins reorder and set priorities; contributors may
  // still propose; viewers get a read-only page. The server re-checks all of it.
  const canPrioritize = companyId ? isPortalAdmin(actor, companyId) : false;
  const canPropose = companyId ? canContribute(actor, companyId) : false;

  return (
    <>
      <PageHead
        eyebrow={<Link href="/portal/programs">← AI Programs</Link>}
        title="Roadmap"
        sub={
          canPrioritize
            ? "Every opportunity from your workflow audits, grouped and prioritised. Set your own priority on any item, and propose new ones for Edge8 to pick up."
            : canPropose
              ? "Every opportunity from your workflow audits, grouped and prioritised. Propose new items for Edge8 to pick up; your account admin controls priorities."
              : "Every opportunity from your workflow audits, grouped and prioritised."
        }
      />
      {overview && (
        <section className="admin-card admin-section-card admin-content" style={{ marginBottom: 18 }}>
          <h2 className="admin-card-title" style={{ marginBottom: 8 }}>Overview</h2>
          <div className="portal-roadmap-overview" style={{ fontSize: 14, lineHeight: 1.65 }}>
            <BotText text={overview} />
          </div>
        </section>
      )}
      <BacklogPortalView items={items} groups={groups} companyId={companyId} canPrioritize={canPrioritize} canPropose={canPropose} />
    </>
  );
}
