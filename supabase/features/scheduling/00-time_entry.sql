-- 00-time_entry.sql
-- The shared timesheet spine for the Unified Project System. Improved
-- Scheduling and Tracking rides on this table; it is built first (Phase 0).
--
-- Design rule (from the Unified PM charter): never store cost on a row. Hours
-- live here; cost = hours x current rate is computed in a view at read time.
--
-- Source of truth: this is THE record for consulting hours. The htt schema
-- (auto-captured code/AI effort) is deliberately not joined.

BEGIN;

CREATE TABLE "company_os"."time_entry" (
    "id"          uuid DEFAULT gen_random_uuid() NOT NULL,
    "person_id"   uuid NOT NULL,
    "board_id"    uuid,                      -- the project/client the work is against (boards.client_company_id)
    "task_id"     uuid,                      -- optional finer attribution
    "work_date"   date NOT NULL,
    "hours"       numeric(5,2) NOT NULL,
    "billable"    boolean NOT NULL DEFAULT true,
    "note"        text,
    "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"  timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "time_entry_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "time_entry_hours_range" CHECK ("hours" > 0 AND "hours" <= 24),
    CONSTRAINT "time_entry_person_id_fkey" FOREIGN KEY ("person_id")
        REFERENCES "company_os"."people"("id") ON DELETE CASCADE,
    CONSTRAINT "time_entry_board_id_fkey" FOREIGN KEY ("board_id")
        REFERENCES "company_os"."boards"("id") ON DELETE SET NULL,
    CONSTRAINT "time_entry_task_id_fkey" FOREIGN KEY ("task_id")
        REFERENCES "company_os"."tasks"("id") ON DELETE SET NULL
);

COMMENT ON TABLE "company_os"."time_entry" IS
    'Staff timesheet. One row per person per chunk of work per day. Source of truth for consulting hours; cost is derived in a view, never stored. Non-billable rows (billable=false) book to internal tasks/boards.';

-- Fast paths for the two hot reads: a person''s week, and a project''s hours.
CREATE INDEX "time_entry_person_work_date_idx" ON "company_os"."time_entry" ("person_id", "work_date");
CREATE INDEX "time_entry_board_work_date_idx"  ON "company_os"."time_entry" ("board_id", "work_date");

-- Row-level security — mirror the staff_assignments pattern exactly.
ALTER TABLE "company_os"."time_entry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all"          ON "company_os"."time_entry" TO "service_role"        USING (true) WITH CHECK (true);
CREATE POLICY "chatbot_reader_select"     ON "company_os"."time_entry" FOR SELECT TO "chatbot_reader"      USING (true);
CREATE POLICY "team_chatbot_reader_select" ON "company_os"."time_entry" FOR SELECT TO "team_chatbot_reader" USING (true);
CREATE POLICY "chatbot_writer_select"     ON "company_os"."time_entry" FOR SELECT TO "chatbot_writer"      USING (true);
CREATE POLICY "chatbot_writer_insert"     ON "company_os"."time_entry" FOR INSERT TO "chatbot_writer"      WITH CHECK (true);
CREATE POLICY "chatbot_writer_update"     ON "company_os"."time_entry" FOR UPDATE TO "chatbot_writer"      USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE "company_os"."time_entry" TO "service_role";
GRANT SELECT                         ON TABLE "company_os"."time_entry" TO "chatbot_reader";
GRANT SELECT, INSERT, UPDATE         ON TABLE "company_os"."time_entry" TO "chatbot_writer";
GRANT SELECT                         ON TABLE "company_os"."time_entry" TO "team_chatbot_reader";

COMMIT;
