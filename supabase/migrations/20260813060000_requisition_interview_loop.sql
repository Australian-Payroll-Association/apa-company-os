-- The interview loop, defined ONCE per requisition (Dave, 2026-08-13).
--
-- Distinct from application_stages, which is the pipeline every candidate walks
-- (Screen -> Interview -> Offer -> Hired/Rejected, one row per req per stage).
-- A loop step is what "Interview" actually consists of: how many conversations,
-- what each one is for, and who runs it. "The AI Engineer loop is three: a
-- technical with Khoa, a founder with Dave, a culture with Mai."
--
-- Interviewers are people, not team_members, matching job_requisitions
-- .hiring_manager_id and interview_interviewers.interviewer_id. Hiring
-- relationships are row-granted and do not track the org chart: Khoa runs the
-- AI Engineer req without being anyone's manager, the same way a coach need not
-- be a line manager.
--
-- Scheduling stays out of here. A loop step is the intent; company_os.interviews
-- remains the record of a booked conversation, and a later pass links the two.

create table if not exists company_os.requisition_loop_steps (
  id                  uuid primary key default gen_random_uuid(),
  job_requisition_id  uuid not null references company_os.job_requisitions(id) on delete cascade,
  position            integer not null,
  name                text not null check (char_length(name) between 1 and 120),
  duration_minutes    integer check (duration_minutes is null or duration_minutes between 5 and 480),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists requisition_loop_steps_req_idx
  on company_os.requisition_loop_steps (job_requisition_id, position);

create table if not exists company_os.requisition_loop_interviewers (
  id              uuid primary key default gen_random_uuid(),
  loop_step_id    uuid not null references company_os.requisition_loop_steps(id) on delete cascade,
  interviewer_id  uuid not null references company_os.people(id),
  created_at      timestamptz not null default now(),
  unique (loop_step_id, interviewer_id)
);

create index if not exists requisition_loop_interviewers_step_idx
  on company_os.requisition_loop_interviewers (loop_step_id);
-- "which loops am I in" is the /team/hiring query, so index the reverse too.
create index if not exists requisition_loop_interviewers_person_idx
  on company_os.requisition_loop_interviewers (interviewer_id);

alter table company_os.requisition_loop_steps enable row level security;
alter table company_os.requisition_loop_interviewers enable row level security;

grant select, insert, update, delete on company_os.requisition_loop_steps to service_role;
grant select, insert, update, delete on company_os.requisition_loop_interviewers to service_role;
revoke all on company_os.requisition_loop_steps from chatbot_reader, chatbot_writer;
revoke all on company_os.requisition_loop_interviewers from chatbot_reader, chatbot_writer;
