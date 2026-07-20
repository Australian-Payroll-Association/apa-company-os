# New Member Onboarding — Build Plan

**Date:** 2026-07-20
**Status:** Spec complete — ready for Phase 0 (read-only audit)
**Public workflow page:** `/workflows/new-member-onboarding` (showcase, shipped with this plan)

Re-creates the Airtable onboarding form (`airtable.com/appqom87xbB1h7B94/.../form`) natively at
`edge8.ai/new-member-onboarding`, wires it to `company_os`, and turns a completed form into a live
employee-on-probation with a portal account.

---

## The workflow we are building

1. **Any admin marks an applicant "Hired"** in the ATS. This transition:
   - **sends the onboarding email** to the new hire with a link to the form, and
   - **flags the recruiter to manually create the Lark `@edge8.ai` email**, then **enter that email into Edge8 OS**
     (an admin-editable `lark_email` field on the person record). Parallel track; no Lark provisioning API here.
2. New hire opens **`/new-member-onboarding`** and completes it.
3. On submit:
   - Details are written to the DB (sensitive fields to `people_sensitive`, uploads to a private bucket).
   - If the person already exists (matched on **personal email**), the same record is **moved to pre-boarding** rather than duplicated (it is not made a full employee on the spot).
   - If **no matching applicant record exists** (e.g. a direct hire who never went through the ATS), we still create the employee-on-probation from the form, and **notify the operations team** (`mai@edge8.ai` for now) so she backfills the applicant / hiring-side information.
   - A **portal invite auto-sends to their personal email** (Supabase Auth via Resend). They log in with any email; no dependency on Lark.
4. New employee logs in and sees onboarding info, health insurance, and everything else we still need to build.
5. **Status lifecycle** (three stages on a clock):
   - **Pre-boarding** — set automatically on form submit.
   - **On probation** — Day 1 (their start date); 60-day default window.
   - **Full-time employee with labor contract** — Day 60, only if they pass. This is a **human pass/fail decision**;
     automating the Day 1 / Day 60 transitions is a later enhancement. v1 sets pre-boarding on submit and the admin
     manages probation dates + the pass decision.
6. **Lark account** (`@edge8.ai`) is created manually by the recruiter (flagged at step 1) and its email is recorded into Edge8 OS via the `lark_email` field. Decoupled from the portal invite. Full automation is a later phase if/when a provisioning API is available.

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
  `employment_status` (`applicant | hired | pre_boarding | probation | full_time`) + `probation_start` /
  `probation_end` (default 60-day window). Lifecycle: submit → `pre_boarding`; Day 1 → `probation`;
  Day 60 pass → `full_time` (with labor contract). Map the form's "Employment Stage: Pre-boarding" to `pre_boarding`.
  The Day 1 / Day 60 transitions are admin-managed in v1 (automation later).
- **Onboarding submission**: store structured form answers. Prefer a dedicated `company_os.onboarding_submissions`
  row (append-only, audit-friendly) linked to `person_id`, plus promoting the durable fields onto
  `people` / `people_sensitive`. Bank details / gov IDs land only in `people_sensitive`.
- **Token/link**: the onboarding email link must carry a single-use, expiring token tied to the person,
  so the form knows who is submitting without them logging in first.
- **Lark email**: an admin-editable `lark_email` field on `people` (general, not sensitive) that the recruiter
  fills in by hand after provisioning the `@edge8.ai` account. It does not gate anything in the automated flow.

---

## Form fields (from the Airtable form — Vietnam new-hire intake)

Source form fields, in order. `S` = restricted PII, store in `people_sensitive` and keep out of the NL→SQL
assistant. `G` = general, store on `people`. `F` = file upload to a **private** Storage bucket
(store only the object path on `people_sensitive`, never a public URL). `Auto` = set by the system.

| # | Field | Type | Store |
|---|-------|------|-------|
| 1 | Timestamp | datetime | Auto (submission time) |
| 2 | Full Name | text | G |
| 3 | Date of birth | date (mm/dd/yyyy) | S |
| 4 | Place of birth | text | S |
| 5 | Position | text | G |
| 6 | Personal Email | email | G (also the applicant **match key**) |
| 7 | Phone number | text | S |
| 8 | Permanent address (per ID card) | text | S |
| 9 | Current address | text | S |
| 10 | ID card number (CCCD) | integer-string | S |
| 11 | Place of issue (ID card) | text | S |
| 12 | Native province (per ID card) | text | S |
| 13 | Date of issue | date (mm/dd/yyyy) | S |
| 14 | Marital status | select | S |
| 15 | Graduated from | text | G |
| 16 | Contact in emergency | text | S |
| 17 | Bank account / bank name / branch | text (e.g. `0012000000 - Eximbank - CN Tân Bình`) | S |
| 18 | PIT code (personal income tax) | integer-string | S |
| 19 | Social Insurance number | text | S |
| 20 | ID Front | file | F |
| 21 | ID Back | file | F |
| 22 | Selfie Image | file | F |
| 23 | Fun Stuff | text (required) | G |
| 24 | Employment Stage | select, default **Pre-boarding** | G (maps to onboarding/probation status) |

Notes:
- **ID number / PIT are "integer format" in Airtable but must be stored as strings** (leading zeros, length).
  Validate as digit-only, do not cast to a number.
- Keep the `0012000000 - Eximbank - branch` combined bank string as entered, but also parse into
  account number / bank name / branch on `people_sensitive` if the audit shows columns for them.
- The three uploads need a private bucket + service-role signed-URL access only (recruiter/ops + the person).
  Confirm the bucket and RLS in Phase 0.
- "Employment Stage: Pre-boarding" is the form's own stage marker; map it to our probation/onboarding status
  rather than adding a parallel field.

**Widget types (from the live form screenshots):**
- Multi-line textareas: Full Name, Place of birth, Position, Permanent address, Current address, Place of
  issue, Native province, Graduated from, Contact in emergency, Bank string, Social Insurance number.
- Single-line inputs: Personal Email, Phone, ID card number, PIT Code.
- Date pickers (mm/dd/yyyy): Date of birth, Date of issue.
- File dropzones: ID Front, ID Back, Selfie Image.
- **Marital status** is a select/dropdown. **Options: Single / Married.**
- **Fun Stuff** = a **multi-select of interests** plus a **free-text box** ("Anything else? Tell us a fun fact
  about you."). Maps to the existing `hobbies` field on `people`; store selected chips + the free text.
  Proposed chip list (editable): Coffee or tea; Foodie / trying new restaurants; Cooking & baking; Traveling;
  Photography; Reading; Gaming; Music & playing instruments; Karaoke / singing; Movies & series;
  Football (soccer); Gym & fitness; Yoga & meditation; Hiking & the outdoors; Cycling / running;
  Art, drawing & painting; Pets & animals; Board games & puzzles.
- **Employment Stage** renders as a fixed "Pre-boarding" pill (single default, not user-editable).
- We will not reproduce Airtable's "Do not submit passwords / Report malicious form" footer.

---

## Build phases (each ends with a verification check)

**Phase 0 — Audit (read-only).**
Map schema + existing patterns above. Output: a short findings note. *Check: findings written, open questions resolved.*

**Phase 1 — Hire action + onboarding email.**
Admin action (any admin) on the job-req/applicant view: "Mark hired → send onboarding". Generates the tokened
link, sends via Resend, stamps status, and flags the manual "create Lark account" task.
*Check: marking a test applicant hired sends the email with a valid link and records the Lark task.*

**Phase 2 — Public form.**
Build `/new-member-onboarding` mirroring the Airtable fields, following the established public-form pattern.
Token resolves the person server-side. *Check: form renders, validates, rejects a bad/expired token.*

**Phase 3 — Submit → pre-boarding (match or create) + ops notification.**
Server action writes submission, promotes durable fields, moves the applicant to `pre_boarding`
(idempotent: re-submit updates, never duplicates). If no applicant record matches, create the record in
`pre_boarding` from the form instead of blocking, and email the operations team (`mai@edge8.ai` for now) that
the hiring-side applicant info needs backfilling. *Check: matched submit moves the test applicant to
pre-boarding; unmatched submit creates the record and sends the ops email; re-submit is safe.*

**Phase 4 — Portal invite (personal email).**
On successful submit, issue the Supabase Auth invite to their **personal email** so the new employee can set a
password and reach `/team`. No Lark dependency; login works with any email.
*Check: invite email arrives at the personal address, account can be created, `/team` loads for the new employee.*

**Phase 5 — Onboarding home (portal).**
Minimal `/team` onboarding view showing their submitted info + placeholders for health insurance etc.
*Check: new employee sees their onboarding data on first login.*

**Later / out of scope for v1:** Lark account provisioning; full health-insurance/benefits content.

---

## Decisions (resolved)

1. **Form fields:** ✅ Full list captured above (Vietnam new-hire intake). Marital status = Single / Married.
   Fun Stuff = interest multi-select + free text.
2. **Trigger owner:** ✅ Any admin can mark hired.
3. **Applicant match:** ✅ Match on **personal email**. No match → create a fresh employee-on-probation and
   notify ops (`mai@edge8.ai`) to backfill the applicant info.
4. **Probation length:** ✅ 60 days by default; admin can change/extend later (not needed for v1).
5. **Portal invite:** ✅ Auto-send on form submit, to the **personal email**. Login works with any email.
6. **Lark:** ✅ `@edge8.ai` account created manually, flagged at the "mark hired" step, decoupled from the
   portal invite. Full automation deferred (no provisioning API available here).
7. **Sensitive data:** ✅ Bank / gov-ID / uploads live only in `people_sensitive` + a private Storage bucket,
   out of the NL→SQL assistant.

**Remaining to confirm during Phase 0 (audit-dependent, not blocking design):** exact column names for status /
probation / the sensitive fields; the Storage bucket + RLS for ID uploads; whether the ops notice is email-only
now (Lark message optional later).

---

## Notes

- The `/workflows/new-member-onboarding` showcase page ships with this plan as the design artifact.
  It describes the target flow; keep it out of the public index sort as "shipped" only once the feature is live,
  or gate it if you prefer not to advertise before build.
