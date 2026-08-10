import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { PageHead } from "@/components/admin/PageHead";
import { PlanChat } from "./PlanChat";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Build a plan",
  description: "Build your AI Program Brief with the guided assistant.",
};

export default async function PlanBuilderPage() {
  const actor = await requirePortalMember();
  const companies = actor.memberships
    .filter((m): m is typeof m & { companyId: string } => !!m.companyId)
    .map((m) => ({ companyId: m.companyId, companyName: m.companyName ?? "Your company" }));

  return (
    <div style={{ maxWidth: 760 }}>
      <PageHead
        eyebrow="AI Programs"
        title="Build a plan"
        sub="Work through four short activities with the assistant. At the end you'll get a 5Ds AI Program Brief you can save and download."
      />
      <PlanChat companies={companies} />
      <div style={{ marginTop: 14 }}>
        <Link href="/portal/programs/add" className="admin-btn admin-btn--sm">← Back</Link>
      </div>
    </div>
  );
}
