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

<!-- BEGIN: AGENT-DELEGATION (managed by infiniteleverage skills — do not delete this block) -->
## Agent delegation (auto-routing)

When you receive a request, **delegate to the right specialist agent** before doing the work yourself. The 8 agents and their triggers:

| Agent | Delegate when the request involves… |
|---|---|
| **product-manager** | roadmap, vision, epics, daily plan, project-status.html, scope changes, approval triage, stakeholder updates, standup briefings |
| **developer** | writing/changing code, fixing bugs, refactoring, scaffolding pages, API endpoints, Supabase migrations, env-vars wiring |
| **qa** | testing, regression checks, browser matrix, accessibility, QA plans, "verify this works" |
| **devops** | CI/CD, deployments, secret management, infra escalations, Vercel/GitHub workflow issues |
| **designer** | UI mockups, brand application, image prompts, design system updates, visual reviews |
| **writer** | blog drafts, social copy, SEO briefs, voice/tone, content briefs |
| **web-publisher** | publishing markdown → Next.js components, updating `website/pages/blog/index.jsx`, image optimization, the publish workflow |
| **email-marketer** | email drafts, sequences, broadcast campaigns, Brevo/Resend, CRM segmentation |

**Delegation rules:**
1. Pick exactly **one** agent per turn — don't run two in parallel unless the operator explicitly says so.
2. If a request spans agents (e.g., "write a blog *and* publish it"), call them **in sequence**: writer → designer → web-publisher.
3. If unclear which agent fits, **ask the operator** before assuming.
4. Cross-cutting engineering rules live in `.claude/rules/global-engineering.md` — every agent honors them.
5. Project-level persona overrides for each agent live in `agents/<name>/context/persona.md` — read these on first invocation.
6. Trigger phrases: `@product-manager`, `@developer`, etc. — but auto-route even without the `@` when intent is clear.
<!-- END: AGENT-DELEGATION -->
