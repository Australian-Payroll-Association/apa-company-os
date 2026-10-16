-- payroll_iq: restore the storage.objects policies lost in the cutover
--
-- Production `storage.objects` has RLS enabled and ZERO policies (verified
-- 2026-10-16 with pg_policies). Before the move to APA Company OS, the
-- Payroll IQ project created bucket-scoped policies in its own migrations
-- (payroll-training-au `website/supabase/migrations/005_blueprints_bucket.sql`
-- and `020_module_storage_buckets.sql`). The cutover copied the buckets and
-- their objects but not those policies, so every Storage call Payroll IQ makes
-- with a USER session is refused:
--
--   * learner Blueprint download (signed URL)        -> blueprints, select
--   * admin Blueprint upload (signed PUT + info)     -> blueprints, insert/select
--   * admin module poster upload (signed PUT, upsert)-> module-posters, insert/select/update
--   * admin module archive upload + download          -> e2-module-archives, insert/select/update
--
-- Company OS needs nothing here: every Storage call it makes goes through the
-- service-role client (lib/supabase.ts, SUPABASE_SECRET_KEY), which bypasses
-- RLS. HTT runs on a different Supabase project.
--
-- This restores the pre-cutover rules verbatim, with two translations:
--   * `app_security.is_admin()` -> `payroll_iq.is_admin()`
--     (= app_security.has_app_role('payroll_iq', 'admin'); SECURITY DEFINER,
--     executable by `authenticated`).
--   * names gain a `payroll_iq_` prefix, because storage.objects is shared
--     by every app on this database.
--
-- Every policy is scoped by `bucket_id`, so nothing here widens access to any
-- other app's bucket. No DELETE policy, exactly as before: Blueprints are
-- append-only (date-versioned), and archives/posters are never removed by a
-- user session.
--
-- Bucket rows (public flag, size limit, MIME types) survived the cutover
-- unchanged and are not touched.

begin;

-- ---------------------------------------------------------------------------
-- blueprints (private) — any signed-in user reads; only an admin uploads.
-- Uploads use `upsert: false`, so no UPDATE policy: an overwrite is refused.
-- ---------------------------------------------------------------------------

drop policy if exists payroll_iq_blueprints_objects_select on storage.objects;
create policy payroll_iq_blueprints_objects_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'blueprints');

drop policy if exists payroll_iq_blueprints_objects_insert on storage.objects;
create policy payroll_iq_blueprints_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'blueprints' and payroll_iq.is_admin());

-- ---------------------------------------------------------------------------
-- e2-module-archives (private) — admin only, all three operations.
-- Uploads use `upsert: true`, which needs SELECT + INSERT + UPDATE.
-- Learner playback signs through the service client, not this policy.
-- ---------------------------------------------------------------------------

drop policy if exists payroll_iq_module_archives_objects_select on storage.objects;
create policy payroll_iq_module_archives_objects_select
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'e2-module-archives' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_archives_objects_insert on storage.objects;
create policy payroll_iq_module_archives_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'e2-module-archives' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_archives_objects_update on storage.objects;
create policy payroll_iq_module_archives_objects_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'e2-module-archives' and payroll_iq.is_admin())
  with check (bucket_id = 'e2-module-archives' and payroll_iq.is_admin());

-- ---------------------------------------------------------------------------
-- module-posters (public bucket) — anyone reads; only an admin writes.
-- Public URLs work without the SELECT policy; it is restored because the
-- upsert upload path needs SELECT, and it is what existed before.
-- ---------------------------------------------------------------------------

drop policy if exists payroll_iq_module_posters_objects_select on storage.objects;
create policy payroll_iq_module_posters_objects_select
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'module-posters');

drop policy if exists payroll_iq_module_posters_objects_insert on storage.objects;
create policy payroll_iq_module_posters_objects_insert
  on storage.objects
  for insert
  to authenticated
  with check (bucket_id = 'module-posters' and payroll_iq.is_admin());

drop policy if exists payroll_iq_module_posters_objects_update on storage.objects;
create policy payroll_iq_module_posters_objects_update
  on storage.objects
  for update
  to authenticated
  using (bucket_id = 'module-posters' and payroll_iq.is_admin())
  with check (bucket_id = 'module-posters' and payroll_iq.is_admin());

commit;
