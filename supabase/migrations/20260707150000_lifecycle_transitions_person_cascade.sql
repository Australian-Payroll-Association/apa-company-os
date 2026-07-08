-- GDPR erase fix: lifecycle_transitions.person_id blocked hard-deleting people
-- (NO ACTION), and nearly every lead has at least one transition row. The
-- transitions are the person's own linked history, so erasure removes them.
-- Applied via Supabase Management API 2026-07-07.

begin;

alter table company_os.lifecycle_transitions
  drop constraint lifecycle_transitions_person_id_fkey;

alter table company_os.lifecycle_transitions
  add constraint lifecycle_transitions_person_id_fkey
  foreign key (person_id) references company_os.people(id) on delete cascade;

commit;
