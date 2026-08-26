-- NOT YET APPLIED; apply via supabase db query --linked before merge --
-- Human Token Tracker integration, Phase 4: ingestion-time SQL.
--
-- 1) htt versions of the tracker's contributor resolvers, re-pointed to the
--    edge8 identity spine (company_os.people + company_os.person_git_emails).
--    All three return a company_os.people.id (person_id), NOT an auth user id:
--    the htt tables carry person_id / author_person_id, and the tracker's
--    auth.users linkage was dropped in the htt model.
-- 2) Widen htt.token_entries.source with 'effort-log': the ported effort-log
--    ingest (app/api/cron/htt-ingest-effort-logs) writes source='effort-log'
--    rows, which the Phase 0 CHECK did not include.
--
-- Additive only. Idempotent (create or replace / drop-and-recreate constraint).

-- Resolve a git commit email to a person: person_git_emails first (the
-- deliberate mapping, intake or discovered), then the person's primary email.
-- citext makes both comparisons case-insensitive. Not scoped to a company: an
-- Edge8 person counts on any repo. SECURITY DEFINER so the ingestion role can
-- resolve without direct table grants beyond its own.
create or replace function htt.resolve_contributor(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select pge.person_id
       from company_os.person_git_emails pge
      where pge.git_email = p_email::citext
      limit 1),
    (select p.id
       from company_os.people p
      where lower(p.email) = lower(p_email)
      order by p.created_at
      limit 1)
  );
$$;
revoke all on function htt.resolve_contributor(text) from public, anon, authenticated;
grant execute on function htt.resolve_contributor(text) to service_role;

-- PR-author email to person_id. Same lookup as resolve_contributor; kept as a
-- distinct name to mirror the tracker's call sites (resolve_team_member was
-- the PR-sync resolver, resolve_contributor the session resolver).
create or replace function htt.resolve_team_member(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select htt.resolve_contributor(p_email);
$$;
revoke all on function htt.resolve_team_member(text) from public, anon, authenticated;
grant execute on function htt.resolve_team_member(text) to service_role;

-- PR-author GitHub login to person_id via people.github_login (citext, unique
-- where not null). A SIBLING function, not an overload: PostgREST rpc() fails
-- with "could not choose the best candidate function" on ambiguous overloads.
-- order by created_at keeps the answer deterministic.
create or replace function htt.resolve_team_member_by_login(p_github_login text)
returns uuid language sql stable security definer set search_path = '' as $$
  select p.id
  from company_os.people p
  where p.github_login = p_github_login::citext
  order by p.created_at
  limit 1;
$$;
revoke all on function htt.resolve_team_member_by_login(text) from public, anon, authenticated;
grant execute on function htt.resolve_team_member_by_login(text) to service_role;

-- Widen the token_entries source CHECK with 'effort-log' (the self-reported
-- owner-effort ingest path). Matches the tracker's live constraint set plus
-- the effort-log source its persist path writes.
alter table htt.token_entries drop constraint if exists token_entries_source_check;
alter table htt.token_entries add constraint token_entries_source_check
  check (source in ('pr_commit','pr_review','planning','design','research',
                    'manual','session','app','effort-log'));
