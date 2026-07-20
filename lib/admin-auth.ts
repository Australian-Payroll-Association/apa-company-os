// Server-only admin auth gate. NEVER import from a client component.
//
// A request is "admin" iff it carries a valid Supabase session AND the user's
// email is in the company_os.admins table (managed at /admin/settings/admins)
// OR in the ADMIN_ALLOWLIST env var (break-glass fallback so a bad delete in
// the UI can never lock everyone out). company_os has RLS ENABLED with no
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
  const { data, error } = await companyOs
    .from("admins")
    .select("id")
    .eq("email", normalized)
    .maybeSingle();
  if (error) {
    console.error("admins lookup failed:", error.message);
    return false;
  }
  return Boolean(data);
}

// Returns the signed-in admin, or null if not signed in / not allowlisted.
// Uses getUser() (revalidates the JWT against Supabase) — not getSession() — so
// a forged or expired cookie cannot pass.
//
// Wrapped in React cache(): the admin layout, the page, and any server component
// that calls requireAdmin() during one render share a single resolve instead of
// each re-running getUser() (a network round-trip) + the admins lookup.
export const getAdminUser = cache(async (): Promise<AdminUser | null> => {
  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email || !(await isAdminEmail(email))) return null;
  return { id: user.id, email };
});

// Server-side gate. Call at the top of the admin layout and every server action.
export async function requireAdmin(): Promise<AdminUser> {
  const user = await getAdminUser();
  if (!user) redirect("/admin/login");
  return user;
}
