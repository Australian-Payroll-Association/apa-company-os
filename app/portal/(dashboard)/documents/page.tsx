import { requirePortalMember } from "@/lib/portal-auth";
import { contributorCompanyScope } from "@/lib/portal/roles";
import { listDocumentsForActor } from "@/lib/portal/documents";
import { PageHead } from "@/components/admin/PageHead";
import { DocumentsView } from "./DocumentsView";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Documents",
  description: "All documents shared between you and Edge8.",
};

export default async function DocumentsPage() {
  const actor = await requirePortalMember();
  const documents = await listDocumentsForActor(actor);
  // Upload is contributor+ (PR 2 roles): the picker only offers companies where
  // the actor may write; viewers get a read-only page (server re-checks anyway).
  const uploadScope = new Set(contributorCompanyScope(actor));
  const companies = actor.memberships
    .filter((m) => m.companyId && uploadScope.has(m.companyId))
    .map((m) => ({ companyId: m.companyId as string, companyName: m.companyName ?? "Your company" }));

  return (
    <div className="admin-content">
      <PageHead
        eyebrow="Client Portal"
        title="Documents"
        sub="Everything shared between you and Edge8, in one place. Files tagged to an AI Program link through to it."
      />
      <DocumentsView documents={documents} companies={companies} actorEmail={actor.email} />
    </div>
  );
}
