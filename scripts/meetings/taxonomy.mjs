// The one meeting-type taxonomy, shared by the DB (normalize_meeting_type
// function + trigger) and by the app. Seven canonical types. Anything an
// external importer (ThoughtFlow) sends is coerced into this set on write, so
// the central company_os.meetings table never holds a type outside it.

export const MEETING_TYPES = [
  "Sales",
  "1-1",
  "Leadership Sync",
  "Vendor Call",
  "General",
  "Performance",
  "Team Ceremony",
];

// SQL for company_os.normalize_meeting_type(text). Order matters: the ceremony
// match runs before the "review"/"planning" words could be read as Performance.
// Unknown non-null labels fall to General so an import can never be rejected.
export const NORMALIZE_FN_SQL = `
create or replace function company_os.normalize_meeting_type(raw text)
returns text language sql immutable as $$
  select case
    when raw is null then null
    when raw in ('Sales','1-1','Leadership Sync','Vendor Call','General','Performance','Team Ceremony') then raw
    when raw ilike any (array['%stand-up%','%standup%','%sprint%','%grooming%','%project planning%','%retro%','%ceremony%','%kickoff%','%kick-off%']) then 'Team Ceremony'
    when raw ilike '%vendor%' then 'Vendor Call'
    when raw ilike '%leadership%' or raw ilike '%exec %' or raw ilike '%leadership sync%' then 'Leadership Sync'
    when raw ilike '%performance review%' or raw ilike '%perf review%' or raw ilike '%performance%' then 'Performance'
    when raw ilike '%1-1%' or raw ilike '%1:1%' or raw ilike '%one-on-one%' or raw ilike '%one on one%' or raw ilike '% <> %' then '1-1'
    when raw ilike '%sales%' or raw ilike '%discovery%' or raw ilike '%capabilities audit%' or raw ilike '%demo%' or raw ilike '%proposal%' then 'Sales'
    else 'General'
  end
$$;
`;

// BEFORE INSERT OR UPDATE trigger. Coerces meeting_type into the canonical set
// and, when it rewrites a non-null label, stashes the raw value in
// metadata.source_meeting_type once, so ThoughtFlow's richer label is not lost.
export const TRIGGER_SQL = `
create or replace function company_os.meetings_normalize_type_tg()
returns trigger language plpgsql as $$
declare
  canon text := company_os.normalize_meeting_type(new.meeting_type);
begin
  if new.meeting_type is not null and canon is distinct from new.meeting_type
     and coalesce(new.metadata->>'source_meeting_type','') = '' then
    new.metadata := coalesce(new.metadata,'{}'::jsonb)
      || jsonb_build_object('source_meeting_type', new.meeting_type);
  end if;
  new.meeting_type := canon;
  return new;
end
$$;

drop trigger if exists meetings_normalize_type on company_os.meetings;
create trigger meetings_normalize_type
  before insert or update on company_os.meetings
  for each row execute function company_os.meetings_normalize_type_tg();
`;
