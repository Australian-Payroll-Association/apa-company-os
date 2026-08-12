"use server";

import { requireTeamMember } from "@/lib/team-auth";
import { signedClientDocumentDownloadForActor } from "@/lib/team/clients";

// Team-side client documents are read-only: download is the only action, and it
// re-checks that the document's company is in the actor's active assignments.

export async function teamDownloadClientDocument(
  documentId: string,
): Promise<{ ok: true; url: string; filename: string } | { ok: false; error: string }> {
  const actor = await requireTeamMember();
  return signedClientDocumentDownloadForActor(actor, documentId);
}
