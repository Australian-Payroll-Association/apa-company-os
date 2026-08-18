-- Marketing consent on people.
--
-- do_not_contact already exists but is a blunt, CRM-wide "never contact this
-- person at all" flag (set on 2 rows). It cannot express the ordinary case:
-- someone who is happy to hear from their account manager but does not want a
-- newsletter. Marketing consent is a separate axis, and BOTH must pass before a
-- marketing email sends.
--
-- never_asked is the honest default. Most of these addresses arrived through a
-- LinkedIn or CRM import and have never been asked anything.
--
-- Backfill deliberately does NOT touch job_seeker: an applicant gave us their
-- address to be considered for a job, not to be marketed to. Same for team
-- members. That leaves prospects and clients, who are the people a newsletter
-- is actually for.
-- Applied via Supabase MCP.

alter table company_os.people
  add column if not exists marketing_consent text not null default 'never_asked',
  add column if not exists marketing_consent_at timestamptz,
  add column if not exists marketing_consent_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'people_marketing_consent_check'
  ) then
    alter table company_os.people
      add constraint people_marketing_consent_check
      check (marketing_consent in ('subscribed', 'unsubscribed', 'never_asked'));
  end if;
end $$;

-- Partial index: the sender only ever scans for subscribed rows.
create index if not exists people_marketing_consent_idx
  on company_os.people (marketing_consent)
  where marketing_consent = 'subscribed';

update company_os.people
set marketing_consent = 'subscribed',
    marketing_consent_at = now(),
    marketing_consent_source = 'backfill_2026_08_18_crm_relationship'
where marketing_consent = 'never_asked'
  and archived_at is null
  and do_not_contact = false
  and is_team_member = false
  and persona in ('prospect', 'client');
