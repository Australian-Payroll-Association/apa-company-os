# Operating instructions for this repo

APA Company OS: the Australian Payroll Association's Company OS. It is **live**
(https://apa-company-os.vercel.app), and its Supabase
database is shared with Payroll IQ (the `payroll-training-au` repo), which owns the
`payroll_iq` schema. **All DDL for that database, `payroll_iq` included, lands in this
repo.**

`README.md` is the runbook for building a *new* instance from a bare repo. Do not run it
against this project: do not create Supabase or Vercel projects, and never apply
`supabase/00-prereqs.sql`, `01-schema.sql` or `01b-storage-policies.sql` to the live
database.

## Working here

- Nothing needs Docker: do not use `supabase db dump` or `supabase start`. Use `psql`
  (Homebrew's `libpq` is not on PATH: `/opt/homebrew/opt/libpq/bin/psql`).
- If `npm install` fails on peer dependencies, report the actual error. Do not add
  `--force` or `--legacy-peer-deps` to make it pass.
- Never paste an API key, token or password into a chat or a file, and never ask anyone
  to. Secrets live in Vercel's environment settings or a gitignored `.env.local`
  (`APA_DB_PW` there is what the `scripts/db/` tools read); never commit them.
- If `/admin` renders while signed out, treat it as a security problem and stop rather
  than working around it (`middleware.ts` is the gate).

## Hard rules about the database

- **Forward changes go in `supabase/migrations/`, THEN into the snapshot.** The migration
  is the reviewable unit and the record of intent; the snapshot is the rebuild path.
  Writing only the migration leaves the rebuild broken.
- **`supabase/01-schema.sql` is GENERATED, not hand-written.** Regenerate it with
  `scripts/db/regenerate-schema.sh` after any schema change and commit the result. It
  covers `app_security`, `company_os`, `htt` and `payroll_iq`.
  `scripts/db/check-schema-drift.sh` fails when it falls behind (it exits 0 with a
  message when it has no database password). There is no CI, so run it yourself.
- **`supabase/01b-storage-policies.sql` is hand-maintained:** the `storage.objects`
  policies are not in the schema dump. It mirrors migration
  `20261016090000_payroll_iq_storage_policies.sql`; change both together.
- **Never use `supabase/migrations/` to build a database.** It holds the Payroll IQ
  consolidation and forward changes, not the Company OS schema, so it cannot build this
  database on its own.
- **Never reconstruct missing schema** from `information_schema` queries or by reading
  the application code. Custom types, hundreds of policies, foreign keys, grants and the
  purpose-built Postgres roles do not survive that, and the result fails at runtime in
  ways that are very hard to trace.
- If `supabase/01-schema.sql` is absent, **stop and say so.** Do not improvise a
  substitute.
