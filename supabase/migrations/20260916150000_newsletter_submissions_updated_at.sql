-- newsletter_submissions.updated_at never updated.
--
-- The column has existed since the table was created, with a default of now(),
-- and nothing ever maintained it — so its value is the insert time forever and
-- it reads as a last-modified date that is not one. newsletter_editions got
-- the trigger; its sibling did not, which is the kind of asymmetry nobody
-- notices until they trust the column.
--
-- Surfaced while backfilling 20260916135000 against the snapshot. Recorded
-- there rather than fixed, because a backfill describing what exists is the
-- wrong place to change behaviour. This is that change, on its own, where it
-- can be reviewed as one.
--
-- Safe to apply: nothing in the application reads this column today. The
-- values already stored stay as they are — this is not a backfill of the data,
-- only of the behaviour from here on. Existing rows keep their insert time
-- until something updates them, which is the honest outcome: there is no
-- record of when they were last touched, so inventing one would be worse.

drop trigger if exists set_newsletter_submissions_updated_at
  on company_os.newsletter_submissions;

create trigger set_newsletter_submissions_updated_at
  before update on company_os.newsletter_submissions
  for each row execute function company_os.handle_updated_at();
