-- Edge8 Onboarding Cycle (docs/plans/2026-07-22-onboarding-plans-kanban.md).
-- Additive only. One journey row per new hire drives the manager kanban at
-- /team/onboarding and the daily cron (/api/cron/onboarding-cycle):
-- plan-upload nag -> Day 1 checklist -> Day 8 survey -> 45-day review ->
-- Day 60 promotion -> Day 180 stay interview.

-- 1) Contract start date on the employment record. Admin-editable; the
--    "Extend probation 30 days" review decision pushes it out automatically.
alter table company_os.team_members
  add column if not exists contract_start_date date;

-- 2) One onboarding journey per team member. Milestone markers are stamped by
--    the cron so re-runs are idempotent and a missed day self-heals.
create table if not exists company_os.onboarding_plans (
  id                   uuid primary key default gen_random_uuid(),
  team_member_id       uuid not null unique references company_os.team_members(id) on delete cascade,
  stage                text not null default 'preboarding'
                       check (stage in ('preboarding','day_1','day_8','day_45','day_60','day_180','complete')),
  -- the manager-uploaded plan document (private onboarding-plans bucket)
  plan_path            text,
  plan_uploaded_by     uuid references company_os.team_members(id),
  plan_uploaded_at     timestamptz,
  -- milestone markers
  day8_survey_sent_at  timestamptz,
  day8_response_id     uuid,
  day45_email_sent_at  timestamptz,
  day45_response_id    uuid,
  decision             text check (decision in ('offer_full_time','extend_probation_30','terminate')),
  decision_at          timestamptz,
  decision_by          uuid references company_os.team_members(id),
  day60_promoted_at    timestamptz,
  day180_email_sent_at timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

alter table company_os.onboarding_plans enable row level security;
-- company_os convention: RLS on with no policies; only service_role (explicitly
-- granted) can touch the table, and the app scopes every read itself.
grant select, insert, update, delete on company_os.onboarding_plans to service_role;

-- onboarding_tasks pre-exists (empty scaffold) — make sure the app can use it.
grant select, insert, update, delete on company_os.onboarding_tasks to service_role;

-- 3) Private bucket for the uploaded plan documents.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'onboarding-plans', 'onboarding-plans', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
    'image/jpeg','image/png','image/webp'
  ]
)
on conflict (id) do nothing;

-- 4) Seed the two cycle surveys on the existing engine (fixed ids, idempotent).

-- Day 8 feedback: three 1-5 Likert questions, sent to the new hire.
insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values (
  'd8f00000-0000-4000-8000-000000000001',
  'onboarding-day-8-feedback',
  'Day 8 Onboarding Feedback',
  'A quick pulse at the end of your first week.',
  'published',
  false,
  'onboarding_day8',
  'One week in — three quick questions so we can fix anything that is not working. Takes about a minute.',
  'Thank you! Your manager and the talent team read every response.'
)
on conflict (id) do nothing;

insert into company_os.survey_fields (id, survey_id, position, type, label, required, config)
values
  ('d8f00000-0000-4000-8000-000000000002', 'd8f00000-0000-4000-8000-000000000001', 0, 'rating',
   'I have the information I need to do my job well.', true,
   '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'::jsonb),
  ('d8f00000-0000-4000-8000-000000000003', 'd8f00000-0000-4000-8000-000000000001', 1, 'rating',
   'I feel good about the company culture', true,
   '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'::jsonb),
  ('d8f00000-0000-4000-8000-000000000004', 'd8f00000-0000-4000-8000-000000000001', 2, 'rating',
   'I understand the company policies', true,
   '{"min":1,"max":5,"min_label":"Strongly disagree","max_label":"Strongly agree"}'::jsonb)
on conflict (id) do nothing;

-- 45-day probation review (stub, one question). The manager opens it from the
-- cron email with ?subject=<team_member_id>; the post-submit processor records
-- the decision on the journey and applies the extension date math.
insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values (
  'd45f0000-0000-4000-8000-000000000001',
  'probation-45-review',
  '45 Day Probation Review',
  'The probation decision, due 15 days before probation ends.',
  'published',
  false,
  'probation_review',
  'Decide the next step for your report. This records the official probation decision — an extension moves the probation end and contract start dates automatically.',
  'Recorded. The system takes it from here.'
)
on conflict (id) do nothing;

insert into company_os.survey_fields (id, survey_id, position, type, label, help_text, required, config)
values (
  'd45f0000-0000-4000-8000-000000000002',
  'd45f0000-0000-4000-8000-000000000001',
  0, 'single_choice', 'Next step',
  'Offer full time: they are automatically promoted when probation ends. Extend: probation and contract start move out 30 days. Terminate: the talent director is notified; nothing is automated.',
  true,
  '{"choices":["Offer full time contract","Extend probation 30 days","Terminate employee"]}'::jsonb
)
on conflict (id) do nothing;
