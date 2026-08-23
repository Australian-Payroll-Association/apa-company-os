import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHead } from "@/components/admin/PageHead";
import { requireAdmin } from "@/lib/admin-auth";
import { getEntry, CHANNEL_LABEL } from "@/lib/admin/marketing-calendar";
import { listAssetImages } from "@/lib/admin/marketing-images";
import { marketingMarkdownToHtml } from "@/lib/marketing/markdown";
import { ContentDetail } from "./ContentDetail";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Asset",
  description: "One content asset: its copy and images.",
};

export default async function AssetDetailPage({
  params,
}: {
  params: { id: string; assetId: string };
}) {
  await requireAdmin();
  const entry = await getEntry(params.assetId);
  // The asset must exist and belong to this campaign.
  if (!entry || entry.campaignId !== params.id) notFound();

  const [images, html] = await Promise.all([
    listAssetImages(entry.id),
    marketingMarkdownToHtml(entry.copyMd ?? ""),
  ]);

  return (
    <div>
      <PageHead
        eyebrow={
          <>
            <Link href="/admin/revenue/marketing/campaigns">Campaigns</Link> ·{" "}
            <Link href={`/admin/revenue/marketing/campaigns/${params.id}`}>
              {entry.campaignName ?? "Campaign"}
            </Link>{" "}
            · {CHANNEL_LABEL[entry.channel]}
          </>
        }
        title={entry.title}
        action={
          <Link className="admin-btn" href={`/admin/revenue/marketing/campaigns/${params.id}`}>
            Back to campaign
          </Link>
        }
      />
      <ContentDetail
        campaignId={params.id}
        entry={entry}
        initialHtml={html}
        initialImages={images}
      />
    </div>
  );
}
