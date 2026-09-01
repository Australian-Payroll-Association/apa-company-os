-- 02-boards-extend.sql
-- A "project" in scheduling terms is a board with a client_company_id. Boards
-- have no dates, no budget, and no client-response expectation today. Add them.
--
-- NOTE (budget unit): budget_hours here powers the estimate-variance flag
-- ("tasks say 10 hours left, budget says 5"). The Unified Project System
-- charter separately proposes boards.budget_cents for cost roll-up. They are
-- complementary; confirm both are wanted before applying (see README).

BEGIN;

ALTER TABLE "company_os"."boards"
    ADD COLUMN "start_date"                date,
    ADD COLUMN "end_date"                  date,
    ADD COLUMN "budget_hours"              numeric(8,2),
    ADD COLUMN "client_response_sla_days"  integer;

COMMENT ON COLUMN "company_os"."boards"."budget_hours" IS
    'Agreed hours budget for the project. Compared against remaining task estimates (tasks.human_tokens) for the over-budget early-warning flag.';
COMMENT ON COLUMN "company_os"."boards"."client_response_sla_days" IS
    'Response-time expectation agreed with the client at kickoff. Baseline for decomposing an overrun into our load vs waiting-on-client.';

ALTER TABLE "company_os"."boards"
    ADD CONSTRAINT "boards_date_order_check"
        CHECK ("end_date" IS NULL OR "start_date" IS NULL OR "end_date" >= "start_date"),
    ADD CONSTRAINT "boards_sla_days_positive"
        CHECK ("client_response_sla_days" IS NULL OR "client_response_sla_days" > 0);

COMMIT;
