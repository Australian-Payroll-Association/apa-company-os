-- Team Coaching Cycle (docs/plans/2026-07-25-team-coaching-cycle.md).
-- The biweekly 1-1 system, rebuilt from Lark into company_os. Six tables:
-- a coaching profile per coached person (the roster), one row per 1-1 meeting,
-- the commitment ledger, mid-cycle check-in records, monthly AI trend reports,
-- and the context documents that feed the AI (foundation docs, company context).
--
-- VISIBILITY MODEL (two-tier, enforced in lib/coaching/, not in SQL):
--   coach tier  — everything, scoped coach_id = actor.teamMemberId
--   member tier — own FAST goal/OKRs, commitments, PUBLISHED shared recaps,
--                 check-ins. Never: prep, transcript, private summary, private
--                 profile, trends, context docs.
-- The coaching relationship is EXPLICIT (coach_id), independent of the org
-- chart's manager_id: dotted lines are first-class (e.g. My reports to Mai but
-- is coached by Dave).
--
-- SECURITY — company_os convention: RLS ENABLED with NO policies; only
-- service_role is granted. The NL->SQL assistant roles are explicitly revoked
-- (they auto-inherit via schema default privileges): private coaching notes
-- must never transit an assistant, same treatment as people_sensitive.

-- ---- the roster: one row per coached person --------------------------------

create table if not exists company_os.coaching_profiles (
  id                        uuid primary key default gen_random_uuid(),
  team_member_id            uuid not null unique references company_os.team_members(id) on delete cascade,
  -- who coaches this person. Defaults to their manager on creation but is
  -- editable — dotted-line coaching is the point of this column.
  coach_id                  uuid not null references company_os.team_members(id),
  fast_goal                 text,
  fast_goal_status          text not null default 'not_set'
                            check (fast_goal_status in ('not_set','draft','set')),
  okrs_markdown             text,           -- member-visible
  private_profile_markdown  text,           -- coaching reads ("how they're wired"), COACH-ONLY
  cadence_days              int not null default 14 check (cadence_days between 7 and 90),
  next_one_on_one_on        date,
  active                    boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists coaching_profiles_coach_idx
  on company_os.coaching_profiles (coach_id) where active;

-- ---- one row per 1-1 meeting ------------------------------------------------

create table if not exists company_os.coaching_one_on_ones (
  id                       uuid primary key default gen_random_uuid(),
  coaching_profile_id      uuid not null references company_os.coaching_profiles(id) on delete cascade,
  held_on                  date not null,
  status                   text not null default 'scheduled'
                           check (status in ('scheduled','held','skipped')),
  prep_markdown            text,            -- COACH-ONLY
  prep_generated_at        timestamptz,
  transcript               text,            -- raw paste, COACH-ONLY
  summary_markdown         text,            -- private tier incl. emotional notes, COACH-ONLY
  shared_summary_markdown  text,            -- member tier — visible ONLY once published
  -- two-tier publish gate: the AI writes the shared recap as a draft; the
  -- member sees it only after the coach saves/publishes it.
  shared_published_at      timestamptz,
  ai_model                 text,
  ai_error                 text,
  -- soft delete for a mistaken log, company_os convention
  archived_at              timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index if not exists coaching_one_on_ones_profile_idx
  on company_os.coaching_one_on_ones (coaching_profile_id, held_on desc) where archived_at is null;

-- ---- the commitment ledger (they are commitments, never tasks) --------------

create table if not exists company_os.coaching_commitments (
  id                   uuid primary key default gen_random_uuid(),
  coaching_profile_id  uuid not null references company_os.coaching_profiles(id) on delete cascade,
  one_on_one_id        uuid references company_os.coaching_one_on_ones(id) on delete set null,
  title                text not null,
  owner                text not null default 'member' check (owner in ('coach','member')),
  due_on               date,
  status               text not null default 'open'
                       check (status in ('open','on_track','needs_attention','completed','dropped','blocked')),
  status_note          text,            -- latest commentary (member or coach)
  status_updated_by    uuid references company_os.team_members(id),
  status_updated_at    timestamptz,
  closed_at            timestamptz,     -- stamped on completed/dropped
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists coaching_commitments_profile_idx
  on company_os.coaching_commitments (coaching_profile_id, status);

-- ---- mid-cycle check-ins ----------------------------------------------------

create table if not exists company_os.coaching_checkins (
  id                   uuid primary key default gen_random_uuid(),
  coaching_profile_id  uuid not null references company_os.coaching_profiles(id) on delete cascade,
  sent_at              timestamptz not null default now(),
  message_markdown     text not null,   -- the nudge content, member-visible
  -- stamped the first time the member updates any commitment after the send
  responded_at         timestamptz,
  created_at           timestamptz not null default now()
);

create index if not exists coaching_checkins_profile_idx
  on company_os.coaching_checkins (coaching_profile_id, sent_at desc);

-- ---- monthly AI trend reports (COACH-ONLY) ----------------------------------

create table if not exists company_os.coaching_trends (
  id                   uuid primary key default gen_random_uuid(),
  coaching_profile_id  uuid not null references company_os.coaching_profiles(id) on delete cascade,
  period               text not null check (period ~ '^\d{4}-\d{2}$'),
  report_markdown      text,
  ai_model             text,
  ai_error             text,
  created_at           timestamptz not null default now(),
  unique (coaching_profile_id, period)
);

-- ---- the docs that feed the AI (COACH-ONLY) ---------------------------------
-- Foundation documents (leadership brand, coaching profile, EQ guide,
-- communication style, operating system), company context, and company OKRs.
-- coach_id null = company-wide context every coach's runs include.

create table if not exists company_os.coaching_context (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid references company_os.team_members(id),
  kind        text not null check (kind in ('foundation','company','okrs')),
  title       text not null,
  markdown    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists coaching_context_coach_idx
  on company_os.coaching_context (coach_id, kind);

-- ---- security ---------------------------------------------------------------
-- RLS on with no policies; only service_role can touch these tables and the
-- app scopes every read/write itself (lib/coaching/data.ts). No delete grants:
-- one_on_ones archives, commitments drop via status.

alter table company_os.coaching_profiles     enable row level security;
alter table company_os.coaching_one_on_ones           enable row level security;
alter table company_os.coaching_commitments  enable row level security;
alter table company_os.coaching_checkins     enable row level security;
alter table company_os.coaching_trends       enable row level security;
alter table company_os.coaching_context      enable row level security;

grant select, insert, update on company_os.coaching_profiles    to service_role;
grant select, insert, update on company_os.coaching_one_on_ones          to service_role;
grant select, insert, update on company_os.coaching_commitments to service_role;
grant select, insert, update on company_os.coaching_checkins    to service_role;
grant select, insert, update on company_os.coaching_trends      to service_role;
grant select, insert, update on company_os.coaching_context     to service_role;

-- Private coaching data must never be readable through the assistants. The
-- admin assistant's SQL roles auto-inherit via company_os default privileges,
-- so revoke explicitly; team_chatbot_reader is allow-list based and already
-- denied by omission.
revoke all on company_os.coaching_profiles    from chatbot_reader, chatbot_writer;
revoke all on company_os.coaching_one_on_ones          from chatbot_reader, chatbot_writer;
revoke all on company_os.coaching_commitments from chatbot_reader, chatbot_writer;
revoke all on company_os.coaching_checkins    from chatbot_reader, chatbot_writer;
revoke all on company_os.coaching_trends      from chatbot_reader, chatbot_writer;
revoke all on company_os.coaching_context     from chatbot_reader, chatbot_writer;
