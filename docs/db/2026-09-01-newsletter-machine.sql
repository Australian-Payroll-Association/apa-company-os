-- Newsletter Machine — Phase 1 (Intake).
-- Plan and decisions: docs/product/newsletter-machine.md
--
-- Additive only. Introduces the Edition: the thing the four-stage brainstorm
-- assumes throughout but never names. Stages 2-4 (draft / review / send) are
-- NOT built here — they already exist as marketing_content, email_campaigns
-- and the cron send worker, and get wired to editions in later phases.
--
-- Section types are deliberately NOT a CHECK constraint. The surveys tables set
-- the precedent (see lib/admin/surveys.ts): allowed values live in application
-- code so the list can change without a migration. APA's real newsletter
-- structure is still to be supplied, and swapping it must stay a one-array
-- edit in lib/newsletter.ts, not a schema change.

-- ---------------------------------------------------------------------------
-- 1. newsletter_editions — one row per edition (normally one per month)
-- ---------------------------------------------------------------------------

create table if not exists company_os.newsletter_editions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  period_start date not null,
  period_end date not null,
  deadline_at timestamptz,

  -- open -> closed -> drafting -> in_review -> published (also: cancelled).
  -- Enforced in lib/newsletter.ts, not by a CHECK, for the reason above.
  status text not null default 'open',

  -- Stage 2 hand-off. Set when the edition is drafted into the marketing
  -- calendar; null until then.
  content_id uuid references company_os.marketing_content(id) on delete set null,

  -- Stage 3. Two signatures, in sequence: the second reviewer, then the admin.
  -- Sending stays blocked until both are set. Either may bounce the edition
  -- back to drafting, which clears both and records why in review_notes.
  reviewer_signed_by text,
  reviewer_signed_at timestamptz,
  admin_signed_by text,
  admin_signed_at timestamptz,
  review_notes text,

  opened_by text,
  closed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table company_os.newsletter_editions enable row level security;

-- One open edition at a time. Contributors are shown "the" open edition, so two
-- of them would silently split a month's submissions between two records.
create unique index if not exists newsletter_editions_single_open_idx
  on company_os.newsletter_editions ((status)) where status = 'open';

create index if not exists newsletter_editions_status_idx
  on company_os.newsletter_editions(status, period_start desc);

drop trigger if exists set_newsletter_editions_updated_at on company_os.newsletter_editions;
create trigger set_newsletter_editions_updated_at
  before update on company_os.newsletter_editions
  for each row execute function company_os.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 2. newsletter_submissions — many contributions per edition
-- ---------------------------------------------------------------------------

create table if not exists company_os.newsletter_submissions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null
    references company_os.newsletter_editions(id) on delete cascade,

  -- Who contributed. Null only for rows the system pulled in (source='events').
  person_id uuid references company_os.people(id) on delete set null,

  section_type text not null,
  title text,
  body text,
  link_url text,

  -- Curation is a decision recorded on the row, never a delete: an excluded
  -- item stays visible to the admin and can be brought back.
  included boolean not null default true,

  -- 'team'   — submitted by a person through /team
  -- 'events' — materialised from company_os.events by the auto-pull
  source text not null default 'team',
  event_id uuid references company_os.events(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table company_os.newsletter_submissions enable row level security;

-- Re-running the events auto-pull must update in place, never duplicate.
create unique index if not exists newsletter_submissions_edition_event_idx
  on company_os.newsletter_submissions(edition_id, event_id)
  where event_id is not null;

create index if not exists newsletter_submissions_edition_idx
  on company_os.newsletter_submissions(edition_id, section_type);

create index if not exists newsletter_submissions_person_idx
  on company_os.newsletter_submissions(person_id);

drop trigger if exists set_newsletter_submissions_updated_at on company_os.newsletter_submissions;
create trigger set_newsletter_submissions_updated_at
  before update on company_os.newsletter_submissions
  for each row execute function company_os.handle_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Grants. New tables in this schema do not inherit privileges (no default
--    privileges are set), so the service-role client sees nothing without this.
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on company_os.newsletter_editions to service_role;
grant select, insert, update, delete on company_os.newsletter_submissions to service_role;
