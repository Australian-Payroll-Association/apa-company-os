# Recon 04: edge8-web onboarding intake + survey system

Worktree (read-only): `/Users/infinite-leverage/code-projects/edge8-web-wt/htt-integration`
Branch: `feat/htt-phase0`. All paths below are repo-relative to that worktree.

Files read fully: `lib/onboarding.ts`, `lib/admin/surveys.ts`, `app/api/surveys/[slug]/route.ts`,
`lib/company-os.ts` (getOrCreatePerson), plus the onboarding seed migrations.

---

## 1. Survey / question data model

**Tables (all in the `company_os` schema):** `surveys`, `survey_fields`, `survey_responses`,
`survey_answers`. They pre-date this feature and have an external writer, so the app enforces
allowed values in code, NOT via DB CHECK constraints (`lib/admin/surveys.ts:4-9`).

**A question = one `survey_fields` row.** Type `SurveyFieldRow` (`lib/admin/surveys.ts:90-99`):
`{ id, survey_id, position, type, label, help_text, required, config }`.

- `type` ∈ `FIELD_TYPES` = short_text, long_text, single_choice, multi_choice, rating, yes_no,
  date, file (`surveys.ts:11-20`).
- `config` = `FieldConfig` (`surveys.ts:53-74`): `choices`, `min`/`max`/labels, `bucket`/`accept`/
  `max_bytes` (file), **`maps_to`**, `levels`, `expected_marker`, `show_when`.

**`maps_to`** (`surveys.ts:48-52`, field at `:62`): a string `"table.column"` (or dotted
`"people.metadata.a.b"`) declaring where a purpose-driven survey writes the answer AFTER submit.
Helper `surveyFieldMapsTo()` just reads+trims it (`surveys.ts:119-122`). Ordinary surveys have
none. `isSensitiveSurveyField()` (`:128-132`) treats any `people_sensitive.*` maps_to (except the
selfie) as restricted PII for display redaction.

### EXACT code that APPLIES maps_to (onboarding): `lib/onboarding.ts:94-111`

```ts
for (const field of input.fields) {
  const target = field.config?.maps_to;
  if (!target) continue;
  const value = input.answers.get(field.id);
  if (value === undefined || value === null || value === "") continue;
  const parts = target.split(".");
  const table = parts[0];

  if (table === "people") {
    if (parts[1] === "metadata") {
      setDeep(metadataPatch, parts.slice(2), value);      // nested JSON into people.metadata
    } else if (parts.length === 2) {
      peoplePatch[parts[1]] = String(value);              // scalar people column, verbatim
    }
  } else if (table === "people_sensitive" && parts.length === 2) {
    sensitivePatch[parts[1]] = String(value);             // scalar people_sensitive column
  }
}
```

Then persisted by:
- **people** update, `lib/onboarding.ts:142-145`:
  `.from("people").update({ ...peoplePatch, metadata: mergedMetadata }).eq("id", personId)`
- **people_sensitive** upsert, `lib/onboarding.ts:150-157` (onConflict `person_id`).

### CONFIRM the plan's assertion ("maps_to only writes scalar columns on company_os.people")

**Partially true, imprecise, but the plan's downstream inference is CORRECT.** Within the
onboarding processor the applier matches exactly three shapes and nothing else:
1. `people.<col>` (parts.length===2) → **scalar column on people** (verbatim `String(value)`).
2. `people.metadata.<a>.<b>…` → **nested JSON** into `people.metadata` (NOT a scalar column).
3. `people_sensitive.<col>` (parts.length===2) → **scalar column on a DIFFERENT table**, people_sensitive.

Any other `table` prefix (e.g. `person_git_emails.*`) matches NO branch and is **silently
ignored, nothing is written**. So:
- It is NOT "people scalar only" (it also writes people.metadata JSON and people_sensitive).
- BUT it categorically **cannot write into a separate/child table, and cannot insert a related
  row.** → The plan's core conclusion holds: a git commit email (child table row) CANNOT go
  through maps_to and MUST be a post-submit upsert. **CONFIRMED.**
- `maps_to` is also **purpose-specific**: performance-review surveys use `performance_reviews.*`
  maps_to applied by a different processor (`lib/reviews.ts` `applyReviewSubmission`, dispatched at
  `route.ts:49-74`), not this loop. There is no single global maps_to writer.

**No generic normalization in the applier**, values are written verbatim (`String(value)`). The
only per-field massaging is hardcoded, keyed by destination column (see §4).

---

## 2. Submit flow: where answers persist, and the post-submit hook point

**Persisting handler:** `app/api/surveys/[slug]/route.ts` → `POST` (public, unauthenticated).

- Load survey by slug (`:26-34`), load fields ordered by position (`:36-42`).
- Validate every answer via `validateAnswer` → `answerRows[{field_id,value,value_json}]` (`:98-103`).
- Resolve person (see §5).
- **Persist:** insert `survey_responses` → `response.id` (`:150-161`); insert `survey_answers`
  (`:165-167`). If answers insert fails it deletes the response to avoid a half-save (`:168-173`).
- **Onboarding post-process dispatch, `route.ts:183-198`:**
  ```ts
  if (surveyData.purpose === "onboarding" && personId) {
    const answers = new Map(
      answerRows.map((a) => [a.field_id, (a.value_json ?? a.value) as ...]),
    );
    try {
      await processOnboardingSubmission({ personId, email: respondentEmail ?? "",
        name: respondentName, fields, answers });
    } catch (err) { console.error(...); }   // best-effort; never fails the submit
  }
  ```

**Where a post-submit child-table upsert should run:** inside `processOnboardingSubmission`
(`lib/onboarding.ts`), which is the established home for all CRM writes and already receives
`fields` + `answers` + `personId`. The processor is a sequence of best-effort steps
(1 bucket → 2 people update → 3 people_sensitive → 3b selfie→avatar → 4 application lookup →
5 team_members → 6 invite). **Exact insertion point: a new step "3c" after the selfie block,
i.e. after `lib/onboarding.ts:173` and before step 4 (`:176`)**, `personId`, `input.fields`,
`input.answers` are all in scope there. (Alternative: a new block in `route.ts` after `:198`,
but onboarding.ts is the correct layer.)

---

## 3. How to add the TWO optional questions

Both are added the SAME way existing fields were: an **idempotent SQL migration** inserting a
`company_os.survey_fields` row for the onboarding survey, guarded on `config->>'maps_to'`.

### Where the question list is defined
Questions are DATA (survey_fields rows), NOT a TS array. Onboarding survey_id =
**`'e1b2c3d4-0000-4000-8000-000000000001'`**. Defined/extended by migrations under
`supabase/migrations/`:
- Base survey + fields 1-21: `20260720150000_onboarding_via_surveys.sql:67-92`.
- Single-field add pattern (copy this): `20260812223017_onboarding_add_preferred_name.sql`
  (position 0) and `20260813063746_onboarding_legal_name_fields.sql` (positions -2, -1).
- Runtime load: `route.ts:36-42`; rendered by `app/surveys/[slug]/page.tsx`.

Migration insert pattern (from `20260812223017_...preferred_name.sql:13-26`):
```sql
insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select 'e1b2c3d4-0000-4000-8000-000000000001', <pos>, 'short_text', '<label>', '<help>', <req>,
  '{"maps_to":"<dest>"}'::jsonb
where not exists (
  select 1 from company_os.survey_fields
  where survey_id = 'e1b2c3d4-0000-4000-8000-000000000001'
    and config->>'maps_to' = '<dest>'
);
```
Set `required = false` for both new questions (optional).

### (a) GitHub username → `people.github_login`
- **Migration A1:** add column, no `github_login` exists today (grep found ZERO refs anywhere).
  `alter table company_os.people add column if not exists github_login text;`
- **Migration A2:** insert survey_fields row, `type='short_text'`, `required=false`,
  `config='{"maps_to":"people.github_login"}'::jsonb`, guarded on that maps_to.
- Because maps_to is `people.<col>` (parts.length===2), the answer flows through the generic
  applier and lands in `people.github_login` with **NO app change strictly required**, BUT it is
  written **verbatim** (`String(value)`), so the requested normalization (strip URL / leading `@`,
  lowercase) does NOT happen automatically.
- **Normalization hook (github):** add a hardcoded special-case in `processOnboardingSubmission`,
  mirroring the bank/selfie pattern, **after the bucketing loop (after `lib/onboarding.ts:111`)
  and before the people update (`:132`)**, e.g.:
  ```ts
  if (peoplePatch.github_login) {
    peoplePatch.github_login = normalizeGithubLogin(peoplePatch.github_login);
    // strip https://github.com/<x> → <x>, strip leading '@', toLowerCase, trim trailing slash
  }
  ```
  (Answer already trimmed + capped 500 chars by `validateAnswer` short_text, `surveys.ts:192-196`.)

### (b) Git commit email → `company_os.person_git_emails` (child table; NOT a scalar people column)
- Do NOT point maps_to at a people column. **Recommended wiring:** set the field's
  `config='{"maps_to":"person_git_emails.email"}'`. The generic applier has no branch for that
  table, so it is **safely ignored** (no bad write) while still giving the post-submit step a
  stable way to find the field.
- **Migration B1:** create `company_os.person_git_emails` (does not exist, grep found ZERO refs).
  Columns per the plan: `person_id` (FK people.id), `email`, `source`, `is_primary`, timestamps;
  unique on (person_id, lower(email)) for idempotent upsert.
- **Migration B2:** insert survey_fields row, `type='short_text'`, `required=false`,
  `config='{"maps_to":"person_git_emails.email"}'::jsonb`, guarded on that maps_to.
- **Upsert hook (git email):** new best-effort step in `processOnboardingSubmission`,
  **after `lib/onboarding.ts:173` (post-selfie, pre step 4)**:
  ```ts
  const gitEmailField = input.fields.find(
    (f) => f.config?.maps_to === "person_git_emails.email",
  );
  const gitEmail = gitEmailField ? input.answers.get(gitEmailField.id) : null;
  if (typeof gitEmail === "string" && gitEmail.trim()) {
    const { error } = await companyOs.from("person_git_emails").upsert(
      { person_id: personId, email: gitEmail.trim().toLowerCase(),
        source: "intake", is_primary: true },
      { onConflict: "person_id,email" },  // match the table's unique index
    );
    if (error) console.error("[onboarding] person_git_emails upsert failed:", error.message);
  }
  ```
  (`companyOs` is already imported at `lib/onboarding.ts:15`.)

---

## 4. Existing maps_to normalization + validation (zod?)

- **Generic normalization: NONE.** maps_to values written verbatim via `String(value)`. Only
  hardcoded, destination-keyed special-cases exist in `lib/onboarding.ts`:
  - selfie: `id_selfie_path` pulled out of the sensitive patch → promoted to avatar (`:113-116`, `:170-173`).
  - bank: `splitBankDetails()` on `bank_name` → account/branch (`:31-56`, applied `:120-127`).
  - email lowercasing happens upstream: `route.ts:124` and `getOrCreatePerson` `company-os.ts:21`.
  → The github + git-email normalization must be added as NEW special-cases in the same style.
- **Zod: NONE in the survey engine.** All answer validation is the hand-rolled `validateAnswer`
  switch in `lib/admin/surveys.ts:185-246` (per-type: trim + length caps [short_text ≤500,
  long_text ≤5000], choice membership, rating bounds, date shape + real-date check, file path).
  Config building uses hand-rolled `normalizeConfig` (`surveys.ts:143-168`). A new optional
  short_text question needs no zod; note short_text does NOT enforce email shape, so validate/
  normalize the git email in the upsert (or add a light email check).

---

## 5. Person row resolution during onboarding

`app/api/surveys/[slug]/route.ts`:
- `isOnboarding = surveyData.purpose === "onboarding"` (`:79`); for onboarding **`actor = null`**
  (`:80`), deliberately ignores any logged-in session so a recruiter previewing the link is not
  mapped as the hire.
- With `actor` null and the onboarding survey non-anonymous, flow hits the typed-identity branch
  (`:122-134`): reads `body.name` + `body.email` (must contain `@`), classifies, then:
  ```ts
  const person = await getOrCreatePerson({ email, name, source: "survey" });
  if (person.ok) personId = person.id;
  ```
- `getOrCreatePerson` (`lib/company-os.ts:14-60`) upserts `company_os.people` by email
  (`onConflict: "email", ignoreDuplicates: true`, email lowercased) and reads back `id`.
- That `personId` is what everything is keyed on: people `.eq("id", personId)`, people_sensitive
  `person_id: personId`, and it's passed into `processOnboardingSubmission({ personId, ... })`
  (`route.ts:188-193`). The onboarding post-process only runs when `personId` is truthy
  (`route.ts:183`). → The new `person_git_emails` upsert uses this same `personId` (= people.id
  resolved from the typed email).

---

## Net requirements checklist for the two questions
1. Migration: `alter table company_os.people add column github_login text` (net-new column).
2. Migration: `create table company_os.person_git_emails (...)` with unique(person_id, email) (net-new table).
3. Migration: insert 2 survey_fields rows (github_login, person_git_emails.email), optional, guarded on maps_to.
4. Code (`lib/onboarding.ts`): github normalization after `:111`; person_git_emails upsert after `:173`.
5. No zod / no `validateAnswer` change needed for optional short_text (consider an email-shape guard for the git email).
