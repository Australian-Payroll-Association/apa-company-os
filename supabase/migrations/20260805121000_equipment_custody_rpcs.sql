-- 20260805121000_equipment_custody_rpcs.sql
--
-- Phase 2 of the equipment register
-- (docs/plans/2026-08-05-equipment-tracking.md).
--
-- A handover touches three things: close the outgoing custody period, open the
-- incoming one, and move equipment.current_holder_id + status. supabase-js
-- can't wrap those in a transaction, and a partial failure is exactly the
-- corruption this feature exists to prevent (an item with no holder, or a
-- holder with no period). So both custody changes are single RPCs.
--
-- assign_equipment is idempotent-ish by design: assigning to whoever already
-- holds it is a no-op rather than an error, so a double-click can't open a
-- second period.

create or replace function company_os.assign_equipment(
  p_equipment_id uuid,
  p_person_id uuid,
  p_assigned_at date default current_date,
  p_condition_out text default null,
  p_note text default null,
  p_actor text default null
)
returns uuid
language plpgsql
volatile
set search_path = company_os, extensions, pg_catalog
as $$
declare
  v_open_id uuid;
  v_open_person uuid;
  v_open_start date;
  v_new_id uuid;
begin
  select id, person_id, assigned_at
    into v_open_id, v_open_person, v_open_start
    from company_os.equipment_assignments
   where equipment_id = p_equipment_id and returned_at is null
   for update;

  -- Already with this person: nothing to record.
  if v_open_person = p_person_id then
    return v_open_id;
  end if;

  if v_open_id is not null then
    -- Close the outgoing period on the handover date. Guard against a
    -- backdated handover that would end the period before it began.
    update company_os.equipment_assignments
       set returned_at = greatest(p_assigned_at, v_open_start)
     where id = v_open_id;
  end if;

  insert into company_os.equipment_assignments
    (equipment_id, person_id, assigned_at, condition_out, note, created_by)
  values
    (p_equipment_id, p_person_id, p_assigned_at, p_condition_out, p_note, p_actor)
  returning id into v_new_id;

  update company_os.equipment
     set current_holder_id = p_person_id,
         status = 'in_use',
         updated_at = now()
   where id = p_equipment_id;

  return v_new_id;
end;
$$;

create or replace function company_os.return_equipment(
  p_equipment_id uuid,
  p_returned_at date default current_date,
  p_condition_in text default null,
  p_note text default null
)
returns uuid
language plpgsql
volatile
set search_path = company_os, extensions, pg_catalog
as $$
declare
  v_open_id uuid;
  v_open_start date;
begin
  select id, assigned_at
    into v_open_id, v_open_start
    from company_os.equipment_assignments
   where equipment_id = p_equipment_id and returned_at is null
   for update;

  if v_open_id is null then
    raise exception 'Nothing to return: this item has no open assignment.';
  end if;

  update company_os.equipment_assignments
     set returned_at = greatest(p_returned_at, v_open_start),
         condition_in = coalesce(p_condition_in, condition_in),
         note = coalesce(p_note, note)
   where id = v_open_id;

  -- Back on the shelf. A later status change (repair, retired, sold) is a
  -- separate, explicit edit.
  update company_os.equipment
     set current_holder_id = null,
         status = 'in_stock',
         condition = coalesce(p_condition_in, condition),
         updated_at = now()
   where id = p_equipment_id;

  return v_open_id;
end;
$$;

grant execute on function company_os.assign_equipment(uuid, uuid, date, text, text, text) to service_role;
grant execute on function company_os.return_equipment(uuid, date, text, text) to service_role;
