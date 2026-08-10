import type { Metadata } from "next";
import { requirePortalMember } from "@/lib/portal-auth";
import { getBacklogForActor } from "@/lib/portal/backlog";
import { PageHead } from "@/components/admin/PageHead";
import { BacklogPortalView } from "./BacklogPortalView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Program",
};

export default async function PortalBacklogPage() {
  const actor = await requirePortalMember();
  const items = await getBacklogForActor(actor);

  // v1: propose against the single company in scope. Multi-company portal users
  // are rare; when present we use the first — refine with a picker if needed.
  const companyId = actor.companyScope[0] ?? "";

  return (
    <>
      <PageHead
        eyebrow="Your roadmap"
        title="AI Program"
        sub="Every opportunity from your workflow audits, grouped and prioritised. Set your own priority on any item, and propose new ones for Edge8 to pick up."
      />
      <BacklogPortalView items={items} companyId={companyId} />
    </>
  );
}
