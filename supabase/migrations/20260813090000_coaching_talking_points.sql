-- Two-way 1-1 agenda: talking points the coachee raises before a meeting.
--
-- Until now the 1-1 flowed one way: the coach prepped, the member received. A
-- talking point is what the MEMBER wants to cover next time. The coach sees it
-- before the meeting and it feeds the AI prep, so the agenda becomes two-way.
-- Profile-scoped ("for the next 1-1"); marked addressed once it has been
-- covered, which drops it off both pages.
--
-- author_team_member_id — who raised it (the member). A member deletes only
--   what they wrote; either side may mark it addressed. Enforced app-side per
--   the /team pattern (lib/coaching/data.ts), never in SQL.
--
-- SECURITY — company_os convention, identical to the sibling coaching tables:
-- RLS ENABLED with NO policies, only service_role granted, the NL->SQL
-- assistant roles revoked. Coaching data must never transit an assistant.

create table if not exists company_os.coaching_talking_points (
  id                     uuid primary key default gen_random_uuid(),
  coaching_profile_id    uuid not null references company_os.coaching_profiles(id) on delete cascade,
  author_team_member_id  uuid references company_os.team_members(id),
  body                   text not null,
  addressed_at           timestamptz,        -- null = still open, to raise next 1-1
  created_at             timestamptz not null default now()
);

create index if not exists coaching_talking_points_profile_idx
  on company_os.coaching_talking_points (coaching_profile_id, created_at) where addressed_at is null;

alter table company_os.coaching_talking_points enable row level security;

grant select, insert, update, delete on company_os.coaching_talking_points to service_role;

revoke all on company_os.coaching_talking_points from chatbot_reader, chatbot_writer;
