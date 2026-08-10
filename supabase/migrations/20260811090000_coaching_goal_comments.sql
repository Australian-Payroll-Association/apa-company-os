-- FAST goal comments (Leadership Coach v2 follow-up).
-- Goals are team-wide transparent; the discussion on them is too. Any team
-- member can comment on any goal (Frequent discussion is the F in FAST).
-- Enforcement stays app-side per the /team pattern: requireTeamMember() +
-- author_team_member_id always the actor.

create table if not exists company_os.coaching_goal_comments (
  id                      uuid primary key default gen_random_uuid(),
  goal_id                 uuid not null references company_os.coaching_goals(id) on delete cascade,
  author_team_member_id   uuid not null references company_os.team_members(id),
  body                    text not null check (char_length(body) between 1 and 2000),
  created_at              timestamptz not null default now()
);

create index if not exists coaching_goal_comments_goal_idx
  on company_os.coaching_goal_comments (goal_id, created_at);

alter table company_os.coaching_goal_comments enable row level security;
grant select, insert on company_os.coaching_goal_comments to service_role;
revoke all on company_os.coaching_goal_comments from chatbot_reader, chatbot_writer;
