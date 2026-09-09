-- Newsletter Machine — topic radar.
--
-- Candidate article topics found by scanning the regulators APA actually
-- follows: the ATO, Fair Work, the eight state and territory revenue offices,
-- and the workers compensation authorities.
--
-- A separate table rather than rows in newsletter_submissions on purpose. A
-- scan returns twenty-odd candidates and most are rejected; putting those in
-- the Article section would bury the two or three items the team actually
-- wrote. A suggestion becomes a submission only when someone presses Add, and
-- that is the moment it enters the edition.
--
-- Nothing here is ever published directly. Every row carries the URL it came
-- from, and the draft path fetches that page before writing a word about it.

create table if not exists company_os.newsletter_topic_suggestions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null
    references company_os.newsletter_editions (id) on delete cascade,

  -- What the scan found. `title` and `url` are the source page's own; summary
  -- is what the model could establish FROM that page, not from its knowledge
  -- of the topic.
  title text not null,
  url text not null,
  source_name text,
  -- Free text, not a date: the model is required to write "date not stated"
  -- when a page does not carry one. Coercing that to null would lose the
  -- distinction between "no date on the page" and "nobody looked".
  date_label text,
  category text,
  summary text,
  -- 'in_window' | 'unclear' — whether the change falls in the period scanned.
  -- Kept because a candidate the scan is unsure about is still worth a human
  -- glance, and hiding the doubt would be the wrong default in a compliance
  -- publication.
  confidence text not null default 'in_window',

  -- 'new' | 'added' | 'dismissed'. Dismissed rows are kept so a re-scan does
  -- not keep re-offering something already rejected.
  status text not null default 'new',
  -- The submission this became, when someone pressed Add.
  submission_id uuid references company_os.newsletter_submissions (id) on delete set null,

  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

-- One row per page per edition. This is what makes a re-scan additive: a page
-- already seen keeps whatever decision was made about it instead of coming
-- back as a fresh suggestion.
create unique index if not exists newsletter_topic_suggestions_edition_url_idx
  on company_os.newsletter_topic_suggestions (edition_id, url);

create index if not exists newsletter_topic_suggestions_edition_idx
  on company_os.newsletter_topic_suggestions (edition_id, status);

-- RLS on with no policies, like every other table in this schema: the
-- service-role client is the boundary, and /admin gates on requireAdmin().
alter table company_os.newsletter_topic_suggestions enable row level security;
