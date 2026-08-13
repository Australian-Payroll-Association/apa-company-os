import { companyOs } from "@/lib/supabase";

// Twice-a-year equipment self-report. No device access: each holder rates the
// state of the machines they hold, once per half-year cycle. Shared by the
// /team form, the Fleet Fitness page, and the biannual nudge routine.

// The machines worth asking about. Monitors and peripherals are left out; the
// point is whether someone's computer is holding them back.
export const CHECK_TYPES: readonly string[] = ["laptop", "desktop"];

export const CHECK_CONDITIONS = [
  { value: "good", label: "Good, no complaints" },
  { value: "fair", label: "Fair, some friction" },
  { value: "poor", label: "Poor, struggling" },
] as const;
export type CheckCondition = (typeof CHECK_CONDITIONS)[number]["value"];

export function conditionLabel(condition: string): string {
  return CHECK_CONDITIONS.find((c) => c.value === condition)?.label ?? condition;
}

// The window is implicit: the current half-year. A holder "owes" a check when
// no row exists for this cycle, and the whole team resets when the cycle key
// rolls over on 1 January and 1 July.
export function currentCheckCycle(date: Date = new Date()): string {
  const half = date.getMonth() < 6 ? 1 : 2;
  return `${date.getFullYear()}-H${half}`;
}

export type EquipmentCheckRow = {
  id: string;
  cycle: string;
  equipment_id: string;
  person_id: string;
  condition: CheckCondition;
  holding_back: boolean;
  needs_upgrade: boolean;
  issues: string | null;
  submitted_at: string;
};

// Latest check per equipment for a cycle, keyed by equipment_id. Powers the
// self-report column on the Fleet Fitness page.
export async function loadChecksByEquipment(
  cycle: string = currentCheckCycle(),
): Promise<Map<string, EquipmentCheckRow>> {
  const { data } = await companyOs
    .from("equipment_check")
    .select(
      "id, cycle, equipment_id, person_id, condition, holding_back, needs_upgrade, issues, submitted_at",
    )
    .eq("cycle", cycle)
    .order("submitted_at", { ascending: false });

  const map = new Map<string, EquipmentCheckRow>();
  for (const row of (data ?? []) as EquipmentCheckRow[]) {
    if (!map.has(row.equipment_id)) map.set(row.equipment_id, row);
  }
  return map;
}
