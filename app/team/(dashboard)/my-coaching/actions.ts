"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { myUpdateCommitmentStatus, type CommitmentStatus } from "@/lib/coaching/data";

// Member-side action: update the status + note on a commitment on their OWN
// profile (ownership re-derived server-side in myUpdateCommitmentStatus).
// Members never edit titles, due dates, or anyone else's commitments.

type Result = { ok: true } | { ok: false; error: string };

export async function updateMyCommitment(
  commitmentId: string,
  status: CommitmentStatus,
  note: string,
): Promise<Result> {
  const actor = await requireTeamMember();
  const res = await myUpdateCommitmentStatus(actor, commitmentId, status, note);
  if (res.ok) revalidatePath("/team/my-coaching");
  return res;
}
