import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { buildTemplateWorkbook } from "@/lib/recalc/template-workbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Serves a blank pay-review data-gathering workbook — no payroll data in it,
// just the tab/column structure — so gating is requireAdmin() only, not the
// canViewSensitive() layer the actual runs and uploads go through.
export async function GET() {
  await requireAdmin();

  const workbook = buildTemplateWorkbook();
  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="pay-review-data-gathering-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
