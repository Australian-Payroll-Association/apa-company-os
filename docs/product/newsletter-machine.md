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
- **Training / webinars** — training is read from austpayroll.com.au/training
  (company_os.events is empty and always has been); both are also typeable.
- **Cadence** — an admin opens each edition by hand. No cron opens one.
- **Brand voice** — to be derived from the July/August/September 2026 editions.
- **Section structure** — derived from the July, August and September 2026
  editions. Six sections: Article (repeatable), Members Portal, Compliance,
  FAQ, Upcoming training, Members webinar. SECTION_TYPES order is the running
  order of the newsletter.
- **Draft output** — one full newsletter, not section-by-section.
- **Review** — two signatures in sequence, plus reject-with-notes.
- **Publish** — email broadcast only. No blog, no PDF. Members archive deferred.

## Phases

- **Phase 0 — Foundations.** APA brand, home-brand switch, env corrections. Done.
- **Phase 1 — Intake.** Editions, submissions, `/team` form, events auto-pull,
  admin edition view. Done, pending the real section list.
- **Phase 2 — Draft.** Wire an edition into `marketing_content` and run
  `draftWithAI` in the APA voice. Needs the voice profile.
- **Phase 3 — Review.** Two signatures and reject-with-notes on the gate. Done.
- **Phase 4 — Publish.** Built: a signed-off edition hands itself to the
  broadcast system as a DRAFT and stops there. No send button, on purpose —
  approveBroadcast is the gate, resolveAudience is the one place that decides
  who may receive marketing mail, and the cron worker re-checks every address
  against the live CRM before sending. A second route to a member's inbox with
  different rules is the one thing this must never have. The edition is marked
  published only once the broadcast has actually sent, not at handover.
  Still gated for real use on a verified sending domain, the sender
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

## Specialist writers (parked)

Beryl, APA's payroll assistant, could draft the payroll articles: it has the
knowledge base and can research a supplied link. Parked 7 Sep 2026, not
rejected. Beryl is a separate product with no API configured in Company OS, and
integrating it was not worth doing before we knew how to call it.

The shape it would take, so this is not re-derived:

- Two stages. A specialist drafts the substance of one submission; the house
  writer then assembles the edition in APA's voice with the running order,
  training preamble and webinar block. Beryl should not need to know the
  newsletter's furniture.
- A `writer` field per submission (default `house`) and a registry mapping
  writer to adapter, so a third specialist later costs one adapter.
- Record which writer produced each piece, so a reviewer knows whose work they
  are checking.

The condition that makes it safe: Beryl returns claims with the source each came
from (confirmed 7 Sep 2026). An agent doing its own research reintroduces the
confabulation this pipeline exists to prevent, and hides it better, because
genuinely researched output looks identical to invented output. Any adapter must
carry Beryl's citations through to the draft; if a future writer cannot cite, its
output should be marked unverified rather than published as a finished section.

## Known gaps

- ~~Phase 3 is not built~~ Done. Two signatures from two DIFFERENT people, the
  slot decided by what is already signed rather than by the caller, and notes
  required on a reject. Any change to the draft — regenerate or hand edit —
  clears both signatures and returns the edition to drafting: the signatures
  are on the words, and a gate that survives an edit approves text nobody read.
  This reversed the earlier behaviour, which preserved signatures through a
  regenerate so as not to "silently discard" one; silently was the wrong part,
  not the discarding, so the action now reports it.
- Three sending variables are unset, confirmed by the Phase 4 readiness check
  running against the real environment. `MARKETING_EMAIL_FROM` and
  `MARKETING_POSTAL_ADDRESS` fall back to the fork's defaults, so the footer
  carries Edge8 and a Ho Chi Minh City address. `UNSUBSCRIBE_SECRET` is also
  unset, which is the worst of the three: without it no unsubscribe link and no
  RFC 8058 one-click header can be generated at all, so recipients would have
  no way out except reporting spam. The Resend domain is unverified. All four
  block a real send.
- Production authenticates with a dead `SUPABASE_SECRET_KEY`, so none of Phases
  1-3 work on the deployed site. Every verification to date has been run locally
  against the live database. Needs Vercel access on `infiniteleverage-2`.
- The member list has not been scoped: location, size and consent state unknown.
