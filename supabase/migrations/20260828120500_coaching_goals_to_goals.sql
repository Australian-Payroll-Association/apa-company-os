-- Make FAST goals the goals table, and drop the vestigial free-text FAST goal.
--
-- Two goal tables existed: the live company_os.coaching_goals (quarterly FAST
-- goals laddered to the Eight Edges tree, with the member-authored measure
-- columns) and a legacy standalone company_os.goals (old HR hierarchy, 0 rows,
-- never queried by the app). We retire the legacy table and promote the real
-- one to the goals name.
--
-- coaching_profiles.fast_goal / fast_goal_status were a free-text stand-in from
-- before coaching_goals existed. They are never rendered (selected once in
-- PROFILE_SELECT, never read as a property), and every profile that still holds
-- text already has its FAST goals as real rows. The FAST-goal relationship is
-- now the FK goals.coaching_profile_id -> coaching_profiles.id, so the free-text
-- columns are dropped.
--
-- DEPLOY COUPLING: the coaching app queries coaching_goals at runtime
-- (lib/coaching/*, lib/company/goals.ts, app/admin/.../company) and selects the
-- fast_goal columns in PROFILE_SELECT. Apply this together with the code that
-- reads company_os.goals and no longer selects fast_goal, or coaching pages
-- error in the gap. The legacy-goals drop is independent and safe on its own.

-- 1. Retire the legacy HR goals table (0 rows, no readers) to free the name.
drop table if exists company_os.goals;

-- 2. Promote the FAST goals table. Indexes, the coaching_profile_id FK, the
--    one-ladder check, and the coaching_goal_comments -> goals(id) FK all follow
--    the rename automatically.
alter table if exists company_os.coaching_goals rename to goals;

-- 3. Drop the vestigial free-text FAST goal from the profile.
alter table company_os.coaching_profiles drop column if exists fast_goal;
alter table company_os.coaching_profiles drop column if exists fast_goal_status;
