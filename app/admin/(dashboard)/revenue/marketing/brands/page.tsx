import Link from "next/link";
import type { Metadata } from "next";
import { PageHead } from "@/components/admin/PageHead";
import { requireAdmin } from "@/lib/admin-auth";
import { listBrandProfiles } from "@/lib/admin/brand-profiles";
import { BrandProfileEditor } from "./BrandProfileEditor";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Brands",
  description: "Brand voice, positioning, and the content rules the writer follows.",
};

export default async function BrandsPage() {
  await requireAdmin();
  const profiles = await listBrandProfiles();

  return (
    <div>
      <PageHead
        eyebrow="Revenue · Marketing"
        title="Brands"
        sub="Voice, positioning, and the content rules each brand's copy follows. The campaign editor and the AI writer read from here."
        action={
          <Link className="admin-btn" href="/admin/revenue/marketing">
            Back to Marketing
          </Link>
        }
      />

      {profiles.length === 0 ? (
        <div className="admin-empty">No active brands.</div>
      ) : (
        profiles.map((p) => <BrandProfileEditor key={p.brandId} profile={p} />)
      )}
    </div>
  );
}
