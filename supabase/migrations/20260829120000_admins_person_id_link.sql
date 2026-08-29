-- Settings -> Admins now adds console users from the active-employee picker
-- instead of a free-text email, and links each admin row to the employee
-- (company_os.people) record it was created for.
--
-- Nullable + ON DELETE SET NULL: env-allowlist admins and the owner have no
-- people row, and archiving a person must not silently cascade away admin
-- access. Backfill matches existing admin emails to people.

alter table company_os.admins
  add column if not exists person_id uuid references company_os.people(id) on delete set null;

comment on column company_os.admins.person_id is
  'The employee (company_os.people) this admin is. Set when added from the active-employee picker in Settings -> Admins. Null for env-allowlist / owner admins with no people row.';

create index if not exists admins_person_id_idx on company_os.admins(person_id);

update company_os.admins a
  set person_id = p.id
  from company_os.people p
  where a.person_id is null
    and lower(a.email) = lower(p.email);
