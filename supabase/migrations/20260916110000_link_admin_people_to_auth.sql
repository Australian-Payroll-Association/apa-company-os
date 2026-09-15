-- Link company_os.people rows to their auth account where the link is missing.
--
-- WHY THIS MUST RUN BEFORE THE ADMIN GATE IS REPOINTED
-- Grants resolve through people.auth_user_id: has_app_role() joins app_access
-- to people on that column, and so does the application's equivalent lookup.
-- A person with a live admin grant but a NULL auth_user_id therefore reads as
-- "not an admin" the moment the gate stops matching on email.
--
-- bj@austpayroll.com.au is exactly that: an auth account that signed in on
-- 2026-09-01, a live company_os admin grant, and no link between them. Under
-- the email gate that never mattered. Under the grant gate it is a lockout.
--
-- Scoped deliberately: only rows that are unlinked AND match exactly one auth
-- user by email. Measured before writing — 23 people, 13 unlinked, 1 with a
-- single match, 0 ambiguous — so this updates one row and cannot guess. The
-- other 12 have no auth account at all, which is correct: they are portal and
-- team people who have never signed in to the admin console.
update company_os.people p
   set auth_user_id = u.id
  from auth.users u
 where p.auth_user_id is null
   and lower(u.email) = lower(p.email)
   and (select count(*) from auth.users u2 where lower(u2.email) = lower(p.email)) = 1;

-- Assert the post-condition. This migration exists solely to stop a
-- grant-holder being locked out once the gate keys on auth_user_id, so
-- "it ran" is not the interesting fact — "nobody is left unresolvable" is.
-- A case or whitespace mismatch, or a second auth row appearing, would make
-- the update above a silent no-op and the lockout would happen anyway.
do $chk$
declare unresolved int;
begin
  select count(*) into unresolved
    from company_os.app_access a
    join company_os.people p on p.id = a.person_id
   where a.app = 'company_os'
     and a.role = 'admin'
     and a.revoked_at is null
     and p.auth_user_id is null;

  if unresolved <> 0 then
    raise exception
      '% company_os admin grant(s) point at a person with no auth_user_id - the grant gate would refuse them',
      unresolved;
  end if;
end $chk$;
