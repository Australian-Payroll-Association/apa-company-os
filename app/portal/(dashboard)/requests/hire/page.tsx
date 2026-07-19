import { requirePortalMember } from "@/lib/portal-auth";
import { PageHead } from "@/components/admin/PageHead";
import { HireEstimatorForm } from "./HireEstimatorForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Full-Time Hire — Vietnam",
  description: "Estimate the rate for a full-time Edge8 team member based in Vietnam.",
};

export default async function HireRequestPage() {
  const actor = await requirePortalMember();
  const companies = actor.memberships
    .filter((m) => m.companyId)
    .map((m) => ({ id: m.companyId as string, name: m.companyName ?? "Your company" }));

  return (
    <>
      <PageHead
        eyebrow="Client Portal · Requests"
        title="Full-time hire — Vietnam"
        sub="Pick a role and experience level for a rate estimate, then tell us the tech stack you need."
      />
      <div style={{ maxWidth: 640 }}>
        {companies.length === 0 ? (
          <div className="admin-empty">
            Your portal access isn&apos;t linked to a company yet — reply to your Edge8 contact to fix this.
          </div>
        ) : (
          <HireEstimatorForm companies={companies} />
        )}
      </div>
    </>
  );
}
