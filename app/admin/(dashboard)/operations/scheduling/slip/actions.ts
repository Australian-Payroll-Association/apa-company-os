"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { companyOs } from "@/lib/supabase";
import { isValidISODate } from "@/lib/timesheet";

// Client-request tracking for the slip decomposition (Phase 3). Admin-gated.
// One row per information request we make of a client, with the day asked and
// the day answered; days-waiting is derived in the project_slip view.

type Result = { ok: true } | { ok: false; error: string };

const MAX_DESC = 500;

function refresh(boardId: string) {
  revalidatePath(`/admin/operations/scheduling/slip/${boardId}`);
  revalidatePath("/admin/operations/scheduling/slip");
}

export async function addClientRequest(input: {
  boardId: string;
  description: string;
  askedOn: string;
  note?: string;
}): Promise<Result> {
  await requireAdmin();
  if (!input.boardId) return { ok: false, error: "Missing project." };
  const description = (input.description ?? "").trim();
  if (!description) return { ok: false, error: "Describe what was asked of the client." };
  if (!isValidISODate(input.askedOn)) return { ok: false, error: "Pick a valid asked-on date." };

  const { error } = await companyOs.from("client_requests").insert({
    board_id: input.boardId,
    description: description.slice(0, MAX_DESC),
    asked_on: input.askedOn,
    note: input.note?.trim() ? input.note.trim().slice(0, MAX_DESC) : null,
  });
  if (error) return { ok: false, error: error.message };
  refresh(input.boardId);
  return { ok: true };
}

export async function answerClientRequest(input: {
  id: string;
  boardId: string;
  answeredOn: string;
}): Promise<Result> {
  await requireAdmin();
  if (!input.id) return { ok: false, error: "Missing request." };
  if (!isValidISODate(input.answeredOn)) return { ok: false, error: "Pick a valid answered-on date." };

  // The DB CHECK enforces answered_on >= asked_on; surface a clean message if it trips.
  const { error } = await companyOs
    .from("client_requests")
    .update({ answered_on: input.answeredOn })
    .eq("id", input.id);
  if (error) {
    return { ok: false, error: /client_requests_answered_after_asked/.test(error.message)
      ? "Answered date can't be before the asked date."
      : error.message };
  }
  refresh(input.boardId);
  return { ok: true };
}

export async function reopenClientRequest(input: { id: string; boardId: string }): Promise<Result> {
  await requireAdmin();
  if (!input.id) return { ok: false, error: "Missing request." };
  const { error } = await companyOs
    .from("client_requests")
    .update({ answered_on: null })
    .eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  refresh(input.boardId);
  return { ok: true };
}

export async function setResponseSla(input: { boardId: string; slaDays: number | null }): Promise<Result> {
  await requireAdmin();
  if (!input.boardId) return { ok: false, error: "Missing project." };
  const sla = input.slaDays;
  if (sla != null && (!Number.isInteger(sla) || sla <= 0)) {
    return { ok: false, error: "SLA must be a whole number of days." };
  }
  const { error } = await companyOs
    .from("boards")
    .update({ client_response_sla_days: sla })
    .eq("id", input.boardId);
  if (error) return { ok: false, error: error.message };
  refresh(input.boardId);
  return { ok: true };
}
