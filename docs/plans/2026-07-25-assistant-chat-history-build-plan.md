# Assistant chat history — build plan

**Date:** 2026-07-25
**Branch:** `feat/assistant-chat-history`
**Status:** Shipped 2026-07-25 — all five phases built and verified (`tsc` + `next build`, migration applied to prod with owner-scoped isolation confirmed). One deviation from the draft below: per the established `company_os` convention, the table has RLS **enabled with no policies** and is granted to `service_role` only (the browser key has no `company_os` access), with every store function scoping on `(surface, owner_auth_user_id)` — rather than an `authenticated` + `auth.uid()` policy. The admin SQL roles (`chatbot_reader`/`chatbot_writer`) are explicitly revoked so the history table is never reachable through the in-chat `query_database` tool.

## Problem

The two AI assistants in the product both forget everything the moment you leave:

| | Admin assistant | Team assistant |
|---|---|---|
| Widget | `components/admin/AdminChatWidget.tsx` | `components/team/TeamChatWidget.tsx` |
| API | `app/api/admin/chat/route.ts` | `app/api/team/chat/route.ts` |
| Access | Full Company OS + approval-gated writes/email | Read-only staff view (no payroll/PII) |
| History today | **Browser `sessionStorage` only** (`edge8-admin-chat`) | **Browser `sessionStorage` only** (`edge8-team-chat`) |

Because state lives in `sessionStorage`, a conversation dies when the tab closes, and it never follows the user to another device. There is no list of past conversations, no way to reopen one. They do not behave like a "normal" AI chatbot.

## Framing: one feature, not three bots

These are **not** separate products to rebuild. It is **one assistant pattern, gated by who logs in** — the bot already scopes *data* by the authenticated user (admin sees everything; staff get the restricted `team_chatbot_reader` grants). "History" is the same idea applied to *conversations*: each person sees only their own saved chats. So we build the persistence + history UI **once** and wire both widgets to it. The access model does not change.

Out of scope: `app/portal/(dashboard)/projects/add/plan/PlanChat.tsx` — that is a purpose-built work-request planning flow, not the general assistant. If a general client-portal assistant is added later, it adopts this same history system by passing a new `surface` value.

## Goal

Make both assistants behave like a normal chatbot:

- Conversations are **saved server-side**, scoped per user.
- A **history list** in the panel shows past conversations (title + time); click to reopen, rename, or delete.
- History **follows the user** across devices and sessions.
- "New chat" starts and saves a fresh conversation.

Decisions already locked with the owner: full conversation-list UX; transcripts stored in full, scoped per user (no auto-retention limit for v1).

## Current architecture (verified on `main`)

- Both chat routes are **stateless**. The client POSTs the full `messages` array; the server streams SSE (`text` / `tool` / `error` / `done`); the `done` event echoes the updated `messages` array back for the client to store and re-send next turn.
- The widget keeps two arrays: `messages` (opaque Anthropic transcript) and `items` (render-friendly display items incl. tool chips and, for admin, approval cards). Both are serialized to `sessionStorage` as `{ items, messages }`.
- Identity: team route resolves `getTeamActor()` → `{ authUserId, personId, displayName }` (matched on `people.auth_user_id`). Admin route resolves the admin Supabase user. **Both are Supabase Auth sessions, so `auth.uid()` is a reliable owner key on both surfaces.**

This means the natural, reliable place to save is **server-side on the `done` event** — the transcript is already assembled there and never depends on a second client call.

## Design

### 1. Storage — one table, transcript as JSONB

`company_os.assistant_conversations`

| column | type | notes |
|---|---|---|
| `id` | `uuid` pk, `default gen_random_uuid()` | conversation id |
| `surface` | `text not null` | `check (surface in ('admin','team'))` |
| `owner_auth_user_id` | `uuid not null` | `= auth.uid()`; the per-user key |
| `owner_person_id` | `uuid` null | `references company_os.people(id)`; for joins/reporting |
| `title` | `text not null default 'New chat'` | derived from first user message |
| `messages` | `jsonb not null default '[]'` | the Anthropic transcript the client round-trips |
| `display_items` | `jsonb not null default '[]'` | render items, so reopening restores the exact UI |
| `last_message_at` | `timestamptz` | drives list ordering |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | |
| `archived_at` | `timestamptz` null | soft delete (matches repo convention) |

Index: `(surface, owner_auth_user_id, last_message_at desc) where archived_at is null`.

**Why JSONB blob, not a child `messages` table:** the client already serializes exactly `{ items, messages }` to `sessionStorage`; persisting the same two arrays per conversation is a 1:1 mapping with the least moving parts. We never need to query an individual message, so a child table buys nothing. Trade-off accepted: no per-message querying (not a requirement).

### 2. Grants + RLS

Per the repo rule that new `company_os` tables need explicit grants or the app cannot see them:

- Enable RLS. Policy: authenticated users may `select/insert/update` only rows where `owner_auth_user_id = auth.uid()`.
- Grant `select, insert, update` to the app roles the server client uses (`authenticated`, `service_role`). **Not** granted to `chatbot_reader` / `chatbot_writer` — those restricted roles exist only for business-data queries; history uses the app's normal Supabase server client.
- Server routes filter by `owner_auth_user_id` explicitly (defense in depth) even though the service-role client bypasses RLS.

No `delete` grant — deletion is `archived_at`, consistent with the rest of Company OS.

### 3. Shared persistence layer — `lib/assistant-history/`

Server-only module, used by both surfaces:

- `store.ts`
  - `listConversations({ surface, authUserId })` → `{ id, title, last_message_at }[]`
  - `getConversation({ id, surface, authUserId })` → full row or null
  - `upsertConversation({ id?, surface, authUserId, personId, title, messages, displayItems })` → `{ id, title }`
  - `renameConversation({ id, surface, authUserId, title })`
  - `archiveConversation({ id, surface, authUserId })`
  - Every function scopes on `(surface, owner_auth_user_id)` — no cross-user or cross-surface access is expressible.
- `title.ts` → `deriveTitle(messages)`: first user message, trimmed to ~48 chars. (Model-generated titles deferred; truncation avoids an extra model call.)

### 4. API

**Saving** — extend the existing chat routes (no separate save endpoint, no trusting the client to persist):
- Request body gains `conversationId?: string | null`.
- On the `done` event, the route calls `upsertConversation` (create when `conversationId` is null, update otherwise) and includes `conversationId` + `title` in the `done` payload.

**Listing / loading / managing** — one shared route group, `surface` resolved from the path segment so identity is checked with the right guard:
- `GET  /api/assistant/[surface]/conversations` → list for current user
- `GET  /api/assistant/[surface]/conversations/[id]` → full conversation (`messages` + `display_items`)
- `PATCH /api/assistant/[surface]/conversations/[id]` → `{ title }` (rename) or `{ archived: true }` (delete)

A small `resolveAssistantActor(surface)` helper returns `{ authUserId, personId }` (admin guard for `admin`, `getTeamActor` for `team`) or a 401.

### 5. Client — shared history UI

- `components/assistant/ConversationHistory.tsx` — the list panel (title + relative time, rename, delete), plus a `useAssistantConversations(surface)` hook.
- Both `AdminChatWidget` and `TeamChatWidget`:
  - Add a **History** button in the panel header (next to New chat) that opens the list.
  - Track `conversationId` in state; send it in the POST body; update it from the `done` event.
  - Clicking a history item `GET`s the conversation and hydrates `items` + `messages`.
  - Keep `sessionStorage` as a fast local cache of the **active** conversation only (instant on reload); the DB is the source of truth for the list and for cross-device loads.
  - "New chat" clears local state and sets `conversationId = null`.

The two widgets stay otherwise as-is (surgical change) — they just gain the shared list + a `conversationId` field. Shared logic lives in the new component/hook so it is written once.

## Phases (each independently verifiable)

1. **Migration** — create the table, index, RLS, grants. Verify: `list_tables` shows it; an authenticated `select` scoped to a test `auth.uid()` returns only that user's rows; a cross-user `select` returns nothing.
2. **Persistence layer** (`lib/assistant-history/`) — pure server functions. Verify with a throwaway script: insert → list → get → rename → archive round-trips, all owner-scoped.
3. **Save on `done`** — wire both chat routes to upsert and return `conversationId` + `title`. Verify: sending a turn creates exactly one row; a follow-up turn updates the same row.
4. **List/load/manage API** — the shared route group. Verify: list returns only the caller's conversations; loading another user's id 404s; rename/archive reflected in list.
5. **History UI** — shared component + wire both widgets. Verify in a build (see Testing): open history, reopen a past chat (UI restores incl. tool chips), rename, delete, new chat.

## Testing

Per project convention, **do not launch a dev server** — verify with:
- `npx tsc --noEmit`
- `next build`
- Migration smoke test through Supabase MCP (owner-scoped select behaves; grants present).
- Manual QA checklist walked once against a preview after merge (per the team's PR → CI → prod flow).

## Security / privacy

- Per-user isolation is enforced at three layers: `owner_auth_user_id` filter in every store function, RLS `auth.uid()` policy, and `surface` partitioning (admin chats never surface in team, and vice-versa).
- Admin transcripts can contain CRM/PII — but that is the same data the querying admin already saw live, and the same class of data already written to `audit_log`; storing the transcript does not widen exposure. Team transcripts are bounded by the read-only `team_chatbot_reader` grants (no payroll/PII).
- Full retention for v1 (owner's choice); `archived_at` supports manual delete. Optional auto-retention can be added later as a scheduled sweep.

## Rollout

Additive and backward-compatible. No env changes (reuses `ANTHROPIC_API_KEY` + existing Supabase config). Existing `sessionStorage` chats simply become the seed of the first saved conversation. Ship via PR → CI → merge → verify on prod.

## Open questions

- **Title quality:** truncated-first-message for v1; is model-generated titling wanted soon? (Deferred by default.)
- **Retention:** confirmed none for v1. Revisit if admin transcript volume/PII retention becomes a concern.
