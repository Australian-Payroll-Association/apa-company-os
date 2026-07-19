"use server";

import { revalidatePath } from "next/cache";
import { supabase, companyOs } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import {
  invitePortalMemberCore,
  resendPortalLinkCore,
  loadPortalTarget,
} from "@/lib/admin/portal-invite";

// Client-portal provisioning: the /portal sibling of the /team actions in
// talent/team/actions.ts, keyed on (person, company) instead of team member.
// Access itself is the company_os.portal_members allowlist row; the auth user
// is minted/linked on people.auth_user_id exactly like /team. Gated by
// requireAdmin() throughout. The invite/resend cores live in
// lib/admin/portal-invite.ts, shared with the admin assistant's
// approval-gated invite_portal_member tool.

type Result = { ok: true; message: string } | { ok: false; error: string };

// Ban horizon for revoked portal access. Banning (not deleting) keeps the
// people.auth_user_id link intact so access can be restored by re-inviting.
// Sessions die on the next request: every gate revalidates via getUser(), which
// the auth server refuses for a banned user.
const REVOKE_BAN = "87600h"; // ~10 years

function revalidate(companyId: string, personId: string) {
  revalidatePath(`/admin/revenue/companies/${companyId}`);
  revalidatePath(`/admin/contacts/${personId}`);
}

// Invite a client contact to the portal for a specific company. See
// invitePortalMemberCore for the full semantics.
export async function invitePortalMember(personId: string, companyId: string): Promise<Result> {
  const admin = await requireAdmin();
  const r = await invitePortalMemberCore(personId, companyId, admin.email, "admin_ui");
  if (r.ok) revalidate(companyId, personId);
  return r;
}

// Email an already-provisioned member a fresh sign-in link (the original invite
// expires; this is the admin-triggered recovery path). Idempotent.
export async function resendPortalMemberInvite(personId: string, companyId: string): Promise<Result> {
  const admin = await requireAdmin();
  return resendPortalLinkCore(personId, companyId, admin.email, "admin_ui");
}

// Revoke portal access for one company: mark the membership revoked, and when
// it was the person's LAST active membership, ban the auth user too (new
// sign-ins refused; existing sessions die on the next request because every
// gate revalidates via getUser()). The people.auth_user_id link is kept so
// Invite can restore access.
export async function revokePortalMember(personId: string, companyId: string): Promise<Result> {
  const admin = await requireAdmin();
  const loaded = await loadPortalTarget(personId);
  if ("error" in loaded) return { ok: false, error: loaded.error };
  const t = loaded.target;

  const { data: row } = await companyOs
    .from("portal_members")
    .select("id, status")
    .eq("person_id", personId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!row || row.status !== "active") return { ok: false, error: "No active membership to revoke." };

  const { error: revErr } = await companyOs
    .from("portal_members")
    .update({ status: "revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", row.id);
  if (revErr) return { ok: false, error: `Revoke failed: ${revErr.message}` };

  const { data: remaining } = await companyOs
    .from("portal_members")
    .select("id")
    .eq("person_id", personId)
    .eq("status", "active")
    .limit(1);
  let message = "Membership revoked.";
  if ((remaining ?? []).length === 0 && t.authUserId) {
    const { error } = await supabase.auth.admin.updateUserById(t.authUserId, {
      ban_duration: REVOKE_BAN,
    });
    if (error) return { ok: false, error: `Membership revoked but sign-in ban failed: ${error.message}` };
    message = "Portal access revoked and sign-in disabled.";
  }

  await recordAudit({
    table: "portal_members",
    recordId: row.id as string,
    operation: "update",
    actor: admin.email,
    context: { action: "portal_revoke", person_id: t.personId, company_id: companyId },
  });

  revalidate(companyId, personId);
  return { ok: true, message };
}
