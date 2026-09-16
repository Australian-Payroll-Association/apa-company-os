-- Module video health — the state behind the `video_unavailable` nightly rule.
--
-- WHY THIS EXISTS
--
-- On 2026-09-15 five published modules were found playing Synthesia's "Sorry!
-- We couldn't find the video you're looking for". The videos had been deleted
-- on Synthesia's side; the module rows were correct and untouched, and a diff
-- of all 200 rows across the pre- and post-cutover databases found zero
-- differences. So the migration did not cause it, and nothing in the product
-- could have noticed it either: there is no surface anywhere that compares
-- what `modules.external_video_id` points at with what Synthesia still holds.
-- The only detector was a learner opening the lesson, and between 11 and 17
-- learner plans referenced each of the five.
--
-- Probed live on 2026-09-16 with APA's key, all 200 ids: 195 returned 200 and
-- 5 returned 404. The five are fixed (three repointed at a surviving re-render
-- of the same lesson, two retired and taken out of plans). These two columns
-- are what stops the next one going unnoticed.
--
-- WHY TWO COLUMNS AND NOT A TABLE
--
-- This is one fact per module with no history worth keeping — "when did we
-- last ask Synthesia about this, and has it been missing since". A row per
-- probe would be 161 rows a night forever to answer a question that only ever
-- concerns the latest answer.
--
-- WHY `video_checked_at` IS SEPARATE FROM `video_missing_since`
--
-- They answer different questions and a single nullable timestamp cannot carry
-- both. `video_checked_at` orders the rolling batch: the nightly pass probes
-- the least-recently-checked modules, so the catalogue sweeps itself without
-- anyone maintaining a cursor. `video_missing_since` is the verdict, and it has
-- to persist across nights — a module found dead on Monday must still be in
-- Thursday's alert even though Thursday's batch did not probe it.
--
-- A probe that fails for OUR reasons (401, 429, a network error) deliberately
-- leaves both columns alone. That keeps the module at the front of the queue
-- for tomorrow, and it means an expired API key can never mark the whole
-- catalogue missing — which would be a far worse failure than silence.

alter table payroll_iq.modules
  add column if not exists video_checked_at timestamptz,
  add column if not exists video_missing_since timestamptz;

comment on column payroll_iq.modules.video_checked_at is
  'When the nightly video-health pass last got a DEFINITIVE answer from Synthesia about this module''s video (200 or 404). Null = never checked, which sorts first so new modules are probed soonest. A rate-limited or errored probe does not touch this, so the module stays at the front of the queue.';

comment on column payroll_iq.modules.video_missing_since is
  'When this module''s Synthesia video first returned 404, and still is. Cleared the moment a probe returns 200. Persists across nights because the pass only probes a rolling batch, so a module found missing on Monday must still be reported on Thursday.';

-- Orders the rolling batch. `nulls first` is the point of the index, not a
-- detail: a module that has never been checked is the one most worth checking.
create index if not exists modules_video_checked_at_idx
  on payroll_iq.modules (video_checked_at nulls first)
  where status = 'published';

-- Finding the currently-broken set is the alert's own query, and it runs every
-- night against a column that is null for ~99% of rows.
create index if not exists modules_video_missing_since_idx
  on payroll_iq.modules (video_missing_since)
  where video_missing_since is not null;

-- The rule row. `notification_events.rule_key` is a foreign key to this table,
-- so the evaluator cannot raise anything until this exists.
--
-- repeat_after_days = 7: a dead video is not fixed in a day (it needs
-- re-recording or repointing, which is a content decision), so nightly
-- repetition would train admins to skim past the panel — the exact failure the
-- suppression window exists to prevent. A week is long enough to be worth
-- reading and short enough that it cannot be forgotten.
--
-- threshold_days is null because there is no threshold to cross. The video is
-- either there or it is not; waiting N days before mentioning it would only
-- mean N more days of learners hitting the dead player.
insert into payroll_iq.notification_rules
  (key, enabled, threshold_days, threshold_pct, repeat_after_days, title, description)
values (
  'video_unavailable',
  true,
  null,
  null,
  7,
  'Module video unavailable',
  'A published module points at a Synthesia video that no longer exists. Learners opening it see Synthesia''s "video not found" page instead of the lesson. Repoint the module at a surviving render, or retire it and take it out of plans.'
)
on conflict (key) do nothing;
