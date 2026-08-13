"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { teamInsertOwn } from "@/lib/team/data";
import { getMyEquipment } from "@/lib/team/equipment";
import { EQUIPMENT_TYPES } from "@/app/admin/(dashboard)/operations/equipment/equipment-shared";
import {
  CHECK_CONDITIONS,
  currentCheckCycle,
  type CheckCondition,
} from "@/lib/admin/equipment-check";

// Own-service equipment request. teamInsertOwn forces person_id = actor's own
// id server-side, so a request can only ever be raised as yourself.

const MAX_REASON = 1000;

export type RequestResult = { ok: true } | { ok: false; error: string };

export async function requestEquipment(input: {
  type: string;
  reason: string;
  neededBy?: string;
}): Promise<RequestResult> {
  const actor = await requireTeamMember();

  if (!(EQUIPMENT_TYPES as readonly string[]).includes(input.type)) {
    return { ok: false, error: "Pick what you need." };
  }
  const reason = input.reason?.trim() ?? "";
  if (!reason) return { ok: false, error: "Tell us what it's for." };
  if (reason.length > MAX_REASON) return { ok: false, error: "Keep the reason under 1000 characters." };

  const { error } = await teamInsertOwn(actor, "equipment_requests", {
    type: input.type,
    reason,
    needed_by: input.neededBy?.trim() || null,
  });
  if (error) return { ok: false, error };

  revalidatePath("/team/equipment");
  revalidatePath("/admin/operations/equipment");
  return { ok: true };
}

const MAX_ISSUES = 1000;

// Twice-a-year self-report for one machine the actor holds. person_id is forced
// server-side (teamInsertOwn); we also confirm the equipment is currently held
// by the actor, so a check can only be filed against your own kit.
export async function submitEquipmentCheck(input: {
  equipmentId: string;
  condition: string;
  holdingBack: boolean;
  needsUpgrade: boolean;
  issues?: string;
}): Promise<RequestResult> {
  const actor = await requireTeamMember();

  if (!CHECK_CONDITIONS.some((c) => c.value === input.condition)) {
    return { ok: false, error: "Pick how the machine is doing." };
  }
  const held = await getMyEquipment(actor);
  if (!held.some((it) => it.id === input.equipmentId)) {
    return { ok: false, error: "That item isn't assigned to you." };
  }
  const issues = input.issues?.trim() ?? "";
  if (issues.length > MAX_ISSUES) return { ok: false, error: "Keep the notes under 1000 characters." };

  const { error } = await teamInsertOwn(actor, "equipment_check", {
    equipment_id: input.equipmentId,
    cycle: currentCheckCycle(),
    condition: input.condition as CheckCondition,
    holding_back: input.holdingBack,
    needs_upgrade: input.needsUpgrade,
    issues: issues || null,
  });
  if (error) {
    // Unique (cycle, equipment_id, person_id): a second submit reads as done.
    if (/duplicate key|unique/i.test(error)) return { ok: false, error: "You've already checked this one." };
    return { ok: false, error };
  }

  revalidatePath("/team/equipment");
  revalidatePath("/admin/operations/equipment/fitness");
  return { ok: true };
}
