// The ONLY sanctioned path for /team code to read company_os. Every /team page
// and server action must go through here (or an equally-scoped helper) rather
// than importing the service-role `companyOs` client directly — a lint rule
// enforces that ban. The service-role key bypasses RLS, so a single unscoped
// query would leak the whole company; funnelling reads through one helper that
// injects the actor's scope filter makes that structurally impossible.

import { companyOs } from "@/lib/supabase";
import type { TeamActor } from "@/lib/team-auth";

// Tables /team may read, and the column + scope each is filtered on. A table not
// listed here cannot be read from /team. Expand this deliberately, one table per
// slice, always with an explicit scope key. `team_member` filters by
// actor.teamMemberScope; `person` by actor.personScope.
type ScopeKind = "team_member" | "person";
const SCOPE_ALLOWLIST: Record<string, { column: string; scope: ScopeKind }> = {
  time_off: { column: "team_member_id", scope: "team_member" },
  ideas: { column: "person_id", scope: "person" },
};

function scopeIds(actor: TeamActor, scope: ScopeKind): string[] {
  return scope === "team_member" ? actor.teamMemberScope : actor.personScope;
}

// Scoped read: returns a query builder already filtered to the actor's scope.
// Chain further .eq/.order/.limit as needed; the scope filter cannot be removed.
export function teamRead(actor: TeamActor, table: keyof typeof SCOPE_ALLOWLIST, select: string) {
  const cfg = SCOPE_ALLOWLIST[table];
  if (!cfg) throw new Error(`teamRead: '${table}' is not in the /team scope allowlist`);
  return companyOs.from(table).select(select).in(cfg.column, scopeIds(actor, cfg.scope));
}

// The actor's OWN employment summary (self-scoped by construction: filtered on
// actor.teamMemberId, which comes from the JWT-derived actor, never client input).
// Department/position/manager are reference labels, safe for the employee to see.
type PersonLite = {
  full_name: string | null;
  preferred_name: string | null;
  email: string;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};
type ManagerName = { full_name: string | null; preferred_name: string | null };
export type OwnProfile = {
  id: string;
  employee_number: string | null;
  employment_type: string | null;
  work_location: string | null;
  status: string | null;
  start_date: string | null;
  person: PersonLite | null;
  departmentName: string | null;
  positionTitle: string | null;
  managerName: string | null;
};

// PostgREST returns to-one embeds as an object, but can surface arrays; normalize.
const one = <T,>(e: T | T[] | null | undefined): T | null =>
  Array.isArray(e) ? e[0] ?? null : e ?? null;

function nameOf(p: ManagerName | null): string | null {
  return p ? p.preferred_name || p.full_name : null;
}

export async function getOwnProfile(actor: TeamActor): Promise<OwnProfile | null> {
  const { data } = await companyOs
    .from("team_members")
    .select(
      "id, employee_number, employment_type, work_location, status, start_date, " +
        "people:people!person_id(full_name, preferred_name, email, phone, emergency_contact_name, emergency_contact_phone), " +
        "departments:departments!department_id(name), " +
        "positions:positions!position_id(title), " +
        "manager:team_members!manager_id(people:people!person_id(full_name, preferred_name))",
    )
    .eq("id", actor.teamMemberId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  const dept = one(r.departments as { name: string | null } | { name: string | null }[] | null);
  const pos = one(r.positions as { title: string | null } | { title: string | null }[] | null);
  const mgr = one(r.manager as { people: ManagerName | ManagerName[] | null } | { people: ManagerName | ManagerName[] | null }[] | null);
  return {
    id: r.id as string,
    employee_number: (r.employee_number as string | null) ?? null,
    employment_type: (r.employment_type as string | null) ?? null,
    work_location: (r.work_location as string | null) ?? null,
    status: (r.status as string | null) ?? null,
    start_date: (r.start_date as string | null) ?? null,
    person: one(r.people as PersonLite | PersonLite[] | null),
    departmentName: dept?.name ?? null,
    positionTitle: pos?.title ?? null,
    managerName: nameOf(one(mgr?.people ?? null)),
  };
}

// Ownership assertion for id-taking mutations: confirms a target row belongs to
// the actor's scope BEFORE the caller mutates it. Closes IDOR — an action must
// never trust a client-supplied id as the authorization subject. Returns the
// row's scope id when in scope, or null when the row is missing or out of scope.
export async function assertInScope(
  actor: TeamActor,
  table: keyof typeof SCOPE_ALLOWLIST,
  id: string,
): Promise<string | null> {
  const cfg = SCOPE_ALLOWLIST[table];
  if (!cfg) throw new Error(`assertInScope: '${table}' is not in the /team scope allowlist`);
  const { data } = await companyOs.from(table).select(`${cfg.column}`).eq("id", id).maybeSingle();
  if (!data) return null;
  const owner = (data as unknown as Record<string, string>)[cfg.column];
  return scopeIds(actor, cfg.scope).includes(owner) ? owner : null;
}

// Scoped insert: the ONLY way /team code creates company_os rows. Forces the
// table's scope column to the actor's OWN id (never the broader manager scope,
// and never a client-supplied value) so a create can only ever be "for myself".
// Spreading `row` before the forced key means any client-supplied value for
// that column is silently overwritten, not merely validated.
export async function teamInsertOwn(
  actor: TeamActor,
  table: keyof typeof SCOPE_ALLOWLIST,
  row: Record<string, unknown>,
): Promise<{ data: { id: string } | null; error: string | null }> {
  const cfg = SCOPE_ALLOWLIST[table];
  if (!cfg) throw new Error(`teamInsertOwn: '${table}' is not in the /team scope allowlist`);
  const ownId = cfg.scope === "team_member" ? actor.teamMemberId : actor.personId;
  const { data, error } = await companyOs
    .from(table)
    .insert({ ...row, [cfg.column]: ownId } as Record<string, unknown>)
    .select("id")
    .maybeSingle();
  return { data: (data as { id: string } | null) ?? null, error: error?.message ?? null };
}

// Scoped update: re-derives ownership via assertInScope immediately before
// writing, so a mutation can never trust a stale or client-forged id. Callers
// that need a narrower check than "actor's scope" (e.g. strictly self, not
// self-plus-reports) must assert that themselves before calling this.
export async function teamUpdateInScope(
  actor: TeamActor,
  table: keyof typeof SCOPE_ALLOWLIST,
  id: string,
  patch: Record<string, unknown>,
): Promise<{ ok: boolean; error: string | null }> {
  const owner = await assertInScope(actor, table, id);
  if (!owner) return { ok: false, error: "Not found." };
  const { error } = await companyOs.from(table).update(patch).eq("id", id);
  return { ok: !error, error: error?.message ?? null };
}

// The actor's own leave balance + policy label, read from team_directory but
// filtered to exactly one row (their own, by actor.teamMemberId — never client
// input). team_directory is not in SCOPE_ALLOWLIST because it is unsafe to read
// broadly (it carries every member's leave balance); this is a narrow,
// purpose-built exception, the same shape as getOwnProfile below.
export type OwnLeaveSummary = {
  policyName: string | null;
  totalDays: number | null;
  usedDays: number | null;
};

export async function getOwnLeaveSummary(actor: TeamActor): Promise<OwnLeaveSummary | null> {
  const { data } = await companyOs
    .from("team_directory")
    .select("leave_policy, total_days, used_days")
    .eq("id", actor.teamMemberId)
    .maybeSingle();
  if (!data) return null;
  const r = data as { leave_policy: string | null; total_days: number | string | null; used_days: number | string | null };
  const num = (v: number | string | null) => (v === null ? null : Number(v));
  return { policyName: r.leave_policy, totalDays: num(r.total_days), usedDays: num(r.used_days) };
}

// The actor's manager's contact details, for notifying on a new time-off
// request. Self-scoped by actor.teamMemberId; returns null if the actor has no
// manager or the manager has no email on file.
export type ManagerContact = { email: string; displayName: string };

export async function getManagerContact(actor: TeamActor): Promise<ManagerContact | null> {
  const { data } = await companyOs
    .from("team_members")
    .select(
      "manager:team_members!manager_id(people:people!person_id(full_name, preferred_name, email))",
    )
    .eq("id", actor.teamMemberId)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  type PersonEmail = { full_name: string | null; preferred_name: string | null; email: string | null };
  const mgr = one(r.manager as { people: PersonEmail | PersonEmail[] | null } | { people: PersonEmail | PersonEmail[] | null }[] | null);
  const person = one(mgr?.people ?? null);
  if (!person?.email) return null;
  return { email: person.email, displayName: person.preferred_name || person.full_name || person.email };
}

// The company directory: current team members (active, on leave, or on notice —
// people who work here today; pre_start and departed are excluded), with a FIXED
// safe column list. Company-visible by design, so it takes no per-actor filter —
// but it deliberately does NOT read the team_directory view, which carries every
// member's leave balance, and it exposes no contact details (deferred decision:
// names/roles only). Widening these columns is a reviewed change, not a tweak.
const DIRECTORY_STATUSES = ["active", "on_leave", "notice"];

export type DirectoryEntry = {
  id: string;
  name: string;
  positionTitle: string | null;
  departmentName: string | null;
  location: string | null;
  managerName: string | null;
};

export async function getDirectory(): Promise<DirectoryEntry[]> {
  const { data } = await companyOs
    .from("team_members")
    .select(
      "id, work_location, " +
        "people:people!person_id(full_name, preferred_name), " +
        "departments:departments!department_id(name), " +
        "positions:positions!position_id(title), " +
        "manager:team_members!manager_id(people:people!person_id(full_name, preferred_name))",
    )
    .in("status", DIRECTORY_STATUSES);
  type Name = { full_name: string | null; preferred_name: string | null };
  const entries = ((data ?? []) as unknown as Record<string, unknown>[]).map((r) => {
    const person = one(r.people as Name | Name[] | null);
    const dept = one(r.departments as { name: string | null } | { name: string | null }[] | null);
    const pos = one(r.positions as { title: string | null } | { title: string | null }[] | null);
    const mgr = one(r.manager as { people: Name | Name[] | null } | { people: Name | Name[] | null }[] | null);
    return {
      id: r.id as string,
      name: nameOf(person) ?? "—",
      positionTitle: pos?.title ?? null,
      departmentName: dept?.name ?? null,
      location: (r.work_location as string | null) ?? null,
      managerName: nameOf(one(mgr?.people ?? null)),
    };
  });
  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

// Self-scoped profile update: writes ONLY the actor's own people row (filtered
// on actor.personId from the JWT-derived actor, never client input) and ONLY
// the fields an employee may edit about themselves. Employment fields, names
// used for payroll (full_name), and email are admin-managed; widening this
// allowlist is a security decision, not a convenience.
const OWN_EDITABLE_FIELDS = [
  "preferred_name",
  "phone",
  "emergency_contact_name",
  "emergency_contact_phone",
] as const;
export type OwnEditableField = (typeof OWN_EDITABLE_FIELDS)[number];

export async function updateOwnContact(
  actor: TeamActor,
  fields: Partial<Record<OwnEditableField, string | null>>,
): Promise<{ ok: boolean; error: string | null }> {
  const patch: Record<string, string | null> = {};
  for (const key of OWN_EDITABLE_FIELDS) {
    if (key in fields) patch[key] = fields[key] ?? null;
  }
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update." };
  const { error } = await companyOs.from("people").update(patch).eq("id", actor.personId);
  return { ok: !error, error: error?.message ?? null };
}
