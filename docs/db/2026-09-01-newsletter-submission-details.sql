-- SUPERSEDED — do not run this file.
--
-- Applied by hand in early September, before the rule that forward changes go
-- in supabase/migrations/ first and then into the snapshot. The migration is
-- supabase/migrations/20260916135000_newsletter_editions_and_submissions.sql,
-- which describes the tables as they are now, after this file and its
-- siblings, and carries the chatbot_reader and chatbot_writer grants none of
-- these scripts had. Kept only as history.
--
-- Newsletter Machine — per-section structured fields.
--
-- Some sections need more than heading/body/link. A webinar carries a date, a
-- time and a register link; a training course carries its printed date label,
-- format and price. Rather than a column per section — which would grow every
-- time a section changes — those values live in one jsonb bag, keyed by the
-- field keys declared in lib/newsletter.ts (SECTION_META[type].fields).
--
-- Same reasoning as keeping the section list in application code: a section
-- should be able to gain a field without a migration.

alter table company_os.newsletter_submissions
  add column if not exists details jsonb not null default '{}'::jsonb;
