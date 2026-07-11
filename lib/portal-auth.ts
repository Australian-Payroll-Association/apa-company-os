// Server-only auth gate for the /portal client surface. The third sibling of
// lib/admin-auth.ts (admins) and lib/team-auth.ts (employees), for external
// client contacts.
//
// SECURITY MODEL (see docs/plans/2026-07-11-client-portal-design.md):
// company_os has RLS enabled with NO policies and NO grants to the browser key,
// so the publishable key can read nothing there. All /portal data goes through
// the service-role client behind this gate. Portal users are EXTERNAL parties,
// so this boundary matters even more than /team: every /portal page and server
// action must call requirePortalMember() first AND scope every query through
// lib/portal/data.ts. Identity is matched on people.auth_user_id (the
// cryptographic id from the JWT), NEVER on email, which is mutable/reusable.
//
// Access is an explicit allowlist: a person may log in iff they hold at least
// one active company_os.portal_members row. CRM links (person_companies) never
// grant access by themselves.

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { companyOs } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin-auth";
import { PORTAL_STATUSES } from "@/lib/team-auth";

export type PortalMembership = {
  id: string;
  companyId: string | null;
  companyName: string | null;
  role: string;
};

export type PortalActor = {
  authUserId: string;
  personId: string;
  displayName: string;
  email: string;
  // Scope, computed server-side from the JWT — never from client input.
  companyScope: string[]; // companies.id values this actor may read
  memberships: PortalMembership[];
};

function displayNameOf(p: {
  preferred_name: string | null;
  first_name: string | null;
  full_name: string | null;
  email: string;
}): string {
  return p.preferred_name || p.first_name || p.full_name || p.email;
}

type GetActorResult =
  | { actor: PortalActor; redirectTo?: undefined }
  | { actor: null; redirectTo: "/admin" | "/team" | "/portal/login" };

type MembershipRow = {
  id: string;
  company_id: string | null;
  role: string;
  companies: { name: string | null } | { name: string | null }[] | null;
};

const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

// Resolve the signed-in user to a portal actor. Returns a redirect target
// instead of an actor when the caller is not a portal user:
//   - not signed in                    -> /portal/login
//   - an admin                         -> /admin  (admins have no /portal identity)
//   - an active team member            -> /team   (employees use /team, never /portal)
//   - no active portal_members row     -> /portal/login
export async function getPortalActor(): Promise<GetActorResult> {
  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email) return { actor: null, redirectTo: "/portal/login" };

  if (await isAdminEmail(email)) return { actor: null, redirectTo: "/admin" };

  // Identity by auth_user_id, never by email.
  const { data: person } = await companyOs
    .from("people")
    .select("id, full_name, first_name, preferred_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!person) return { actor: null, redirectTo: "/portal/login" };

  // Employees belong in /team. Provisioning refuses to invite active team
  // members, so hitting this means the person became staff after the invite —
  // route them to their real surface rather than double-scoping them.
  const { data: employment } = await companyOs
    .from("team_members")
    .select("id")
    .eq("person_id", person.id)
    .in("status", PORTAL_STATUSES)
    .limit(1);
  if ((employment ?? []).length > 0) return { actor: null, redirectTo: "/team" };

  const { data: memberRows } = await companyOs
    .from("portal_members")
    .select("id, company_id, role, companies:companies!company_id(name)")
    .eq("person_id", person.id)
    .eq("status", "active");
  const rows = (memberRows ?? []) as MembershipRow[];
  if (rows.length === 0) return { actor: null, redirectTo: "/portal/login" };

  const memberships: PortalMembership[] = rows.map((r) => ({
    id: r.id,
    companyId: r.company_id,
    companyName: one(r.companies)?.name ?? null,
    role: r.role,
  }));
  const companyScope = memberships
    .map((m) => m.companyId)
    .filter((id): id is string => !!id);

  return {
    actor: {
      authUserId: user.id,
      personId: person.id,
      displayName: displayNameOf(person),
      email: person.email,
      companyScope,
      memberships,
    },
  };
}

// Gate for /portal pages and server actions. Redirects when the caller has no
// portal identity. Call at the top of the /portal layout and EVERY /portal action.
export async function requirePortalMember(): Promise<PortalActor> {
  const { actor, redirectTo } = await getPortalActor();
  if (!actor) redirect(redirectTo);
  return actor;
}
