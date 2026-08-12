"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTeamMember } from "@/lib/team-auth";
import { finalizeReview } from "@/lib/reviews";

// Finalize a submitted manager review. Authorization (the actor must be the
// row's reviewer-of-record) lives in finalizeReview; the id from the form is
// re-checked there, never trusted.
export async function finalizeReviewAction(formData: FormData): Promise<void> {
  const actor = await requireTeamMember();
  const id = String(formData.get("id") ?? "");
  const result = await finalizeReview(actor, id);
  revalidatePath("/team/reviews");
  revalidatePath(`/team/reviews/${id}`);
  if (!result.ok) redirect(`/team/reviews/${id}?error=${encodeURIComponent(result.error)}`);
}
