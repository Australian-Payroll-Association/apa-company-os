# Surveys: light Typeform under Operations

**Date:** 2026-07-08
**Status:** Approved (retreat linking descoped), in build
**Owner:** Dave

## Problem

We have no way to collect structured feedback. We want internal team surveys (pulse checks, retro feedback) and external surveys (guests, clients) without paying for or wiring up Typeform. The sidebar already promises this: Operations > Workplace > Surveys is a disabled "soon" item.

## Decisions (confirmed 2026-07-08)

- Question types at launch: short text, long text, multiple choice (single + multi select), rating scale (covers NPS as a 0-10 preset), yes/no.
- Per-survey anonymous toggle. When anonymous, responses store no person, name, or email, even for signed-in team members.
- External respondents give name + email, matched or created as `company_os.people` (same as contact/inquiry flows).
- Taking experience: one question per screen, Typeform style, progress bar.
- **Retreat linking is descoped.** The pre-existing schema put `cohort_slug` on `survey_responses`; that design is under review. The column stays untouched and unused until redesigned.

## Existing data discovered during build

The `company_os` schema already had `surveys`, `survey_fields`, `survey_responses`, `survey_answers`, with 2 published surveys (Post-Event NPS, AI Capability Pulse) and 6 real responses from the `saigon-2026-06-20` cohort (June 2026), written by an external process. The build therefore **adapts to the existing schema additively**:

- Keep table/column names (`survey_fields`, `config`, `value` + `value_json`).
- Keep the existing `published` status value (statuses: `draft | published | closed`).
- Answers: `value` holds the canonical human-readable text (what the existing writer used); `value_json` holds structured values (multi-select arrays).
- Migration `20260708080000_surveys_admin_extend.sql` adds: `surveys.is_anonymous / created_by / archived_at`, `survey_responses.respondent_kind`, indexes, a unique (response_id, field_id) constraint, and the missing `delete` grants for `service_role`.

## Identity model

One public taking page serves everyone. Identity resolution at submit time, server side:

1. Signed-in user whose `people.auth_user_id` matches (team portal identity): attributed team response, no identity step shown.
2. Signed-in admin (email in `admins`): matched to `people` by email (created if missing), team response.
3. Otherwise: first screen asks name + email, `getOrCreatePerson()` links the response. `respondent_kind='external'`.
4. `is_anonymous` surveys skip identity entirely and never store person/name/email.

## Routes

### Admin (mirrors the time-off vertical slice)
Under `app/admin/(dashboard)/operations/surveys/`, gated by `requireAdmin()`, writes via server actions with `recordAudit()`.

- `/admin/operations/surveys`: list with KPI cards and table.
- `/admin/operations/surveys/new` + `/admin/operations/surveys/[id]`: builder. Meta (title, description, slug, anonymous toggle), question add/edit/delete/reorder, status control (draft -> published -> closed), copy public link.
- `/admin/operations/surveys/[id]/results`: per-question aggregates (choice distribution, rating average, NPS when 0-10), responses table with row preview.
- Sidebar item flipped to `enabled: true`.

Editing guard once responses exist: label/help edits, reorder, and adding questions stay allowed; type changes and deletes are blocked.

### Public
- `app/surveys/[slug]/page.tsx`: server component, loads survey + fields (404 unless published; closed shows a notice), detects team identity, renders the client runner. Marketing styling (globals.css), not admin.css.
- `app/api/surveys/[slug]/route.ts` POST: honeypot, per-type server validation, identity resolution, response + answers insert, best-effort `notifyOps()`.

## Out of scope (later if wanted)

- Retreat/cohort linking (redesign first: likely survey-level link plus response backfill)
- Logic jumps, branching, sections
- Email invites, reminders, CSV export
- Editing question types after responses exist

## Risks

- An unknown external writer produced the existing rows; schema changes stay additive so it keeps working.
- Public endpoint is unauthenticated by design: honeypot + strict validation. Rate limiting if abuse appears.
- New-table grants gotcha handled in the migration (delete grants added).
