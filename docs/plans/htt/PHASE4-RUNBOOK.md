# Phase 4 cutover runbook: tracker ingestion now lives in edge8-web

**For:** Dave. **Written:** 2026-08-26.
**Companion PR:** feat(htt): Phase 4, ingestion port + cutover runbook.

This document is the hand-off between what the code already does and what only
you can do (secrets, auth, and deleting the old system). Every step that
creates a secret or deletes something is yours and is marked **[DAVE]**.
Nothing in this runbook has been done for you unless the section says so.

---

## Part A: what the merged code already does (no action needed)

- The whole tracker ingestion pipeline now exists inside edge8-web and writes
  the `htt` schema of the Edge8 Company Database (project `wwchefrgkkxmhlkntufm`):
  - `/api/ingest/session/`: telemetry fan-out (POST, Bearer `INGEST_TRIGGER_SECRET`).
  - `/api/cron/htt-sync-prs/`: nightly PR sync (02:10 UTC).
  - `/api/cron/htt-ingest-effort-logs/`: nightly owner effort-log ingest (03:10 UTC).
  - `/api/cron/htt-refresh-summaries/`: nightly AI summaries and goal metric (04:10 UTC).
  - `/api/cron/htt-ingest-app-tokens/`: app-token ingest (manual only, same as before).
  - `/api/htt/backfill/`: full PR re-fetch or author re-attribution (manual only).
- Two Supabase edge functions are IN THE REPO but not deployed yet:
  `supabase/functions/ingest-session-start` (writes `htt.man_hour_entries`) and
  `supabase/functions/ingest-session-end` (writes `htt.token_entries`).
- Four GitHub workflows exist in edge8-web: `htt-ingest-telemetry` (schedule
  still commented out), `htt-sync-prs`, `htt-regenerate-summary`,
  `htt-reattribute-prs`. All manual until the secrets below exist.
- The three nightly Vercel crons are scheduled the moment the PR merges, but
  each one exits immediately with `skipped: "GH_PAT not configured"` until you
  create `GH_PAT` in Vercel. Nothing errors and nothing writes until then.
- Every hardcoded `human-tokens.com` URL and the default telemetry repo were
  re-pointed in the ported copies: endpoints are `https://www.edge8.ai/...`
  (with a trailing slash, which this site requires), the default telemetry repo
  is `talentedgeai/edge8-web`, and the OpenRouter attribution header says
  edge8.ai. The old tracker repo was not modified.
- A migration file with the htt resolver functions exists but is NOT applied:
  `supabase/migrations/20260826120000_htt_phase4_ingestion.sql` (see Part C).

The pipeline stays dormant until Parts B through E are done. Doing them in
order turns it on with no surprises.

---

## Part B: re-create the secrets **[DAVE]**

Never paste these values into chat, into a file in the repo, or into a
terminal command that gets logged. Use the dashboards.

There are three homes. Three values are SHARED between homes and must match
exactly, so generate them once (a password manager's generator is fine) and
paste the same value in both places:

| Shared value | Must match between |
|---|---|
| `INGEST_SECRET` | Vercel env AND Supabase edge-function secrets |
| `INGEST_TRIGGER_SECRET` | GitHub Actions secrets AND Vercel env |
| `CRON_SECRET` | GitHub Actions secrets AND Vercel env (Vercel already has it; copy the existing value into GitHub, do not mint a new one) |

### B1. Vercel (edge8-web project, Settings -> Environment Variables, Production)

Already present, leave alone: `CRON_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`,
`ANTHROPIC_API_KEY` (if this last one is missing, add it; the summaries cron
skips without it).

Add these:

1. `INGEST_SECRET`: new random value. Shared with the edge functions (B3).
2. `INGEST_TRIGGER_SECRET`: new random value. Shared with GitHub Actions (B2).
3. `GH_PAT`: a GitHub personal access token for the central service account,
   with read access to every tracked client repo. This is the one that was in
   the tracker's Vercel project; create a fresh token rather than moving the
   old one, then revoke the old one in Part E.
4. `GH_PAT_FALLBACK` (optional): the secondary service-account PAT, only if
   you were using one on the tracker.
5. `CENTRAL_EMAIL` (optional): the service account's email. If unset the code
   uses `human-tokens@edge8.co`.

Redeploy (or just let the next push deploy) so the new env vars take effect.

### B2. GitHub (talentedgeai/edge8-web, Settings -> Secrets and variables -> Actions)

Secrets:

1. `CRON_SECRET`: the SAME value as the Vercel `CRON_SECRET`.
2. `INGEST_TRIGGER_SECRET`: the SAME value as the Vercel one from B1.
3. `SUPABASE_URL`: the edge8 Supabase project URL (same value as Vercel's).
4. `SUPABASE_SERVICE_ROLE_KEY`: the edge8 project's service-role key
   (Supabase dashboard -> Settings -> API). Used only by the registrations
   script inside the ingest workflow.

Variables (the "Variables" tab, not secret):

5. `INGEST_URL` = `https://www.edge8.ai`

(`GITHUB_TOKEN` is provided automatically by Actions; nothing to create.)

### B3. Supabase edge-function secrets (edge8 project `wwchefrgkkxmhlkntufm`)

1. `INGEST_SECRET`: the SAME value as the Vercel one from B1. Set it in the
   dashboard (Edge Functions -> Secrets) or from the linked worktree:
   `supabase secrets set INGEST_SECRET=<value>` (typed directly, not from a
   file that gets committed).

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided to edge
functions by the platform; nothing to create.)

That is the full inventory: six values you actually create
(`INGEST_SECRET`, `INGEST_TRIGGER_SECRET`, `GH_PAT`, GitHub's copies of
`CRON_SECRET` / `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`), plus the
`INGEST_URL` variable and the two optional ones. The tracker's `BREVO_API_KEY`
was declared but never referenced in code; do NOT re-create it.

---

## Part C: database and edge functions (one-time, from the linked worktree)

These are safe, additive steps. A developer session can run them for you; they
are listed here so the order is on paper. Run from a worktree that is
`supabase link`ed to the edge8 project (the htt-integration worktree already is).

1. **Apply the resolver migration** (adds three `htt.resolve_*` functions and
   widens one CHECK; touches no data):
   `supabase db query --linked -f supabase/migrations/20260826120000_htt_phase4_ingestion.sql`
2. **Expose the `htt` schema to the API.** ALREADY DONE (2026-08-26): applied
   in-database via `alter role authenticator set pgrst.db_schemas = 'public,
   graphql_public, company_os, htt'` plus `notify pgrst, 'reload config'`, and
   verified serving. Listed here only so the record of the change is on paper;
   if the setting is ever edited from the dashboard, make sure `htt` stays in
   the list.
3. **Deploy the two edge functions** (they authenticate with `x-ingest-secret`,
   not a JWT, so JWT verification must be off):
   `supabase functions deploy ingest-session-start --no-verify-jwt`
   `supabase functions deploy ingest-session-end --no-verify-jwt`
4. Smoke test: POST to each function URL with a wrong `x-ingest-secret` and
   confirm a 401 (not a 500).

---

## Part D: turn the pipeline on

1. **[DAVE or dev]** Create the `telemetry` branch in edge8-web (an empty
   orphan branch). Contributors' telemetry tooling must now push
   `telemetry/**/*.jsonl` and `registrations/*.json` to
   `talentedgeai/edge8-web` instead of the tracker repo; update the client-side
   hook/config on each contributor machine. Vercel will NOT deploy pushes to
   this branch (vercel.json already disables it).
2. **[DAVE]** After B and C are done, enable the schedule: uncomment the
   `schedule:` block in `.github/workflows/htt-ingest-telemetry.yml` (a
   one-line PR any dev session can make once you say go).
3. Verify the loop end to end:
   - `gh workflow run htt-ingest-telemetry.yml` and watch it go green.
   - `gh workflow run htt-sync-prs.yml` and confirm `htt.sync_runs` gets a row
     and `htt.pull_requests` fills for the migrated repos.
   - Next morning, check the three Vercel cron logs: no more
     `GH_PAT not configured` skips.

---

## Part E: retire the standalone tracker **[DAVE, destructive steps]**

Only after Part D has run green for a few days. Nothing here is reversible
without backups, so go top to bottom.

1. **Migrate the dashboard users.** The tracker's own email + password login
   (human-tokens.com) is replaced by the Edge8 portal. For each active tracker
   user (Supabase dashboard of project `znnnxubopsbvpvtvrtne` -> Authentication
   -> Users): confirm the same email exists as a `company_os.people` row linked
   to their company in the edge8 project, and send them an Edge8 portal login
   link (the portal uses magic links tied to `people.auth_user_id`; passwords
   do not migrate and do not need to). Anyone missing gets added through the
   normal portal invite flow first.
2. **Stop the tracker's schedules.** In the tracker's Vercel project: Settings
   -> Cron Jobs -> disable (or merge a tracker PR emptying `crons` in its
   vercel.json). In the tracker repo: disable the four workflows (Actions ->
   each workflow -> Disable workflow).
3. **Delete the tracker's edge functions** (`ingest-session-start`,
   `ingest-session-end`) in the tracker Supabase project, or pause the whole
   project once step 5 is done.
4. **Revoke the old credentials**: the tracker's `GH_PAT` (GitHub -> the
   service account's tokens), and rotate anything from the tracker's Vercel
   env you consider burned.
5. **Take down the login surface.** Point human-tokens.com away from the
   tracker deployment (park it or redirect to edge8.ai) and delete the Vercel
   deployment. Keep the tracker Supabase project PAUSED rather than deleted
   until the Phase 2 data copy has been re-verified once more; deleting the
   project (and its auth users) is the very last step and is permanent.

---

## Quick reference: what runs where after cutover

| Piece | Old home | New home |
|---|---|---|
| Telemetry commits | tracker repo, `telemetry` branch | edge8-web, `telemetry` branch |
| Registration + ingest workflow | tracker `.github/workflows/ingest-telemetry.yml` | edge8-web `htt-ingest-telemetry.yml` |
| Ingest endpoint | human-tokens.com `/api/ingest/session` | edge8.ai `/api/ingest/session/` |
| Session edge functions | tracker Supabase project | edge8 Supabase project (`htt` schema) |
| PR sync cron | tracker Vercel 02:00 | edge8 Vercel 02:10 (`htt-sync-prs`) |
| Effort-log cron | tracker Vercel 03:00 | edge8 Vercel 03:10 (`htt-ingest-effort-logs`) |
| Summaries cron | tracker Vercel 04:00 | edge8 Vercel 04:10 (`htt-refresh-summaries`) |
| Dashboard login | human-tokens.com email+password | Edge8 portal magic link |
