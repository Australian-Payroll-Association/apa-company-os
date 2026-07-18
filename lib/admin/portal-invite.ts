// Server-only. Core client-portal provisioning, shared between the admin UI
// server actions (app/admin/(dashboard)/revenue/companies/portal-actions.ts)
// and the admin assistant's approval-gated invite_portal_member tool
// (lib/admin-chat/actions.ts). Callers are responsible for the auth gate
// (requireAdmin / the chat route's privileged-admin check).

import { headers } from "next/headers";
import { supabase, companyOs } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin-auth";
import { PORTAL_STATUSES } from "@/lib/team-auth";
import { recordAudit } from "@/lib/admin/audit";
import { sendTransactionalEmail } from "@/lib/email";

export type PortalResult = { ok: true; message: string } | { ok: false; error: string };

export function siteOrigin(): string {
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  return host ? `https://${host}` : "https://www.edge8.ai";
}

async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return null;
  const match = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === email);
  return match ? { id: match.id } : null;
}

export type PortalTarget = {
  personId: string;
  email: string;
  authUserId: string | null;
};

// Shared refusals for any portal action targeting a person: missing/archived
// person, no email, admin email (admins use /admin), or an active team member
// (employees use /team — a person is never scoped as both).
export async function loadPortalTarget(
  personId: string,
): Promise<{ target: PortalTarget } | { error: string }> {
  if (!personId) return { error: "Missing person." };

  const { data: person, error: pErr } = await companyOs
    .from("people")
    .select("id, email, auth_user_id, archived_at")
    .eq("id", personId)
    .maybeSingle();
  if (pErr || !person) return { error: pErr?.message ?? "Person not found." };
  if (person.archived_at) return { error: "This person is archived." };

  const email = ((person.email as string | null) ?? "").trim().toLowerCase();
  if (!email) return { error: "This person has no email address on file." };

  if (await isAdminEmail(email)) {
    return { error: "This person is an admin. Admins use /admin, not the client portal." };
  }

  const { data: employment } = await companyOs
    .from("team_members")
    .select("id")
    .eq("person_id", personId)
    .in("status", PORTAL_STATUSES)
    .limit(1);
  if ((employment ?? []).length > 0) {
    return { error: "This person is an Edge8 team member. Staff use /team, not the client portal." };
  }

  return {
    target: {
      personId: person.id as string,
      email,
      authUserId: (person.auth_user_id as string | null) ?? null,
    },
  };
}

export function bannedUntil(user: unknown): string | null {
  const v = (user as { banned_until?: string | null } | null)?.banned_until;
  return v && new Date(v).getTime() > Date.now() ? v : null;
}

// Invite a client contact to the portal for a specific company: ensure the
// portal_members row, mint (or reuse) their Supabase auth user, and link it on
// people.auth_user_id. The person must already be linked to the company in the
// CRM (person_companies) — portal members are always known contacts.
// Re-inviting someone whose access was revoked reactivates the row and lifts
// the ban. Also completes the half-provisioned state (active membership row
// but no auth account, e.g. from a backfill that held invites): the row is
// left alone and the auth user is minted + emailed.
export async function invitePortalMemberCore(
  personId: string,
  companyId: string,
  actor: string,
  via: "admin_ui" | "admin_chatbot",
): Promise<PortalResult> {
  if (!companyId) return { ok: false, error: "Missing company." };
  const loaded = await loadPortalTarget(personId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const t = loaded.target;

  const { data: link } = await companyOs
    .from("person_companies")
    .select("id")
    .eq("person_id", personId)
    .eq("company_id", companyId)
    .limit(1);
  if ((link ?? []).length === 0) {
    return { ok: false, error: "Link this person to the company first (People tab)." };
  }

  // Ensure the membership row (the allowlist). Reactivate a revoked one.
  const { data: existingRow } = await companyOs
    .from("portal_members")
    .select("id, status")
    .eq("person_id", personId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (existingRow && existingRow.status !== "active") {
    const { error } = await companyOs
      .from("portal_members")
      .update({ status: "active", revoked_at: null, invited_by: actor, updated_at: new Date().toISOString() })
      .eq("id", existingRow.id);
    if (error) return { ok: false, error: `Could not reactivate membership: ${error.message}` };
  } else if (!existingRow) {
    const { error } = await companyOs
      .from("portal_members")
      .insert({ person_id: personId, company_id: companyId, invited_by: actor });
    if (error) return { ok: false, error: `Could not create membership: ${error.message}` };
  }

  // Auth user: restore, reuse, or mint + email the invite.
  let message = "Portal access enabled.";
  if (t.authUserId) {
    const { data } = await supabase.auth.admin.getUserById(t.authUserId);
    if (data?.user && bannedUntil(data.user)) {
      const { error } = await supabase.auth.admin.updateUserById(t.authUserId, {
        ban_duration: "none",
      });
      if (error) return { ok: false, error: `Could not restore access: ${error.message}` };
      message = "Portal access restored.";
    } else {
      message = "Portal access enabled (account already existed).";
    }
  } else {
    const existing = await findAuthUserByEmail(t.email);
    let authUserId: string;
    if (existing) {
      authUserId = existing.id;
      message = "Linked existing account and enabled portal access.";
    } else {
      // Server-side invite → implicit-flow link (session in the URL hash);
      // lands on /portal/callback, which reads the hash and establishes the
      // session. See app/portal/(auth)/callback/page.tsx.
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(t.email, {
        redirectTo: `${siteOrigin()}/portal/callback`,
      });
      if (error || !data?.user) return { ok: false, error: error?.message ?? "Invite failed to send." };
      authUserId = data.user.id;
      message = "Invite sent.";
    }
    const { error: upErr } = await companyOs
      .from("people")
      .update({ auth_user_id: authUserId })
      .eq("id", t.personId);
    if (upErr) {
      return { ok: false, error: `Auth user ready but linking failed: ${upErr.message}` };
    }
  }

  await recordAudit({
    table: "portal_members",
    recordId: null,
    operation: "update",
    actor,
    context: { action: "portal_invite", person_id: t.personId, company_id: companyId, via },
  });

  return { ok: true, message };
}

// Email an already-provisioned member a fresh sign-in link (the original invite
// expires; this is the admin-triggered recovery path). Idempotent.
export async function resendPortalLinkCore(
  personId: string,
  companyId: string,
  actor: string,
  via: "admin_ui" | "admin_chatbot",
): Promise<PortalResult> {
  const loaded = await loadPortalTarget(personId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const t = loaded.target;

  if (!t.authUserId) return { ok: false, error: "Not invited yet — use Invite instead." };

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: t.email,
    options: { redirectTo: `${siteOrigin()}/portal/callback` },
  });
  const actionLink = data?.properties?.action_link;
  if (error || !actionLink) {
    return { ok: false, error: error?.message ?? "Could not generate a sign-in link." };
  }

  await sendTransactionalEmail({
    to: t.email,
    subject: "Your Edge8 Client Portal sign-in link",
    html: `
      <p>Here is your sign-in link for the Edge8 Client Portal:</p>
      <p><a href="${actionLink}">Sign in to the Edge8 Client Portal</a></p>
      <p>The link expires shortly. If it does, you can request a fresh one any
      time at <a href="${siteOrigin()}/portal/login">${siteOrigin()}/portal/login</a>.</p>
    `,
  });

  await recordAudit({
    table: "portal_members",
    recordId: null,
    operation: "update",
    actor,
    context: { action: "portal_resend", person_id: t.personId, company_id: companyId, via },
  });

  return { ok: true, message: "Sign-in link sent." };
}
