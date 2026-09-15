# Payroll IQ auth migration — verified against code and Supabase docs

Status: **verified findings** — 2026-09-14, target corrected 2026-09-15
Companion to [payroll-iq-consolidation-plan.md](./payroll-iq-consolidation-plan.md), which this
document **corrects in three places**.

> **Target project:** `nubxrrzwcbhgpvvmbioh` (APA Company OS, Sydney, Postgres 17) — *not*
> `wwchefrgkkxmhlkntufm`, which earlier drafts named and which is Edge8's own internal database
> in another organisation. Both projects carry a `company_os` schema, so the mistake survived
> every structural check. Everything below holds either way: the auth mechanics are the same.
> One thing improves — source and target are both Postgres 17, so the dump direction is
> supported (a 17 → 15 restore would not have been). Everything below is backed by a file:line in one of the two
repos or by Supabase's own documentation, not by inference.

---

## 1. The question: can user credentials move?

**Yes. Passwords migrate. Supabase documents this explicitly.**

> "You can migrate all tables in the auth schema — including users and their hashed passwords —
> from one Supabase project to another. This means users do not need to reset or recreate their
> passwords after migration."
> — [Migrating Auth Users Between Supabase Projects](https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects)

**Why it works.** `auth.users.encrypted_password` is a bcrypt hash. A bcrypt string carries its own
algorithm marker, cost factor and salt (`$2a$10$<salt><digest>`). Verifying a password is
`bcrypt.compare(plaintext, hash)` — it uses nothing from the project: no JWT secret, no
project-level pepper, no per-project key. Copy the row, the password still works.

**This matters more here than in a typical migration**, because Payroll IQ is
**password-only**. Verified by exhaustive grep of `website/src`:

| Method | Present? | Evidence |
|---|---|---|
| `signInWithPassword` | **yes — the only login path** | `website/src/lib/auth/actions.ts:66` |
| `signUp` (email+password) | yes | `actions.ts:248`, `lib/invites/accept.ts:256` |
| `signInWithOtp` (magic link) | **no — zero occurrences** | — |
| `signInWithOAuth` | dead code, no importers | `components/auth/OAuthButtons.tsx:30`; removal noted at `SignInForm.tsx:218-220` |
| `admin.createUser` | **only in tests** | `tests/integration/rls-cross-org.spec.ts:193` |

So there is no OAuth identity to re-link and no SSO provider to reconfigure. Move the hash and
every learner signs in exactly as before.

### What genuinely cannot move: live sessions

Users get logged out **once**, and this is unavoidable — not for the reason the Supabase doc
gives, but for a second one that applies even if you work around the first.

1. **JWT secret.** Each project signs tokens with its own secret, so existing access tokens stop
   verifying. The doc notes you *can* copy the old JWT secret into the new project to keep tokens
   valid — but doing that would invalidate every **Company OS** session instead, and regenerates
   the project's anon and service_role keys. Not worth it.
2. **The cookie name is derived from the project ref.** `@supabase/ssr` defaults the auth storage
   key to `sb-<project-ref>-auth-token`, and Payroll IQ sets no custom `storageKey` anywhere
   (verified: zero occurrences of `storageKey`, `cookieOptions`, `flowType` in `website/src`).
   When `NEXT_PUBLIC_SUPABASE_URL` changes, the browser's existing cookie is simply not looked
   for. Even with a shared JWT secret, the session would not be found.

**Net effect for a learner:** one sign-in prompt, their existing password, straight back in. No
reset email, no lost progress.

### Also portable, and must not be forgotten

- `auth.identities` — one `provider='email'` row per user. Copy it. Without it, the account exists
  but has no email identity attached.
- `auth.mfa_factors` — Payroll IQ can *verify* TOTP but has no enrolment path
  (`mfa.enroll` absent; `mfa.verify` at `actions.ts:528`). If any factors exist, they were created
  out of band. Copy them or those users hit the dead end at `actions.ts:515-517`.

---

## 2. Three corrections to the consolidation plan

### Correction 1 — user ids also live inside jsonb, and are read back

The plan said to remap "every column that stores a user id" by generating the list from
`information_schema` foreign keys. **That list is incomplete and would leave a silent bug.**

`payroll_iq.audit_log.detail` is a jsonb blob carrying raw user uuids, and it is not merely
written — it is **queried and compared**:

```
website/src/lib/dashboard/team-actions.ts:339-340
    detail?.target_user_id === targetUserId
```

Written at `lib/auth/actions.ts:355`, `lib/invites/accept.ts:360`,
`lib/admin/user-actions.ts:429,437,601,607,622`, `lib/dashboard/team-actions.ts:444…603`.
Keys involved: `owner_user_id`, `new_user_id`, `target_user_id` (`lib/audit/events/core.ts:19,39,54,59,64`).

Two more jsonb columns can carry ids: `notification_events.detail`
(`…023_notifications.sql:200`) and `hubspot_outbox.payload` (`…027_billing_entitlement.sql:267`).

And one Supabase-managed pair the plan missed entirely: **`storage.objects.owner` and
`storage.objects.owner_id`**, which FK `auth.users(id)`. Every file a signed-in user uploaded to
`blueprints`, `e2-module-archives` or `module-posters` carries their uid.

**Consequence: preserve uids wherever possible.** A remap has to cover 19 FK columns, 3 jsonb
blobs and 2 storage columns. Preserving the uuid costs nothing and skips all of it.

### Correction 2 — the password-reset email template is a genuine conflict

This is the one thing that actually threatens "seamless", and the original plan did not catch it.

A Supabase project has **one** set of auth email templates. The two apps need different ones:

| App | Reset mechanism | Template must contain |
|---|---|---|
| **Payroll IQ** | 6-digit OTP — `verifyOtp({type:'recovery'})` at `website/src/lib/auth/actions.ts:463` | `{{ .Token }}` |
| **Company OS** | token hash in a URL — `app/api/auth/callback/route.ts:75` | `{{ .TokenHash }}` |

Payroll IQ chose OTP deliberately: corporate link scanners prefetch and burn one-time link tokens
(`actions.ts:418-422`). Company OS hit the same problem and solved it differently — it mints the
link server-side with `admin.generateLink()` and sends it through **Resend** to its own
`/verify` interstitial, so a scanner never redeems it (`lib/team/signin-link.ts:4-10,70-88`).

**Recommended fix — adopt the Company OS pattern in Payroll IQ.** Payroll IQ already has Resend
wired for invite emails (`lib/invites/actions.ts:42,477-483`, `lib/email/resend.ts:26`). Move
password reset off Supabase-sent mail:

1. Server action calls `admin.generateLink({ type: 'recovery', email })`.
2. Take `data.properties.email_otp` (or `hashed_token`) from the response.
3. Send it with Resend, in Payroll IQ's own branding.
4. Existing `verifyOtp` code path is unchanged.

This removes the shared-template conflict permanently, gives each product its own branding, and
matches a pattern already proven in this codebase. Without it, one product's users receive
password-reset emails branded for the other, or a single template awkwardly carrying both a code
and a link.

### Correction 3 — the collision set is forced, not optional

`auth.users` has a unique index on email. Two accounts with the same address **cannot** coexist in
one project. So any APA staff member who has both a Company OS login and a Payroll IQ login must
be merged, and one of the two uids must lose.

The plan already chose "Company OS wins". Verified as correct, because of an asymmetry in how the
two apps resolve identity:

| Surface | Keyed on | Evidence |
|---|---|---|
| Company OS `/admin` | **email** | `lib/admin-auth.ts:41-45` — `.from("admins").eq("email", normalized)` |
| Company OS `/team` | **auth uid** | `lib/team-auth.ts:69-74` — `.eq("auth_user_id", authUserId)` |
| Company OS `/portal` | **auth uid** | `lib/portal-auth.ts:174-178` |
| Payroll IQ everything | **auth uid** | `public.users.id` = auth uid, `001_schema.sql:60-61` |

Company OS stores its uid in exactly one place — `company_os.people.auth_user_id`, a single FK
with a unique constraint (`supabase/01-schema.sql:9566`, `:5296`). Payroll IQ's uid is threaded
through 19 FK columns plus jsonb. **Remapping the Company OS side would be one UPDATE; remapping
the Payroll IQ side is the expensive one — so Company OS must win and Payroll IQ's colliding rows
get remapped.** Expect the set to be small, and quite possibly **empty**: the Payroll IQ admins
and the APA Company OS admins are different departments and different staff, so the same person
holding both logins is the exception, not the rule. Run the collision query early: if it returns
nothing, the riskiest part of this migration does not apply at all.

**This report has a second job now.** Under the revised authorisation model (§2.3 of the
consolidation plan), every Payroll IQ admin needs a `company_os.people` row so a grant in
`company_os.app_access` can reference it. The collision report is exactly the input to that
backfill: a Payroll IQ admin whose email already exists in the target's `auth.users` is a person
who probably already has a `people` row, and must be linked rather than duplicated. One whose
email does not appear is a new `people` row with the uid carried over from payroll-iq.

Scale context: Company OS has roughly 85 auth users at most (5 `admins`, 64 `team_members`,
15 `portal_members` per `docs/db/data-dictionary.md:93,157,2058,2067`) — and its own code assumes
this, paging `listUsers({ perPage: 1000 })` in a single call with the comment *"Small org, so one
page is sufficient"* (`lib/admin/admins.ts:29-33`).

---

## 3. Four project-level settings that must match before cutover

A Supabase project has one auth configuration shared by every app merged into it. Verified
requirements from both codebases:

| Setting | Payroll IQ needs | Company OS today | Verdict |
|---|---|---|---|
| **Confirm email** | **OFF** — signUp must return a session so the buyer reaches the session-gated purchase page (`actions.ts:364-369`) | `enable_confirmations = false` (`supabase/config.toml`) | ✅ compatible |
| **Reset-password template** | `{{ .Token }}` | `{{ .TokenHash }}` | ❌ **conflict — see Correction 2** |
| **Redirect allow-list** | `<NEXT_PUBLIC_SITE_URL>/auth/callback` (`actions.ts:255`) | its own list (`config.toml:18-22`) | ➕ add Payroll IQ's domains |
| **JWT signing keys** | asymmetric preferred — `proxy.ts:58` uses `getClaims()`, which only verifies locally with ECC/RSA keys; on the legacy HS256 secret it silently degrades to a network call **per request** across a near-global matcher (`proxy.ts:124-128`) | unknown — check before cutover | ⚠️ verify |

The JWT-key one is a latency regression rather than a breakage, but the matcher covers nearly
every path including the public homepage, so it is worth confirming.

---

## 4. The verified step order

Ordering constraints that are load-bearing, each with its reason:

**Phase 0 — before any downtime**

1. **Get direct Postgres access to Payroll IQ.** It has never had one: no `DATABASE_URL`, no `pg`
   driver, no connection string anywhere in the repo — all DDL was applied over the Supabase MCP.
   Reset the DB password in the dashboard, connect on **5432** (6543 is the transaction pooler and
   cannot do schema work). Use `psql`/`pg_dump` from `libpq` by absolute path — `supabase db dump`
   shells out to Docker and is banned by this repo's CLAUDE.md.
2. **Build the collision list.** Query both projects:
   `select lower(email) from auth.users` on each, intersect. This set determines how much remap
   work exists. If it is empty, no remap is needed at all.
3. **Ship the Resend password-reset change to Payroll IQ** (Correction 2) while it is still on its
   own project, so the template conflict never exists in production.
4. **Pre-copy `e2-module-archives`.** 5 GB object limit, video content. Storage objects do not
   move with a database dump — they copy one at a time through the API, so any of that time
   spent inside the window *is* the downtime. Copy it while payroll-iq is still live and
   re-sync only the delta later; module video barely changes, so the delta should be near zero.
5. **Rehearse on a Supabase branch** of `nubxrrzwcbhgpvvmbioh`. The Payroll IQ migrations end in
   `do $$ … raise exception` post-condition blocks that abort on drift; some assert counts that
   will change in a merged project (`027:440` expects exactly 4 seat tiers, `030:169` asserts no
   unscoped chat policy, `032` asserts `chat.research_enabled` is false). Find out which ones
   break before the real run, not during it.

**Phase 1 — the window**

6. **Announce the downtime and take the site down.** Khoa emails the APA manager; there is no
   in-app maintenance mode and none is being built. Confirm `hubspot_outbox` is drained before
   going down — it is at-least-once delivery state and must not be replayed. Because the site is
   down, no customer writes land in the new database that the old one is missing, which is why
   this plan has no rollback procedure: until the env flip, payroll-iq is still serving its own
   untouched database, so the two are live replicas and aborting costs nothing.
7. **Dump**, in this order: `public` + `app_security` schemas; then the `auth.users` and
   `auth.identities` rows for Payroll IQ's users; then `storage.buckets` rows.
8. **Transform `public` → `payroll_iq`** with a script, not by hand. Safe to do textually because
   every Payroll IQ function is `set search_path = ''` and fully qualifies its references
   (`001_schema.sql:30`). Also: move the Payroll-specific helpers out of `app_security` into
   `payroll_iq`, qualify the unqualified `create table signup_prospects`
   (`010_signup_prospects.sql:21`), retarget the `storage.objects` policies to
   `payroll_iq.is_admin()`, and **drop the schema-wide `anon` revoke**
   (`004_grants.sql:77-80`) — applied project-wide it would break Company OS.
9. **Apply to `nubxrrzwcbhgpvvmbioh`**: `create extension pg_trgm`, `create schema app_security`,
   then the transformed dump with `ON_ERROR_STOP=1`, then the per-schema grants.
10. **Merge auth users.** Insert non-colliding `auth.users` + `auth.identities` **verbatim**, uuid
    and `encrypted_password` preserved. For the collision set only, remap: `auth.users` →
    `payroll_iq.users.id` → the 19 FK columns → the 3 jsonb blobs → `storage.objects.owner`/`owner_id`.
    Generate the column list from `information_schema`, do not hand-type it.
    **Verify zero orphans:** `select count(*) from payroll_iq.users u left join auth.users a on a.id = u.id where a.id is null` must be 0.
    This must land before anyone logs in, because all 31 `auth.uid()` call sites across the RLS
    policies resolve through `payroll_iq.users.id` — a uid that drifted means the user
    authenticates successfully and then sees an empty app.
11. **Expose the schema.** Add `payroll_iq` to `[api].schemas` in `supabase/config.toml` and push.
    Miss this and every request fails `PGRST106`, which **psql verification cannot catch**.
12. **Delta-copy storage**, verify object counts per bucket.
13. **Repoint and redeploy** Payroll IQ: `NEXT_PUBLIC_SUPABASE_URL`, the service key, the anon key,
    plus `.mcp.json`'s hardcoded `project_ref=vgwampgffykiuzsoyevn` — otherwise agent tooling keeps
    writing to the abandoned database.

**Phase 2 — verify before unfreezing**

14. REST call against `payroll_iq` with the publishable key returns RLS-filtered rows (proves
    step 11). Then: a learner signs in **with their existing password**, a quiz attempt saves,
    a manager sees seat usage, a Stripe test webhook writes, one cron runs, and **the Payroll
    IQ `/admin` console still renders for a Payroll IQ admin** — it stays in the Payroll IQ app
    and is never ported. Then the separation check that matters now that one `auth.users` serves
    both apps: Company OS `/admin` still 401s signed out, a **Payroll IQ admin is refused** at
    Company OS `/admin`, and a **Company OS admin is refused** at Payroll IQ `/admin`. One login
    pool is not one permission set.

---

## 5. What is *not* a problem

Worth stating, because each was a plausible worry:

- **Invite links survive.** Payroll IQ mints its own tokens (`crypto.randomBytes(24)`,
  `lib/invites/actions.ts:13`) stored in `invites.token` and mails them via Resend — entirely
  project-independent. Outstanding invites keep working as long as the rows come across.
- **No pgvector, no pg_cron, no edge functions** on the Payroll IQ side. Search is `pg_trgm` plus
  a generated tsvector; scheduling is Vercel Cron in `website/vercel.json`.
- **No custom enums or composite types** in either database — every enumerated field is `text` +
  `CHECK`, so there are no `ALTER TYPE` ordering headaches.
- **`SUPABASE_JWKS_URL`** in `.env.local` hardcodes the old project ref but **nothing reads it**.
  Dead variable.
- **Stripe ids** on `organisations` are tied to the Stripe account, not the Supabase project.
  Nothing to do.
- **`signup_prospects`** is email-keyed with no uuid — migrates trivially.

## 6. One pre-existing bug found along the way

Unrelated to this migration but worth a ticket: Company OS reads a storage bucket named
`documents` at `lib/docs.ts:5,31,55`, but that bucket is **not declared** in
`supabase/00-prereqs.sql` (which declares 10 others). A fresh stand-up of this project silently
breaks document publishing.
