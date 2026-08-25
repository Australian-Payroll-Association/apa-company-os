# Phase 4 Cutover Inventory: Human Token Tracker telemetry ingestion → edge8

Recon of `human-token-tracker` (repo root `/Users/infinite-leverage/code-projects/human-token-tracker`).
App lives in the `website/` subdir; **GitHub workflows live at the repo ROOT** (`.github/workflows/`),
outside `website/`. Read-only. Secret NAMES only below, never values.

---

## 0. End-to-end telemetry data flow (how the pieces connect)

```
Contributor commits telemetry/**/*.jsonl + registrations/*.json to the `telemetry` branch
        │
        ▼  (GitHub Actions: ingest-telemetry.yml, currently workflow_dispatch only; cron commented out)
process-registrations.mjs   → creates projects/aliases directly in Supabase (SERVICE ROLE)
ingest-telemetry.mjs        → git-diff since tag `telemetry-ingested`, batch(25),
                              POST ${INGEST_URL}/api/ingest/session   (Bearer INGEST_TRIGGER_SECRET)
        │
        ▼  (Vercel, Next.js route)
/api/ingest/session         → auth Bearer==INGEST_TRIGGER_SECRET, resolve project,
                              fan-out POST ${SUPABASE_URL}/functions/v1/ingest-session-start
                                          ${SUPABASE_URL}/functions/v1/ingest-session-end
                              header x-ingest-secret: INGEST_SECRET; then relink tokens→PRs; write sync_runs
        │
        ▼  (Supabase edge functions, Deno)
ingest-session-start        → auth x-ingest-secret==INGEST_SECRET, write man_hour_entries (SERVICE ROLE)
ingest-session-end          → auth x-ingest-secret==INGEST_SECRET, write token_entries   (SERVICE ROLE)
```

Separately, Vercel **crons** hit `/api/cron/*` and manual **workflows** curl `https://human-tokens.com/api/...`.

---

## 1. Supabase edge functions (`website/supabase/functions/`)

Both are `Deno.serve` HTTP handlers, **POST-only**, authenticated by header
`x-ingest-secret` compared to `Deno.env.get('INGEST_SECRET')` (401 otherwise).
Neither is cron/scheduled and neither is invoked from GitHub directly, **both are called
only by the Next.js route `/api/ingest/session`** (server-to-server). Both build a Supabase
client from `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (service role → **bypasses RLS**).

Env/secrets read by BOTH (names only): `INGEST_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

- **ingest-session-start** (`ingest-session-start/index.ts`), writes **man-hour** rows.
  Excludes client/owner identities (`client_identities` by git_email/github_login), resolves
  contributor (`team_members` by user_id, or `resolve_contributor` RPC by email). Idempotent
  merge on (team_member_id, project_id, occurred_on) into `man_hour_entries` (source
  `auto_session`); takes GREATEST hours, replaces prior rows. Validates occurred_hour 0–23.

- **ingest-session-end** (`ingest-session-end/index.ts`), writes **token** rows.
  Same exclude/resolve logic. Upserts `token_entries` rows (kind `human` and/or `claude`)
  with onConflict `session_id,kind` (claude) or `team_member_id,project_id,occurred_on,kind`
  (human). Rejects rows with no idempotency key. VALID_SOURCES = pr_commit, pr_review,
  planning, design, research, manual, session.

No shared module, each function is a single self-contained `index.ts` (imports
`jsr:@supabase/supabase-js@2`).

---

## 2. Next.js API routes (`website/src/app/api/`)

All server-side; DB access via `createAdminClient()` (`src/lib/supabase/admin.ts`) which uses
`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (**service role → bypasses RLS**).
GitHub via `src/lib/github/client.ts` (`GH_PAT`, optional `GH_PAT_FALLBACK`, `CENTRAL_EMAIL`).

| Route | Trigger / auth | What it does | Env/secrets | External calls |
|---|---|---|---|---|
| `api/ingest/session/route.ts` | POST, `Authorization: Bearer INGEST_TRIGGER_SECRET`. maxDuration 300 | Per entry: verify committer, resolve project, POST to the 2 edge fns; relink tokens→PRs; insert `sync_runs` | `INGEST_TRIGGER_SECRET`, `INGEST_SECRET`, `SUPABASE_URL`(→`NEXT_PUBLIC_SUPABASE_URL` fallback), `SUPABASE_SERVICE_ROLE_KEY` | Supabase edge fns (`${SUPABASE_URL}/functions/v1/...`), Supabase DB |
| `api/cron/sync-prs/route.ts` | GET (Vercel cron 02:00 UTC) / POST alias, `Bearer CRON_SECRET`. maxDuration 300 | Fetch updated PRs per project, `upsertPRs`, mirror repo homepage→`projects.live_url`, write `sync_runs` | `CRON_SECRET`, `GH_PAT`(+`GH_PAT_FALLBACK`), service-role Supabase | **GitHub API** (Octokit), Supabase |
| `api/cron/ingest-effort-logs/route.ts` | GET (Vercel cron 03:00 UTC) / POST alias, `Bearer CRON_SECRET`. maxDuration 300 | Read each repo's committed `.claude/project.json` `effort_log`; OWNER-ONLY entries → `token_entries` (idempotent by session_id) | `CRON_SECRET`, `GH_PAT`, service-role Supabase | **GitHub API** (getContent), Supabase |
| `api/cron/refresh-summaries/route.ts` | GET (Vercel cron 04:00 UTC) `Bearer CRON_SECRET`; POST = force one project (also `Bearer CRON_SECRET`). maxDuration 300 | AI regen of project executive/digest summaries + goal metric; GenerationBudget circuit breaker | `CRON_SECRET`, `ANTHROPIC_API_KEY`, service-role Supabase | **Anthropic API** (SDK) **or OpenRouter** (see §4), Supabase |
| `api/cron/ingest-app-tokens/route.ts` | GET, `Bearer CRON_SECRET`. maxDuration 300. **NOT scheduled in vercel.json, route exists, no cron entry** (manual/dispatch only) | Read each repo's `.claude/project.json` `app_tokens` → upsert `token_entries` (kind app) | `CRON_SECRET`, `GH_PAT`, service-role Supabase | **GitHub API**, Supabase |
| `api/sync/backfill/route.ts` | POST, `Bearer CRON_SECRET`. maxDuration 300 | `mode:full` re-fetch all PRs for one project; `mode:reattribute` re-run author resolution over stored rows (no GitHub calls, dry-run default) | `CRON_SECRET`, `GH_PAT`, service-role Supabase | **GitHub API** (full mode only), Supabase |
| `api/projects/status/route.ts` | GET `?repo=` (public, no auth) | Lookup `projects` by github_repo → `{registered, status, name}` (registration probe endpoint) | service-role Supabase | Supabase |
| `api/survey/submit/route.ts` | POST (public, per-token in-proc rate limit) | Write NPS-style survey response | service-role Supabase | Supabase |
| `api/contributors/route.ts`, `api/contributors/[login]/route.ts` | GET | Read contributor data (dashboard reads) | Supabase | Supabase |

**Helper scripts** (`website/scripts/`, run by the ingest workflow, not Vercel routes):
- `ingest-telemetry.mjs`, git-diffs the `telemetry` branch, POSTs batches to `${INGEST_URL}/api/ingest/session`. Env: `INGEST_URL`, `INGEST_TRIGGER_SECRET`, `GH_TOKEN` (for `gh api` committer resolution + `git push` tag), `GITHUB_REPOSITORY`. Uses `gh` CLI + git.
- `process-registrations.mjs`, reads `registrations/` on `telemetry` branch, creates projects/aliases. Env: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_REPOSITORY`, `GH_TOKEN`.

---

## 3. GitHub workflows (`.github/workflows/`: at REPO ROOT, not in website/)

Four workflows; **all `workflow_dispatch`** (no active `schedule` anywhere, the ingest cron is
commented out). The three "call the endpoint" ones curl the LIVE prod host `https://human-tokens.com`.

| Workflow | Trigger | Secrets/vars referenced | POSTs to |
|---|---|---|---|
| `ingest-telemetry.yml` | workflow_dispatch (schedule `0 1,13 * * *` **commented out / disabled**) | `secrets.SUPABASE_URL`, `secrets.SUPABASE_SERVICE_ROLE_KEY`, `secrets.INGEST_TRIGGER_SECRET`, `secrets.GITHUB_TOKEN` (as `GH_TOKEN`), `vars.INGEST_URL`, `github.repository` | Runs `process-registrations.mjs` then `ingest-telemetry.mjs`; the script POSTs `${INGEST_URL}/api/ingest/session` |
| `sync-prs.yml` | workflow_dispatch | `secrets.CRON_SECRET` | `POST https://human-tokens.com/api/cron/sync-prs` |
| `regenerate-summary.yml` | workflow_dispatch (inputs client, project) | `secrets.CRON_SECRET` | `POST https://human-tokens.com/api/cron/refresh-summaries` |
| `reattribute-prs.yml` | workflow_dispatch (inputs project_id, dry_run, confirm) | `secrets.CRON_SECRET` | `POST https://human-tokens.com/api/sync/backfill` |

**Vercel crons** (`website/vercel.json`), the actual scheduled telemetry/summary pipeline:
- `/api/cron/sync-prs`, `0 2 * * *`
- `/api/cron/ingest-effort-logs`, `0 3 * * *`
- `/api/cron/refresh-summaries`, `0 4 * * *`
- (`ingest-app-tokens` has NO cron entry.)
`vercel.json` also sets `git.deploymentEnabled.telemetry: false` → disables Vercel deploys for the `telemetry` branch.

---

## 4. Hardcoded hostnames / URLs / repo refs to repoint (file:line)

**Functional, MUST repoint for Phase 4:**
- `.github/workflows/sync-prs.yml:40` → `https://human-tokens.com/api/cron/sync-prs`
- `.github/workflows/regenerate-summary.yml:37` → `https://human-tokens.com/api/cron/refresh-summaries`
- `.github/workflows/reattribute-prs.yml:83` → `https://human-tokens.com/api/sync/backfill`
- `website/src/lib/ai/summarize.ts:101` → `"HTTP-Referer": "https://human-tokens.com"` (OpenRouter attribution header)
- `website/scripts/ingest-telemetry.mjs:19` → `REPO = process.env.GITHUB_REPOSITORY ?? 'talentedgeai/human-token-tracker'` (DEFAULT telemetry repo)
- `website/scripts/process-registrations.mjs:212` → `REPO = ... ?? 'talentedgeai/human-token-tracker'` (DEFAULT telemetry repo)
- `website/src/lib/github/client.ts:56` → `CENTRAL_EMAIL ?? 'human-tokens@edge8.co'` (fallback service-account email)
- `website/src/lib/github/client.ts:41` (comment) → `get@human-tokens.com` fallback-account reference

**`telemetry` branch / watermark references:**
- `website/scripts/ingest-telemetry.mjs:17` → `const BRANCH = 'telemetry'`; `:18` → `const TAG = 'telemetry-ingested'`
- `website/scripts/process-registrations.mjs:211` → `const BRANCH = 'telemetry'`
- `website/vercel.json` → `git.deploymentEnabled.telemetry: false`

**Runtime endpoints derived from env (not hardcoded, but repoint the ENV, not code):**
- `website/src/app/api/ingest/session/route.ts:16` → `${SUPABASE_URL ?? NEXT_PUBLIC_SUPABASE_URL}/functions/v1` (edge-fn host = Supabase project URL)
- `website/scripts/ingest-telemetry.mjs:31` → `INGEST_URL` (base host for the ingest POST; set via `vars.INGEST_URL`)

**Display-only / docs (cosmetic, low priority):**
- `website/src/components/pipeline/diagrams/DiagramL1BigPicture.tsx:22` → label text `"human-tokens.com"`
- Numerous `docs/**` and `agents/**` mentions of `human-tokens.com` / `get@human-tokens.com` (non-code)

**No hardcoded `*.supabase.co` URL in production code**, only a test:
`website/src/lib/auth/__tests__/internalApiGuard.test.ts:28` (`https://proj.supabase.co`).
**No hardcoded Supabase project ref** found anywhere. The Supabase project is referenced
entirely through env (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`).

---

## 5. Complete secret-name inventory Phase 4 must re-create in edge8 (grouped by home)

### A. GitHub Actions: repository SECRETS (`secrets.*`)
- `CRON_SECRET`  (sync-prs, regenerate-summary, reattribute-prs)
- `INGEST_TRIGGER_SECRET`  (ingest-telemetry)
- `SUPABASE_URL`  (ingest-telemetry → process-registrations)
- `SUPABASE_SERVICE_ROLE_KEY`  (ingest-telemetry → process-registrations)
- `GITHUB_TOKEN`  (auto-provided by Actions; consumed as `GH_TOKEN`, no manual creation, but note the dependency)

### B. GitHub Actions: repository VARIABLES (`vars.*`, non-secret)
- `INGEST_URL`  (ingest-telemetry), the production base URL to POST telemetry into

### C. Supabase edge-function secrets (`Deno.env`, set via `supabase secrets set`)
- `INGEST_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
  (`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are auto-populated for edge functions by the platform,
   but the shared `INGEST_SECRET` is the one that MUST be created and MUST match the Vercel `INGEST_SECRET`.)

### D. Vercel env (Next.js app, `process.env.*`)
Required for ingestion/cron:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`  (used to build the edge-fn base; falls back to `NEXT_PUBLIC_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `INGEST_SECRET`  (Vercel→edge-fn shared secret; must match §C)
- `INGEST_TRIGGER_SECRET`  (auth for inbound `/api/ingest/session`; must match §A)
- `CRON_SECRET`  (auth for all `/api/cron/*` + `/api/sync/backfill`)
- `GH_PAT`  (GitHub service-account PAT, reads every client repo)
- `GH_PAT_FALLBACK`  (optional secondary PAT)
- `CENTRAL_EMAIL`  (optional; defaults to `human-tokens@edge8.co`)
- `ANTHROPIC_API_KEY`  (Anthropic key **or** OpenRouter key `sk-or-...`, provider auto-detected by prefix)
Also present (app/email/SEO, adjacent surface):
- `RESEND_API_KEY`, `EMAIL_FROM`  (transactional email via Resend, `src/lib/notifications/email.ts`)
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`  (robots/sitemap/invitation links)
- `BREVO_API_KEY`  (declared in `.env.example` + `.env.local` but **NOT referenced anywhere in code**, likely dead/legacy; confirm before re-creating)
- `NODE_ENV`  (framework-provided)

### Cross-home shared-value constraints (must match across homes)
- `INGEST_SECRET`, same value in Vercel (§D) AND Supabase edge fns (§C).
- `INGEST_TRIGGER_SECRET`, same value in GitHub Actions (§A) AND Vercel (§D).
- `CRON_SECRET`, same value in GitHub Actions (§A) AND Vercel (§D).
- `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_URL`, same project across all three homes.

---

## 6. Tracker's own Supabase Auth (the standalone login to retire) + RLS/`auth.uid()`

**Standalone login surface (to be retired in cutover):**
- `website/src/app/login/LoginScreen.tsx:76-77`, `createBrowserClient()` + `supabase.auth.signInWithPassword` (email/password).
- Password flows: `src/app/forgot-password/page.tsx`, `src/app/reset-password/page.tsx`,
  `src/app/auth/callback/route.ts` (`verifyOtp` + `exchangeCodeForSession`).
- Session resolution: `src/lib/auth/session.ts` (`auth.getUser()`, `auth.getClaims()`);
  SSR cookie session via `@supabase/ssr` (`src/lib/supabase/client.ts` browser,
  `src/lib/supabase/server.ts` server with `cookies()`), using
  `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- This login gates the **dashboard/admin READ surface only** (authenticated role).

**RLS / `auth.uid()`, where it is referenced (READ path, not ingestion):**
- `supabase/migrations/20260605000009_rls_policies.sql`:
  - Enables RLS on `token_entries` (:37) and `man_hour_entries` (:40) (plus clients, team_members, projects, pull_requests, roi_actuals, scenarios).
  - Policies are keyed on `auth.uid()` via SECURITY DEFINER helpers `current_user_client_ids()` (:11) and `current_user_is_internal()` (:26); `team_members_select` also uses `auth.uid()` directly (:52).
  - `token_entries_rw` (:63) and `man_hours_rw` (:67) restrict the **authenticated** (logged-in dashboard user) role to their own client's rows.

**Ingestion does NOT depend on user JWT / `auth.uid()`, already service-role (good for cutover):**
- Both edge functions build the client with `SUPABASE_SERVICE_ROLE_KEY` → bypass RLS.
- Every server route/script writes via `createAdminClient()` / service-role `createClient` → bypass RLS.
- Therefore retiring the standalone Supabase Auth login does **not** break ingestion writes; only the
  authenticated dashboard READ policies (which lean on `auth.uid()`) are tied to that login. In edge8,
  the read surface's auth/RLS must be re-homed to edge8's identity, but the ingestion write path is
  already auth-independent (service role + `INGEST_SECRET`/`CRON_SECRET`/`INGEST_TRIGGER_SECRET` bearer checks).

---

## Gotchas / notes for the cutover
- Workflows live at the **repo root** `.github/workflows/`, NOT under `website/`, easy to miss when scoping "the website".
- The scheduled telemetry pipeline is the **Vercel crons** in `website/vercel.json`, not GitHub schedule (the GH ingest cron is commented out; all 4 workflows are manual `workflow_dispatch`).
- `ingest-app-tokens` route exists but is **unscheduled** (no cron / no workflow), invoke manually or add a schedule if it must run in edge8.
- `ANTHROPIC_API_KEY` is dual-purpose: an `sk-or-...` prefix routes to **OpenRouter** (`https://openrouter.ai/api/v1/chat/completions`), otherwise the **Anthropic API** directly. Model `claude-opus-4-8` / `anthropic/claude-opus-4.8`.
- `BREVO_API_KEY` is declared in env files but unused in code, confirm before re-creating it in edge8.
- Three secrets are shared across homes and MUST match: `INGEST_SECRET` (Vercel↔edge-fn), `INGEST_TRIGGER_SECRET` (Actions↔Vercel), `CRON_SECRET` (Actions↔Vercel).
