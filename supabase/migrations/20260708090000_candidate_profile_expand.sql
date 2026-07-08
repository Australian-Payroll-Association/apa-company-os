-- Candidate-profile satellite, Phase A (expand — strictly additive). Applied
-- via Supabase MCP 2026-07-08 (migration candidate_profile_expand). Recorded
-- here for the repo history.
-- Recruiting-role state moves off people (headline, current_title,
-- portfolio_url, do_not_hire), mirroring the lead satellite pattern.
-- current_company_id is dropped rather than moved: person_companies already
-- models employer links. Folds in the retired candidates table's only
-- populated field (pool_status: active/passive/placed/do_not_pursue).

begin;

create table company_os.candidate_profile (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references company_os.people(id) on delete cascade,
  headline      text,
  current_title text,
  portfolio_url text,
  do_not_hire   boolean not null default false,
  pool_status   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint candidate_profile_person_unique unique (person_id)
);
alter table company_os.candidate_profile enable row level security;
grant select, insert, update, delete on company_os.candidate_profile to service_role;

create table company_os_archive.people_ats_fields as
select id, headline, current_title, current_company_id, portfolio_url, do_not_hire
from company_os.people
where do_not_hire or headline is not null or current_title is not null
   or portfolio_url is not null or current_company_id is not null;

insert into company_os.candidate_profile
  (person_id, headline, current_title, portfolio_url, do_not_hire, pool_status, created_at)
select p.id,
       coalesce(p.headline, c.headline),
       coalesce(p.current_title, c.current_title),
       coalesce(p.portfolio_url, c.portfolio_url),
       (p.do_not_hire or coalesce(c.pool_status = 'do_not_pursue', false)),
       c.pool_status,
       coalesce(c.created_at, now())
from company_os.people p
left join company_os.candidates c on c.person_id = p.id
where p.do_not_hire
   or p.headline is not null or p.current_title is not null or p.portfolio_url is not null
   or c.id is not null;

commit;
