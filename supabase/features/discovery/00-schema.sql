-- Payroll 360 Discovery tool — Phase 1 schema.
-- Follows the conventions in supabase/01-schema.sql (see contractor_work_requests
-- / contractor_work_events for the closest existing analog: a no-login,
-- access_token-scoped client record with an append-only event/audit table).
--
-- Apply directly against the live database (company_os schema already exists).
-- After applying, also append this file's content into 01-schema.sql's dump so
-- the golden snapshot stays in sync — see supabase/features/scheduling/README.md
-- for why that matters (01-schema.sql is what a fresh environment is built from).

-- ============================================================================
-- Tables
-- ============================================================================

CREATE TABLE "company_os"."discovery_engagements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_name" "text" NOT NULL,
    "company_id" "uuid",
    "consultant_person_id" "uuid",
    "access_token" "text" NOT NULL,
    "status" "text" DEFAULT 'not_started'::"text" NOT NULL,
    "overview" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "team_members" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "submitted_at" timestamp with time zone,
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discovery_engagements_status_check" CHECK (("status" = ANY (ARRAY['not_started'::"text", 'in_progress'::"text", 'submitted'::"text", 'under_review'::"text", 'report_drafted'::"text", 'completed'::"text"])))
);

COMMENT ON COLUMN "company_os"."discovery_engagements"."access_token" IS 'The client-facing link credential — no Supabase Auth session, matches contractor_work_requests.access_token. Never expose other engagements'' rows given only a token.';
COMMENT ON COLUMN "company_os"."discovery_engagements"."overview" IS 'Systems in use + employing entities, from the Overview & Demographics tab.';

CREATE TABLE "company_os"."discovery_responses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "engagement_id" "uuid" NOT NULL,
    "question_id" "text" NOT NULL,
    "options" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "text" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

COMMENT ON COLUMN "company_os"."discovery_responses"."question_id" IS 'Stable slug from lib/discovery/questions.ts — never a positional index, so reordering the question bank cannot silently reassign existing answers.';

CREATE TABLE "company_os"."discovery_findings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "engagement_id" "uuid" NOT NULL,
    "question_id" "text" NOT NULL,
    "status" "text" DEFAULT 'open'::"text" NOT NULL,
    "priority" "text" DEFAULT 'medium'::"text" NOT NULL,
    "owner" "text",
    "target_date" "date",
    "notes" "text",
    "created_by" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discovery_findings_status_check" CHECK (("status" = ANY (ARRAY['open'::"text", 'in_progress'::"text", 'resolved'::"text"]))),
    CONSTRAINT "discovery_findings_priority_check" CHECK (("priority" = ANY (ARRAY['high'::"text", 'medium'::"text", 'low'::"text"])))
);

COMMENT ON TABLE "company_os"."discovery_findings" IS 'Consultant-only triage on top of a response — the Consultant View "flag as a finding" fields. Never visible to the client.';

CREATE TABLE "company_os"."discovery_evidence_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "engagement_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'not_requested'::"text" NOT NULL,
    "document_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discovery_evidence_items_status_check" CHECK (("status" = ANY (ARRAY['not_requested'::"text", 'requested'::"text", 'received'::"text", 'not_applicable'::"text"])))
);

COMMENT ON TABLE "company_os"."discovery_evidence_items" IS 'Layer 2 (Data & Evidence Pack) tracker. document_id links to company_os.documents once the actual file is uploaded there.';

CREATE TABLE "company_os"."discovery_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "engagement_id" "uuid" NOT NULL,
    "actor_type" "text" NOT NULL,
    "actor" "text",
    "type" "text" NOT NULL,
    "body" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "discovery_events_actor_type_check" CHECK (("actor_type" = ANY (ARRAY['admin'::"text", 'client'::"text", 'system'::"text"]))),
    CONSTRAINT "discovery_events_type_check" CHECK (("type" = ANY (ARRAY['created'::"text", 'saved'::"text", 'submitted'::"text", 'finding_added'::"text", 'finding_updated'::"text", 'evidence_updated'::"text", 'status_changed'::"text", 'note'::"text"])))
);

COMMENT ON TABLE "company_os"."discovery_events" IS 'Append-only audit/activity timeline per engagement, mirrors contractor_work_events.';

-- ============================================================================
-- Primary keys, uniqueness, foreign keys
-- ============================================================================

ALTER TABLE ONLY "company_os"."discovery_engagements" ADD CONSTRAINT "discovery_engagements_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "company_os"."discovery_engagements" ADD CONSTRAINT "discovery_engagements_access_token_key" UNIQUE ("access_token");
ALTER TABLE ONLY "company_os"."discovery_engagements" ADD CONSTRAINT "discovery_engagements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "company_os"."companies"("id");
ALTER TABLE ONLY "company_os"."discovery_engagements" ADD CONSTRAINT "discovery_engagements_consultant_person_id_fkey" FOREIGN KEY ("consultant_person_id") REFERENCES "company_os"."people"("id");

ALTER TABLE ONLY "company_os"."discovery_responses" ADD CONSTRAINT "discovery_responses_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "company_os"."discovery_responses" ADD CONSTRAINT "discovery_responses_engagement_question_key" UNIQUE ("engagement_id", "question_id");
ALTER TABLE ONLY "company_os"."discovery_responses" ADD CONSTRAINT "discovery_responses_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "company_os"."discovery_engagements"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "company_os"."discovery_findings" ADD CONSTRAINT "discovery_findings_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "company_os"."discovery_findings" ADD CONSTRAINT "discovery_findings_engagement_question_key" UNIQUE ("engagement_id", "question_id");
ALTER TABLE ONLY "company_os"."discovery_findings" ADD CONSTRAINT "discovery_findings_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "company_os"."discovery_engagements"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "company_os"."discovery_evidence_items" ADD CONSTRAINT "discovery_evidence_items_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "company_os"."discovery_evidence_items" ADD CONSTRAINT "discovery_evidence_items_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "company_os"."discovery_engagements"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "company_os"."discovery_evidence_items" ADD CONSTRAINT "discovery_evidence_items_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "company_os"."documents"("id");

ALTER TABLE ONLY "company_os"."discovery_events" ADD CONSTRAINT "discovery_events_pkey" PRIMARY KEY ("id");
ALTER TABLE ONLY "company_os"."discovery_events" ADD CONSTRAINT "discovery_events_engagement_id_fkey" FOREIGN KEY ("engagement_id") REFERENCES "company_os"."discovery_engagements"("id") ON DELETE CASCADE;

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX "discovery_engagements_status_idx" ON "company_os"."discovery_engagements" USING "btree" ("status");
CREATE INDEX "discovery_engagements_company_idx" ON "company_os"."discovery_engagements" USING "btree" ("company_id");
CREATE INDEX "discovery_responses_engagement_idx" ON "company_os"."discovery_responses" USING "btree" ("engagement_id");
CREATE INDEX "discovery_findings_engagement_idx" ON "company_os"."discovery_findings" USING "btree" ("engagement_id");
CREATE INDEX "discovery_evidence_items_engagement_idx" ON "company_os"."discovery_evidence_items" USING "btree" ("engagement_id");
CREATE INDEX "discovery_events_engagement_idx" ON "company_os"."discovery_events" USING "btree" ("engagement_id", "created_at");

-- ============================================================================
-- Row-level security — the Next.js app connects as service_role and bypasses
-- RLS entirely; these policies only bound the admin-assistant chatbot roles.
-- ============================================================================

ALTER TABLE "company_os"."discovery_engagements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_os"."discovery_responses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_os"."discovery_findings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_os"."discovery_evidence_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_os"."discovery_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chatbot_writer_select" ON "company_os"."discovery_engagements" FOR SELECT TO "chatbot_writer" USING (true);
CREATE POLICY "chatbot_writer_insert" ON "company_os"."discovery_engagements" FOR INSERT TO "chatbot_writer" WITH CHECK (true);
CREATE POLICY "chatbot_writer_update" ON "company_os"."discovery_engagements" FOR UPDATE TO "chatbot_writer" USING (true) WITH CHECK (true);

CREATE POLICY "chatbot_writer_select" ON "company_os"."discovery_responses" FOR SELECT TO "chatbot_writer" USING (true);
CREATE POLICY "chatbot_writer_insert" ON "company_os"."discovery_responses" FOR INSERT TO "chatbot_writer" WITH CHECK (true);
CREATE POLICY "chatbot_writer_update" ON "company_os"."discovery_responses" FOR UPDATE TO "chatbot_writer" USING (true) WITH CHECK (true);

CREATE POLICY "chatbot_writer_select" ON "company_os"."discovery_findings" FOR SELECT TO "chatbot_writer" USING (true);
CREATE POLICY "chatbot_writer_insert" ON "company_os"."discovery_findings" FOR INSERT TO "chatbot_writer" WITH CHECK (true);
CREATE POLICY "chatbot_writer_update" ON "company_os"."discovery_findings" FOR UPDATE TO "chatbot_writer" USING (true) WITH CHECK (true);

CREATE POLICY "chatbot_writer_select" ON "company_os"."discovery_evidence_items" FOR SELECT TO "chatbot_writer" USING (true);
CREATE POLICY "chatbot_writer_insert" ON "company_os"."discovery_evidence_items" FOR INSERT TO "chatbot_writer" WITH CHECK (true);
CREATE POLICY "chatbot_writer_update" ON "company_os"."discovery_evidence_items" FOR UPDATE TO "chatbot_writer" USING (true) WITH CHECK (true);

CREATE POLICY "chatbot_writer_select" ON "company_os"."discovery_events" FOR SELECT TO "chatbot_writer" USING (true);
CREATE POLICY "chatbot_writer_insert" ON "company_os"."discovery_events" FOR INSERT TO "chatbot_writer" WITH CHECK (true);

-- ============================================================================
-- Grants
-- ============================================================================

GRANT SELECT ON TABLE "company_os"."discovery_engagements" TO "chatbot_reader";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "company_os"."discovery_engagements" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "company_os"."discovery_engagements" TO "chatbot_writer";

GRANT SELECT ON TABLE "company_os"."discovery_responses" TO "chatbot_reader";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "company_os"."discovery_responses" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "company_os"."discovery_responses" TO "chatbot_writer";

GRANT SELECT ON TABLE "company_os"."discovery_findings" TO "chatbot_reader";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "company_os"."discovery_findings" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "company_os"."discovery_findings" TO "chatbot_writer";

GRANT SELECT ON TABLE "company_os"."discovery_evidence_items" TO "chatbot_reader";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "company_os"."discovery_evidence_items" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "company_os"."discovery_evidence_items" TO "chatbot_writer";

GRANT SELECT ON TABLE "company_os"."discovery_events" TO "chatbot_reader";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "company_os"."discovery_events" TO "service_role";
GRANT SELECT,INSERT,UPDATE ON TABLE "company_os"."discovery_events" TO "chatbot_writer";
