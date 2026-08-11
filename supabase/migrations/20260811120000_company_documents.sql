-- 20260811120000_company_documents.sql
--
-- Documents belong to the client company; tagging to an AI Program is optional
-- (plan: docs/plans/2026-08-11-client-portal-improvements.md, PR 1).
--
-- program_documents gains a required company_id (backfilled from the owning
-- program), and ai_program_id becomes an optional tag. Deleting a program no
-- longer deletes its documents; they just lose the tag (ON DELETE SET NULL).

alter table company_os.program_documents
  add column if not exists company_id uuid references company_os.companies(id);

update company_os.program_documents d
set company_id = p.company_id
from company_os.ai_programs p
where d.ai_program_id = p.id and d.company_id is null;

alter table company_os.program_documents
  alter column company_id set not null;

alter table company_os.program_documents
  alter column ai_program_id drop not null;

-- Replace the CASCADE program FK with SET NULL: a document outlives its tag.
alter table company_os.program_documents
  drop constraint if exists program_documents_ai_program_id_fkey;
alter table company_os.program_documents
  add constraint program_documents_ai_program_id_fkey
  foreign key (ai_program_id) references company_os.ai_programs(id) on delete set null;

create index if not exists program_documents_company_idx
  on company_os.program_documents (company_id);

comment on table company_os.program_documents is
  'Client documents in the private program-documents bucket, company-owned; ai_program_id is an optional tag.';
