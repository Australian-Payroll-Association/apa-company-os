-- 01-engagements-extend.sql
-- Extend discovery_engagements with the client-invite send flow (Phase 5):
-- who the invite goes to, and which address it sends from / submission
-- alerts go to. consultant_email is entered per engagement rather than
-- resolved from consultant_person_id, since the APA sending domain isn't
-- yet verified in Resend — sendTransactionalEmail can only override `from`
-- with a verified address, so this lets a consultant use their own inbox
-- immediately without waiting on domain verification, and without a schema
-- change once it lands.

BEGIN;

ALTER TABLE "company_os"."discovery_engagements"
    ADD COLUMN "client_email" text,
    ADD COLUMN "client_contact_name" text,
    ADD COLUMN "consultant_email" text;

COMMENT ON COLUMN "company_os"."discovery_engagements"."client_email" IS
    'Who the discovery link invite is sent to. Set at creation; the invite can be resent to this address.';
COMMENT ON COLUMN "company_os"."discovery_engagements"."consultant_email" IS
    'Sender/reply-to for the client invite and recipient for the submission alert, typed per engagement. Falls back to the default system sender when blank.';

COMMIT;
