-- 20260719110000_ai_programs.sql
--
-- Portal "AI Programs" section (plan: docs/plans/2026-07-19-clients-page-and-ai-programs.md).
-- Company-scoped: clients who have human tokens or dedicated staff manage AI
-- programs here. Each program holds Program Plans, produced either by uploading
-- documents or by the guided A01 chatbot (which writes a self-contained 5Ds
-- brief into program_plans.brief_html).
--
-- Access follows the rest of the portal: RLS on with NO policies, no browser-key
-- grants; every read/write goes through the service-role client and is scoped in
-- app code to the actor's companyScope (lib/portal/ai-programs.ts).

-- Private bucket for uploaded program documents. Path convention:
--   company/<company_id>/program/<ai_program_id>/<filename>
insert into storage.buckets (id, name, public, file_size_limit)
values ('program-documents', 'program-documents', false, 26214400)  -- 25 MiB
on conflict (id) do nothing;

-- One AI program per client engagement.
create table if not exists company_os.ai_programs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references company_os.companies(id),
  name text not null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'complete')),
  created_by text,               -- portal actor email
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A plan inside a program: either an uploaded-doc marker or a chatbot-produced
-- 5Ds brief. brief_html is null until the chat path assembles and saves it.
create table if not exists company_os.program_plans (
  id uuid primary key default gen_random_uuid(),
  ai_program_id uuid not null references company_os.ai_programs(id) on delete cascade,
  title text not null,
  method text not null
    check (method in ('upload', 'chat')),
  brief_html text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uploaded documents attached to a program (Document Upload path).
create table if not exists company_os.program_documents (
  id uuid primary key default gen_random_uuid(),
  ai_program_id uuid not null references company_os.ai_programs(id) on delete cascade,
  storage_path text not null,    -- object path in the program-documents bucket
  filename text not null,
  size_bytes bigint,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists ai_programs_company_idx on company_os.ai_programs (company_id);
create index if not exists ai_programs_status_idx on company_os.ai_programs (status);
create index if not exists program_plans_program_idx on company_os.program_plans (ai_program_id);
create index if not exists program_documents_program_idx on company_os.program_documents (ai_program_id);

comment on table company_os.ai_programs is
  'Portal AI Programs: company-scoped client AI program records (draft/active/complete).';
comment on table company_os.program_plans is
  'Plans within an AI program: uploaded-doc markers or chatbot-produced 5Ds briefs (brief_html).';
comment on table company_os.program_documents is
  'Documents uploaded to an AI program, stored in the private program-documents bucket.';

-- Service-role-only convention (RLS on, no policies); the app reaches these
-- through the service-role key. New company_os tables need the grant explicitly.
alter table company_os.ai_programs enable row level security;
alter table company_os.program_plans enable row level security;
alter table company_os.program_documents enable row level security;
grant select, insert, update, delete on company_os.ai_programs to service_role;
grant select, insert, update, delete on company_os.program_plans to service_role;
grant select, insert, update, delete on company_os.program_documents to service_role;
