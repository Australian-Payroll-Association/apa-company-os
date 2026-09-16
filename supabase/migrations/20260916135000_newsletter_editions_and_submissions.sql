-- Newsletter Machine — editions and submissions.
--
-- BACKFILL, and a companion to 20260916140000_newsletter_topic_suggestions.
-- Both tables already exist in production. They were applied by hand in early
-- September from docs/db/2026-09-01-newsletter-machine.sql, plus two follow-ups
-- that added columns (-newsletter-submission-details.sql for
-- newsletter_submissions.details, -newsletter-training-window.sql for
-- newsletter_editions.training_from / training_to) — all before the rule that
-- forward changes go in supabase/migrations/ first and then into the snapshot.
--
-- Numbered 135000, BEFORE the topic-radar migration at 140000, because that one
-- takes foreign keys to both of these tables. Applied in timestamp order from
-- an empty database the other way round, it would fail on a missing reference.
--
-- Written against supabase/01-schema.sql — the live shape, after those two
-- follow-ups — rather than against the original scripts, which describe an
-- earlier state and grant only service_role. Verified column-for-column.
--
-- Idempotent throughout: this is added after the fact and will meet a database
-- that already holds every object in it.

-- ---------------------------------------------------------------------------
-- newsletter_editions — one row per edition, normally one per month
-- ---------------------------------------------------------------------------
--
-- Status runs open -> closed -> drafting -> in_review -> published, with
-- cancelled off to the side. Deliberately NOT a CHECK constraint: allowed
-- values live in lib/newsletter.ts so the list can change without a migration,
-- following the precedent set by the surveys tables.

create table if not exists company_os.newsletter_editions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_start date not null,
  period_end date not null,
  deadline_at timestamptz,

  status text not null default 'open',

  -- Stage 2 hand-off: the marketing_content row holding the draft.
  content_id uuid references company_os.marketing_content (id) on delete set null,

  -- Stage 3. Two signatures, in sequence and from two different people.
  -- Sending stays blocked until both are set, and any change to the draft
  -- clears them — the signatures are on the words, not on the edition.
  reviewer_signed_by text,
  reviewer_signed_at timestamptz,
  admin_signed_by text,
  admin_signed_at timestamptz,
  review_notes text,

  opened_by text,
  closed_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Last, not grouped with the other dates, because that is where they are in
  -- production: they arrived as an ALTER TABLE ADD COLUMN in
  -- docs/db/2026-09-01-newsletter-training-window.sql and Postgres appends.
  -- Reordering them here would leave a rebuilt database physically different
  -- from the live one.
  --
  -- The window the training pull reads. Nullable: unset falls back to the
  -- period plus six weeks, because an edition advertises past its own month.
  training_from date,
  training_to date
);

-- One open edition at a time. Contributors are shown "the" open edition, so
-- two of them would silently split a month's submissions across two records.
create unique index if not exists newsletter_editions_single_open_idx
  on company_os.newsletter_editions ((status)) where status = 'open';

create index if not exists newsletter_editions_status_idx
  on company_os.newsletter_editions (status, period_start desc);

drop trigger if exists set_newsletter_editions_updated_at on company_os.newsletter_editions;
create trigger set_newsletter_editions_updated_at
  before update on company_os.newsletter_editions
  for each row execute function company_os.handle_updated_at();

-- ---------------------------------------------------------------------------
-- newsletter_submissions — what goes into an edition
-- ---------------------------------------------------------------------------
--
-- NOTE, recorded rather than corrected: this table has an updated_at column
-- but NO trigger maintaining it, unlike newsletter_editions above. So the
-- value is the insert time forever and reads as a last-modified date that is
-- not one. That is how production is today; a backfill migration is the wrong
-- place to change behaviour, so it is reproduced faithfully and flagged here.

create table if not exists company_os.newsletter_submissions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null
    references company_os.newsletter_editions (id) on delete cascade,
  -- Null for rows the system pulled in rather than a person submitting.
  person_id uuid references company_os.people (id) on delete set null,

  -- Which section of the newsletter. Not a CHECK, same reasoning as status:
  -- SECTION_TYPES in lib/newsletter.ts is the running order of the newsletter
  -- and changing it must stay a one-array edit.
  section_type text not null,
  title text,
  body text,
  link_url text,

  -- Curation. An excluded row stays visible but out of the draft; the training
  -- pull switches rows off when the website stops advertising that session.
  included boolean not null default true,

  -- 'team' | 'events' | 'radar' — where the row came from.
  source text not null default 'team',
  event_id uuid references company_os.events (id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Last for the same reason as training_from above: added later by
  -- docs/db/2026-09-01-newsletter-submission-details.sql, and Postgres appends.
  --
  -- Section-specific extras keyed by SECTION_META[type].fields, so a section
  -- can gain a field without a migration.
  details jsonb not null default '{}'::jsonb
);

-- Stops the same calendar event being materialised into one edition twice.
create unique index if not exists newsletter_submissions_edition_event_idx
  on company_os.newsletter_submissions (edition_id, event_id);

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------
--
-- RLS on with no policies, like every other table in this schema: the
-- service-role client is the boundary, and /admin gates on requireAdmin()
-- while /team gates on requireTeamMember() and a scope allowlist.

alter table company_os.newsletter_editions enable row level security;
alter table company_os.newsletter_submissions enable row level security;

grant select on company_os.newsletter_editions to chatbot_reader;
grant select, insert, update on company_os.newsletter_editions to chatbot_writer;
grant select, insert, update, delete on company_os.newsletter_editions to service_role;

grant select on company_os.newsletter_submissions to chatbot_reader;
grant select, insert, update on company_os.newsletter_submissions to chatbot_writer;
grant select, insert, update, delete on company_os.newsletter_submissions to service_role;
