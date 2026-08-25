-- Weekly AI summary of the themes running across recently posted ideas and
-- learnings, shown on the Innovation cockpit (/admin/innovation). One row per
-- generation; the cockpit renders the newest. Written by the idea-trends cron,
-- read via the service-role client. RLS on with no policies keeps the browser
-- anon key out (matches the company_os convention).

create table if not exists company_os.idea_trend_reports (
  id uuid primary key default gen_random_uuid(),
  themes jsonb not null default '[]'::jsonb,        -- array of short theme strings
  source_count integer not null default 0,          -- ideas + learnings considered
  model text,
  generated_at timestamptz not null default now()
);

alter table company_os.idea_trend_reports enable row level security;

grant select, insert on company_os.idea_trend_reports to service_role;

create index if not exists idea_trend_reports_generated_idx
  on company_os.idea_trend_reports (generated_at desc);
