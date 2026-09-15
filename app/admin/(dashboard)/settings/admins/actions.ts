"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { companyOs, supabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin-auth";
import { recordAudit } from "@/lib/admin/audit";
import { findAdminEmployee, findAuthUser } from "@/lib/admin/admins";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/settings/admins");
}

function siteOrigin(): string {
  const h = headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("host");
  return host ? `https://${host}` : "https://www.edge8.ai";
}

// Send the right email for the account's state: no login yet → Supabase invite
// (creates the auth user, link lets them set a password); existing login →
// password reset. These are generated server-side, so the link comes back via
// the implicit flow with the session in the URL hash (#access_token=…). Land
// straight on /admin/reset-password (which reads the hash) — NOT
// /api/auth/callback, which only handles the PKCE ?code= flow used by the
// browser-initiated login "forgot password" form.
async function sendAccessEmail(email: string): Promise<Result> {
  const redirectTo = `${siteOrigin()}/admin/reset-password`;
  const existing = await findAuthUser(email);
  if (existing) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { ok: false, error: `Reset email failed: ${error.message}` };
    return { ok: true, message: `Password reset link sent to ${email}.` };
  }
  const { error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error) return { ok: false, error: `Invite failed: ${error.message}` };
  return { ok: true, message: `Invite sent to ${email}.` };
}


// ── Grants are the authority; this table is the console's record ────────────
//
// lib/admin-auth.ts now decides admin access from company_os.app_access, so
// every write here MUST maintain the grant or the console silently stops
// granting anything: an admins row with no grant is a person the UI lists and
// the gate turns away.
//
// The admins row is kept for one release because it still carries this
// screen's identity (`id`) and its created_by/created_at provenance. It is no
// longer consulted for authorisation.
async function setGrant(
  personId: string,
  role: "admin" | "sensitive",
  granted: boolean,
  actorPersonId: string | null,
): Promise<string | null> {
  if (granted) {
    // Revocation is a timestamp, never a delete, so re-granting someone must
    // not stack a second live row on top of the first.
    const { data: live } = await companyOs
      .from("app_access")
      .select("id")
      .eq("person_id", personId)
      .eq("app", "company_os")
      .eq("role", role)
      .is("revoked_at", null)
      .limit(1)
      .maybeSingle();
    if (live) return null;
    const { error } = await companyOs.from("app_access").insert({
      person_id: personId,
      app: "company_os",
      role,
      granted_by: actorPersonId,
      note: "Granted from /admin/settings/admins.",
    });
    return error?.message ?? null;
  }
  const { error } = await companyOs
    .from("app_access")
    .update({ revoked_at: new Date().toISOString() })
    .eq("person_id", personId)
    .eq("app", "company_os")
    .eq("role", role)
    .is("revoked_at", null);
  return error?.message ?? null;
}

/** The acting admin's person id, for grant provenance. Null is acceptable. */
async function actorPersonId(email: string): Promise<string | null> {
  const { data } = await companyOs
    .from("people")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

// Admins are granted to employees, never free-typed emails. The client sends
// the chosen person's id and the level; email + name are re-resolved from the
// people record server-side, and eligibility (on payroll, not a contractor,
// not already an admin) is re-checked here — findAdminEmployee returns null
// otherwise.
export async function addAdmin(personId: string, canViewSensitive: boolean): Promise<Result> {
  const admin = await requireAdmin();

  const employee = await findAdminEmployee(personId);
  if (!employee) {
    return { ok: false, error: "Pick an active employee from the list (contractors and current admins are excluded)." };
  }
  const email = employee.email; // already normalized lowercase
  const displayName = employee.name;

  const { data: row, error } = await companyOs
    .from("admins")
    .insert({
      email,
      display_name: displayName,
      person_id: personId,
      can_view_sensitive: canViewSensitive,
      created_by: admin.email,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  // THE GRANT IS WHAT CONFERS ACCESS. Written after the row so a failure here
  // leaves a visible, fixable entry rather than an invisible one.
  const actor = await actorPersonId(admin.email);
  const gErr =
    (await setGrant(personId, "admin", true, actor)) ??
    (canViewSensitive ? await setGrant(personId, "sensitive", true, actor) : null);
  if (gErr) return { ok: false, error: `Added, but the access grant failed: ${gErr}` };

  await recordAudit({
    table: "admins",
    recordId: row.id,
    operation: "insert",
    actor: admin.email,
    newData: { email, display_name: displayName, person_id: personId, can_view_sensitive: canViewSensitive },
  });

  const sent = await sendAccessEmail(email);
  refresh();
  if (!sent.ok) {
    // Access is already granted; only the email failed. Surface that precisely.
    return {
      ok: true,
      message: `${email} added, but the email could not be sent (${sent.error}). They can use "Forgot password" on the login page.`,
    };
  }
  return { ok: true, message: `${email} added. ${sent.message}` };
}

// Edits the display name and the level (Super Admin => can_view_sensitive).
// Email is no longer editable here: it's the linked employee's login address,
// kept in sync with the people record rather than typed by hand.
export async function updateAdmin(
  id: string,
  fields: { displayName: string; canViewSensitive: boolean },
): Promise<Result> {
  const admin = await requireAdmin();

  const { data: row, error: rErr } = await companyOs
    .from("admins")
    .select("id, email, display_name, can_view_sensitive, person_id")
    .eq("id", id)
    .maybeSingle();
  if (rErr || !row) return { ok: false, error: rErr?.message ?? "Admin not found." };

  const displayName = fields.displayName.trim() || null;
  const canViewSensitive = fields.canViewSensitive;

  const { error } = await companyOs
    .from("admins")
    .update({ display_name: displayName, can_view_sensitive: canViewSensitive })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // The LEVEL is the sensitive grant. Updating only the boolean would move the
  // badge in this screen and change nothing about what the person can see.
  if (row.person_id) {
    if (displayName) {
      await companyOs.from("people").update({ display_name: displayName }).eq("id", row.person_id);
    }
    const gErr = await setGrant(
      row.person_id,
      "sensitive",
      canViewSensitive,
      await actorPersonId(admin.email),
    );
    if (gErr) return { ok: false, error: `Saved, but the clearance change failed: ${gErr}` };
  }

  await recordAudit({
    table: "admins",
    recordId: id,
    operation: "update",
    actor: admin.email,
    oldData: { display_name: row.display_name, can_view_sensitive: row.can_view_sensitive },
    newData: { display_name: displayName, can_view_sensitive: canViewSensitive },
  });
  refresh();
  return { ok: true, message: "Admin updated." };
}

export async function resendAccessLink(id: string): Promise<Result> {
  await requireAdmin();
  const { data: row, error } = await companyOs
    .from("admins")
    .select("email")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) return { ok: false, error: error?.message ?? "Admin not found." };
  const sent = await sendAccessEmail(row.email);
  refresh();
  return sent;
}

// Revokes /admin access immediately (the gate checks this table per request).
// The Supabase login itself is kept — it may be re-granted or, later, hold a
// /team identity. Removal is what the audit trail records.
export async function deleteAdmin(id: string): Promise<Result> {
  const admin = await requireAdmin();

  const { data: row, error: rErr } = await companyOs
    .from("admins")
    .select("id, email, display_name, person_id")
    .eq("id", id)
    .maybeSingle();
  if (rErr || !row) return { ok: false, error: rErr?.message ?? "Admin not found." };
  if (row.email.toLowerCase() === admin.email) {
    return { ok: false, error: "You can't remove yourself — ask another admin." };
  }

  // Revoke FIRST: deleting the row without revoking would remove them from
  // this screen while leaving the grant — and therefore the access — in place.
  if (row.person_id) {
    const actor = await actorPersonId(admin.email);
    const gErr =
      (await setGrant(row.person_id, "admin", false, actor)) ??
      (await setGrant(row.person_id, "sensitive", false, actor));
    if (gErr) return { ok: false, error: `Could not revoke access: ${gErr}` };
  }

  const { error } = await companyOs.from("admins").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  await recordAudit({
    table: "admins",
    recordId: id,
    operation: "delete",
    actor: admin.email,
    oldData: { email: row.email, display_name: row.display_name },
  });
  refresh();
  return { ok: true, message: `${row.email} no longer has admin access.` };
}
