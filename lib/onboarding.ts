// New Member Onboarding processor. Runs after a survey whose purpose is
// 'onboarding' is submitted (see app/api/surveys/[slug]/route.ts). It reads each
// answer's field.config.maps_to and writes it into the CRM: identity + non-
// sensitive fields on `people`, restricted PII on `people_sensitive`, uploaded
// ID/selfie object paths onto the sensitive image columns. It then moves the
// person into pre-boarding on `team_members` and, for someone who came through
// the hiring pipeline, sends the /team portal invite. A direct hire with no
// application on file is created all the same, and operations is notified to
// backfill the hiring-side record.
//
// Everything here is best-effort: the survey response + answers are already the
// authoritative record, so a downstream failure is logged, never thrown back to
// the new member mid-submit.

import { companyOs, supabase } from "@/lib/supabase";
import { getSiteOrigin } from "@/lib/site-origin";
import { sendTransactionalEmail } from "@/lib/email";
import { recordAudit } from "@/lib/admin/audit";
import type { SurveyFieldRow } from "@/lib/admin/surveys";

const OPS_EMAIL = "mai@edge8.ai";

type AnswerValue = string | string[] | number | boolean | null;

// A non-empty answer keyed by field id, already server-validated.
export type OnboardingInput = {
  personId: string;
  email: string;
  name: string | null;
  fields: SurveyFieldRow[];
  answers: Map<string, AnswerValue>;
};

function setDeep(target: Record<string, unknown>, path: string[], value: unknown): void {
  let node = target;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (typeof node[key] !== "object" || node[key] === null) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
  node[path[path.length - 1]] = value;
}

async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return null;
  const match = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === email);
  return match ? { id: match.id } : null;
}

export async function processOnboardingSubmission(input: OnboardingInput): Promise<void> {
  const { personId, email } = input;
  try {
    // 1) Bucket each mapped answer by destination.
    const peoplePatch: Record<string, string> = {};
    const metadataPatch: Record<string, unknown> = {};
    const sensitivePatch: Record<string, string> = {};

    for (const field of input.fields) {
      const target = field.config?.maps_to;
      if (!target) continue;
      const value = input.answers.get(field.id);
      if (value === undefined || value === null || value === "") continue;
      const parts = target.split(".");
      const table = parts[0];

      if (table === "people") {
        if (parts[1] === "metadata") {
          setDeep(metadataPatch, parts.slice(2), value);
        } else if (parts.length === 2) {
          peoplePatch[parts[1]] = String(value);
        }
      } else if (table === "people_sensitive" && parts.length === 2) {
        sensitivePatch[parts[1]] = String(value);
      }
    }

    // 2) Enrich `people` (getOrCreatePerson only set email/name, and never
    //    overwrites an existing person — so update explicitly). Merge metadata so
    //    we don't clobber onboarding_completed_at, fun_stuff, etc.
    const { data: existingPerson } = await companyOs
      .from("people")
      .select("metadata")
      .eq("id", personId)
      .maybeSingle();
    const mergedMetadata = {
      ...((existingPerson?.metadata as Record<string, unknown> | null) ?? {}),
      ...metadataPatch,
      onboarding_completed_at: new Date().toISOString(),
    };
    const { error: pErr } = await companyOs
      .from("people")
      .update({ ...peoplePatch, metadata: mergedMetadata })
      .eq("id", personId);
    if (pErr) console.error("[onboarding] people update failed:", pErr.message);

    // 3) Restricted PII + uploaded ID/selfie paths, in one upsert. Dates are
    //    already validated YYYY-MM-DD by the survey engine.
    if (Object.keys(sensitivePatch).length > 0) {
      const { error: sErr } = await companyOs
        .from("people_sensitive")
        .upsert(
          { person_id: personId, ...sensitivePatch, updated_at: new Date().toISOString() },
          { onConflict: "person_id" },
        );
      if (sErr) console.error("[onboarding] people_sensitive upsert failed:", sErr.message);
      else
        await recordAudit({
          table: "people_sensitive",
          recordId: personId,
          operation: "update",
          actor: "new-member-onboarding",
          context: { fields_changed: Object.keys(sensitivePatch) },
        });
    }

    // 4) Did this person come through the hiring pipeline? Drives the invite +
    //    ops-notification branch.
    const { data: appRow } = await companyOs
      .from("applications")
      .select("id")
      .eq("person_id", personId)
      .limit(1)
      .maybeSingle();
    const matchedApplicant = Boolean(appRow);

    // 5) Move to pre-boarding on team_members (never demote an existing
    //    employment record; only create one or set the stage).
    const { data: existingTm } = await companyOs
      .from("team_members")
      .select("id, status")
      .eq("person_id", personId)
      .not("status", "in", "(terminated,alumni)")
      .limit(1)
      .maybeSingle();

    if (existingTm) {
      const { error: tmErr } = await companyOs
        .from("team_members")
        .update({ employment_stage: "pre_boarding" })
        .eq("id", existingTm.id);
      if (tmErr) console.error("[onboarding] team_member stage update failed:", tmErr.message);
    } else {
      const { error: tmErr } = await companyOs
        .from("team_members")
        .insert({ person_id: personId, status: "pre_start", employment_stage: "pre_boarding" });
      if (tmErr) console.error("[onboarding] team_member insert failed:", tmErr.message);
    }
    await recordAudit({
      table: "team_members",
      recordId: personId,
      operation: existingTm ? "update" : "insert",
      actor: "new-member-onboarding",
      context: { action: "onboarding_pre_boarding", matched_applicant: matchedApplicant },
    });

    // 6) Portal invite — only for someone already in the pipeline. An open,
    //    unauthenticated form must not fire account invites at arbitrary
    //    addresses, so a direct hire with no application waits for a human.
    if (matchedApplicant) {
      await inviteToTeamPortal(personId, email);
    } else {
      await notifyOpsBackfill(personId, input.name, email);
    }
  } catch (err) {
    console.error("[onboarding] processing failed:", err);
  }
}

async function inviteToTeamPortal(personId: string, email: string): Promise<void> {
  try {
    const existing = await findAuthUserByEmail(email);
    let authUserId: string;
    if (existing) {
      authUserId = existing.id;
    } else {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${getSiteOrigin()}/team/callback`,
      });
      if (error || !data?.user) {
        console.error("[onboarding] portal invite failed:", error?.message);
        return;
      }
      authUserId = data.user.id;
    }
    const { error: linkErr } = await companyOs
      .from("people")
      .update({ auth_user_id: authUserId, is_team_member: true })
      .eq("id", personId);
    if (linkErr) console.error("[onboarding] auth link failed:", linkErr.message);
  } catch (err) {
    console.error("[onboarding] invite error:", err);
  }
}

async function notifyOpsBackfill(
  personId: string,
  name: string | null,
  email: string,
): Promise<void> {
  await sendTransactionalEmail({
    to: OPS_EMAIL,
    subject: `New onboarding submission — ${name ?? email}`,
    html: `
      <p>A new member completed onboarding but has <strong>no application on file</strong>, so this looks like a direct hire.</p>
      <p><strong>${name ?? "(no name)"}</strong> &lt;${email}&gt; is now in <strong>pre-boarding</strong>.</p>
      <p>Please backfill the hiring-side record (department, position, employee number) and send their portal invite from the Team admin when ready.</p>
      <p style="color:#64748b;font-size:13px;">person_id: ${personId}</p>
    `,
    logMeta: { source: "onboarding" },
  });
}
