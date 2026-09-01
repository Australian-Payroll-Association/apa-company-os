-- 01-staff_assignments-extend.sql
-- Extend staff_assignments IN PLACE (decision: extend, don''t fork).
--
-- Today staff_assignments links a team_member to a client company for a period
-- (a durable placement), with a free-text status defaulting to 'active'. It has
-- no allocation size, no project link, and no deal link. This adds the four
-- things scheduling needs, WITHOUT disturbing the legacy `status` column that
-- existing client placements rely on.
--
-- Portal-leak guard: staff_assignments.client_visible is read by the client
-- portal. A tentative (unconfirmed) allocation must never reach a client, so a
-- CHECK forbids client_visible = true on tentative rows.

BEGIN;

ALTER TABLE "company_os"."staff_assignments"
    ADD COLUMN "allocation_hours" numeric(5,2),                       -- weekly hours; % converts at entry against a 38h week
    ADD COLUMN "schedule_status"  text NOT NULL DEFAULT 'confirmed',  -- tentative | confirmed (distinct from legacy `status`)
    ADD COLUMN "source_deal_id"   uuid,                               -- set on tentative rows shadowing a late-stage deal
    ADD COLUMN "board_id"         uuid;                               -- the project this allocation is for

COMMENT ON COLUMN "company_os"."staff_assignments"."allocation_hours" IS
    'Planned weekly hours for this allocation. Percentages are converted at entry against a 38-hour week. Ends the hours-vs-percentage ambiguity.';
COMMENT ON COLUMN "company_os"."staff_assignments"."schedule_status" IS
    'Scheduling lifecycle: tentative (the digitised whiteboard) or confirmed. Separate from the legacy free-text `status` used by durable client placements.';
COMMENT ON COLUMN "company_os"."staff_assignments"."source_deal_id" IS
    'For tentative rows: the deal this allocation shadows. A tentative project is a delivery-side shadow of a late-stage deal, linked by FK, never a copy.';

ALTER TABLE "company_os"."staff_assignments"
    ADD CONSTRAINT "staff_assignments_schedule_status_check"
        CHECK ("schedule_status" = ANY (ARRAY['tentative'::text, 'confirmed'::text])),
    ADD CONSTRAINT "staff_assignments_source_deal_id_fkey"
        FOREIGN KEY ("source_deal_id") REFERENCES "company_os"."deals"("id") ON DELETE SET NULL,
    ADD CONSTRAINT "staff_assignments_board_id_fkey"
        FOREIGN KEY ("board_id") REFERENCES "company_os"."boards"("id") ON DELETE SET NULL,
    -- Portal-leak guard: tentative allocations are never client-visible.
    ADD CONSTRAINT "staff_assignments_tentative_not_client_visible"
        CHECK (NOT ("schedule_status" = 'tentative' AND "client_visible" = true)),
    -- Anti-double-count guard: allocation hours may only sit on a row tied to a
    -- project (board) or a prospective project (deal). A durable client
    -- placement (neither) can never carry allocation hours, so it can never be
    -- summed into consultant_load alongside the real project allocations.
    ADD CONSTRAINT "staff_assignments_allocation_requires_project"
        CHECK ("allocation_hours" IS NULL OR "board_id" IS NOT NULL OR "source_deal_id" IS NOT NULL);

CREATE INDEX "staff_assignments_board_id_idx"       ON "company_os"."staff_assignments" ("board_id");
CREATE INDEX "staff_assignments_source_deal_id_idx" ON "company_os"."staff_assignments" ("source_deal_id");

COMMIT;
