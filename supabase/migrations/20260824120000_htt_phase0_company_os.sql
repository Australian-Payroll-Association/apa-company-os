-- Applied via Supabase Management API (supabase db query --linked, role postgres).
-- Human Token Tracker integration, Phase 0a: company_os additive changes.
-- Additive only (new columns + two new tables). Safe on live data; idempotent.

-- companies: AI-program indicator (true => tracker on, >=1 repo)
alter table company_os.companies
  add column if not exists is_ai_program boolean not null default false;

-- ai_programs: GitHub repo identity (1:1 with a tracked repo).
-- repo_url = admin-pasted display/parse; github_repo = canonical org/name join key; github_repo_id survives renames.
alter table company_os.ai_programs
  add column if not exists repo_url text,
  add column if not exists github_repo citext,
  add column if not exists github_repo_id bigint;

create unique index if not exists ai_programs_github_repo_key
  on company_os.ai_programs (github_repo) where github_repo is not null;

-- people: GitHub account login (1:1, nullable)
alter table company_os.people
  add column if not exists github_login citext;

create unique index if not exists people_github_login_key
  on company_os.people (github_login) where github_login is not null;

-- company -> GitHub org(s), 1..n. org_login is globally unique: one org maps to one company.
create table if not exists company_os.company_github_orgs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references company_os.companies(id) on delete cascade,
  org_login   citext not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists company_github_orgs_company_idx
  on company_os.company_github_orgs (company_id);

-- person -> git commit email(s), 1..n. git_email globally unique: one commit email maps to one person.
-- Absorbs the tracker's contributor_aliases (migrated rows use source='discovered');
-- onboarding intake adds source='intake'.
create table if not exists company_os.person_git_emails (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references company_os.people(id) on delete cascade,
  git_email   citext not null unique,
  source      text not null default 'manual' check (source in ('intake','discovered','manual')),
  is_primary  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists person_git_emails_person_idx
  on company_os.person_git_emails (person_id);
create unique index if not exists person_git_emails_one_primary
  on company_os.person_git_emails (person_id) where is_primary;

-- updated_at triggers (reuse the schema's existing standard touch fn)
drop trigger if exists company_github_orgs_set_updated_at on company_os.company_github_orgs;
create trigger company_github_orgs_set_updated_at before update on company_os.company_github_orgs
  for each row execute function company_os.handle_updated_at();
drop trigger if exists person_git_emails_set_updated_at on company_os.person_git_emails;
create trigger person_git_emails_set_updated_at before update on company_os.person_git_emails
  for each row execute function company_os.handle_updated_at();

-- RLS on (no user-facing policies; app-code gating via service_role) + grants, per repo convention.
alter table company_os.company_github_orgs enable row level security;
alter table company_os.person_git_emails enable row level security;

grant select, insert, update, delete on company_os.company_github_orgs to service_role;
grant select, insert, update, delete on company_os.person_git_emails to service_role;
grant select on company_os.company_github_orgs to supabase_read_only_user;
grant select on company_os.person_git_emails to supabase_read_only_user;
