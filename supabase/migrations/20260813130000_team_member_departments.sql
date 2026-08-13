-- Department belongs to the PERSON, not the job title (Dave, 2026-08-13).
--
-- positions.department_id cannot carry it: a position row is shared by everyone
-- holding that title. "AI Engineer" is one row held by four people sitting on
-- four different clients (Bstore, DOXA, On Target, and one internal), so a
-- department on the position would file all four under the same one.
--
-- The taxonomy is Operations, Product Development, and one department per
-- staffing client, because a staffing client IS a department: the people on it
-- are a team with their own hiring, their own rhythm, and their own manager.
--
-- Backfill lives in scripts/backfill/2026-08-13-team-departments.mjs so the
-- mapping is reviewable as data rather than buried in DDL.

alter table company_os.team_members
  add column if not exists department_id uuid references company_os.departments(id);

create index if not exists team_members_department_idx
  on company_os.team_members (department_id);

-- No new departments. Bstore is a client but NOT a staffing client (Dave,
-- 2026-08-13), so it is not a department, and the people assigned to it take an
-- internal department instead. The five staffing clients (OnTarget, EO, Doxa,
-- Unlock, Wareease) already have rows, which is why the backfill can key off
-- "does a department exist for this client" rather than a hardcoded list.

-- Existing slugs are corrupted: every one is missing its first character
-- ('perations', 'roduct-evelopment', 'nlock', 'lient-elivery', 'n-arget',
-- 'nstitute'), and Wareease still carries 'ualicious' from a former name. Some
-- slug generator sliced [1:] instead of [0:]. Nothing reads these yet, which is
-- why it went unnoticed; fix them before something does.
update company_os.departments
set slug = regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g'),
    updated_at = now()
where slug is distinct from regexp_replace(lower(trim(name)), '[^a-z0-9]+', '-', 'g');
