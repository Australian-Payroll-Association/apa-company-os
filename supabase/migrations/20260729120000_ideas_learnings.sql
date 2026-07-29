-- Ideas that Spark Solutions: add a second idea kind, 'learning' ("What have I
-- learned?"), alongside the existing build-idea flow ("What should we build?").
-- Learnings are a lighter submission (story + takeaway instead of the four Ds),
-- so the 5D columns become nullable; server-side validation enforces the
-- per-kind required fields. The AI output column (ai_plan) is reused for the
-- learning's polished shareable summary.
-- Applied 2026-07-29 via Supabase MCP migration `ideas_learnings`.

alter table company_os.ideas
  add column kind text not null default 'build'
    check (kind in ('build', 'learning'));

alter table company_os.ideas alter column problem drop not null;
alter table company_os.ideas alter column data_needed drop not null;
alter table company_os.ideas alter column workflow drop not null;
alter table company_os.ideas alter column roi drop not null;

-- Learning fields: what happened, and the lesson the team should take from it.
alter table company_os.ideas add column story text;
alter table company_os.ideas add column takeaway text;

create index if not exists ideas_kind_idx on company_os.ideas(kind);
