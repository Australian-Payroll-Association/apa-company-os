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
import { promoteSelfieToAvatar } from "@/lib/avatars";
import { ensureJourney } from "@/lib/onboarding-cycle";
import type { SurveyFieldRow } from "@/lib/admin/surveys";

const OPS_EMAIL = "mai@edge8.ai";

// Onboarding collects bank details as one free-text line, usually
// "<account> - <bank> - <branch>" (sometimes newline-separated, or just
// "<account> - <bank>"). Split it so payroll gets a clean account number and
// branch instead of everything crammed into the name. Conservative: only splits
// when it finds a plausible digit-run account, otherwise returns {} and the raw
// value is left untouched in bank_name. Exported so the backfill reuses it.
export function splitBankDetails(raw: string): {
  bank_name?: string;
  bank_account_number?: string;
  bank_branch?: string;
} {
  const parts = raw
    .replace(/[\n\r]+/g, " - ")
    .split(/\s*[-–—]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 2) return {};

  // The account number is the part that is essentially digits (≥6 of them).
  const isAccount = (s: string) => s.replace(/\D/g, "").length >= 6 && /^[\d\s.]+$/.test(s);
  const accIdx = parts.findIndex(isAccount);
  if (accIdx < 0) return {};

  const account = parts[accIdx].replace(/\s+/g, "");
  const rest = parts.filter((_, i) => i !== accIdx);
  const out: { bank_name?: string; bank_account_number?: string; bank_branch?: string } = {
    bank_account_number: account,
  };
  if (rest.length >= 1) out.bank_name = rest[0];
  if (rest.length >= 2) out.bank_branch = rest.slice(1).join(" - ");
  return out;
}

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

    // The selfie is a public profile photo, not restricted PII: pull it out of
    // the sensitive patch and promote it to the person's avatar after the writes.
    const selfiePath = sensitivePatch.id_selfie_path ?? null;
    delete sensitivePatch.id_selfie_path;

    // Bank details come in as one line; split into account number + branch so
    // payroll has clean fields rather than everything inside the bank name.
    if (sensitivePatch.bank_name && !sensitivePatch.bank_account_number) {
      const bank = splitBankDetails(sensitivePatch.bank_name);
      if (bank.bank_account_number) {
        sensitivePatch.bank_account_number = bank.bank_account_number;
        if (bank.bank_name) sensitivePatch.bank_name = bank.bank_name;
        if (bank.bank_branch) sensitivePatch.bank_branch = bank.bank_branch;
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

    // 3b) Selfie -> public avatar. Best-effort; the survey answer keeps the
    //     record either way, so a storage hiccup never blocks the submission.
    if (selfiePath) {
      const ok = await promoteSelfieToAvatar(personId, selfiePath);
      if (!ok) console.error("[onboarding] selfie -> avatar failed for", personId);
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

    let cycleMemberId: string | null = null;
    if (existingTm) {
      const { error: tmErr } = await companyOs
        .from("team_members")
        .update({ employment_stage: "pre_boarding" })
        .eq("id", existingTm.id);
      if (tmErr) console.error("[onboarding] team_member stage update failed:", tmErr.message);
      else cycleMemberId = existingTm.id;
    } else {
      const { data: newTm, error: tmErr } = await companyOs
        .from("team_members")
        .insert({ person_id: personId, status: "pre_start", employment_stage: "pre_boarding" })
        .select("id")
        .maybeSingle();
      if (tmErr) console.error("[onboarding] team_member insert failed:", tmErr.message);
      else cycleMemberId = (newTm as { id: string } | null)?.id ?? null;
    }
    // Start the onboarding-cycle journey immediately (the daily cron would
    // backfill it anyway; this puts the card on the manager's board today).
    if (cycleMemberId) await ensureJourney(cycleMemberId);
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
