# The Newsletter Machine

Turning the monthly newsletter from a task somebody redoes into a pipeline that
runs. Four stages: **Intake → Draft → Review → Publish**.

Origin: the "Newsletter Machine" brainstorm from the Revenue Office four-offices
session. That document was written as if building from zero. It was not written
against this codebase, and most of what it describes already exists here.

## What already existed

| Stage | Company OS | Status |
|---|---|---|
| 01 Intake | nothing equivalent | built in Phase 1 |
| 02 Draft | `draftWithAI()` → `writeForBrand()`, `repurposeEntry()` | exists |
| 03 Review | `email_campaigns.approved_by` — one signature only | needs a second |
| 04 Publish | `createBroadcastFromEntry()` + the cron send worker | exists |

The events model (`webinar`, `workshop` types) means training and webinars are
pulled automatically rather than chased — two of the brainstorm's five monthly
asks removed outright.

## Decisions

Taken 1 Sep 2026. If an implementation choice contradicts one of these, the
decision wins.

- **System of record** — Company OS only. The helpdesk project's database is not
  used; its member list becomes an import workstream.
- **Tenancy** — APA is the home brand (`HOME_BRAND_SLUG = "apa"`). The former
  `edge8` value and the "shared database" comment in `lib/supabase.ts` were both
  inherited from the fork and never described this project.
- **Audience** — APA members. The list lives outside Company OS today.
- **Sending** — deferred. Phases 0–3 need none of it.
- **Intake** — a bespoke editions module, not the surveys builder. Surveys are
  one-shot per respondent and cannot model contributions accumulating.
- **Contributors** — APA staff through the `/team` portal.
- **Training / webinars** — auto-pulled from `company_os.events`.
- **Cadence** — an admin opens each edition by hand. No cron opens one.
- **Brand voice** — to be derived from past APA newsletters (not yet supplied).
- **Section structure** — the real APA sections, to be supplied. The five in
  `lib/newsletter.ts` today are the brainstorm's placeholder list.
- **Draft output** — one full newsletter, not section-by-section.
- **Review** — two signatures in sequence, plus reject-with-notes.
- **Publish** — email broadcast only. No blog, no PDF. Members archive deferred.

## Phases

- **Phase 0 — Foundations.** APA brand, home-brand switch, env corrections. Done.
- **Phase 1 — Intake.** Editions, submissions, `/team` form, events auto-pull,
  admin edition view. Done, pending the real section list.
- **Phase 2 — Draft.** Wire an edition into `marketing_content` and run
  `draftWithAI` in the APA voice. Needs the voice profile.
- **Phase 3 — Review.** Second signature and reject-with-notes on the gate.
- **Phase 4 — Publish.** Gated on a verified sending domain, the sender
  environment variables, and the member import.

Phases 2–4 are deliberately unspecified in detail until Phase 1 has run against
real submissions.

## Schema

`docs/db/2026-09-01-newsletter-machine.sql` — `newsletter_editions` and
`newsletter_submissions`.

Section types and edition statuses are enforced in `lib/newsletter.ts`, not by DB
CHECK constraints. This follows the surveys precedent and exists so the section
list can change without a migration — which matters while APA's real structure is
still to be confirmed.

## Known gaps

- Section structure is the brainstorm's placeholder, not APA's real one.
- No brand voice profile yet, so Phase 2 cannot run.
- `MARKETING_EMAIL_FROM` and `MARKETING_POSTAL_ADDRESS` are empty, and the Resend
  domain is unverified. All three block Phase 4.
- The member list has not been scoped: location, size and consent state unknown.
