# Team portal assistant (/team)

Built 2026-07-20 on branch `feat/team-portal-assistant`.

A read-only chat assistant for Edge8 staff, on every `/team` page. Answers
questions about the company by querying Company OS and a markdown-driven
knowledge base. Mirrors the admin assistant's streaming tool-use pattern, but
answer-only and on a deliberately narrower data surface.

## Scope (decided with Dave, 2026-07-20)

Edge8 is open-book with staff. The bot **can** read: finances (revenue,
invoices, expenses, deals), clients & companies, sales pipeline, people & org,
time off, events, ideas, CRM interaction notes, and the knowledge base. It
**cannot** read: payroll/compensation, `people_sensitive` (bank/ID/DOB),
performance reviews / 1-1s / goals, recruiting & candidate data (ATS), survey
responses, meetings, document files, `audit_log`, admin tables, and the free-text
`termination_reason` / time-off `reason` / `manager_note` columns. Answer-only:
no writes, no emails, no approvals.

## The security boundary is the database

`team_chatbot_reader` (migration
`20260720160000_team_chatbot_reader_and_knowledge.sql`) is a locked-down,
nologin Postgres role. Unlike the admin `chatbot_reader` (which sees all of
company_os), it is **default-deny**: USAGE on `company_os` + SELECT on an
explicit allow-list of tables only — never `grant on all tables`, no default
privileges, so a future table is invisible until deliberately granted. Two
tables are column-redacted via column-level grants (`team_members` minus
`termination_reason`; `time_off` minus `reason`/`manager_note`). App-layer
guards in `lib/team-chat/db.ts` (single-SELECT validation, schema/table
blocklist) are defense in depth on top of the grants.

## Files

- `supabase/migrations/20260720160000_team_chatbot_reader_and_knowledge.sql` —
  role + grants + `company_os.team_knowledge` table.
- `lib/team-chat/{db,schema,tools,system-prompt}.ts` — restricted SQL executor,
  scoped schema summary, the one read tool, and the persona/rules prompt.
- `app/api/team/chat/route.ts` — streaming SSE route, gated by `getTeamActor()`.
- `components/team/TeamChatWidget.tsx` — floating widget (reuses admin `chatw-*`
  CSS), mounted in `app/team/(dashboard)/layout.tsx`.
- `docs/team-knowledge/*.md` + `scripts/sync-team-knowledge.ts` — the knowledge
  base and its sync. "Claude is the CMS": edit markdown, run the sync, it's live.

## Go-live steps (require Dave — prod + secrets)

1. **Apply the migration** to the Supabase project (`wwchefrgkkxmhlkntufm`), e.g.
   via the Supabase MCP `apply_migration` or the dashboard SQL editor.
2. **Set the role password** (never in git):
   ```sql
   alter role team_chatbot_reader with login password '<strong password>';
   ```
3. **Add the env var** in Vercel (all environments): `TEAM_CHATBOT_DB_URL` = the
   Supavisor transaction-pooler connection string (port 6543) authenticating as
   `team_chatbot_reader`. `ANTHROPIC_API_KEY` and `CHATBOT_MODEL` are already set
   (shared with the admin assistant). Record the change per env-var discipline.
4. **Seed the knowledge base**:
   ```bash
   npx tsx scripts/sync-team-knowledge.ts
   ```
5. Verify on prod: sign in at `/team`, open the assistant, ask "what are our
   values?" (knowledge base) and "who's out next week?" (data).

Until steps 1–3 are done the assistant degrades gracefully: the widget shows,
and a query returns "Database access is not configured" rather than erroring.

## Keeping knowledge current

Edit or add files in `docs/team-knowledge/` (one file = one entry with
frontmatter), then `npx tsx scripts/sync-team-knowledge.ts`. Removing a file
archives its entry (soft delete). See `docs/team-knowledge/README.md`.

## Future

- Add tables to the allow-list as new open-book areas are agreed (edit the
  migration's two `allowed` arrays + `lib/team-chat/schema.ts`).
- Optional scheduled routine to re-sync knowledge from source docs.
- Possible v2: approved actions (book leave, edit profile) behind the same
  Approve-click pattern as the admin assistant.
