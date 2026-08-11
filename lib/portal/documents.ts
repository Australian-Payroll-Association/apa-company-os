// Portal "Documents" data access: the company-level document list, upload, and
// delete-own for /portal/documents. Same discipline as lib/portal/ai-programs.ts:
// every read/write is scoped to the actor's own companyScope and cross-company
// ids are rejected (IDOR guard). Delete is uploader-only on this surface: you
// may remove what you uploaded, never someone else's file
// (docs/plans/2026-08-11-client-portal-improvements.md, PR 1).

import type { PortalActor } from "@/lib/portal-auth";
import {
  listDocumentsForCompanies,
  getDocumentRow,
  signedDownloadForPath,
  createSignedDocumentUpload,
  recordDocument,
  deleteDocumentRow,
  type ClientDocument,
  type DocResult,
} from "@/lib/client-documents";

export type { ClientDocument } from "@/lib/client-documents";

// The single company an actor acts under (same rule as ai-programs.ts): with one
// membership it's implied; with several the form supplies the choice, which is
// still validated against companyScope.
function resolveCompanyId(actor: PortalActor, companyId?: string): string | null {
  if (companyId) return actor.companyScope.includes(companyId) ? companyId : null;
  return actor.companyScope.length === 1 ? actor.companyScope[0] : null;
}

export async function listDocumentsForActor(actor: PortalActor): Promise<ClientDocument[]> {
  return listDocumentsForCompanies(actor.companyScope);
}

export async function signedCompanyDocumentUpload(
  actor: PortalActor,
  input: { companyId?: string; filename: string },
): Promise<DocResult<{ signedUrl: string; path: string; companyId: string }>> {
  const companyId = resolveCompanyId(actor, input.companyId);
  if (!companyId) return { ok: false, error: "Pick which company this document is for." };
  const r = await createSignedDocumentUpload({ companyId, filename: input.filename });
  if (!r.ok) return r;
  return { ok: true, signedUrl: r.signedUrl, path: r.path, companyId };
}

export async function recordCompanyDocument(
  actor: PortalActor,
  input: { companyId: string; path: string; filename: string; sizeBytes: number | null },
): Promise<DocResult> {
  if (!actor.companyScope.includes(input.companyId)) {
    return { ok: false, error: "Not your company." };
  }
  return recordDocument({ ...input, uploadedBy: actor.email });
}

export async function signedCompanyDocumentDownload(
  actor: PortalActor,
  documentId: string,
): Promise<DocResult<{ url: string; filename: string }>> {
  const row = await getDocumentRow(documentId);
  if (!row || !actor.companyScope.includes(row.companyId)) return { ok: false, error: "Not found." };
  const r = await signedDownloadForPath(row.storagePath, row.filename);
  if (!r.ok) return r;
  return { ok: true, url: r.url, filename: row.filename };
}

// Uploader-only delete: the row must be in the actor's company scope AND carry
// their email as uploader. Admin-side delete (any document) lives in the admin
// actions, not here.
export async function deleteOwnDocument(actor: PortalActor, documentId: string): Promise<DocResult> {
  const row = await getDocumentRow(documentId);
  if (!row || !actor.companyScope.includes(row.companyId)) return { ok: false, error: "Not found." };
  if ((row.uploadedBy ?? "").toLowerCase() !== actor.email.toLowerCase()) {
    return { ok: false, error: "You can only delete documents you uploaded." };
  }
  return deleteDocumentRow(row);
}
