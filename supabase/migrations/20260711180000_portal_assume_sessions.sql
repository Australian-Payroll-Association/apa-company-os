-- Applied 2026-07-11 via Supabase MCP migration `portal_assume_sessions`.
-- Admin "Assume" feature: view the client portal as a specific client company,
-- without ever swapping the admin's real Supabase session. requirePortalMember()
-- (lib/portal-auth.ts) checks for an active row here, matched by an httpOnly
-- cookie holding the session id, before deciding whether to bounce an admin to
-- /admin. The admin's own auth session is untouched throughout; ending the
-- session (or letting it expire) simply removes the override.
create table if not exists company_os.portal_assume_sessions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_os.companies(id),
  person_id uuid not null references company_os.people(id),
  started_by text not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  ended_at timestamptz,
  ended_by text
);

create index if not exists portal_assume_sessions_started_by_idx
  on company_os.portal_assume_sessions (started_by);

alter table company_os.portal_assume_sessions enable row level security;
grant select, insert, update, delete on company_os.portal_assume_sessions to service_role;
