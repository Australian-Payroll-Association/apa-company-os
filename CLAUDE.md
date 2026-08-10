Do not make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidence.

Exception: operational runbooks in `.claude/skills/` (e.g. `crm-call-to-proposal`) are pre-approved. When a request matches one, execute it end to end without waiting for follow-up answers, then report. These flows are measured in minutes; do not spend time rediscovering what the skill already states.

## Brand rules (all pages, copy, commits)

- "Edge8" is always written exactly like that. Never all caps. Watch for CSS `text-transform: uppercase` on eyebrows and labels; keep the brand name out of it.
- Never use em dashes anywhere. Use commas, colons, periods, or parentheses.

## Sales ops (CRM + proposals)

- Call transcript in, then: CRM updated, proposal live, /proposals views correct. Runbook: `.claude/skills/crm-call-to-proposal/SKILL.md`. It carries verified Company OS IDs, table conventions, and the DB helper `scripts/crm/db.mjs`. Do not re-explore the schema.
- `app/proposals/page.tsx` (per-entry `status`) and `company_os.deals` move together: winning or losing a client updates both in the same session.
- Proposal pages are static files in `public/proposals/`; new ones start from `docs/templates/proposal-template.html`.

## Ship flow

- The checkout is usually on a WIP branch with uncommitted changes. Never build on it: `git worktree add` a branch from `origin/main`, stage only your files by name, open a PR, merge when CI is green.
- After merging, verify with `curl` against `https://www.edge8.ai/...` (the in-app browser blocks edge8.ai by policy) and reply with the live URL.
