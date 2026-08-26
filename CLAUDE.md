# edge8-web — CLAUDE.md

The Edge8 marketing site + internal OS (admin, team, client portal) at https://www.edge8.ai. Pre-rewrite instructions archived at `docs/archive/CLAUDE-md-pre-rewrite-2026-08-26.md`.

Do not make changes until you have 95% confidence in what you need to build; ask follow-up questions until you get there. Exception: operational runbooks in `.claude/skills/` (crm-call-to-proposal, crm-lead, publish-doc) are pre-approved. When a request matches one, execute end to end without waiting, then report. Do not re-discover what the skill already states.

## Map

- **Design system**: `docs/product/edge8-design-system.md` (foundations, marketing site), `docs/product/edge8-design-system-data.md` (data layer: admin/team/portal), `docs/product/edge8-design-system-inventory.md` (known drift). Read the right layer before building any UI; check the inventory before "fixing" an inconsistency or adding a variant it already lists.
- **Tokens**: `app/globals.css` `:root` (marketing: `--color-primary-blue #287BE8`, `--color-accent-mint #6FF2C1`, `--radius`, Manrope) and `app/admin/admin.css` (`--data-*` layer). Never introduce a raw hex, radius, shadow, or font family that isn't a token. `admin.css` is the shared OS shell: a change there hits `/admin`, `/team`, and `/portal` at once.
- **Component reference**: `/admin/patterns` (file: `app/admin/(dashboard)/patterns/page.tsx`), the living reference. Copy from it rather than hand-rolling a new card, table, or chip.
- **Stack**: Next.js 14 App Router, React 18, TypeScript, plain CSS (no Tailwind). Fonts: Manrope self-hosted from `public/fonts/`, weights 200-800; never a CDN or licensed font.
- **Data**: Supabase (`supabase/migrations/`, 126 files; clients in `lib/supabase/`). Company OS CRM helpers: `lib/company-os.ts`, `scripts/crm/db.mjs`; verified IDs and table conventions live in `.claude/skills/crm-call-to-proposal/SKILL.md`, do not re-explore the schema. `app/proposals/page.tsx` and `company_os.deals` move together; proposals are static files in `public/proposals/` starting from `docs/templates/proposal-template.html`.
- **Ship**: the local checkout is usually a WIP branch; never build on it. `git fetch`, `git worktree add` from `origin/main`, stage only your files by name, PR, merge when CI is green. CI runs `design-guardrails.yml` (`npm run check:design` + `scripts/check-crons.mjs`) and a warn-only authorship guard. Run `npm run check:design` before opening a PR; commit any new asset in the same PR (missing fonts/images fail silently). 13 Vercel crons in `vercel.json`.
- **Verify**: diagnose against `origin/main`, and check live behavior with `curl` against https://www.edge8.ai/... (the in-app browser blocks edge8.ai by policy). Reply with the live URL.

## Brand rules (all pages, copy, commits)

- "Edge8" is always written exactly like that, never all caps: watch CSS `text-transform: uppercase` on eyebrows and labels.
- Never use em dashes anywhere. Use commas, colons, periods, or parentheses.
