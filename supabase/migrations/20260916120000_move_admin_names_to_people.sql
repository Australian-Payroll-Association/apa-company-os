-- Move admin display names onto company_os.people, and repair the link the
-- admins table was supposed to carry.
--
-- WHY THIS IS NOT COSMETIC
-- All nine admins have a people row and a live grant, and NO NAME ANYWHERE
-- ELSE: people.full_name, display_name, first_name and last_name are null for
-- every one of them, so company_os.admins.display_name is the only copy.
-- Repointing the gate at grants is safe without this, but dropping or
-- hollowing out the admins table afterwards would silently lose nine people's
-- names — the same shape of loss the users.role card warns about with
-- authored_by provenance, where the delete succeeds and takes the record too.
--
-- JOINED ON EMAIL, deliberately. admins.person_id is NULL for all nine rows:
-- addAdmin() has written it since it was added, but these nine predate that,
-- so the column that looks like the link is not the link. A first draft of
-- this migration joined on person_id and silently updated nothing — which is
-- exactly how a no-op migration gets committed and believed.
update company_os.people p
   set display_name = a.display_name,
       updated_at   = now()
  from company_os.admins a
 where lower(a.email) = lower(p.email)
   and a.display_name is not null
   and p.display_name is null;

-- Repair the link itself so the legacy table is consistent for the release it
-- stays around for, and so anything still reading person_id gets an answer.
update company_os.admins a
   set person_id = p.id
  from company_os.people p
 where a.person_id is null
   and lower(a.email) = lower(p.email);

-- Assert the post-condition. The header above records that a first draft
-- joined on person_id and silently updated nothing; this is what turns that
-- from a story into a guard. Names are the only thing the admins table still
-- holds uniquely, so a no-op here is a future data loss, not a cosmetic miss.
do $chk$
declare nameless int; unlinked int;
begin
  select count(*) into nameless
    from company_os.admins a
    join company_os.people p on lower(p.email) = lower(a.email)
   where a.display_name is not null
     and p.display_name is null;
  if nameless <> 0 then
    raise exception '% admin name(s) did not reach company_os.people', nameless;
  end if;

  select count(*) into unlinked from company_os.admins where person_id is null;
  if unlinked <> 0 then
    raise exception '% admins row(s) still have a null person_id', unlinked;
  end if;
end $chk$;
