-- Applied 2026-07-11 via Supabase MCP migration `invoices_customer_mapping`.
-- Extends the QuickBooks invoice sync from the eight portal customers to ALL
-- QBO customers, ahead of the full 2025+2026 backfill
-- (20260711220100_invoices_backfill_2025_2026.sql).

-- 1) customer_name preserves the QBO display name on every invoice (needed for
--    umbrella companies like the Vietnam trip where one company groups many payers).
alter table company_os.invoices add column if not exists customer_name text;

-- 2) New companies for QBO customers with no existing CRM record.
insert into company_os.companies (id, name, lifecycle_stage, notes, metadata) values
  ('3c1f5b2a-9d4e-4f6b-8a2c-1e7d9f0b4c5a', 'Vietnam Group Trip 2026', 'customer',
   'Umbrella record for the 2026 Vietnam group trip - one-off consumer trip revenue billed per participant in QuickBooks. Participant names are kept on each invoice (invoices.customer_name).',
   jsonb_build_object('qbo_customer_ids', jsonb_build_array('207','208','209','210','211','212','213','214','215','216','217'))),
  ('7e2a9c48-5b1d-4e3f-9c6a-2d8b0f4a7e1c', 'Tuan Anh Legal', 'customer',
   'QuickBooks customer "Tuan Anh Legal" (le@tuananh.legal). Kept separate from Dao Nguyen Legal per Dave (2026-07-11).',
   jsonb_build_object('qbo_customer_ids', jsonb_build_array('222'))),
  ('5d9b3e71-2c4a-4b8f-a1e6-9f0c7d2b5a3e', 'Gradion', 'customer',
   'Rich Pham (rich@gradion.com) - software subscription passthrough billing via QuickBooks.',
   jsonb_build_object('qbo_customer_ids', jsonb_build_array('206')));

-- 3) QBO customer -> company mapping for existing CRM companies.
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('1'))
  where id = 'eb5640d1-79b0-4e3d-8d77-6fd853debe09'; -- Vespa Adventures (2024 record; 2025 duplicate f75e1798 left unmapped)
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('12'))
  where id = '34777b3d-d06f-42c2-91ce-0d9775e2bc32'; -- Veracity
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('195'))
  where id = 'd9f2cffa-50a0-4b84-b106-d9e757bbf222'; -- Vee International (billed as "Vee International Inc. dba Blush")
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('17'))
  where id = '2f07b428-be7b-44f5-b107-74cc989faf42'; -- Fab Four Academy
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('171'))
  where id = 'b3993a6d-190c-4bd7-a30e-a5fc83fa17de'; -- Pho 24 (billed as "PHO24 (VN)")
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('183'))
  where id = '957d51d6-0e64-4118-bd40-7ff0deb58012'; -- Kyungbang Vietnam
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('2'))
  where id = '87d0c5ba-54c4-4b9e-8411-3bed518269b6'; -- Surrogate First
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('14'))
  where id = '0eb54647-016d-423d-8568-c73030520dd6'; -- Caram Gems (billed as "Aura International LTD")
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('184'))
  where id = '337499c6-481e-4874-9fcf-0d7e7f6419d0'; -- LIMA TANGO
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('189'))
  where id = '0c9c281c-4b7d-4e74-ba79-0efe0d269caa'; -- Dao Nguyen Legal (billed as "DN Legal (VN)")
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('182'))
  where id = '73a2180e-792b-40d7-9ee7-e7f34462c426'; -- Alchemy
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('198'))
  where id = '5194fe00-0eba-49c1-a063-9688ad205b1d'; -- Visa Solutions
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('191'))
  where id = 'fb26eac7-c557-4ccd-8a4e-80a5742a88bd'; -- Invest Migrate (billed as "Josh Godin")
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('15'))
  where id = '9d769434-700e-4ecb-816e-5f85f79dec2e'; -- Avison Young (billed as "David Jackson")
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('165'))
  where id = '0f40f74f-8d52-49e1-8a45-f6204424750a'; -- Aron Photography (billed as "Aron Schuftan Photography")
update company_os.companies set metadata = metadata || jsonb_build_object('qbo_customer_ids', jsonb_build_array('205','187','190'))
  where id = '7be4752c-c39b-4edc-9b1b-8cf61c4ff867'; -- Entrepreneurs Organization (main + APAC + GBA)
