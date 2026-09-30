-- payroll_iq: admin-editable email wording (plan 092)
--
-- APA admins edit the wording of Payroll IQ's transactional emails from
-- /admin/emails. The shipped wording stays in code as the default; this table
-- holds only the emails an admin has changed. No row means "send the default",
-- so an empty table is exactly today's behaviour, and "reset to default" is a
-- DELETE.
--
-- Only the words are stored. Layout, logo, colours and link targets stay in
-- code, so an edit cannot break an email or drop its sign-in link.
--
-- Spec: payroll-training-au `.specify/features/092-admin-email-editor/`.

begin;

create table if not exists payroll_iq.email_templates (
  key           text primary key,
  subject       text not null,
  heading       text not null,
  body          text not null,
  button_label  text,
  footnote      text not null default '',
  updated_by    uuid references payroll_iq.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  -- Mirrors the editor's limits so a bad write fails here rather than in an
  -- inbox. The key vocabulary is NOT constrained: which keys exist is a code
  -- fact (lib/email/catalog.ts), and an unknown key is simply never read.
  constraint email_templates_subject_len  check (char_length(subject) between 1 and 150),
  constraint email_templates_heading_len  check (char_length(heading) between 1 and 120),
  constraint email_templates_body_len     check (char_length(body) between 1 and 5000),
  constraint email_templates_button_len   check (button_label is null or char_length(button_label) between 1 and 40),
  constraint email_templates_footnote_len check (char_length(footnote) <= 1000)
);

comment on table payroll_iq.email_templates is
  'Admin-edited wording for Payroll IQ emails, one row per edited email. No row = the default wording shipped in code. Service role only: admin writes go through requireAdmin() server actions, and the senders (crons included) read with the service client.';
comment on column payroll_iq.email_templates.key is
  'Email identifier from website/src/lib/email/catalog.ts, e.g. invite, cycle_day_30.';

-- No policies, by design (the licence_events pattern). RLS on with zero
-- policies means an authenticated client reads nothing even if a future query
-- forgets to go through the gated server action.
alter table payroll_iq.email_templates enable row level security;

grant all on table payroll_iq.email_templates to service_role;

commit;
