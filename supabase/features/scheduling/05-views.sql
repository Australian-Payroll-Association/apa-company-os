-- 05-views.sql
-- Derived layer. Nothing here stores state. Apply after 00–04.
--
-- CAPACITY: weekly capacity is hard-coded to 38h below (marked -- CAPACITY).
-- When the Unified Project System adds people.weekly_capacity_hours, replace
-- the 38 constant with COALESCE(p.weekly_capacity_hours, 38).
--
-- Horizon: a rolling 8 weeks from the start of the current week.

BEGIN;

-- ---------------------------------------------------------------------------
-- consultant_load — per person, per week: confirmed + tentative allocated
-- hours against capacity, with approved leave subtracted. The spine view.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "company_os"."consultant_load" AS
WITH weeks AS (
    SELECT gs::date AS week_start, (gs::date + 6) AS week_end
    FROM generate_series(date_trunc('week', CURRENT_DATE),
                         date_trunc('week', CURRENT_DATE) + INTERVAL '7 weeks',
                         INTERVAL '1 week') AS gs
),
members AS (
    SELECT tm.id AS team_member_id, tm.person_id, p.display_name
    FROM "company_os"."team_members" tm
    JOIN "company_os"."people" p ON p.id = tm.person_id
    WHERE tm.status = 'active'
),
horizon_days AS (
    SELECT d::date AS day
    FROM generate_series(date_trunc('week', CURRENT_DATE)::date,
                         date_trunc('week', CURRENT_DATE)::date + 55,
                         INTERVAL '1 day') AS g(d)
    WHERE EXTRACT(isodow FROM d) < 6                          -- Mon–Fri only
),
leave_days AS (
    SELECT t.team_member_id,
           date_trunc('week', hd.day)::date AS week_start,
           count(*) AS leave_days
    FROM horizon_days hd
    JOIN "company_os"."time_off" t
      ON t.status = ANY (ARRAY['approved','taken'])
     AND hd.day BETWEEN t.start_date AND t.end_date
    GROUP BY 1, 2
),
alloc AS (
    SELECT sa.team_member_id, w.week_start,
           sum(CASE WHEN sa.schedule_status = 'confirmed' THEN COALESCE(sa.allocation_hours,0) ELSE 0 END) AS confirmed_hours,
           sum(CASE WHEN sa.schedule_status = 'tentative' THEN COALESCE(sa.allocation_hours,0) ELSE 0 END) AS tentative_hours
    FROM "company_os"."staff_assignments" sa
    JOIN weeks w
      ON sa.start_date <= w.week_end
     AND (sa.end_date IS NULL OR sa.end_date >= w.week_start)
    WHERE sa.allocation_hours IS NOT NULL
      -- Project allocations only, never durable client placements. The
      -- allocation_requires_project CHECK (migration 01) means these are the
      -- only rows that can carry allocation_hours anyway; this is explicit.
      AND (sa.board_id IS NOT NULL OR sa.source_deal_id IS NOT NULL)
    GROUP BY 1, 2
)
SELECT
    m.person_id,
    m.team_member_id,
    m.display_name,
    w.week_start,
    38::numeric AS capacity_hours,                            -- CAPACITY
    (COALESCE(ld.leave_days,0) * (38.0/5))::numeric(6,2) AS leave_hours,
    GREATEST(38 - COALESCE(ld.leave_days,0) * (38.0/5), 0)::numeric(6,2) AS available_hours,
    COALESCE(a.confirmed_hours,0)::numeric(6,2) AS confirmed_hours,
    COALESCE(a.tentative_hours,0)::numeric(6,2) AS tentative_hours,
    round(COALESCE(a.confirmed_hours,0)
          / NULLIF(GREATEST(38 - COALESCE(ld.leave_days,0) * (38.0/5), 0), 0) * 100, 1)
        AS confirmed_utilisation_pct,
    round((COALESCE(a.confirmed_hours,0) + COALESCE(a.tentative_hours,0))
          / NULLIF(GREATEST(38 - COALESCE(ld.leave_days,0) * (38.0/5), 0), 0) * 100, 1)
        AS committed_plus_tentative_pct
FROM members m
CROSS JOIN weeks w
LEFT JOIN alloc a       ON a.team_member_id = m.team_member_id AND a.week_start = w.week_start
LEFT JOIN leave_days ld ON ld.team_member_id = m.team_member_id AND ld.week_start = w.week_start;

COMMENT ON VIEW "company_os"."consultant_load" IS
    'Per person per week over a rolling 8 weeks: confirmed + tentative allocation vs capacity, leave subtracted. The two-tier overwork flag (soft >= 85%, hard > 100%) is applied in the app over confirmed_utilisation_pct.';

-- ---------------------------------------------------------------------------
-- deal_forecast_load — the probability-weighted line. Tentative allocations
-- linked to a deal, weighted by that deal''s pipeline probability.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "company_os"."deal_forecast_load" AS
WITH weeks AS (
    SELECT gs::date AS week_start, (gs::date + 6) AS week_end
    FROM generate_series(date_trunc('week', CURRENT_DATE),
                         date_trunc('week', CURRENT_DATE) + INTERVAL '7 weeks',
                         INTERVAL '1 week') AS gs
)
SELECT
    sa.team_member_id,
    w.week_start,
    sum(COALESCE(sa.allocation_hours,0) * COALESCE(d.probability,0) / 100.0)::numeric(6,2)
        AS probability_weighted_hours
FROM "company_os"."staff_assignments" sa
JOIN weeks w
  ON sa.start_date <= w.week_end
 AND (sa.end_date IS NULL OR sa.end_date >= w.week_start)
JOIN "company_os"."deals" d ON d.id = sa.source_deal_id
WHERE sa.schedule_status = 'tentative'
  AND sa.allocation_hours IS NOT NULL
GROUP BY 1, 2;

COMMENT ON VIEW "company_os"."deal_forecast_load" IS
    'Probability-weighted expected load from tentative, deal-linked allocations. Leadership sees the committed picture (consultant_load) and the expected one (this) side by side.';

-- ---------------------------------------------------------------------------
-- project_slip — per client project: planned vs elapsed, and total days spent
-- waiting on the client, against the SLA agreed at kickoff.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "company_os"."project_slip" AS
SELECT
    b.id AS board_id,
    b.name,
    b.client_company_id,
    b.start_date,
    b.end_date,
    b.client_response_sla_days,
    (b.end_date - b.start_date) AS planned_days,
    (LEAST(CURRENT_DATE, COALESCE(b.end_date, CURRENT_DATE)) - b.start_date) AS elapsed_days,
    COALESCE(cr.days_waiting_on_client, 0) AS days_waiting_on_client,
    COALESCE(cr.open_requests, 0) AS open_requests
FROM "company_os"."boards" b
LEFT JOIN (
    SELECT board_id,
           sum((COALESCE(answered_on, CURRENT_DATE) - asked_on)) AS days_waiting_on_client,
           count(*) FILTER (WHERE answered_on IS NULL) AS open_requests
    FROM "company_os"."client_requests"
    GROUP BY board_id
) cr ON cr.board_id = b.id
WHERE b.client_company_id IS NOT NULL
  AND b.archived_at IS NULL
  AND b.start_date IS NOT NULL;

COMMENT ON VIEW "company_os"."project_slip" IS
    'Decomposes an overrun: planned vs elapsed alongside days-waiting-on-client, measured against the kickoff SLA. Days-waiting is derived here, never stored.';

-- ---------------------------------------------------------------------------
-- estimate_variance — planned (task human_tokens, 1 token = 1 hour) vs logged
-- (time_entry) hours per project. The loop that makes the next estimate real.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "company_os"."estimate_variance" AS
SELECT
    b.id AS board_id,
    b.name,
    -- Grain is per PROJECT (board) — correct and useful today. project_type is a
    -- forward-compatible passthrough: nothing populates boards.metadata->>'project_type'
    -- yet, so it reads '(unset)' until a project-type field lands (Unified PM or here).
    -- Roll up to project_type in the app once that field is real; do not present a
    -- per-type breakdown before then.
    COALESCE(b.metadata->>'project_type', '(unset)') AS project_type,
    COALESCE(est.estimated_hours, 0)::numeric(10,2) AS estimated_hours,
    COALESCE(te.logged_hours, 0)::numeric(10,2) AS logged_hours,
    (COALESCE(te.logged_hours, 0) - COALESCE(est.estimated_hours, 0))::numeric(10,2) AS variance_hours
FROM "company_os"."boards" b
LEFT JOIN (
    SELECT board_id, sum(human_tokens) AS estimated_hours
    FROM "company_os"."tasks"
    WHERE archived_at IS NULL AND human_tokens IS NOT NULL
    GROUP BY board_id
) est ON est.board_id = b.id
LEFT JOIN (
    SELECT board_id, sum(hours) AS logged_hours
    FROM "company_os"."time_entry"
    WHERE board_id IS NOT NULL
    GROUP BY board_id
) te ON te.board_id = b.id
WHERE b.archived_at IS NULL;

COMMENT ON VIEW "company_os"."estimate_variance" IS
    'Planned vs logged hours per project/project-type. Feeds back so each finished job sharpens the next estimate.';

-- ---------------------------------------------------------------------------
-- project_budget_health — the over-budget early warning: remaining task
-- estimate vs remaining budget hours ("tasks say 10 left, budget says 5").
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW "company_os"."project_budget_health" AS
SELECT
    b.id AS board_id,
    b.name,
    b.budget_hours,
    COALESCE(te.logged_hours, 0)::numeric(10,2) AS logged_hours,
    (b.budget_hours - COALESCE(te.logged_hours, 0))::numeric(10,2) AS remaining_budget_hours,
    COALESCE(rem.remaining_estimate_hours, 0)::numeric(10,2) AS remaining_estimate_hours,
    (COALESCE(rem.remaining_estimate_hours, 0) > (b.budget_hours - COALESCE(te.logged_hours, 0))) AS over_budget_flag
FROM "company_os"."boards" b
LEFT JOIN (
    SELECT board_id, sum(hours) AS logged_hours
    FROM "company_os"."time_entry" WHERE board_id IS NOT NULL GROUP BY board_id
) te ON te.board_id = b.id
LEFT JOIN (
    -- "Remaining" = not yet done by EITHER of the app's two done-signals:
    -- tasks.status = 'done' (lib/boards/data.ts) and completed_at being set.
    SELECT t.board_id, sum(t.human_tokens) AS remaining_estimate_hours
    FROM "company_os"."tasks" t
    LEFT JOIN "company_os"."board_columns" bc ON bc.id = t.board_column_id
    WHERE t.archived_at IS NULL AND t.human_tokens IS NOT NULL
      AND t.status <> 'done'
      AND t.completed_at IS NULL
      AND COALESCE(bc.is_done, false) = false          -- not sitting in a Done column
    GROUP BY t.board_id
) rem ON rem.board_id = b.id
WHERE b.archived_at IS NULL
  AND b.budget_hours IS NOT NULL;

COMMENT ON VIEW "company_os"."project_budget_health" IS
    'Fires over_budget_flag when remaining task estimate exceeds remaining budget hours — before the overrun, not after.';

-- Grants — reads only; mirror the roles used elsewhere.
GRANT SELECT ON "company_os"."consultant_load"       TO "service_role", "chatbot_reader", "chatbot_writer", "team_chatbot_reader";
GRANT SELECT ON "company_os"."deal_forecast_load"    TO "service_role", "chatbot_reader", "chatbot_writer", "team_chatbot_reader";
GRANT SELECT ON "company_os"."project_slip"          TO "service_role", "chatbot_reader", "chatbot_writer", "team_chatbot_reader";
GRANT SELECT ON "company_os"."estimate_variance"     TO "service_role", "chatbot_reader", "chatbot_writer", "team_chatbot_reader";
GRANT SELECT ON "company_os"."project_budget_health" TO "service_role", "chatbot_reader", "chatbot_writer", "team_chatbot_reader";

COMMIT;
