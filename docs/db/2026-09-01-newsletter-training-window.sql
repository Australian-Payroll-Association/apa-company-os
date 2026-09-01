-- Newsletter Machine — training window on an edition.
--
-- The training table advertises past the edition month: the July edition ran
-- courses to 14 August, August's to 11 September, September's to 15 October.
-- So the window the training pull reads is its own range, not the edition
-- period.
--
-- Both nullable. When unset the pull falls back to period_start .. period_end
-- plus six weeks, which is the span the three 2026 editions actually used.

alter table company_os.newsletter_editions
  add column if not exists training_from date,
  add column if not exists training_to date;
