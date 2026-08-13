-- Link a booked interview to the loop step it fulfils.
--
-- company_os.interviews already holds a scheduled conversation (time, mode,
-- interviewers). requisition_loop_steps holds the intent ("a technical with
-- Khoa"). This column is the join: it lets /team/hiring say "your Technical is
-- Thursday 2pm" instead of listing an intent and a time side by side and hoping
-- the reader connects them.
--
-- Nullable on purpose: an interview booked outside the defined loop (an extra
-- round, a re-run) is legitimate and simply has no step.
--
-- lark_event_id is the ingest's idempotency key. The recruiter books in Lark;
-- a scheduled task matches events to candidates and writes rows here. Without
-- a stable key, a re-run would double-book every interview it already wrote.

alter table company_os.interviews
  add column if not exists loop_step_id uuid references company_os.requisition_loop_steps(id) on delete set null,
  add column if not exists lark_event_id text;

create unique index if not exists interviews_lark_event_idx
  on company_os.interviews (lark_event_id)
  where lark_event_id is not null;

create index if not exists interviews_loop_step_idx
  on company_os.interviews (loop_step_id);

-- The ingest writes interviews and their interviewer rows; neither table had a
-- delete grant, and re-running a match needs to replace an interviewer set.
grant select, insert, update, delete on company_os.interviews to service_role;
grant select, insert, update, delete on company_os.interview_interviewers to service_role;
