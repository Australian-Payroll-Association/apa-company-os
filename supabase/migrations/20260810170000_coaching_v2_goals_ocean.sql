-- Leadership Coach v2 — schema additions (docs/plans/2026-08-10-leadership-coach-dev-plan.md, PR 2).
-- Three new tables + columns on the v1 coaching tables:
--   coaching_goals          quarterly FAST goals, 1+ per person, TEAM-WIDE readable,
--                           optionally laddered to the Eight Edges tree
--   coaching_priorities     standing 1-1 focus items (P1, P2…), coach + member
--   coaching_ocean_profiles structured OCEAN, coach-authored, member-readable once published
--   coaching_profiles       + retention_root (coach-only embeddedness read)
--   coaching_one_on_ones    + mode split (C/M/D pcts, coach-only) + Lark Minutes fields
--
-- VISIBILITY (enforced in lib/coaching/, not SQL — same as v1):
--   goals: any team member may read (Transparent is the T in FAST); coach writes
--   priorities: coach RW, member R
--   ocean: coach RW, member R of own row when published = true
--   retention_root, mode split: coach only
--
-- SECURITY — company_os convention: RLS on with no policies, service_role only,
-- assistant roles revoked (same treatment as the v1 coaching tables).

-- ---- quarterly FAST goals ---------------------------------------------------

create table if not exists company_os.coaching_goals (
  id                   uuid primary key default gen_random_uuid(),
  coaching_profile_id  uuid not null references company_os.coaching_profiles(id) on delete cascade,
  title                text not null,
  description_markdown text,
  status               text not null default 'draft'
                       check (status in ('draft','active','achieved','dropped')),
  quarter_label        text,  -- e.g. '2026-Q3'
  -- Optional ladder into the Eight Edges tree, at whichever altitude fits.
  -- At most one of the three is set.
  objective_id         uuid references company_os.objectives(id)  on delete set null,
  key_result_id        uuid references company_os.key_results(id) on delete set null,
  metric_id            uuid references company_os.metrics(id)     on delete set null,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint coaching_goals_one_ladder check (
    (objective_id is not null)::int + (key_result_id is not null)::int
      + (metric_id is not null)::int <= 1
  )
);

create index if not exists coaching_goals_profile_idx
  on company_os.coaching_goals (coaching_profile_id, status);

-- ---- standing 1-1 priorities ------------------------------------------------

create table if not exists company_os.coaching_priorities (
  id                   uuid primary key default gen_random_uuid(),
  coaching_profile_id  uuid not null references company_os.coaching_profiles(id) on delete cascade,
  title                text not null,
  detail_markdown      text,
  status               text not null default 'active'
                       check (status in ('active','retired')),
  objective_id         uuid references company_os.objectives(id)  on delete set null,
  key_result_id        uuid references company_os.key_results(id) on delete set null,
  metric_id            uuid references company_os.metrics(id)     on delete set null,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint coaching_priorities_one_ladder check (
    (objective_id is not null)::int + (key_result_id is not null)::int
      + (metric_id is not null)::int <= 1
  )
);

create index if not exists coaching_priorities_profile_idx
  on company_os.coaching_priorities (coaching_profile_id, status, sort_order);

-- ---- structured OCEAN profile ----------------------------------------------
-- Coach-authored. The member sees their own row only when published = true;
-- guidance_markdown is written in second person (growth guidance, not manager
-- notes). One row per coached person.

create table if not exists company_os.coaching_ocean_profiles (
  id                          uuid primary key default gen_random_uuid(),
  coaching_profile_id         uuid not null unique
                              references company_os.coaching_profiles(id) on delete cascade,
  openness_rating             text, openness_evidence             text,
  conscientiousness_rating    text, conscientiousness_evidence    text,
  extraversion_rating         text, extraversion_evidence         text,
  agreeableness_rating        text, agreeableness_evidence        text,
  neuroticism_rating          text, neuroticism_evidence          text,
  snapshot_markdown           text,
  guidance_markdown           text,
  published                   boolean not null default false,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- ---- v1 table additions -----------------------------------------------------

-- Embeddedness read (Holtom): which root is thinnest. 'watching' = no read yet.
alter table company_os.coaching_profiles
  add column if not exists retention_root text
  check (retention_root in ('belonging','links','sacrifice','watching'));

-- Coach/Mentor/Direct split per 1-1 (target 80/15/5). All three or none; sums to 100.
alter table company_os.coaching_one_on_ones
  add column if not exists mode_coach_pct  int,
  add column if not exists mode_mentor_pct int,
  add column if not exists mode_direct_pct int,
  add column if not exists minutes_token     text,  -- matched Lark Minutes id
  add column if not exists transcript_source text
    check (transcript_source in ('minutes_auto','minutes_link','manual'));

alter table company_os.coaching_one_on_ones
  drop constraint if exists coaching_one_on_ones_mode_split;
alter table company_os.coaching_one_on_ones
  add constraint coaching_one_on_ones_mode_split check (
    ((mode_coach_pct is null) = (mode_mentor_pct is null))
    and ((mode_mentor_pct is null) = (mode_direct_pct is null))
    and (mode_coach_pct is null
         or (mode_coach_pct between 0 and 100
             and mode_mentor_pct between 0 and 100
             and mode_direct_pct between 0 and 100
             and mode_coach_pct + mode_mentor_pct + mode_direct_pct = 100))
  );

-- ---- security ---------------------------------------------------------------

alter table company_os.coaching_goals          enable row level security;
alter table company_os.coaching_priorities    enable row level security;
alter table company_os.coaching_ocean_profiles enable row level security;

grant select, insert, update on company_os.coaching_goals          to service_role;
grant select, insert, update on company_os.coaching_priorities     to service_role;
grant select, insert, update on company_os.coaching_ocean_profiles to service_role;

revoke all on company_os.coaching_goals          from chatbot_reader, chatbot_writer;
revoke all on company_os.coaching_priorities     from chatbot_reader, chatbot_writer;
revoke all on company_os.coaching_ocean_profiles from chatbot_reader, chatbot_writer;

-- ---- data moves -------------------------------------------------------------

-- 1. Existing single fast_goal values become the first coaching_goals row.
--    (fast_goal columns stay until their last reader is gone; dropped in a
--    follow-up migration per the dev plan.)
insert into company_os.coaching_goals
  (coaching_profile_id, title, status, quarter_label)
select cp.id, cp.fast_goal,
       case cp.fast_goal_status when 'set' then 'active' else 'draft' end,
       '2026-Q3'
from company_os.coaching_profiles cp
where cp.fast_goal is not null
  and not exists (
    select 1 from company_os.coaching_goals g
    where g.coaching_profile_id = cp.id and g.title = cp.fast_goal
  );

-- 2. Ginny is a contractor now: no 1-1s, history retained.
update company_os.coaching_profiles cp
set active = false
from company_os.team_members tm
join company_os.people p on p.id = tm.person_id
where tm.id = cp.team_member_id and p.email = 'ginny.vo@edge8.ai';

-- 3. Retention roots from the Lark dashboard (2026-07-01 state).
update company_os.coaching_profiles cp
set retention_root = seed.root
from (values
  ('mai@edge8.ai',       'belonging'),
  ('khoa.doan@edge8.ai', 'links'),
  ('quan@edge8.ai',      'watching'),
  ('my.pham@edge8.ai',   'watching')
) as seed(email, root)
join company_os.people p on p.email = seed.email
join company_os.team_members tm on tm.person_id = p.id
where cp.team_member_id = tm.id and cp.retention_root is null;
