Do not make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidence.

Exception: operational runbooks in `.claude/skills/` (e.g. `crm-call-to-proposal`) are pre-approved. When a request matches one, execute it end to end without waiting for follow-up answers, then report. These flows are measured in minutes; do not spend time rediscovering what the skill already states.

## Brand rules (all pages, copy, commits)

- "Edge8" is always written exactly like that. Never all caps. Watch for CSS `text-transform: uppercase` on eyebrows and labels; keep the brand name out of it.
- Never use em dashes anywhere. Use commas, colons, periods, or parentheses.

## Design system

One system, two layers. Read the relevant layer before building any UI; do not invent values.

- **Foundations** (marketing site): `docs/product/edge8-design-system.md`
- **Data layer** (Edge8 OS: admin, team, client portal): `docs/product/edge8-design-system-data.md`
- **Known drift** between the docs above and the code: `docs/product/edge8-design-system-inventory.md`. Check it before "fixing" an inconsistency, it may already be catalogued, and before adding a variant of something it lists.
- Tokens live in `app/globals.css` `:root`. `app/admin/admin.css` re-roots onto them. The OS shell is shared: `/team` and `/portal` both import `admin.css` and render inside `.admin-shell`, so a change there hits all three views.
- Living component reference: `/admin/patterns`. Copy from it rather than hand-rolling a new card, table, or chip.
- Never introduce a raw hex, radius, shadow, or font family that isn't a token.
- **Typeface is Manrope**, open source (SIL OFL 1.1) and self-hosted from `public/fonts/`. Never load fonts from a third-party CDN, and never add a licensed font. Weights 200 to 800 are all real (variable font); nothing above 800.

### Building UI

Every UI defect shipped so far came from writing new markup instead of reusing
markup that already works. The rule is: copy a working thing, then change the
words in it. In order, every time:

1. **Copy the nearest shipped row, card, or table.** `/admin/patterns` first,
   but it does not cover everything (list rows, for one). When it comes up
   empty that is NOT permission to invent: open the closest live surface and
   copy its markup. Say which file you copied in the PR body, e.g. "row copied
   from the attention card in `app/portal/(dashboard)/page.tsx`".
2. **No inline `style` for layout, ever.** `display`, `flex-direction`, `gap`,
   `align-items`, `justify-content`, `width` do not belong in a `style={{}}`.
   If a class does not lay out the way you want, you picked the wrong class or
   you need a new one in `admin.css`. Inline styles lose to the class silently:
   `.admin-list-aside` stacks its children, and an inline `display: flex`
   beside it changes nothing, which is exactly how the time-off Approve and
   Decline buttons shipped stacked on top of each other.
3. **A new pattern is a new class in `admin.css`**, with a comment saying what
   it is for, used by every surface that needs it. Never a one-off inline style
   on one page. If two surfaces need the same treatment, they share the class.
4. **Look at it before shipping.** Any new or changed UI gets rendered and
   screenshotted at desktop AND 375px before the PR. For gated pages (`/portal`,
   `/admin`, `/team`) build a throwaway route that renders the component with
   fake data, screenshot that, then delete the route before committing. Never
   ship UI you have not seen with your own eyes. "It typechecks and builds" is
   not verification of a layout.
5. **Anything actionable also belongs on the home screen.** If a surface asks
   the user to decide something, it goes in the "Needs your attention" card on
   `/portal` or `/team` home as well, linking through. A decision that only
   exists on its own page is a decision nobody makes.

### Guardrail

`npm run check:design` verifies that every asset referenced in CSS/JSX exists in `public/`, that every `font-weight` used is backed by a real `@font-face`, and that a PR adds no new inline layout styles. It runs in CI on every PR (~0.3s, inside the job that already runs, no new job). Run it before opening one.

The inline-layout check is a ratchet, not a sweep: the repo already has ~580 of these and cleaning them up is not the check's job, so it only refuses to let the per-file count grow. Baseline lives in `scripts/design/inline-layout-baseline.json`; regenerate with `npm run check:design -- --update-baseline` after a cleanup. If an inline layout style is genuinely unavoidable, put `layout-ok: <reason>` in a comment on that line.

Any new asset (font, image, icon) referenced in code must be committed in the same PR. A missing file does not fail the build: fonts silently substitute and images silently 404, which is exactly how the missing SemiBold shipped unnoticed for months.

## Sales ops (CRM + proposals)

- Call transcript in, then: CRM updated, proposal live, /proposals views correct. Runbook: `.claude/skills/crm-call-to-proposal/SKILL.md`. It carries verified Company OS IDs, table conventions, and the DB helper `scripts/crm/db.mjs`. Do not re-explore the schema.
- `app/proposals/page.tsx` (per-entry `status`) and `company_os.deals` move together: winning or losing a client updates both in the same session.
- Proposal pages are static files in `public/proposals/`; new ones start from `docs/templates/proposal-template.html`.

## Ship flow

- The checkout is usually on a WIP branch with uncommitted changes. Never build on it: `git worktree add` a branch from `origin/main`, stage only your files by name, open a PR, merge when CI is green.
- After merging, verify with `curl` against `https://www.edge8.ai/...` (the in-app browser blocks edge8.ai by policy) and reply with the live URL.
- The local checkout is often many commits behind. Always diagnose against `origin/main` (fetch first), never the stale working copy.
