-- Applied via Supabase Management API (supabase db query --linked, role postgres).
-- Human Token Tracker integration, Phase 0b: the dedicated `htt` schema.
-- Consolidated final-state DDL for the tracker's data tables, re-pointed to edge8 identity:
--   client_id  -> company_id (company_os.companies)
--   team_member_id -> person_id (company_os.people)
--   project_id -> repo_id (htt.repos)
-- created_by (was auth.users uuid) -> text (audit label; auth linkage dropped).
-- Additive only; creates a new schema. No data (data copy is Phase 2). Idempotent.

create schema if not exists htt;

-- updated_at touch fn for htt tables
create or replace function htt.set_updated_at() returns trigger
  language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- 1) repos (ex tracker `projects`): 1:1 with an ai_program; denormalized company scope.
create table if not exists htt.repos (
  id                  uuid primary key default gen_random_uuid(),
  ai_program_id       uuid not null unique references company_os.ai_programs(id) on delete restrict,
  company_id          uuid not null references company_os.companies(id) on delete restrict,
  slug                text,
  name                text not null,
  github_repo         text,
  github_repo_id      bigint,
  github_repo_aliases text[] not null default '{}',
  roi_metric_name     text,
  roi_metric_unit     text check (roi_metric_unit in ('count','money','percent')),
  roi_metric_baseline numeric,
  roi_metric_target   numeric,
  roi_metric_period   text check (roi_metric_period in ('monthly','quarterly','annual')),
  started_at          timestamptz,
  ended_at            timestamptz,
  status              text not null default 'planned'
                        check (status in ('planned','active','ramping','paused','complete','archived')),
  last_synced_at      timestamptz,
  live_url            text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index if not exists repos_github_repo_uniq on htt.repos (github_repo) where github_repo is not null;
create unique index if not exists repos_company_slug_uniq on htt.repos (company_id, slug) where slug is not null;
create index if not exists repos_company_status_idx on htt.repos (company_id, status);

-- 2) pull_requests
create table if not exists htt.pull_requests (
  id               uuid primary key default gen_random_uuid(),
  repo_id          uuid not null references htt.repos(id) on delete cascade,
  github_pr_id     bigint,
  number           integer,
  title            text not null,
  author_login     text,
  author_person_id uuid references company_os.people(id) on delete set null,
  url              text,
  state            text not null check (state in ('open','merged','closed')),
  status           text not null default 'tracked' check (status in ('tracked','verified','disputed','excluded')),
  opened_at        timestamptz not null,
  merged_at        timestamptz,
  closed_at        timestamptz,
  head_branch      text,
  created_by       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists pull_requests_github_pr_id_uniq on htt.pull_requests (github_pr_id);
create index if not exists pull_requests_repo_idx on htt.pull_requests (repo_id, state);
create index if not exists pull_requests_repo_head_branch_idx on htt.pull_requests (repo_id, head_branch) where head_branch is not null;

-- 3) token_entries (AI + human token amounts). NOTE: keeps the tracker's known NULL-person daily dedup gap.
create table if not exists htt.token_entries (
  id              uuid primary key default gen_random_uuid(),
  company_id      uuid not null references company_os.companies(id) on delete restrict,
  repo_id         uuid references htt.repos(id) on delete set null,
  pull_request_id uuid references htt.pull_requests(id) on delete set null,
  person_id       uuid references company_os.people(id) on delete set null,
  kind            text not null check (kind in ('human','claude','app')),
  amount          bigint not null check (amount >= 0),
  source          text not null
                    check (source in ('pr_commit','pr_review','planning','design','research','manual','session','app')),
  occurred_at     timestamptz not null,
  occurred_on     date,
  status          text not null default 'recorded' check (status in ('recorded','approved','disputed','excluded')),
  session_branch  text,
  session_id      text,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists token_entries_session_kind_uniq on htt.token_entries (session_id, kind);
create unique index if not exists token_entries_member_repo_day_kind_uniq on htt.token_entries (person_id, repo_id, occurred_on, kind);
create unique index if not exists token_entries_app_repo_day_source_uniq on htt.token_entries (repo_id, occurred_on, source) where kind = 'app';
create index if not exists token_entries_company_occurred_idx on htt.token_entries (company_id, occurred_at);
create index if not exists token_entries_repo_kind_idx on htt.token_entries (repo_id, kind);
create index if not exists token_entries_pr_idx on htt.token_entries (pull_request_id);
create index if not exists token_entries_member_idx on htt.token_entries (person_id);
create index if not exists token_entries_session_branch_idx on htt.token_entries (repo_id, session_branch)
  where pull_request_id is null and session_branch is not null;

-- 4) man_hour_entries (true de-overlapped human hours = the delivery debit source)
create table if not exists htt.man_hour_entries (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid references company_os.people(id) on delete set null,
  company_id    uuid not null references company_os.companies(id) on delete restrict,
  repo_id       uuid references htt.repos(id) on delete set null,
  primary_role  text,
  hours         numeric(6,2) not null,
  occurred_on   date not null,
  occurred_hour smallint check (occurred_hour >= 0 and occurred_hour <= 23),
  source        text not null check (source in ('auto_session','manual')),
  description   text,
  rate_cents    integer,
  currency      text default 'AUD',
  status        text not null default 'recorded'
                  check (status in ('recorded','approved','invoiced','paid','excluded')),
  started_at    timestamptz,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists man_hour_auto_uniq on htt.man_hour_entries (person_id, repo_id, occurred_on) where source = 'auto_session';
create index if not exists man_hour_company_day_idx on htt.man_hour_entries (company_id, occurred_on);
create index if not exists man_hour_started_at_idx on htt.man_hour_entries (person_id, repo_id, started_at) where started_at is not null;

-- 5) work_sessions (per-session intervals; additive/inert today). No updated_at trigger (matches source).
create table if not exists htt.work_sessions (
  id               uuid primary key default gen_random_uuid(),
  company_id       uuid not null references company_os.companies(id) on delete restrict,
  repo_id          uuid not null references htt.repos(id) on delete cascade,
  person_id        uuid references company_os.people(id) on delete set null,
  session_id       text not null,
  tool             text,
  started_at       timestamptz,
  ended_at         timestamptz,
  active_intervals jsonb not null default '[]',
  tokens_total     bigint not null default 0,
  occurred_on      date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create unique index if not exists work_sessions_member_session_uniq on htt.work_sessions (person_id, session_id);
create index if not exists work_sessions_contrib_day_idx on htt.work_sessions (person_id, occurred_on);

-- 6) client_identities (bot/owner excludes; repo-scoped, NULL repo = global exclude)
create table if not exists htt.client_identities (
  id           uuid primary key default gen_random_uuid(),
  repo_id      uuid references htt.repos(id) on delete cascade,
  git_email    text,
  github_login text,
  label        text,
  created_at   timestamptz not null default now()
);
create index if not exists client_identities_email_idx on htt.client_identities (lower(git_email));
create index if not exists client_identities_login_idx on htt.client_identities (lower(github_login));

-- 7) pr_attribution_overrides (append-only correction ledger; one active row per PR)
create table if not exists htt.pr_attribution_overrides (
  id              uuid primary key default gen_random_uuid(),
  pull_request_id uuid not null references htt.pull_requests(id) on delete cascade,
  repo_id         uuid not null references htt.repos(id) on delete cascade,
  kind            text not null check (kind in ('pair_session','manual_span')),
  started_at      timestamptz not null,
  reason          text not null check (length(btrim(reason)) > 0),
  corrected_by    text not null,
  revoked_at      timestamptz,
  revoked_by      text,
  created_at      timestamptz not null default now()
);
create unique index if not exists pr_attribution_overrides_active_uniq on htt.pr_attribution_overrides (pull_request_id) where revoked_at is null;
create index if not exists pr_attribution_overrides_repo_idx on htt.pr_attribution_overrides (repo_id);

-- 8) sync_runs (ingestion audit)
create table if not exists htt.sync_runs (
  id              uuid primary key default gen_random_uuid(),
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  projects_synced integer not null default 0,
  prs_upserted    integer not null default 0,
  unattributed    integer not null default 0,
  errors          jsonb not null default '[]',
  backfill        boolean not null default false
);

-- 9) roi_actuals (Group D)
create table if not exists htt.roi_actuals (
  id           uuid primary key default gen_random_uuid(),
  repo_id      uuid not null references htt.repos(id) on delete cascade,
  recorded_for date not null,
  value        numeric not null,
  note         text,
  status       text not null default 'recorded' check (status in ('recorded','approved','disputed','excluded')),
  created_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (repo_id, recorded_for)
);

-- 10) scenarios (Group D)
create table if not exists htt.scenarios (
  id         uuid primary key default gen_random_uuid(),
  repo_id    uuid not null references htt.repos(id) on delete cascade,
  name       text not null,
  impact     text not null check (impact in ('low','med','high')),
  value_pct  numeric,
  note       text,
  status     text not null default 'active' check (status in ('active','complete','dropped','archived')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists scenarios_repo_idx on htt.scenarios (repo_id, status);

-- 11) project_goals (Group D; append-only, latest seq per repo wins)
create table if not exists htt.project_goals (
  id         uuid primary key default gen_random_uuid(),
  seq        bigint generated always as identity,
  repo_id    uuid not null references htt.repos(id) on delete cascade,
  metric     text not null,
  unit       text not null,
  period     text not null check (period in ('day','week','month','quarter')),
  quantity   numeric check (quantity is null or quantity > 0),
  source     text not null check (source in ('stated','suggested','manual')),
  source_key text not null,
  set_by     text not null,
  state      text,
  created_at timestamptz not null default now()
);
create index if not exists project_goals_latest on htt.project_goals (repo_id, seq desc);

-- 12) goal_events (Group D)
create table if not exists htt.goal_events (
  id          uuid primary key default gen_random_uuid(),
  repo_id     uuid not null references htt.repos(id) on delete cascade,
  state       text,
  object      text not null,
  count       integer not null default 1 check (count > 0),
  occurred_on date not null default ((now() at time zone 'utc')::date),
  recorded_by text not null,
  created_at  timestamptz not null default now()
);
create index if not exists goal_events_repo_time on htt.goal_events (repo_id, occurred_on desc);

-- 13) project_summaries (Group D; AI-written cache keyed by source_key)
create table if not exists htt.project_summaries (
  id           uuid primary key default gen_random_uuid(),
  repo_id      uuid not null references htt.repos(id) on delete cascade,
  kind         text not null check (kind in ('executive','latest_prs')),
  content      text not null,
  as_of        timestamptz,
  source_key   text not null,
  model        text not null,
  generated_at timestamptz not null default now(),
  unique (repo_id, kind)
);

-- 14) survey_invitations (Group D; tokenized NPS links)
create table if not exists htt.survey_invitations (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references company_os.companies(id) on delete restrict,
  repo_id      uuid not null references htt.repos(id) on delete cascade,
  metric_name  text not null default 'clinician_nps',
  prompt       text not null default 'How likely are you to recommend this to a colleague?',
  token        text not null unique,
  recorded_for date not null,
  expires_at   timestamptz not null default (now() + interval '14 days'),
  used_at      timestamptz,
  created_by   text,
  created_at   timestamptz not null default now()
);
create index if not exists survey_invitations_repo_idx on htt.survey_invitations (repo_id);

-- 15) token_allocations (CREDITS: invoice/manual, company grain; current = highest seq per company)
create table if not exists htt.token_allocations (
  id           uuid primary key default gen_random_uuid(),
  seq          bigint generated always as identity,
  company_id   uuid not null references company_os.companies(id) on delete restrict,
  tokens       numeric check (tokens >= 0),
  set_by_email text not null,
  set_at       timestamptz not null default now()
);
create index if not exists token_allocations_company_seq_idx on htt.token_allocations (company_id, seq desc);

-- updated_at triggers (only tables that carry updated_at and had a trigger in the source)
drop trigger if exists repos_set_updated_at on htt.repos;
create trigger repos_set_updated_at before update on htt.repos for each row execute function htt.set_updated_at();
drop trigger if exists pull_requests_set_updated_at on htt.pull_requests;
create trigger pull_requests_set_updated_at before update on htt.pull_requests for each row execute function htt.set_updated_at();
drop trigger if exists token_entries_set_updated_at on htt.token_entries;
create trigger token_entries_set_updated_at before update on htt.token_entries for each row execute function htt.set_updated_at();
drop trigger if exists man_hour_entries_set_updated_at on htt.man_hour_entries;
create trigger man_hour_entries_set_updated_at before update on htt.man_hour_entries for each row execute function htt.set_updated_at();
drop trigger if exists roi_actuals_set_updated_at on htt.roi_actuals;
create trigger roi_actuals_set_updated_at before update on htt.roi_actuals for each row execute function htt.set_updated_at();
drop trigger if exists scenarios_set_updated_at on htt.scenarios;
create trigger scenarios_set_updated_at before update on htt.scenarios for each row execute function htt.set_updated_at();

-- RLS on for every htt table (no user-facing policies; service_role bypasses; app-code gating).
alter table htt.repos                    enable row level security;
alter table htt.pull_requests            enable row level security;
alter table htt.token_entries            enable row level security;
alter table htt.man_hour_entries         enable row level security;
alter table htt.work_sessions            enable row level security;
alter table htt.client_identities        enable row level security;
alter table htt.pr_attribution_overrides enable row level security;
alter table htt.sync_runs                enable row level security;
alter table htt.roi_actuals              enable row level security;
alter table htt.scenarios                enable row level security;
alter table htt.project_goals            enable row level security;
alter table htt.goal_events              enable row level security;
alter table htt.project_summaries        enable row level security;
alter table htt.survey_invitations       enable row level security;
alter table htt.token_allocations        enable row level security;

-- Grants: the app talks to Postgres as service_role; read-replica parity via supabase_read_only_user.
grant usage on schema htt to service_role;
grant usage on schema htt to supabase_read_only_user;
grant select, insert, update, delete on all tables in schema htt to service_role;
grant select on all tables in schema htt to supabase_read_only_user;
grant usage, select on all sequences in schema htt to service_role;
grant execute on function htt.set_updated_at() to service_role;
