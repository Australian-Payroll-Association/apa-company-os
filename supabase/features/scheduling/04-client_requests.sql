-- 04-client_requests.sql
-- One row per information request we make of a client, with the day asked and
-- the day answered. Elapsed days is DERIVED (see 05-views.sql), never stored.
-- Feeds the slip decomposition: overrun = our load vs waiting-on-client,
-- measured against the client_response_sla_days agreed at kickoff (on boards).

BEGIN;

CREATE TABLE "company_os"."client_requests" (
    "id"           uuid DEFAULT gen_random_uuid() NOT NULL,
    "board_id"     uuid NOT NULL,
    "asked_on"     date NOT NULL,
    "description"  text NOT NULL,
    "answered_on"  date,
    "note"         text,
    "created_at"   timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"   timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "client_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "client_requests_answered_after_asked"
        CHECK ("answered_on" IS NULL OR "answered_on" >= "asked_on"),
    CONSTRAINT "client_requests_board_id_fkey" FOREIGN KEY ("board_id")
        REFERENCES "company_os"."boards"("id") ON DELETE CASCADE
);

COMMENT ON TABLE "company_os"."client_requests" IS
    'Information requests made of a client during delivery. Days-unanswered is derived, never stored. Operations tool and commercial defence in one.';

CREATE INDEX "client_requests_board_id_idx" ON "company_os"."client_requests" ("board_id");
CREATE INDEX "client_requests_open_idx"     ON "company_os"."client_requests" ("board_id") WHERE "answered_on" IS NULL;

ALTER TABLE "company_os"."client_requests" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all"           ON "company_os"."client_requests" TO "service_role"        USING (true) WITH CHECK (true);
CREATE POLICY "chatbot_reader_select"      ON "company_os"."client_requests" FOR SELECT TO "chatbot_reader"       USING (true);
CREATE POLICY "team_chatbot_reader_select" ON "company_os"."client_requests" FOR SELECT TO "team_chatbot_reader"  USING (true);
CREATE POLICY "chatbot_writer_select"      ON "company_os"."client_requests" FOR SELECT TO "chatbot_writer"       USING (true);
CREATE POLICY "chatbot_writer_insert"      ON "company_os"."client_requests" FOR INSERT TO "chatbot_writer"       WITH CHECK (true);
CREATE POLICY "chatbot_writer_update"      ON "company_os"."client_requests" FOR UPDATE TO "chatbot_writer"       USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE "company_os"."client_requests" TO "service_role";
GRANT SELECT                         ON TABLE "company_os"."client_requests" TO "chatbot_reader";
GRANT SELECT, INSERT, UPDATE         ON TABLE "company_os"."client_requests" TO "chatbot_writer";
GRANT SELECT                         ON TABLE "company_os"."client_requests" TO "team_chatbot_reader";

COMMIT;
