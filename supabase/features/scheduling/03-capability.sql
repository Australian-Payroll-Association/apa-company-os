-- 03-capability.sql
-- Adriana''s head, written down: per person, per work type, how well they do it
-- and whether they like it. A narrow, purpose-built assignment aid — NOT a
-- revival of the old skills / person_skills tables (dropped 27 Aug 2026 as
-- unused). Durable certifications stay in person_qualifications.
--
-- Kept fresh at project close-out (who did the work, at what level), not by
-- periodic review — that staleness is what kills every skills matrix.

BEGIN;

CREATE TABLE "company_os"."capability" (
    "id"          uuid DEFAULT gen_random_uuid() NOT NULL,
    "person_id"   uuid NOT NULL,
    "work_type"   text NOT NULL,                       -- seeded from the Kantata project-type list (< ~12)
    "level"       text NOT NULL DEFAULT 'capable',     -- fast | capable | learning | no
    "preference"  text,                                -- likes | neutral | dislikes
    "note"        text,
    "created_at"  timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at"  timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT "capability_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "capability_person_work_type_key" UNIQUE ("person_id", "work_type"),
    CONSTRAINT "capability_level_check"
        CHECK ("level" = ANY (ARRAY['fast'::text, 'capable'::text, 'learning'::text, 'no'::text])),
    CONSTRAINT "capability_preference_check"
        CHECK ("preference" IS NULL OR "preference" = ANY (ARRAY['likes'::text, 'neutral'::text, 'dislikes'::text])),
    CONSTRAINT "capability_person_id_fkey" FOREIGN KEY ("person_id")
        REFERENCES "company_os"."people"("id") ON DELETE CASCADE
);

COMMENT ON TABLE "company_os"."capability" IS
    'Assignment aid: how fast a person does a given work type, plus preference. Updated at project close-out, not by periodic review. Not a competency framework.';

CREATE INDEX "capability_work_type_idx" ON "company_os"."capability" ("work_type");

ALTER TABLE "company_os"."capability" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all"           ON "company_os"."capability" TO "service_role"         USING (true) WITH CHECK (true);
CREATE POLICY "chatbot_reader_select"      ON "company_os"."capability" FOR SELECT TO "chatbot_reader"       USING (true);
CREATE POLICY "team_chatbot_reader_select" ON "company_os"."capability" FOR SELECT TO "team_chatbot_reader"  USING (true);
CREATE POLICY "chatbot_writer_select"      ON "company_os"."capability" FOR SELECT TO "chatbot_writer"       USING (true);
CREATE POLICY "chatbot_writer_insert"      ON "company_os"."capability" FOR INSERT TO "chatbot_writer"       WITH CHECK (true);
CREATE POLICY "chatbot_writer_update"      ON "company_os"."capability" FOR UPDATE TO "chatbot_writer"       USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, DELETE, UPDATE ON TABLE "company_os"."capability" TO "service_role";
GRANT SELECT                         ON TABLE "company_os"."capability" TO "chatbot_reader";
GRANT SELECT, INSERT, UPDATE         ON TABLE "company_os"."capability" TO "chatbot_writer";
GRANT SELECT                         ON TABLE "company_os"."capability" TO "team_chatbot_reader";

COMMIT;
