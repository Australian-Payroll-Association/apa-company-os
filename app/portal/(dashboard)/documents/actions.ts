"use server";

import { revalidatePath } from "next/cache";
import { requirePortalMember } from "@/lib/portal-auth";
import {
  signedCompanyDocumentUpload,
  recordCompanyDocument,
  signedCompanyDocumentDownload,
  deleteOwnDocument,
} from "@/lib/portal/documents";
import type { DocResult } from "@/lib/client-documents";

// Client-portal actions for the company Documents page. requirePortalMember()
// gates identity; every helper re-checks company ownership (and, for delete,
// uploadership) before touching anything.

function refresh() {
  revalidatePath("/portal/documents");
  revalidatePath("/portal/programs");
}

export async function signedDocumentUploadAction(input: {
  companyId?: string;
  filename: string;
}): Promise<DocResult<{ signedUrl: string; path: string; companyId: string }>> {
  const actor = await requirePortalMember();
  return signedCompanyDocumentUpload(actor, input);
}

export async function recordCompanyDocumentAction(input: {
  companyId: string;
  path: string;
  filename: string;
  sizeBytes: number | null;
}): Promise<DocResult> {
  const actor = await requirePortalMember();
  const r = await recordCompanyDocument(actor, input);
  if (r.ok) refresh();
  return r;
}

export async function downloadCompanyDocumentAction(
  documentId: string,
): Promise<DocResult<{ url: string; filename: string }>> {
  const actor = await requirePortalMember();
  return signedCompanyDocumentDownload(actor, documentId);
}

export async function deleteOwnDocumentAction(documentId: string): Promise<DocResult> {
  const actor = await requirePortalMember();
  const r = await deleteOwnDocument(actor, documentId);
  if (r.ok) refresh();
  return r;
}
