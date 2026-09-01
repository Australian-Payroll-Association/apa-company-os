"use server";

import { revalidatePath } from "next/cache";
import { discoveryDb as companyOs } from "@/lib/discovery/data";
import { getSiteOrigin } from "@/lib/site-origin";
import { loadEngagementByToken, type EngagementOverview, type TeamMember } from "@/lib/discovery/data";
import { notifyConsultantOfSubmission } from "@/lib/discovery/notify";

// Client-facing actions on the public /discovery/[token] page. No admin gate:
// the opaque access_token IS the credential (same bearer-link model as
// /work/[token]). Every action re-validates the token server-side, so a
// tampered request can never touch another engagement's rows.

type Result = { ok: true } | { ok: false; error: string };

function nowIso() {
  return new Date().toISOString();
}

async function logEvent(engagementId: string, type: string, body?: string) {
  await companyOs.from("discovery_events").insert({
    engagement_id: engagementId,
    actor_type: "client",
    type,
    body: body ?? null,
  });
}

// Bumps status from not_started -> in_progress on first save; never moves it
// backwards (e.g. re-editing after submission stays "submitted").
async function markStarted(engagementId: string, currentStatus: string) {
  if (currentStatus !== "not_started") return;
  await companyOs.from("discovery_engagements").update({ status: "in_progress", updated_at: nowIso() }).eq("id", engagementId);
}

export async function saveResponse(
  token: string,
  questionId: string,
  options: string[],
  text: string,
): Promise<Result> {
  const eng = await loadEngagementByToken(token);
  if (!eng) return { ok: false, error: "This link is not valid." };
  if (eng.status === "submitted" || eng.status === "under_review" || eng.status === "report_drafted" || eng.status === "completed") {
    return { ok: false, error: "This review has already been submitted and can no longer be edited." };
  }

  const { error } = await companyOs
    .from("discovery_responses")
    .upsert(
      { engagement_id: eng.id, question_id: questionId, options, text, updated_at: nowIso() },
      { onConflict: "engagement_id,question_id" },
    );
  if (error) return { ok: false, error: "Something went wrong saving your answer — please try again." };

  await markStarted(eng.id, eng.status);
  return { ok: true };
}

export async function saveOverview(token: string, overview: EngagementOverview): Promise<Result> {
  const eng = await loadEngagementByToken(token);
  if (!eng) return { ok: false, error: "This link is not valid." };
  if (eng.status !== "not_started" && eng.status !== "in_progress") {
    return { ok: false, error: "This review has already been submitted and can no longer be edited." };
  }

  const { error } = await companyOs
    .from("discovery_engagements")
    .update({ overview, updated_at: nowIso() })
    .eq("id", eng.id);
  if (error) return { ok: false, error: "Something went wrong saving your answer — please try again." };

  await markStarted(eng.id, eng.status);
  return { ok: true };
}

export async function saveTeamMembers(token: string, teamMembers: TeamMember[]): Promise<Result> {
  const eng = await loadEngagementByToken(token);
  if (!eng) return { ok: false, error: "This link is not valid." };
  if (eng.status !== "not_started" && eng.status !== "in_progress") {
    return { ok: false, error: "This review has already been submitted and can no longer be edited." };
  }

  const { error } = await companyOs
    .from("discovery_engagements")
    .update({ team_members: teamMembers, updated_at: nowIso() })
    .eq("id", eng.id);
  if (error) return { ok: false, error: "Something went wrong saving your answer — please try again." };

  await markStarted(eng.id, eng.status);
  return { ok: true };
}

export async function submitEngagement(token: string): Promise<Result> {
  const eng = await loadEngagementByToken(token);
  if (!eng) return { ok: false, error: "This link is not valid." };
  if (eng.status === "submitted" || eng.status === "under_review" || eng.status === "report_drafted" || eng.status === "completed") {
    return { ok: false, error: "This review has already been submitted." };
  }

  const { error } = await companyOs
    .from("discovery_engagements")
    .update({ status: "submitted", submitted_at: nowIso(), updated_at: nowIso() })
    .eq("id", eng.id);
  if (error) return { ok: false, error: "Something went wrong submitting — please try again." };

  await logEvent(eng.id, "submitted");
  await notifyConsultantOfSubmission({
    engagementId: eng.id,
    clientName: eng.client_name,
    consultantEmail: eng.consultant?.email ?? null,
    consultantName: eng.consultant?.full_name ?? null,
    extraNotifyEmail: eng.consultant_email,
    reviewUrl: `${getSiteOrigin()}/admin/discovery/${eng.id}`,
  });

  revalidatePath(`/discovery/${token}`);
  return { ok: true };
}
