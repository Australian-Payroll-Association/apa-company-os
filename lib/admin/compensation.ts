// Server-only data layer for confidential employee salaries
// (company_os.compensation, comp_type = 'salary'). CONFIDENTIAL: callers MUST
// gate on canViewSensitive() before invoking any of this — authorization is the
// caller's job. Salary is stored in BOTH native VND (salary_vnd, whole VND) and
// USD (salary_usd_cents), converted at a FIXED 25,500 VND/USD (not live fx).
// History is append-only: a change closes the current row and inserts a new one;
// rows are never mutated in place, so the full wage history is preserved.

import { companyOs } from "@/lib/supabase";
import type { SalaryRow, SalaryChangeInput } from "./compensation-shared";

// Pure types + the fixed-rate conversion live in ./compensation-shared
// (client-safe) and are re-exported here so server callers keep one import.
export * from "./compensation-shared";

type Row = {
  id: string;
  salary_vnd: number | string | null;
  salary_usd_cents: number | string | null;
  effective_from: string | null;
  effective_to: string | null;
  is_current: boolean;
  change_reason: string | null;
  approved_by: string | null;
  created_at: string;
};

const num = (v: number | string | null): number | null =>
  v === null || v === "" ? null : Number(v);

function mapRow(r: Row): SalaryRow {
  return {
    id: r.id,
    salaryVnd: num(r.salary_vnd),
    salaryUsdCents: num(r.salary_usd_cents),
    effectiveFrom: r.effective_from,
    effectiveTo: r.effective_to,
    isCurrent: r.is_current,
    changeReason: r.change_reason,
    approvedBy: r.approved_by,
    createdAt: r.created_at,
  };
}

const SALARY_COLS =
  "id, salary_vnd, salary_usd_cents, effective_from, effective_to, is_current, change_reason, approved_by, created_at";

export async function getCurrentSalary(teamMemberId: string): Promise<SalaryRow | null> {
  const { data, error } = await companyOs
    .from("compensation")
    .select(SALARY_COLS)
    .eq("team_member_id", teamMemberId)
    .eq("comp_type", "salary")
    .eq("is_current", true)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("getCurrentSalary failed:", error.message);
    return null;
  }
  return data ? mapRow(data as Row) : null;
}

export async function getSalaryHistory(teamMemberId: string): Promise<SalaryRow[]> {
  const { data, error } = await companyOs
    .from("compensation")
    .select(SALARY_COLS)
    .eq("team_member_id", teamMemberId)
    .eq("comp_type", "salary")
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("getSalaryHistory failed:", error.message);
    return [];
  }
  return (data as Row[]).map(mapRow);
}


// Append-only: close the current salary row(s), then insert the new one. The old
// row keeps its amounts and gets effective_to = the new row's effective_from.
export async function saveSalaryChange(
  teamMemberId: string,
  input: SalaryChangeInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const now = new Date().toISOString();

  const { error: closeErr } = await companyOs
    .from("compensation")
    .update({ is_current: false, effective_to: input.effectiveFrom, updated_at: now })
    .eq("team_member_id", teamMemberId)
    .eq("comp_type", "salary")
    .eq("is_current", true);
  if (closeErr) return { ok: false, error: closeErr.message };

  const { data, error } = await companyOs
    .from("compensation")
    .insert({
      team_member_id: teamMemberId,
      comp_type: "salary",
      pay_period: "monthly",
      // Generic columns kept consistent (USD) so non-salary readers see a value.
      amount_cents: input.salaryUsdCents,
      currency: "usd",
      // Dedicated dual-currency salary columns (the record of truth).
      salary_vnd: input.salaryVnd,
      salary_usd_cents: input.salaryUsdCents,
      effective_from: input.effectiveFrom,
      is_current: true,
      change_reason: input.changeReason ?? null,
      approved_by: input.approvedBy,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string }).id };
}
