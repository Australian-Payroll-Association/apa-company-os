// Server-only auth gate for the /team self-service portal. The mirror of
// lib/admin-auth.ts, but for employees and managers instead of admins.
//
// SECURITY MODEL (see docs/plans/2026-07-05-team-portal-design.md):
// company_os has RLS enabled with NO policies and NO grants to the browser key,
// so the publishable key can read nothing there. All /team data goes through the
// service-role client (lib/supabase.ts) exactly like /admin. This gate is the
// ONLY boundary, so every /team page and server action must call
// requireTeamMember() first AND scope every query to the actor's own ids (use
// lib/team/data.ts). Identity is matched on people.auth_user_id (the cryptographic
// id from the JWT), NEVER on email, which is mutable/reusable.

import { redirect } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { companyOs } from "@/lib/supabase";
import { isAdminEmail } from "@/lib/admin-auth";

export type TeamRole = "employee" | "manager";

export type TeamActor = {
  authUserId: string;
  personId: string;
  teamMemberId: string;
  role: TeamRole;
  displayName: string;
  // Scope sets, computed server-side from the JWT — never from client input.
  // Employees: just their own id. Managers: own id + active direct reports.
  teamMemberScope: string[]; // team_members.id values this actor may read
  personScope: string[]; // people.id values this actor may read
  directReportIds: string[]; // team_members.id of direct reports (managers only)
};

// team_members.status values that grant portal access. Candidates (recruiting),
// terminated, and alumni are denied; pre_start is allowed so new hires can do
// onboarding before day one. Exported so provisioning refuses to invite anyone
// the gate would turn away.
export const PORTAL_STATUSES = ["active", "on_leave", "notice", "pre_start"];

function displayNameOf(p: {
  preferred_name: string | null;
  first_name: string | null;
  full_name: string | null;
  email: string;
}): string {
  return p.preferred_name || p.first_name || p.full_name || p.email;
}

type GetActorResult =
  | { actor: TeamActor; redirectTo?: undefined }
  | { actor: null; redirectTo: "/admin" | "/team/login" };

// Resolve the signed-in user to a team actor. Returns a redirect target instead
// of an actor when the caller is not a portal user:
//   - not signed in            -> /team/login
//   - an admin (allowlist)     -> /admin (admins have no /team identity)
//   - signed in but not a linked, active team member -> /team/login
export async function getTeamActor(): Promise<GetActorResult> {
  const supabase = createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!user || !email) return { actor: null, redirectTo: "/team/login" };

  // Admins live in /admin. They keep full service-role access there and get no
  // /team identity, so a plain employee can never reach the CRM and an admin is
  // never accidentally scoped as an employee.
  if (await isAdminEmail(email)) return { actor: null, redirectTo: "/admin" };

  // Identity by auth_user_id, never by email.
  const { data: person } = await companyOs
    .from("people")
    .select("id, full_name, first_name, preferred_name, email")
    .eq("auth_user_id", user.id)
    .maybeSingle();
  if (!person) return { actor: null, redirectTo: "/team/login" };

  // Active employment record. A person may have several engagements; prefer an
  // 'active' one, else the first portal-eligible row.
  const { data: memberships } = await companyOs
    .from("team_members")
    .select("id, status")
    .eq("person_id", person.id)
    .in("status", PORTAL_STATUSES);
  const rows = (memberships ?? []) as { id: string; status: string }[];
  const membership = rows.find((r) => r.status === "active") ?? rows[0];
  if (!membership) return { actor: null, redirectTo: "/team/login" };

  // Manager iff at least one active team member reports to this one.
  const { data: reports } = await companyOs
    .from("team_members")
    .select("id, person_id")
    .eq("manager_id", membership.id)
    .in("status", PORTAL_STATUSES);
  const reportRows = (reports ?? []) as { id: string; person_id: string }[];
  const isManager = reportRows.length > 0;

  const directReportIds = reportRows.map((r) => r.id);
  const teamMemberScope = [membership.id, ...directReportIds];
  const personScope = [person.id, ...reportRows.map((r) => r.person_id)];

  return {
    actor: {
      authUserId: user.id,
      personId: person.id,
      teamMemberId: membership.id,
      role: isManager ? "manager" : "employee",
      displayName: displayNameOf(person),
      teamMemberScope,
      personScope,
      directReportIds,
    },
  };
}

// Gate for /team pages and server actions. Redirects when the caller has no
// team identity. Call at the top of the /team layout and EVERY /team action.
export async function requireTeamMember(): Promise<TeamActor> {
  const { actor, redirectTo } = await getTeamActor();
  if (!actor) redirect(redirectTo);
  return actor;
}
