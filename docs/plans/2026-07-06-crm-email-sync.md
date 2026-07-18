# CRM Email Sync - Design + Runbook

Date: 2026-07-06
Status: Spec drafted, NOT started. Blocked on admin credentials (Google + Lark). Build begins after Dave provisions access (planned when home).

## Locked decisions (2026-07-06)

1. **Automatic sync, not a manual composer.** Emails land in the CRM on their own, no paste-in step.
2. **Both providers.** Google Workspace for `edge8.co` (Gmail API) and Lark Mail for `edge8.ai` (Lark Mail API). Built together, sharing one core.
3. **Inbound + sent.** Capture both received and sent mail so the CRM shows the full back-and-forth.
4. **Dave's mailboxes for v1.** `dave@edge8.co` and `dave@edge8.ai`. Whole-team capture is a later expansion (add rows to `mailbox_accounts`).
5. **Known contacts only.** A message is filed only when the external party matches an existing CRM contact (`company_os.people.email`) or a known client company domain. Internal-only and personal email is dropped and never stored. This is the privacy guarantee.

## Goal

Every client email Dave sends or receives shows up automatically on the matching contact and deal in the CRM, with zero manual logging, and without ingesting internal or personal mail.

## Where it lands (mostly already built)

`company_os.interactions` is the sink. It already supports `kind='email'`, links to `person_id` / `company_id`, and has a polymorphic `subject_type` / `subject_id` for attaching to a deal. The **contact 360 page already renders interactions** in an activity timeline (`lib/admin/contacts.ts` -> `getPerson360`), so inbound/outbound emails appear on the contact with no UI work. The only new UI is a read-only messages section on the **deal drawer** (`DealsBoard.tsx`), which does not show interactions today.

Reference: Ian Vaughan's inbound email (2026-07-06) is already stored this way as a manual proof of concept.

## Architecture

A provider-agnostic core with two thin adapters:

```
Gmail adapter  ─┐
                ├─> normalize -> known-contacts filter -> dedup -> write interaction -> attach to contact + open deal
Lark adapter  ─┘
```

- **Adapters** talk to each provider's API and emit a common `NormalizedMessage` (message_id, from, to[], cc[], subject, body_text, sent_at, mailbox_owner, direction).
- **Normalize** collapses provider quirks into that shape.
- **Known-contacts filter** decides file-or-drop (see below).
- **Dedup** skips messages already stored (by RFC 822 Message-ID).
- **Writer** inserts one `interactions` row and links it.

## Data model

### New table: `company_os.mailbox_accounts`

Holds the mailboxes we sync and their sync state. Tokens/keys encrypted at rest, never in code or git.

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `provider` | text | `gmail` or `lark` |
| `email` | citext | the mailbox address (e.g. `dave@edge8.co`) |
| `owner_person_id` | uuid | FK -> people (the team member who owns it) |
| `sync_cursor` | text | Gmail `historyId` / Lark page or watermark |
| `watch_expires_at` | timestamptz | Gmail `watch()` expiry, for cron renewal |
| `status` | text | `active` / `paused` / `error` |
| `last_synced_at` | timestamptz | |
| `secret_ref` | text | pointer to the encrypted token (Supabase Vault), not the token itself |
| `created_at` / `updated_at` | timestamptz | |

Grant note: new `company_os` tables need explicit `service_role` grants or the app cannot read them (see prior CRM migrations). The app uses the service-role client only; this table is never client-exposed.

### `interactions` additions (for sync)

- Add `external_id text` = the RFC 822 Message-ID. Add a partial unique index `(external_id) where external_id is not null` for idempotent dedup. Because a Message-ID is globally unique, re-runs and cross-mailbox duplicates collapse to one row.
- `direction` (`inbound` / `outbound`) stored in `metadata` (`{"direction":"outbound","provider":"gmail","mailbox":"dave@edge8.co"}`) to avoid a schema change, unless we later want to filter on it in SQL, in which case promote to a column.

The schema SQL will live at `docs/db/2026-07-06-crm-email-sync.sql` when built.

## Filing logic (known contacts only)

For each normalized message:

1. **Compute the counterparty set:** every From/To/Cc address minus Dave's own addresses and internal domains (`@edge8.co`, `@edge8.ai`).
2. **Match:** for each counterparty, look for a `people.email` match; if none, match the address domain to a `companies.domain`.
3. **Decision:**
   - At least one counterparty matches a contact or client domain -> **file** the message against that contact (and company).
   - No match -> **drop** (do not store). This removes internal-only and personal mail.
4. **Direction:** mailbox owner is in `From` -> `outbound`; owner is in `To`/`Cc` -> `inbound`.
5. **Attach to a deal:** if the matched contact has exactly one open deal, set `subject_type='deal'`, `subject_id=<deal id>`. If several open deals, link the contact only (leave deal attachment to a human).
6. **Dedup:** skip if `external_id` already exists.
7. **Write:** insert `interactions` row (`kind='email'`, subject, `body`, `person_id`, `company_id`, `occurred_at=sent_at`, metadata as above).

Body: store `text/plain`. Keep full text for v1; quoted-history stripping and HTML-to-text cleanup are a later polish.

## Sync mechanics

### Gmail (`edge8.co`)

- **Auth:** a Google Cloud service account with **domain-wide delegation**, impersonating the mailbox (`subject=dave@edge8.co`), scope `https://www.googleapis.com/auth/gmail.readonly`. Server-side only, no per-user OAuth screen.
- **Incremental:** `users.watch()` registers a Pub/Sub push topic; new mail pings our webhook, which calls `users.history.list` from the stored `historyId`, then `users.messages.get` for content. Covers INBOX + SENT.
- **Renewal:** `watch()` expires within 7 days; a Vercel cron renews it and stores the new `historyId`.
- **Fallback:** if Pub/Sub is not wired, a cron polls `messages.list` on a `newer_than` window.

### Lark Mail (`edge8.ai`)

- **Auth:** a Lark custom app with scope `mail:user_mailbox`, admin-approved; app id/secret exchanged for a tenant/user access token.
- **Read:** `mail-v1` `user_mailbox/message` list + get endpoints, over the Sent and inbox folders.
- **Incremental:** use Lark's mail event subscription if available for the mailbox; otherwise a Vercel cron polls the message list against a stored watermark.
- Confirmed feasible: the Mail API exposes user-mailbox message read under the `mail:user_mailbox` scope. Exact list/paging endpoints to be pinned during the Phase 2 spike.

### Shared infra

- One Vercel cron entry drives periodic polling + Gmail `watch()` renewal (crons already exist in `vercel.json`).
- Webhook routes under `app/api/` (Next.js route handlers, same pattern as `app/api/contact/route.ts`), each secret-verified (Pub/Sub JWT for Google, verification token + signature for Lark).

## Security + privacy

- Mailbox tokens live in Supabase Vault (or app-level AES), referenced by `secret_ref`. Never in code, logs, or git.
- Webhooks reject unverified callers.
- The known-contacts filter is the hard privacy boundary: internal and personal mail is never written to the database.
- All DB access is service-role, server-side. No mailbox data reaches the browser except the filtered interactions already shown in the admin.

## UI

- **Contact 360:** no change needed. Emails appear in the existing activity timeline. Nice-to-have: an inbound/outbound arrow and an email icon per row.
- **Deal drawer (`DealsBoard.tsx`):** add a read-only "Messages" section listing interactions attached to the deal (and its contact), newest first, subject + snippet + date + direction. Read-only; capture stays automatic.

## Build plan (phased, after credentials exist)

- **Phase 0 - core (no credentials needed).** `mailbox_accounts` + `interactions.external_id` migration; `NormalizedMessage` type; known-contacts filter; deduped writer; deal-drawer messages view. Fully testable with fixtures.
- **Phase 1 - Gmail adapter.** Service-account client, `watch()` + Pub/Sub webhook, history sync, cron renewal. Needs Google credentials.
- **Phase 2 - Lark adapter.** App token client, message list/get, event or cron sync. Needs Lark credentials.
- **Phase 3 - backfill + polish.** Historical import to an agreed depth, quoted-text stripping, monitoring/error surfacing on `mailbox_accounts.status`.

## Admin setup runbook (Dave, when home)

Nothing sensitive comes to chat. Secrets go straight into Vercel env and are recorded in the repo env docs.

### Google Workspace (`edge8.co`)

1. Create (or pick) a Google Cloud project.
2. Enable the **Gmail API** and **Pub/Sub API**.
3. Create a **service account**; download its JSON key.
4. In **Admin console -> Security -> API controls -> Domain-wide delegation**, add the service account client ID with scope `https://www.googleapis.com/auth/gmail.readonly`.
5. Create a Pub/Sub topic + push subscription pointing at the (to-be-built) webhook URL.
6. Note the mailbox to sync: `dave@edge8.co`.

### Lark (`edge8.ai`)

1. In the Lark Developer console, create a **custom app**.
2. Add scope `mail:user_mailbox` (plus contact read if needed for matching); submit for admin approval.
3. Note the **App ID** and **App Secret**.
4. Set an **event subscription** URL (the webhook) with its verification + encrypt tokens.
5. Note the mailbox to sync: `dave@edge8.ai`.

### Env vars (added to Vercel, recorded in repo env docs)

`GOOGLE_SERVICE_ACCOUNT_JSON`, `GMAIL_PUBSUB_TOPIC`, `GMAIL_PUBSUB_VERIFICATION_AUDIENCE`, `LARK_MAIL_APP_ID`, `LARK_MAIL_APP_SECRET`, `LARK_MAIL_VERIFICATION_TOKEN`, `LARK_MAIL_ENCRYPT_KEY`, `MAIL_SYNC_WEBHOOK_SECRET`.

## Open questions (decide before or during build)

1. **Backfill depth.** Import history how far back (e.g. 90 days, 1 year, all)?
2. **Body storage.** Full plaintext vs quoted-history stripped for v1?
3. **Multiple open deals.** Confirm the rule: attach to contact only when a contact has more than one open deal.
4. **Token encryption.** Supabase Vault vs app-level AES key.
5. **Team expansion.** When to extend past Dave's two mailboxes, and whether each teammate self-authorizes.
