import Link from "next/link";
import { requirePortalMember } from "@/lib/portal-auth";
import { PageHead } from "@/components/admin/PageHead";
import { UploadProgramForm } from "./UploadProgramForm";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Upload documents",
  description: "Start an AI program by uploading your documents.",
};

export default async function UploadProgramPage() {
  const actor = await requirePortalMember();
  const companies = actor.memberships
    .filter((m): m is typeof m & { companyId: string } => !!m.companyId)
    .map((m) => ({ companyId: m.companyId, companyName: m.companyName ?? "Your company" }));

  return (
    <div style={{ maxWidth: 880 }}>
      <PageHead
        eyebrow="AI Programs"
        title="Upload documents"
        sub="Name your program and upload the documents you already have. Files stay private to your company."
      />
      <div className="admin-card admin-section-card" style={{ marginBottom: 16 }}>
        <UploadProgramForm companies={companies} />
      </div>
      <Link href="/portal/projects/add" className="admin-btn admin-btn--sm">← Back</Link>
    </div>
  );
}
