-- OKR + Metrics restructure, Phase 1 (additive half).
-- Plan: docs/plans/2026-08-25-okr-metrics-restructure.md
-- 1. objectives.brand (replaces business_line; the drop ships separately in
--    20260825170001 so the deployed app never selects a missing column).
-- 2. key_results.source / source_detail (moved from metrics).
-- 3. kr_logs: append-only weekly updates, agent-first (replaces metric_readings).
-- 4. Data: promote the 3 agent metrics to KRs with their readings as opening
--    logs; delete all 4 metric rows (Days to hire becomes a live cockpit KPI).

alter table company_os.objectives
  add column if not exists brand text check (brand in ('edge8','aio'));

update company_os.objectives set brand = 'edge8' where business_line is not null;

alter table company_os.key_results
  add column if not exists source text not null default 'manual'
    check (source in ('agent','manual'));
alter table company_os.key_results
  add column if not exists source_detail text;

create table if not exists company_os.kr_logs (
  id uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references company_os.key_results(id) on delete cascade,
  week_start date not null,
  value numeric,
  note_md text,
  author_kind text not null check (author_kind in ('agent','human')),
  author_agent text,
  author_person_id uuid references company_os.people(id),
  created_at timestamptz not null default now(),
  -- Every log names its author: an agent or a person.
  constraint kr_logs_author_required
    check ((author_kind = 'agent' and author_agent is not null)
        or (author_kind = 'human' and author_person_id is not null))
);

-- Append-only by design: no unique (key_result_id, week_start). The latest
-- log with a value per week wins for the series; earlier rows are the audit trail.
create index if not exists kr_logs_kr_week_idx
  on company_os.kr_logs (key_result_id, week_start);

alter table company_os.kr_logs enable row level security;
grant select, insert, update, delete on company_os.kr_logs to service_role;
grant select on company_os.kr_logs to team_chatbot_reader;
grant select on company_os.kr_logs to chatbot_reader;

-- ---- Data migration: metric triage (plan, "Decided" section) ----
-- Promote the 3 agent metrics to KRs under the best-fit 2026Q3 company
-- objectives (re-parenting later is a one-column update). Copy their readings
-- into kr_logs, then delete all metric rows. metric_readings cascade.
do $$
declare
  m record;
  target_objective uuid;
  new_kr uuid;
begin
  for m in select * from company_os.metrics where source = 'agent' loop
    target_objective := case
      -- Keynote attendees + Documented workflows: thought-leadership assets.
      when m.name in ('Keynote attendees', 'Documented workflows')
        then '66be1138-2ebc-48b7-9660-ed583d51e484'  -- "We are seen as a thought leader in the AI space"
      -- Avg sales call score: the client-delivery/revenue objective.
      else 'f78afc7c-4cd2-496c-aad7-77c4fc68ea70'    -- "We help world-class companies be tech-forward..."
    end;

    insert into company_os.key_results
      (objective_id, title, target_value, current_value, direction,
       accountable_person_id, executing_agent, source, source_detail, sort_order)
    values
      (target_objective, m.name, m.target,
       coalesce((select r.value from company_os.metric_readings r
                 where r.metric_id = m.id order by r.week_start desc limit 1), 0),
       m.direction, m.owner_person_id, m.owner_agent, m.source, m.formula, 100)
    returning id into new_kr;

    insert into company_os.kr_logs
      (key_result_id, week_start, value, author_kind, author_agent, created_at)
    select new_kr, r.week_start, r.value, 'agent', m.owner_agent, r.created_at
    from company_os.metric_readings r where r.metric_id = m.id;
  end loop;

  delete from company_os.metrics;  -- readings cascade
end $$;
