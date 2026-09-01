import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { requireAdmin, canViewSensitive } from "@/lib/admin-auth";
import { getRun } from "@/lib/recalc/runs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Exports one run's variance results as an .xlsx — same sensitivity gate as
// the run pages themselves (payroll dollar data).
export async function GET(_req: Request, { params }: { params: { runId: string } }) {
  const admin = await requireAdmin();
  if (!(await canViewSensitive(admin.email))) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }

  const run = await getRun(params.runId);
  if (!run || !run.results) {
    return NextResponse.json({ error: "Run not found." }, { status: 404 });
  }

  const workbook = new ExcelJS.Workbook();

  const variance = workbook.addWorksheet("Variance");
  variance.columns = [
    { header: "Employee", key: "employeeId", width: 14 },
    { header: "Pay period start", key: "periodStart", width: 16 },
    { header: "Pay period end", key: "periodEnd", width: 16 },
    { header: "Component", key: "component", width: 24 },
    { header: "Expected", key: "expected", width: 14, style: { numFmt: "$#,##0.00" } },
    { header: "Actual", key: "actual", width: 14, style: { numFmt: "$#,##0.00" } },
    { header: "Variance", key: "variance", width: 14, style: { numFmt: "$#,##0.00;($#,##0.00)" } },
    { header: "Flagged", key: "flagged", width: 10 },
  ];
  variance.getRow(1).font = { bold: true };
  for (const v of run.results.variances) {
    variance.addRow({
      employeeId: v.employeeId,
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      component: v.component.replace(/_/g, " "),
      expected: v.expectedCents / 100,
      actual: v.actualCents / 100,
      variance: v.varianceCents / 100,
      flagged: v.flagged ? "Y" : "",
    });
  }

  if (run.results.findings.length > 0) {
    const findings = workbook.addWorksheet("Compliance findings");
    findings.columns = [
      { header: "Employee", key: "employeeId", width: 14 },
      { header: "Date", key: "date", width: 14 },
      { header: "Description", key: "description", width: 90 },
    ];
    findings.getRow(1).font = { bold: true };
    for (const f of run.results.findings) findings.addRow(f);
  }

  if (run.results.warnings.length > 0 || run.results.notModeled.length > 0) {
    const notes = workbook.addWorksheet("Warnings & not evaluated");
    notes.columns = [
      { header: "Type", key: "type", width: 16 },
      { header: "Note", key: "note", width: 100 },
    ];
    notes.getRow(1).font = { bold: true };
    for (const w of run.results.warnings) notes.addRow({ type: "Warning", note: w });
    for (const n of run.results.notModeled) notes.addRow({ type: "Not evaluated", note: n });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const safeName = (run.label || run.id.slice(0, 8)).replace(/[^a-z0-9-_]+/gi, "-");

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="recalc-${safeName}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
