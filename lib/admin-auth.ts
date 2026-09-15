// Server-only admin auth gate. NEVER import from a client component.
//
// A request is "admin" iff it carries a valid Supabase session AND the user
// holds a live (company_os, admin) grant in company_os.app_access — the one
// authority every APA app consults — OR their email is in the ADMIN_ALLOWLIST
// env var (break-glass fallback so a bad delete in the UI can never lock
// everyone out).
//
// The gate used to match on EMAIL against company_os.admins. Two lists then
// described the same thing with nothing keeping them honest, and the key was
// mutable: change an address and access vanished, reissue a departed
// employee's and it transferred. company_os has RLS ENABLED with no
// policies and no grants to the browser/publishable key, so that key can read
// nothing there; all data flows through the service-role client
// (lib/supabase.ts), which bypasses RLS. This gate — enforced in the admin
// layout and at the top of EVERY server action — is therefore the security
// boundary. (The /team portal uses the same service-role + gate pattern via
// requireTeamMember(); see lib/team-auth.ts.)

import { cache } from "react";
import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { companyOs } from "@/lib/supabase";

export type AdminUser = { id: string; email: string };

// ── Where admin authority actually lives ───────────────────────────────────
//
// company_os.app_access, reached through app_security.has_app_role(). That is
// the one contract every APA application consults; Payroll IQ's 64 RLS policies
// and its requireAdmin() both resolve through it.
//
// This app cannot CALL has_app_role(), and that is a property of its
// architecture rather than an oversight: the function resolves auth.uid(), and
// every query here goes through the service-role client, where there is no JWT
// and auth.uid() is null. So this runs the function's own query with the key
// passed in explicitly. Same table, same rule, same answer — see
// supabase/migrations/20260916030000_app_access_grants.sql.
//
// TWO KEYS, because callers ask two different questions and conflating them is
// what made the old gate wrong:
//
//   byAuthUserId — "is the CALLER an admin?" Used once the session has been
//     revalidated, so it keys on the immutable id rather than the address. This
//     is the fix for the wart the old gate carried: an email is mutable and
//     reusable, so changing someone's address silently removed their access and
//     reissuing a departed employee's address silently granted it.
//
//   byEmail — "is THIS OTHER PERSON an admin?" Genuinely a question about an
//     address: portal-invite and talent/team ask it to refuse inviting an admin
//     as an employee, signin-link and survey-identity to classify one. No
//     session is involved, so auth.uid() could never have answered it.
async function hasCompanyOsGrant(
  key: { authUserId: string } | { email: string },
  role: "admin" | "sensitive",
): Promise<boolean> {
  let q = companyOs
    .from("app_access")
    .select("id, people!inner(id)")
    .eq("app", "company_os")
    .eq("role", role)
    .is("revoked_at", null);

  q = "authUserId" in key
    ? q.eq("people.auth_user_id", key.authUserId)
    : q.eq("people.email", key.email);

  const { data, error } = await q.limit(1).maybeSingle();
  if (error) {
    // Fail closed, exactly as the table lookup it replaces did: the env
    // allowlist above is the recovery path, never an open door.
    console.error(`app_access lookup failed (${role}):`, error.message);
    return false;
  }
  return Boolean(data);
}

// Emergency allowlist from the environment. Editing it requires a redeploy;
// day-to-day admin management lives in company_os.admins.
export function envAllowlist(): Set<string> {
  return new Set(
    (process.env.ADMIN_ALLOWLIST ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// True if the email is an admin: env allowlist first (no DB hit), then the
// admins table. A DB error counts as "not in the table" — the env fallback is
// the recovery path, never an open door. Shared with the /team gate (admins
// have no /team identity) and portal provisioning (never invite an admin as
// an employee).
export async function isAdminEmail(email: string | null | undefined): Promise<boolean> {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  if (envAllowlist().has(normalized)) return true;
  return hasCompanyOsGrant({ email: normalized }, "admin");
}

// Returns the signed-in admin, or null if not signed in / not allowlisted.
//
// Revalidates the JWT against GoTrue on every call (auth.getUser, one network
// hop). This gate does NOT delegate authentication to middleware.
//
// It used to: it read the session locally with getSession() and relied on
// middleware.ts having already run auth.getUser(). getSession() performs no
// signature check — it decodes the cookie and returns whatever is in it — so
// that arrangement was only ever as strong as the middleware matcher. The
// matcher covers "/admin/:path*", "/team/:path*", "/portal/:path*" and does NOT
// cover /api, yet eight /api routes call these gates (admin chat, team chat,
// publish-editor, both QBO routes, the portal assistants, the conversation
// store). On those routes nothing revalidated the cookie, so a forged one was
// accepted — and lib/admin-chat/privileged.ts treats a single email address as
// the write-privileged user.
//
// Verifying here instead of upstream makes the guarantee local to the gate: it
// holds no matter which route calls it, and cannot be broken by editing a
// matcher in another file. The authoritative admins-table authorization check
// below is unchanged.
//
// Wrapped in React cache(): the admin layout, the page, and any server component
// that calls requireAdmin() during one render share a single resolve, so the
// revalidation is one network hop per request, not one per caller.
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email) return null;
  // Break-glass first (no DB hit), then the grant BY AUTH USER ID. The session
  // has just been revalidated above, so the immutable key is available here —
  // and this is the one caller that should never key on an address.
  const ok =
    envAllowlist().has(email) ||
    (await hasCompanyOsGrant({ authUserId: user.id }, "admin"));
  if (!ok) return null;
  return { id: user.id, email };
});

// Server-side gate. Call at the top of the admin layout and every server action.
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}

// ── Sensitive-data gate (wages + PII) ──────────────────────────────────────
//
// Being an admin is NOT enough to see confidential data. Compensation, PII
// (people_sensitive, ID documents, bank details), and anything similarly
// restricted is gated to a smaller set — Dave and Mai — checked SERVER-SIDE so
// the data is never fetched for anyone else. Two sources, mirroring the admin
// gate: a SENSITIVE_VIEWERS env allowlist (break-glass; covers env-only admins
// like the owner, who has no admins row) checked first, then the
// admins.can_view_sensitive column. Do NOT reuse ADMIN_ALLOWLIST — every admin
// is in that.

export function sensitiveEnvAllowlist(): Set<string> {
  return new Set(
    (process.env.SENSITIVE_VIEWERS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

// True if this email may view/edit wages and PII. Env allowlist first (no DB
// hit), then admins.can_view_sensitive. A DB error counts as "not cleared" —
// fail closed, never leak. Wrapped in cache() so one render resolves it once.
export const canViewSensitive = cache(async (email: string | null | undefined): Promise<boolean> => {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return false;
  if (sensitiveEnvAllowlist().has(normalized)) return true;
  // One mechanism instead of a table plus a boolean: clearance is its own
  // grant, so it is granted, revoked and audited exactly like admin is.
  return hasCompanyOsGrant({ email: normalized }, "sensitive");
});

// Convenience for server components/actions: the current admin plus whether
// they're cleared for sensitive data. Returns null if not signed in.
export async function getSensitiveViewer(): Promise<{ email: string; canViewSensitive: boolean } | null> {
  const user = await getAdminUser();
  if (!user) return null;
  return { email: user.email, canViewSensitive: await canViewSensitive(user.email) };
}

// ── Super admin gate ────────────────────────────────────────────────────────
//
// "Super admin" is the access-control name for the smallest, most-trusted admin
// set — currently Dave and Mai. It is the SAME set already cleared for sensitive
// data (wages + PII), so there is one source of truth: SENSITIVE_VIEWERS env +
// admins.can_view_sensitive, via canViewSensitive(). Being a plain admin (My,
// Quan) is not enough. Used to gate the ATS (recruiting: applications, job reqs,
// candidate pool) and employee compensation — the two together are what a super
// admin can see that a plain admin cannot.

export const isSuperAdmin = cache(async (email: string | null | undefined): Promise<boolean> => {
  return canViewSensitive(email);
});

// Server-side gate for super-admin-only surfaces. Call in the ATS route layouts
// and at the top of EVERY ATS server action (a layout does not protect action
// POSTs — the action gate is the real boundary). A signed-in admin who is not a
// super admin is bounced to the admin home rather than the login page.
export async function requireSuperAdmin(): Promise<AdminUser> {
  const user = await requireAdmin();
  if (!(await isSuperAdmin(user.email))) redirect("/admin");
  return user;
}
