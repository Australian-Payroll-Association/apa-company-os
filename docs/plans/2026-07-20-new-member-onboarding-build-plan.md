# New Member Onboarding — Build Plan

**Date:** 2026-07-20
**Status:** Draft (not yet approved to build)
**Public workflow page:** `/workflows/new-member-onboarding` (showcase, shipped with this plan)

Re-creates the Airtable onboarding form (`airtable.com/appqom87xbB1h7B94/.../form`) natively at
`edge8.ai/new-member-onboarding`, wires it to `company_os`, and turns a completed form into a live
employee-on-probation with a portal account.

---

## The workflow we are building

1. **Recruiter marks an applicant "Hired"** in the ATS (admin).
2. That transition **sends an onboarding email** to the new hire with a link to the form.
3. New hire opens **`/new-member-onboarding`** and completes it.
4. On submit:
   - Details are written to the DB.
   - If the person already exists (as an applicant), they are **converted to an employee on probation** rather than duplicated.
   - If **no matching applicant record exists** (e.g. a direct hire who never went through the ATS), we still create the employee-on-probation from the form, and **notify the operations team** (`mai@edge8.ai` for now) so she backfills the applicant / hiring-side information.
   - A **portal invite** is sent so they can create an account and log into the employee portal (`/team`).
5. New employee logs in and sees onboarding info, health insurance, and everything else we still need to build.
6. Lark account creation is **out of scope for v1** (noted as a later phase).

---

## Current state — verify before building

These are drawn from prior work/memory and MUST be confirmed against live schema and code first
(per repo rule: 95% confidence before changes). Do not assume any column exists.

- **Person-direct ATS:** `application → person`; the `candidates` table is retired. `/careers` is driven by `is_public` reqs.
- **People + PII split:** core fields on `company_os.people`; restricted PII on `company_os.people_sensitive` (hidden from the NL→SQL assistant). Probation fields, nicknames, positions, hobbies were added in the 2026-07-17 Airtable import.
- **Auth email:** Supabase Auth invites/resets already send through Resend custom SMTP.
- **Employee portal:** `/team` hub exists (home + org chart). Employee auth/login path needs confirming.
- **Grants:** any new table/function needs explicit `service_role` grants or the app cannot see it.
- **No dev server** in this environment: verify with `tsc --noEmit` + `next build`.

**First build task is a read-only audit** to lock down: exact `people` / `people_sensitive` columns,
how "hired" and "probation" are currently represented, the existing admin status-change action on the
job-req page, the public-form → server-action → Supabase insert reference (e.g. `/careers` apply or contact),
the Resend helper, and the service-role client helper.

---

## Data model (proposed — confirm against audit)

- **Employment status** on `people`: reuse existing status/probation columns if present; otherwise add
  `employment_status` (`applicant | hired | employee | ...`) + `probation_start` / `probation_end`.
- **Onboarding submission**: store structured form answers. Prefer a dedicated `company_os.onboarding_submissions`
  row (append-only, audit-friendly) linked to `person_id`, plus promoting the durable fields onto
  `people` / `people_sensitive`. Bank details / gov IDs land only in `people_sensitive`.
- **Token/link**: the onboarding email link must carry a single-use, expiring token tied to the person,
  so the form knows who is submitting without them logging in first.

---

## Build phases (each ends with a verification check)

**Phase 0 — Audit (read-only).**
Map schema + existing patterns above. Output: a short findings note. *Check: findings written, open questions resolved.*

**Phase 1 — Hire action + onboarding email.**
Admin action on the job-req/applicant view: "Mark hired → send onboarding". Generates the tokened link,
sends via Resend, stamps status. *Check: marking a test applicant hired sends the email with a valid link.*

**Phase 2 — Public form.**
Build `/new-member-onboarding` mirroring the Airtable fields, following the established public-form pattern.
Token resolves the person server-side. *Check: form renders, validates, rejects a bad/expired token.*

**Phase 3 — Submit → convert (or create) + ops notification.**
Server action writes submission, promotes durable fields, converts applicant → employee on probation
(idempotent: re-submit updates, never duplicates). If no applicant record matches, create the
employee-on-probation from the form instead of blocking, and email the operations team (`mai@edge8.ai` for
now) that the hiring-side applicant info needs backfilling. *Check: matched submit converts the test
applicant; unmatched submit creates the employee and sends the ops email; re-submit is safe.*

**Phase 4 — Portal invite.**
On successful submit, issue the Supabase Auth invite so the new employee can set a password and reach `/team`.
*Check: invite email arrives, account can be created, `/team` loads for the new employee.*

**Phase 5 — Onboarding home (portal).**
Minimal `/team` onboarding view showing their submitted info + placeholders for health insurance etc.
*Check: new employee sees their onboarding data on first login.*

**Later / out of scope for v1:** Lark account provisioning; full health-insurance/benefits content.

---

## Open questions for Dave

1. **Form fields:** I cannot read the Airtable form (auth-gated). Please paste the field list (labels, types,
   required, any dropdown options), or confirm I should reproduce a standard new-hire set
   (legal name, preferred name, DOB, personal email, phone, address, emergency contact, bank details,
   national ID/tax, start date, T-shirt size, etc.).
2. **Trigger owner:** who marks "hired" — any admin, or a specific recruiter role?
3. **Existing applicant match:** match on email only, or email + name? (No-match behavior is decided: create a
   fresh employee-on-probation and notify ops at `mai@edge8.ai` to backfill the applicant info. Confirm the
   match key, and whether the ops notice should be email only or also a Lark message later.)
4. **Probation length:** fixed default (e.g. 60/90 days) or set per-hire at the hire step?
5. **Portal invite timing:** invite on form submit (as described), or immediately at "hired"?
6. **Sensitive data:** confirm bank/gov-ID fields belong only in `people_sensitive` and stay out of the NL→SQL assistant.

---

## Notes

- The `/workflows/new-member-onboarding` showcase page ships with this plan as the design artifact.
  It describes the target flow; keep it out of the public index sort as "shipped" only once the feature is live,
  or gate it if you prefer not to advertise before build.
