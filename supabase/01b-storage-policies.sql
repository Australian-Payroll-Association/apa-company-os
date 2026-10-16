-- Payroll IQ storage policies. Apply AFTER 01-schema.sql (they call
-- payroll_iq.is_admin(), which that file creates).
--
-- Hand-maintained, because the schema-scoped pg_dump behind 01-schema.sql does
-- not dump `storage`, and these are the only policies on storage.objects:
-- Company OS reaches Storage through the service-role client and needs none,
-- while Payroll IQ signs and uploads with the user's session. Missing them is
-- not an error anywhere — it is a learner Blueprint download and every admin
-- upload failing quietly, which is what happened from the 2026-09-15 cutover
-- until 2026-10-16.
--
-- Mirror of migration 20261016090000_payroll_iq_storage_policies.sql — change
-- both together. Every policy is scoped by bucket_id.

begin;

drop policy if exists payroll_iq_blueprints_objects_select on storage.objects;
create policy payroll_iq_blueprints_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'blueprints');

drop policy if exists payroll_iq_blueprints_objects_insert on storage.objects;
create policy payroll_iq_blueprints_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'blueprints' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_archives_objects_select on storage.objects;
create policy payroll_iq_module_archives_objects_select on storage.objects
  for select to authenticated
  using (bucket_id = 'e2-module-archives' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_archives_objects_insert on storage.objects;
create policy payroll_iq_module_archives_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'e2-module-archives' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_archives_objects_update on storage.objects;
create policy payroll_iq_module_archives_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'e2-module-archives' and payroll_iq.is_admin())
  with check (bucket_id = 'e2-module-archives' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_posters_objects_select on storage.objects;
create policy payroll_iq_module_posters_objects_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'module-posters');

drop policy if exists payroll_iq_module_posters_objects_insert on storage.objects;
create policy payroll_iq_module_posters_objects_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'module-posters' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_posters_objects_update on storage.objects;
create policy payroll_iq_module_posters_objects_update on storage.objects
  for update to authenticated
  using (bucket_id = 'module-posters' and payroll_iq.is_admin())
  with check (bucket_id = 'module-posters' and payroll_iq.is_admin());

commit;
