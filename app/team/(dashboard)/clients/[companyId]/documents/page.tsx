import { notFound } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { getClientDocumentsForActor, getActorEmail } from "@/lib/team/clients";
import { ClientDocumentsList } from "../ClientDocumentsList";

export const dynamic = "force-dynamic";

export const metadata = { title: "Client Documents" };

// The Documents tab: the client's vault (same files as /portal/documents).
// Upload for any assigned team member; delete only what you uploaded.

export default async function TeamClientDocumentsTab({ params }: { params: { companyId: string } }) {
  const actor = await requireTeamMember();
  const [documents, actorEmail] = await Promise.all([
    getClientDocumentsForActor(actor, params.companyId),
    getActorEmail(actor),
  ]);
  if (documents === null) notFound();

  return (
    <section className="admin-card admin-section-card">
      <h2 className="admin-card-title" style={{ marginBottom: 10 }}>Documents</h2>
      <ClientDocumentsList documents={documents} companyId={params.companyId} actorEmail={actorEmail} />
    </section>
  );
}
