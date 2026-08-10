-- application_stages only had SELECT for service_role while its siblings
-- (applications, job_requisitions) have write grants, so the New req flow
-- (PR #499) could create the req but not seed its pipeline stages
-- ("permission denied for table application_stages"), and deleteJobReq
-- could not remove stages either. Applied to production 2026-08-10; the
-- one stageless req created in the gap was backfilled with the standard
-- 5-stage pipeline.

grant insert, update, delete on company_os.application_stages to service_role;
