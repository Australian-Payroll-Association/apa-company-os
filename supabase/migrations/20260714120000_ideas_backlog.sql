-- Ideas Backlog: employee-submitted AI program ideas from the /team portal.
-- Captures the first four Ds of the 5D framework (Define, Discover, Design,
-- Determine — Deploy is deliberately omitted in v1), plus the Claude-generated
-- Dan Shipper product plan and its office classification.
-- Applied 2026-07-14 via Supabase MCP migration `ideas_backlog`.

create table company_os.ideas (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references company_os.people(id),
  title         text not null,
  -- The four Ds captured from the guided form
  problem       text not null,      -- Define: who feels it, what it costs, why now
  data_needed   text not null,      -- Discover: datasources the AI would need
  workflow      text not null,      -- Design: high-level workflow, trigger to output
  roi           text not null,      -- Determine: expected ROI / success measure
  -- Claude output
  office        text check (office in ('revenue','talent','operations','innovation')),
  ai_plan       text,               -- Dan Shipper product plan (markdown)
  ai_model      text,               -- model id used, for audit
  ai_error      text,               -- populated when generation failed
  status        text not null default 'new'
                check (status in ('new','in_review','approved','declined','archived')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists ideas_person_id_idx on company_os.ideas(person_id);
create index if not exists ideas_status_idx on company_os.ideas(status);
create index if not exists ideas_office_idx on company_os.ideas(office);

-- company_os access model: RLS on with no policies; all reads/writes go through
-- the service-role client behind the app's server-side gates.
alter table company_os.ideas enable row level security;
grant select, insert, update, delete on company_os.ideas to service_role;
