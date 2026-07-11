-- Applied 2026-07-11 via Supabase MCP migration `client_portal_crm_cleanup`.
-- Client-portal PR 1 CRM cleanup (confirmed by Dave, 2026-07-11):
-- 1. Wareease is the new name of Qualicious (same company + department, ids kept).
-- 2. Fix the EO company-name typo.
-- 3. Link Tracy Angwin to AustPayroll (contact existed unlinked).
-- 4. Archive the duplicate David Nilssen person row (dave.nilssen@; zero FK references).
-- 5. AustPayroll + Doxa Talent are active AI Program clients -> lifecycle customer.
-- Every id below was verified against the live DB on 2026-07-11.

-- 1. Qualicious -> Wareease
update company_os.companies
   set name = 'Wareease',
       metadata = metadata || jsonb_build_object('renamed_from', 'Qualicious', 'renamed_at', '2026-07-11'),
       updated_at = now()
 where id = '1093fbc0-7d47-4c2c-8f4b-4c55f71b5b24' and name = 'Qualicious';

update company_os.departments
   set name = 'Wareease'
 where id = '5015a415-41ba-4ee1-b696-b48697148a6a' and name = 'Qualicious';

-- 2. EO typo
update company_os.companies
   set name = 'Entrepreneurs Organization', updated_at = now()
 where id = '7be4752c-c39b-4edc-9b1b-8cf61c4ff867' and name = 'Entrepreneurs Organizaztion';

-- 3. Tracy Angwin -> AustPayroll
insert into company_os.person_companies (person_id, company_id, role, is_primary)
select 'e3b19510-bccc-434e-9204-4946d0f8e8d6', '1750a8ca-93ea-4369-aca1-c55553a49073', 'employee', true
 where not exists (
   select 1 from company_os.person_companies
    where person_id = 'e3b19510-bccc-434e-9204-4946d0f8e8d6'
      and company_id = '1750a8ca-93ea-4369-aca1-c55553a49073');

-- 4. Archive the orphan Nilssen duplicate (keeper: david.nilssen@doxatalent.com)
update company_os.people
   set archived_at = now(), archived_by = 'client-portal-pr1', updated_at = now()
 where id = '7a32722d-42f8-42ab-aca0-ca320285c896' and archived_at is null;

-- 5. Lifecycle bumps + transition trail
update company_os.companies
   set lifecycle_stage = 'customer', updated_at = now()
 where id in ('1750a8ca-93ea-4369-aca1-c55553a49073', '8bdd0566-ed10-4c12-82c9-90fd8591b891')
   and lifecycle_stage = 'none';

insert into company_os.lifecycle_transitions (company_id, from_stage, to_stage, reason)
values
  ('1750a8ca-93ea-4369-aca1-c55553a49073', 'none', 'customer', 'client-portal-pr1: active AI Program client'),
  ('8bdd0566-ed10-4c12-82c9-90fd8591b891', 'none', 'customer', 'client-portal-pr1: active AI Program client');

-- Audit trail
insert into company_os.audit_log (actor_label, table_name, record_id, operation, new_data, context)
values
  ('client-portal-pr1', 'companies', '1093fbc0-7d47-4c2c-8f4b-4c55f71b5b24', 'update',
   '{"name":"Wareease"}', '{"action":"rename","from":"Qualicious"}'),
  ('client-portal-pr1', 'companies', '7be4752c-c39b-4edc-9b1b-8cf61c4ff867', 'update',
   '{"name":"Entrepreneurs Organization"}', '{"action":"typo_fix","from":"Entrepreneurs Organizaztion"}'),
  ('client-portal-pr1', 'person_companies', null, 'insert',
   '{"person":"tracy@austpayroll.com.au","company":"AustPayroll"}', '{"action":"link_contact"}'),
  ('client-portal-pr1', 'people', '7a32722d-42f8-42ab-aca0-ca320285c896', 'archive',
   null, '{"action":"duplicate_merge","keeper":"2d819515-3a7d-4342-8ec9-14f2fe84cc8b"}'),
  ('client-portal-pr1', 'companies', '1750a8ca-93ea-4369-aca1-c55553a49073', 'update',
   '{"lifecycle_stage":"customer"}', '{"action":"lifecycle_bump"}'),
  ('client-portal-pr1', 'companies', '8bdd0566-ed10-4c12-82c9-90fd8591b891', 'update',
   '{"lifecycle_stage":"customer"}', '{"action":"lifecycle_bump"}');
