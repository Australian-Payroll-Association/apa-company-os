-- Performance Reviews (docs/plans/2026-08-12-performance-reviews.md).
-- Extends the pre-existing (empty) company_os.performance_reviews table into
-- the system of record for the three review moments: probation (6 weeks after
-- start), mid-year check-in (5 months from contract date), renewal (1 month
-- before contract expiration). One row per subject per cycle per rater
-- (self or manager). The survey engine captures; this table is the record.
--
-- Also adds career track and level to team_members: the review UI draws the
-- AI-craft expectation line from them, the form never asks.
--
-- SECURITY — company_os convention: RLS enabled with no policies; only
-- service_role reads/writes. The NL->SQL assistant roles are explicitly
-- revoked (they auto-inherit via schema default privileges): reviews are
-- sensitive, same treatment as people_sensitive and coaching. The
-- team_chatbot_reader role is allow-list based and has never been granted
-- this table.

-- ---- performance_reviews: one row per subject x cycle x rater --------------

alter table company_os.performance_reviews
  -- who is speaking: the subject about themselves, or their manager-of-record
  add column if not exists rater_kind text not null default 'manager'
    check (rater_kind in ('self', 'manager')),
  -- the eleven 1-5 ratings, keyed by dimension slug. Six behaviors:
  --   role_understanding, work_quality, collaboration, communication,
  --   problem_solving, learning_innovation
  -- Five AI craft (the AI Officer curriculum skills):
  --   ai_planning, workflow_design, organizing_information,
  --   creating_instructions, ai_building
  -- Legacy imports may carry a partial set plus innovation_legacy (the old
  -- form's seventh column).
  add column if not exists ratings jsonb not null default '{}'::jsonb,
  -- the three free-text fields, verbatim from the original Performance Pulse
  add column if not exists achievements text,
  add column if not exists improvements text,
  add column if not exists comments text,
  -- the recorded decision. Required to finalize a manager review; which
  -- values apply depends on review_type:
  --   probation: continue_to_contract | extend_probation | discontinue
  --   renewal:   renew | renew_with_changes | do_not_renew
  --   legacy imports may carry promotion
  add column if not exists decision text
    check (decision is null or decision in (
      'continue_to_contract', 'extend_probation', 'discontinue',
      'renew', 'renew_with_changes', 'do_not_renew', 'promotion')),
  -- mid-year keeper question: "would you fight to keep them?" true = high
  -- performer this cycle. Manager rows only; null elsewhere.
  add column if not exists keeper boolean,
  -- where the row came from: the portal flow or the historical Lark import
  add column if not exists source text not null default 'portal'
    check (source in ('portal', 'lark_import')),
  -- import provenance and snapshots (partner, department, role at the time)
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- review_type gains the three scheduled moments; 'annual' and blank-mapped
-- 'adhoc' cover the historical rows. The table is empty pre-import, so the
-- constraint is safe to add.
alter table company_os.performance_reviews
  drop constraint if exists performance_reviews_review_type_check;
alter table company_os.performance_reviews
  add constraint performance_reviews_review_type_check
  check (review_type in ('probation', 'midyear', 'renewal', 'adhoc', 'annual'));

alter table company_os.performance_reviews
  drop constraint if exists performance_reviews_status_check;
alter table company_os.performance_reviews
  add constraint performance_reviews_status_check
  check (status in ('open', 'draft', 'submitted', 'finalized', 'acknowledged'));

-- One row per subject x cycle x rater for portal-created rows. Legacy imports
-- are exempt: the old flat form allowed several manager reviews of the same
-- person in one period (e.g. two managers, or a redo days later).
create unique index if not exists performance_reviews_cycle_rater_uniq
  on company_os.performance_reviews (team_member_id, cycle_label, rater_kind)
  where source = 'portal' and cycle_label is not null;

create index if not exists performance_reviews_member_idx
  on company_os.performance_reviews (team_member_id, submitted_at);

-- ---- team_members: career track and level ----------------------------------

alter table company_os.team_members
  add column if not exists career_track text
    check (career_track is null or career_track in ('ic', 'manager')),
  add column if not exists career_level text
    check (career_level is null or career_level in
      ('junior', 'collaborator', 'senior', 'principal'));

comment on column company_os.team_members.career_track is
  'ic or manager. Same four levels on both tracks; reviews draw the AI-craft expectation line from track + level.';
comment on column company_os.team_members.career_level is
  'junior | collaborator | senior | principal. Expected AI-craft rating: 2 / 3 / 4 / 4-5.';

-- ---- security ---------------------------------------------------------------

alter table company_os.performance_reviews enable row level security;
grant select, insert, update, delete on company_os.performance_reviews to service_role;
revoke all on company_os.performance_reviews from chatbot_reader, chatbot_writer;
