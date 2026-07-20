"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabase, companyOs } from "@/lib/supabase";
import { requireAdmin, isAdminEmail } from "@/lib/admin-auth";
import { PORTAL_STATUSES } from "@/lib/team-auth";
import { recordAudit } from "@/lib/admin/audit";
import { sendTransactionalEmail } from "@/lib/email";
import { setPersonAvatar, type AvatarResult } from "@/lib/avatars";
import { upsertPeopleSensitive, type SensitiveInput } from "@/lib/admin/people-sensitive";

type Result = { ok: true; message: string } | { ok: false; error: string };

// Admin sets a team member's photo. Bound to a personId in the page, so the
// AvatarUpload component only sends the file. Gated by requireAdmin + audited.
export async function adminSetPersonAvatar(
  personId: string,
  formData: FormData,
): Promise<AvatarResult> {
  const admin = await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, error: "No file received." };
  const res = await setPersonAvatar(personId, file);
  if (res.ok) {
    await recordAudit({
      table: "people",
      recordId: personId,
      operation: "update",
      actor: admin.email,
      context: { field: "avatar_url", via: "admin" },
    });
    revalidatePath("/admin/talent/team");
  }
  return res;
}

// Admin edits the restricted PII record. Gated by requireAdmin; the upsert
// records its own audit row with the admin's email.
export async function saveSensitiveDetails(
  personId: string,
  input: SensitiveInput,
): Promise<Result> {
  const admin = await requireAdmin();
  const res = await upsertPeopleSensitive(personId, input, admin.email);
  if (!res.ok) return { ok: false, error: res.error };
  revalidatePath("/admin/talent/team");
  return { ok: true, message: "Saved." };
}

// Ban horizon for revoked portal access. Banning (not deleting) keeps the
// people.auth_user_id link intact so access can be restored by re-inviting.
// Sessions die on the next request: every gate revalidates via getUser(), which
// the auth server refuses for a banned user.
const REVOKE_BAN = "87600h"; // ~10 years

function siteOrigin(): string {
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  return host ? `https://${host}` : "https://www.edge8.ai";
}

// Find an existing auth user by email (case-insensitive). Small org, so scanning
// the first page is sufficient; revisit if the auth user count ever grows large.
async function findAuthUserByEmail(email: string): Promise<{ id: string } | null> {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error || !data?.users) return null;
  const match = data.users.find((u) => (u.email ?? "").trim().toLowerCase() === email);
  return match ? { id: match.id } : null;
}

// Load the team member + linked person a portal action targets, with the shared
// refusals: no person, no email, or an admin email (admins use /admin, never /team).
type PortalTarget = {
  teamMemberId: string;
  status: string | null;
  personId: string;
  email: string;
  authUserId: string | null;
};

async function loadPortalTarget(
  teamMemberId: string,
): Promise<{ target: PortalTarget } | { error: string }> {
  if (!teamMemberId) return { error: "Missing team member." };

  const { data: tm, error: tmErr } = await companyOs
    .from("team_members")
    .select("id, person_id, status")
    .eq("id", teamMemberId)
    .maybeSingle();
  if (tmErr || !tm) return { error: tmErr?.message ?? "Team member not found." };

  const { data: person, error: pErr } = await companyOs
    .from("people")
    .select("id, email, auth_user_id")
    .eq("id", tm.person_id)
    .maybeSingle();
  if (pErr || !person) return { error: pErr?.message ?? "Linked person not found." };

  const email = ((person.email as string | null) ?? "").trim().toLowerCase();
  if (!email) return { error: "This person has no email address on file." };

  if (await isAdminEmail(email)) {
    return { error: "This person is an admin. Admins use /admin, not the portal." };
  }

  return {
    target: {
      teamMemberId: tm.id as string,
      status: (tm.status as string | null) ?? null,
      personId: person.id as string,
      email,
      authUserId: (person.auth_user_id as string | null) ?? null,
    },
  };
}

function bannedUntil(user: unknown): string | null {
  const v = (user as { banned_until?: string | null } | null)?.banned_until;
  return v && new Date(v).getTime() > Date.now() ? v : null;
}

// Invite a team member to the /team portal: mint (or reuse) their Supabase auth
// user and link it on people.auth_user_id. Gated by requireAdmin(). Sends a real
// magic-link invite email via Supabase, so this is deliberately explicit.
// Re-inviting someone whose access was revoked lifts the ban instead.
export async function inviteToPortal(teamMemberId: string): Promise<Result> {
  const admin = await requireAdmin();
  const loaded = await loadPortalTarget(teamMemberId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const t = loaded.target;

  // Only portal-eligible employment statuses get an invite; anyone else would
  // receive a link that requireTeamMember() dead-ends at the login screen.
  if (!t.status || !PORTAL_STATUSES.includes(t.status)) {
    return {
      ok: false,
      error: `Status '${t.status ?? "unknown"}' is not portal-eligible (needs one of: ${PORTAL_STATUSES.join(", ")}).`,
    };
  }

  // Already linked: restore access if it was revoked, otherwise nothing to do.
  if (t.authUserId) {
    const { data } = await supabase.auth.admin.getUserById(t.authUserId);
    if (data?.user && bannedUntil(data.user)) {
      const { error } = await supabase.auth.admin.updateUserById(t.authUserId, {
        ban_duration: "none",
      });
      if (error) return { ok: false, error: `Could not restore access: ${error.message}` };
      await companyOs.from("people").update({ is_team_member: true }).eq("id", t.personId);
      await recordAudit({
        table: "people",
        recordId: t.personId,
        operation: "update",
        actor: admin.email,
        context: { action: "portal_restore", team_member_id: t.teamMemberId },
      });
      revalidatePath("/admin/talent/team");
      return { ok: true, message: "Portal access restored." };
    }
    return { ok: true, message: "Already has portal access." };
  }

  // Reuse an existing auth user with this exact email (e.g. created elsewhere);
  // otherwise mint one and email the invite. Either way the email matches by
  // construction, so we never link a mismatched identity.
  const existing = await findAuthUserByEmail(t.email);
  let authUserId: string;
  if (existing) {
    authUserId = existing.id;
  } else {
    // Server-side invite → implicit-flow link (session in the URL hash), which
    // /api/auth/callback can't read (it only handles PKCE ?code=). Land on the
    // client callback that reads the hash, establishes the session, and hands
    // off to /team. See app/team/(auth)/callback/page.tsx.
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(t.email, {
      redirectTo: `${siteOrigin()}/team/callback`,
    });
    if (error || !data?.user) return { ok: false, error: error?.message ?? "Invite failed to send." };
    authUserId = data.user.id;
  }

  const { error: upErr } = await companyOs
    .from("people")
    .update({ auth_user_id: authUserId, is_team_member: true })
    .eq("id", t.personId);
  if (upErr) {
    // Linking failed after (possibly) minting a user; surface it rather than
    // leaving an orphaned auth user silently.
    return { ok: false, error: `Auth user ready but linking failed: ${upErr.message}` };
  }

  await recordAudit({
    table: "people",
    recordId: t.personId,
    operation: "update",
    actor: admin.email,
    context: {
      action: "portal_invite",
      team_member_id: t.teamMemberId,
      linked_existing_auth_user: Boolean(existing),
    },
  });

  revalidatePath("/admin/talent/team");
  return {
    ok: true,
    message: existing ? "Linked existing account and enabled portal access." : "Invite sent.",
  };
}

// Email an already-provisioned member a fresh sign-in link (the original invite
// expires; this is the admin-triggered recovery path). Idempotent.
export async function resendPortalInvite(teamMemberId: string): Promise<Result> {
  const admin = await requireAdmin();
  const loaded = await loadPortalTarget(teamMemberId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const t = loaded.target;

  if (!t.authUserId) return { ok: false, error: "Not invited yet — use Invite instead." };

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: t.email,
    options: { redirectTo: `${siteOrigin()}/team/callback` },
  });
  const actionLink = data?.properties?.action_link;
  if (error || !actionLink) {
    return { ok: false, error: error?.message ?? "Could not generate a sign-in link." };
  }

  await sendTransactionalEmail({
    to: t.email,
    subject: "Your Edge8 AI Workspace sign-in link",
    html: `
      <p>Here is your sign-in link for the Edge8 AI Workspace:</p>
      <p><a href="${actionLink}">Sign in to Edge8 AI Workspace</a></p>
      <p>The link expires shortly. If it does, you can request a fresh one any
      time at <a href="${siteOrigin()}/team/login">${siteOrigin()}/team/login</a>.</p>
    `,
  });

  await recordAudit({
    table: "people",
    recordId: t.personId,
    operation: "update",
    actor: admin.email,
    context: { action: "portal_resend", team_member_id: t.teamMemberId },
  });

  return { ok: true, message: "Sign-in link sent." };
}

// Revoke portal access: ban the auth user (new sign-ins refused, and existing
// sessions die on the next request because every gate revalidates via
// getUser()). The people.auth_user_id link is kept so Invite can restore access.
export async function revokePortalAccess(teamMemberId: string): Promise<Result> {
  const admin = await requireAdmin();
  const loaded = await loadPortalTarget(teamMemberId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const t = loaded.target;

  if (!t.authUserId) return { ok: false, error: "No portal access to revoke." };

  const { error } = await supabase.auth.admin.updateUserById(t.authUserId, {
    ban_duration: REVOKE_BAN,
  });
  if (error) return { ok: false, error: `Revoke failed: ${error.message}` };

  await companyOs.from("people").update({ is_team_member: false }).eq("id", t.personId);

  await recordAudit({
    table: "people",
    recordId: t.personId,
    operation: "update",
    actor: admin.email,
    context: { action: "portal_revoke", team_member_id: t.teamMemberId },
  });

  revalidatePath("/admin/talent/team");
  return { ok: true, message: "Portal access revoked." };
}
