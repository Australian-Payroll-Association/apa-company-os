"use server";

import { revalidatePath } from "next/cache";
import { requireTeamMember } from "@/lib/team-auth";
import { teamInsertOwn } from "@/lib/team/data";
import { generateIdeaPlan } from "@/lib/ai/idea-plan";

// Own-service idea submission for /team. teamInsertOwn forces
// person_id = actor.personId server-side, so an idea can only ever be
// submitted as yourself. The Claude call runs synchronously in the request —
// the employee is watching a "building your plan" state — but the idea row is
// inserted FIRST, so a generation failure never loses the submission.

type SubmitResult = { ok: true; id: string } | { ok: false; error: string };

const MAX_FIELD = 5000;

export async function submitIdea(input: {
  title: string;
  problem: string;
  data_needed: string;
  workflow: string;
  roi: string;
}): Promise<SubmitResult> {
  const actor = await requireTeamMember();

  const title = input.title?.trim();
  const problem = input.problem?.trim();
  const dataNeeded = input.data_needed?.trim();
  const workflow = input.workflow?.trim();
  const roi = input.roi?.trim();

  if (!title) return { ok: false, error: "Give your idea a short title." };
  if (!problem) return { ok: false, error: "Define the problem first — that's the most important D." };
  if (!dataNeeded) return { ok: false, error: "Describe the data your idea would need." };
  if (!workflow) return { ok: false, error: "Sketch the workflow at a high level." };
  if (!roi) return { ok: false, error: "Estimate the ROI — a rough number beats no number." };
  for (const v of [title, problem, dataNeeded, workflow, roi]) {
    if (v.length > MAX_FIELD) return { ok: false, error: "One of your answers is too long — keep each under 5,000 characters." };
  }

  const { data, error } = await teamInsertOwn(actor, "ideas", {
    title: title.slice(0, 200),
    problem,
    data_needed: dataNeeded,
    workflow,
    roi,
  });
  if (error || !data) return { ok: false, error: error ?? "Could not save your idea." };

  // Best effort: the idea is already safe in the backlog. If generation fails,
  // the detail page explains and an admin can retry.
  await generateIdeaPlan(data.id);

  revalidatePath("/team/ideas");
  return { ok: true, id: data.id };
}
