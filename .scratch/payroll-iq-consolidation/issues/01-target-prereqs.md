# 01 — Prepare the target project to receive `payroll_iq`

**What to build:** `nubxrrzwcbhgpvvmbioh` (APA Company OS) can accept a `payroll_iq` schema and
serve it over PostgREST. Nothing of Payroll IQ's is loaded yet — this is the empty slot.

Target project is `nubxrrzwcbhgpvvmbioh`, Sydney, Postgres 17. **Not** `wwchefrgkkxmhlkntufm`,
which is Edge8's internal database; both carry a `company_os` schema so a wrong ref passes every
structural check. Name the ref explicitly in every command.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] `pg_trgm` installed in the `extensions` schema (the other four already exist)
- [ ] `app_security` schema created, `usage` granted to `authenticated` and `service_role`
- [ ] Buckets `blueprints` (private, 25 MB), `e2-module-archives` (private, 5 GB),
      `module-posters` (public, 2 MB) exist with their MIME restrictions
- [ ] `payroll_iq` added to `[api].schemas` in `supabase/config.toml` and pushed — miss this and
      every request fails PGRST106, which psql verification cannot catch
- [ ] `supabase/00-prereqs.sql` updated so a fresh stand-up gets all of the above
- [ ] `payrollIq = supabase.schema("payroll_iq")` exported from `lib/supabase.ts`
- [ ] A REST call against `payroll_iq` with the publishable key returns a schema-exists response,
      not PGRST106
