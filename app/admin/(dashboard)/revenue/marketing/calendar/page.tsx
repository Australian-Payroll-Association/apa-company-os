import Link from "next/link";
import type { Metadata } from "next";
import { PageHead } from "@/components/admin/PageHead";
import { requireAdmin } from "@/lib/admin-auth";
import { listEntries, listBrands, listPillars } from "@/lib/admin/marketing-calendar";
import { CalendarClient } from "./CalendarClient";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  title: "Marketing calendar",
  description: "Plan content across blog, email, LinkedIn, and Facebook.",
};

export default async function MarketingCalendarPage() {
  await requireAdmin();
  const [{ rows, error }, brands, pillars] = await Promise.all([
    listEntries(),
    listBrands(),
    listPillars(),
  ]);

  return (
    <div>
      <PageHead
        eyebrow="Revenue · Marketing"
        title="Calendar"
        sub="One plan across blog, email, LinkedIn, and Facebook. Email entries can spawn a real campaign."
        action={
          <Link className="admin-btn" href="/admin/revenue/marketing">
            Back to Marketing
          </Link>
        }
      />

      {error && (
        <div className="admin-alert admin-alert--err" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <CalendarClient initialEntries={rows} brands={brands} initialPillars={pillars} />
    </div>
  );
}
