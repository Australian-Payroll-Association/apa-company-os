"use server";

import { revalidatePath } from "next/cache";
import { companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";

type Result = { ok: true } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/operations/contractors");
}

// Update a contractor's hourly + overtime rate. Effective-dated: the current
// compensation rows are superseded (is_current=false, effective_to=today),
// never mutated, so rate history stays queryable.
export async function updateContractorRates(input: {
  teamMemberId: string;
  hourlyRateCents: number;
  overtimeRateCents: number;
  currency: string;
  changeReason?: string;
}): Promise<Result> {
  const admin = await requireAdmin();

  if (!input.teamMemberId) return { ok: false, error: "Missing contractor." };
  const hourly = Math.round(input.hourlyRateCents);
  const overtime = Math.round(input.overtimeRateCents);
  if (!Number.isFinite(hourly) || hourly <= 0) return { ok: false, error: "Hourly rate must be greater than zero." };
  if (!Number.isFinite(overtime) || overtime <= 0)
    return { ok: false, error: "Overtime rate must be greater than zero." };
  const currency = (input.currency || "usd").toLowerCase();
  if (!["usd", "vnd"].includes(currency)) return { ok: false, error: "Currency must be USD or VND." };

  const today = new Date().toISOString().slice(0, 10);
  const reason = input.changeReason?.trim() || "Rate update via admin";

  // Supersede current contractor-rate rows...
  const { error: closeErr } = await companyOs
    .from("compensation")
    .update({ is_current: false, effective_to: today, updated_at: new Date().toISOString() })
    .eq("team_member_id", input.teamMemberId)
    .in("comp_type", ["hourly", "overtime"])
    .eq("is_current", true);
  if (closeErr) return { ok: false, error: closeErr.message };

  // ...then insert the new pair.
  const rows = [
    { comp_type: "hourly", amount_cents: hourly },
    { comp_type: "overtime", amount_cents: overtime },
  ].map((r) => ({
    team_member_id: input.teamMemberId,
    comp_type: r.comp_type,
    amount_cents: r.amount_cents,
    currency,
    pay_period: "hourly",
    effective_from: today,
    is_current: true,
    change_reason: reason,
  }));
  const { error: insErr } = await companyOs.from("compensation").insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  await recordAudit({
    table: "compensation",
    recordId: input.teamMemberId,
    operation: "update",
    actor: admin.email,
    newData: { hourly_rate_cents: hourly, overtime_rate_cents: overtime, currency, change_reason: reason },
    context: { kind: "contractor_rate_update" },
  });
  refresh();
  return { ok: true };
}
