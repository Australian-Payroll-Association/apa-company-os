-- Link an admin's login to a team identity so /team/* (Timesheet etc.) works.
--
-- requireTeamMember() resolves identity as: auth.users.id -> people.auth_user_id
-- -> an active team_members row. An admin missing either link is bounced from
-- every /team page back to /admin. This script creates both links.
--
-- Run in the Supabase SQL editor (service role). Idempotent: safe to re-run.
-- Change the email on the first line, nothing else.

-- Step 1: people.auth_user_id is unique, so detach this login from any OTHER
-- people row (e.g. a duplicate contact under a different email) first.
update company_os.people p
set auth_user_id = null, updated_at = now()
where p.auth_user_id = (select id from auth.users where lower(email) = 'quan@edge8.ai')
  and lower(p.email::text) <> 'quan@edge8.ai';

-- Step 2: link the login and ensure an active employment record.
with params as (
  select 'quan@edge8.ai'::text as email
),
auth_user as (
  select u.id as auth_user_id, p.email
  from params p
  join auth.users u on lower(u.email) = lower(p.email)
),
-- Attach the login to an existing people row with that email, or create one.
linked_person as (
  insert into company_os.people (email, auth_user_id, is_team_member, persona, source)
  select email, auth_user_id, true, 'employee', 'link-team-account.sql'
  from auth_user
  on conflict (email) do update
    set auth_user_id = excluded.auth_user_id,
        is_team_member = true,
        updated_at = now()
  returning id as person_id
),
-- Ensure an active employment record. Reactivate a non-portal row if one
-- exists (candidate/terminated/alumni), otherwise insert a fresh active one.
existing_membership as (
  select tm.id
  from linked_person lp
  join company_os.team_members tm on tm.person_id = lp.person_id
  order by (tm.status = 'active') desc, tm.created_at desc
  limit 1
),
reactivated as (
  update company_os.team_members tm
  set status = 'active', end_date = null, termination_reason = null, updated_at = now()
  from existing_membership em
  where tm.id = em.id
  returning tm.id
),
inserted as (
  insert into company_os.team_members (person_id, status, employment_type, start_date)
  select lp.person_id, 'active', 'full_time', current_date
  from linked_person lp
  where not exists (select 1 from existing_membership)
  returning id
)
select
  (select person_id from linked_person) as person_id,
  coalesce((select id from reactivated), (select id from inserted)) as team_member_id;

-- Verify: both rows must come back, membership status must be portal-eligible
-- ('active', 'on_leave', 'notice' or 'pre_start').
-- select p.id, p.email, p.auth_user_id, tm.id as team_member_id, tm.status
-- from company_os.people p
-- left join company_os.team_members tm on tm.person_id = p.id
-- where lower(p.email) = 'quan@edge8.ai';
