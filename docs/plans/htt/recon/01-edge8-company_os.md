# edge8 `company_os` schema: DDL recon (HTT migration)

- **Project:** edge8, `project_id = wwchefrgkkxmhlkntufm`
- **Schema:** `company_os`
- **Captured:** 2026-08-24 via read-only Supabase MCP (`pg_catalog` + `information_schema`)
- **Scope:** 23 tables requested + functions, enums, grants, RLS, linkage snapshot.

## TL;DR for the re-key (read this first)

- **Two different FK column names link content to a company:**
  - `company_id` on `ai_programs`, `client_roadmap_overview`, `client_roadmap_groups`, `client_backlog_items`, `program_documents`, `program_plans` (via `ai_program`), `token_purchases`, `person_companies`, `portal_members`, `compensation` (via `team_member`).
  - **`client_company_id`** on `boards` (NOT `company_id`). This is the single naming exception among roadmap/backlog/board.
- **All FK targets = `company_os.companies(id)`** (a `uuid`). `client_roadmap_overview` has **no `id`**, its PK **is** `company_id` (one overview row per company).
- **`ai_programs` is NOT referenced by roadmap/backlog/boards.** Roadmap overview, roadmap groups, backlog items, and boards all hang off `companies` directly, not off `ai_programs`. Only `program_plans` and `program_documents` reference `ai_program_id`. So "the AI program" and "the roadmap/board" are linked only transitively through the shared `company_id`.
- **No native enums/domains** in `company_os`, every constrained field is `text` + a `CHECK (... = ANY (ARRAY[...]))`.
- **Schema is entirely `service_role`-gated.** `authenticated` and `anon` have **no USAGE** on the schema and no table grants. RLS is ON for every table; policies exist only for bespoke `chatbot_*` roles, none for `authenticated`/`anon`/`service_role` (service_role bypasses RLS anyway). This matches the "RLS on, app-code gating" model.

## Row-count snapshot (current data)

| table | rows |
|---|---|
| ai_programs | 1 |
| program_plans | 1 |
| program_documents | 12 |
| client_roadmap_overview | 2 |
| client_roadmap_groups | 7 (5 + 1 + 1 across 3 companies) |
| client_backlog_items | 43 (40 + 2 + 1 across 3 companies) |
| boards | 8 (5 with client_company_id, 3 NULL/internal) |
| tasks | 92 |
| token_purchases | 0 (empty) |

---

## Linkage snapshot (critical for re-key)

**The single `ai_programs` row:**
```json
{"id":"ab033728-698f-4a1b-b9c4-c912252b0db9",
 "company_id":"47ea790d-ec5f-4c6c-8352-6457456d0132",
 "name":"Initial Roadmap Development","status":"active",
 "created_by":"GM@bstore.com.au",
 "created_at":"2026-08-10T07:33:53Z","updated_at":"2026-08-10T07:33:53Z"}
```
Links to a company via **`company_id`**. No `ai_program`-style column exists anywhere on roadmap/backlog/boards to point back at this row.

**`client_roadmap_overview` (2 rows), keyed by `company_id` (PK), no `id` column:**
| company_id | body (excerpt) |
|---|---|
| `6dbb0ebf-ed3c-42c5-b3d8-a91e219cc432` | "Set up a company database in the 8 Edges…" |
| `47ea790d-ec5f-4c6c-8352-6457456d0132` | "**What this roadmap is**…" |

**`boards` (8 rows), link column is `client_company_id`:**
| board id | client_company_id | name |
|---|---|---|
| `abaadfb3-…-30ba9e19489a` | `47ea790d-…-6457456d0132` | Bstore Company Db |
| `7c57483a-…-d29d253b4db1` | `7be4752c-…-8cf61c4ff867` | EO Global |
| `70bcfa25-…-5089d349af05` | `1750a8ca-…-c55553a49073` | Australian Payroll |
| `ba10f0ca-…-db269665702a` | `1787dc4b-…-e2cfdf75f95d` | Work Healthy |
| `c60688cc-…-bb3b4095be73` | `6dbb0ebf-…-a91e219cc432` | Arca Wellness |
| `4d353e2f-…-b4b9efc8b58b` | **NULL** | 8 Edges (internal) |
| `0a6d39c7-…-19b42bd4c2b5` | **NULL** | AIOlabz (internal) |
| `b9e2d723-…-5231df8ba41c` | **NULL** | Operations (internal) |

**`client_backlog_items` count by parent fk (`company_id`):**
- `47ea790d-…` → 40, `6dbb0ebf-…` → 2, `1750a8ca-…` → 1.

**`client_roadmap_groups` count by `company_id`:** `47ea790d-…` → 5, `6dbb0ebf-…` → 1, `1750a8ca-…` → 1.

**Primary linkage hub = company `47ea790d-ec5f-4c6c-8352-6457456d0132` (Bstore):** owns the 1 ai_program, a roadmap overview, 5 roadmap groups, 40 backlog items, and board "Bstore Company Db". A clean re-key must keep all five in sync on this company id, and remember `boards` names the column differently (`client_company_id`).

---

## Per-table DDL

Format per column: `name | type | nullable | default`. Types are Postgres `udt_name` (`_text` = `text[]`, `int8` = `bigint`, `int4` = `integer`, `float8` = `double precision`, `timestamptz`, `citext`).

### companies
PK `(id)`. Referenced by nearly everything below.
```
id            | uuid        | NOT NULL | gen_random_uuid()
name          | text        | NOT NULL
industry      | text        | NULL
size_band     | text        | NULL
country       | text        | NULL
owner_id      | uuid        | NULL      -> people(id)
notes         | text        | NULL
created_at    | timestamptz | NOT NULL | now()
updated_at    | timestamptz | NOT NULL | now()
priority      | text        | NULL
billing_address | text      | NULL
metadata      | jsonb       | NOT NULL | '{}'
archived_at   | timestamptz | NULL
archived_by   | text        | NULL
lifecycle_stage | text      | NOT NULL | 'none'
industry_normalized | text  | NULL
website_url   | citext      | NULL
client_types  | _text       | NOT NULL | '{}'::text[]
```
- FK: `owner_id -> company_os.people(id)`
- CHECK: `size_band IN ('0-50','51-250','251-5000','5000+')`; `priority IN ('low','medium','high')`; `industry_normalized IN (15 fixed industries or NULL)`.
- Indexes: `companies_pkey(id)`; `idx_companies_owner(owner_id)`; `idx_companies_website_url(website_url)`; `companies_active_idx(created_at DESC) WHERE archived_at IS NULL`.

### ai_programs
PK `(id)`. **Links to company via `company_id`.**
```
id         | uuid        | NOT NULL | gen_random_uuid()
company_id | uuid        | NOT NULL  -> companies(id)
name       | text        | NOT NULL
status     | text        | NOT NULL | 'draft'
created_by | text        | NULL
created_at | timestamptz | NOT NULL | now()
updated_at | timestamptz | NOT NULL | now()
```
- FK: `company_id -> company_os.companies(id)` (no ON DELETE clause = NO ACTION/restrict).
- CHECK: `status IN ('draft','active','complete')`.
- Indexes: `ai_programs_pkey(id)`; `ai_programs_company_idx(company_id)`; `ai_programs_status_idx(status)`.

### program_plans
PK `(id)`. Links to ai_program (NOT directly to company).
```
id            | uuid        | NOT NULL | gen_random_uuid()
ai_program_id | uuid        | NOT NULL  -> ai_programs(id)
title         | text        | NOT NULL
method        | text        | NOT NULL
brief_html    | text        | NULL
created_by    | text        | NULL
created_at    | timestamptz | NOT NULL | now()
updated_at    | timestamptz | NOT NULL | now()
```
- FK: `ai_program_id -> company_os.ai_programs(id) ON DELETE CASCADE`.
- CHECK: `method IN ('upload','chat')`.
- Index: `program_plans_pkey(id)`; `program_plans_program_idx(ai_program_id)`.

### program_documents
PK `(id)`. Links to BOTH `ai_program_id` (nullable) and `company_id` (NOT NULL).
```
id            | uuid        | NOT NULL | gen_random_uuid()
ai_program_id | uuid        | NULL      -> ai_programs(id) ON DELETE SET NULL
storage_path  | text        | NOT NULL
filename      | text        | NOT NULL
size_bytes    | int8        | NULL
uploaded_by   | text        | NULL
created_at    | timestamptz | NOT NULL | now()
company_id    | uuid        | NOT NULL  -> companies(id)
```
- FKs: `ai_program_id -> ai_programs(id) ON DELETE SET NULL`; `company_id -> companies(id)`.
- Indexes: `program_documents_pkey(id)`; `program_documents_company_idx(company_id)`; `program_documents_program_idx(ai_program_id)`; **UNIQUE `program_documents_storage_path_key(storage_path)`**.

### people
PK `(id)`. UNIQUE `email`, UNIQUE `auth_user_id`. Self-FK `owner_id`.
```
id, email(citext NOT NULL), full_name, first_name, last_name, preferred_name,
phone, avatar_url, country, timezone,
is_team_member(bool NOT NULL def false), do_not_contact(bool NOT NULL def false),
owner_id(uuid -> people(id)), source, auth_user_id(uuid -> auth.users(id)),
notes, created_at, updated_at, gender, persona, linkedin_url, city, state_province,
metadata(jsonb NOT NULL '{}'), archived_at, archived_by,
emergency_contact_name, emergency_contact_phone, lark_email(citext),
graduated_from, display_name,
marketing_consent(text NOT NULL 'never_asked'), marketing_consent_at, marketing_consent_source
```
- FKs: `auth_user_id -> auth.users(id)`; `owner_id -> company_os.people(id)`.
- CHECK: `marketing_consent IN ('subscribed','unsubscribed','never_asked')`; `persona IN ('vendor','prospect','client','job_seeker','employee','student') OR NULL`.
- UNIQUE: `people_email_key(email)`, `people_auth_user_id_key(auth_user_id)`; partial unique `idx_people_auth_user(auth_user_id) WHERE auth_user_id IS NOT NULL`.
- Other indexes: `idx_people_owner(owner_id)`; `people_active_idx(created_at DESC) WHERE archived_at IS NULL`; `people_marketing_consent_idx(marketing_consent) WHERE marketing_consent='subscribed'`.

### portal_members
PK `(id)`. Links person to (optional) company.
```
id          | uuid        | NOT NULL | gen_random_uuid()
person_id   | uuid        | NOT NULL  -> people(id)
company_id  | uuid        | NULL      -> companies(id)
role        | text        | NOT NULL | 'admin'
status      | text        | NOT NULL | 'active'
invited_by  | text        | NULL
invited_at  | timestamptz | NOT NULL | now()
revoked_at  | timestamptz | NULL
created_at  | timestamptz | NOT NULL | now()
updated_at  | timestamptz | NOT NULL | now()
```
- FKs: `person_id -> people(id)`; `company_id -> companies(id)`.
- CHECK: `role IN ('admin','contributor','viewer','affiliate')`.
- Indexes: `portal_members_pkey(id)`; `portal_members_company_idx(company_id)`; **partial unique** `portal_members_person_company_key(person_id,company_id) WHERE company_id IS NOT NULL`; **partial unique** `portal_members_person_only_key(person_id) WHERE company_id IS NULL`.

### person_companies
PK `(id)`. UNIQUE `(person_id, company_id)`.
```
id, person_id(uuid NOT NULL -> people(id)), company_id(uuid NOT NULL -> companies(id)),
role(text NOT NULL 'employee'), title, is_primary(bool NOT NULL false),
ownership_pct(numeric), start_date(date), end_date(date), created_at, updated_at
```
- FKs: both `ON DELETE CASCADE`.
- CHECK: `role IN ('owner_founder','executive','employee','primary','secondary','board','advisor','other')`.
- Indexes: `person_companies_pkey`; `idx_person_companies_company(company_id)`; UNIQUE `(person_id,company_id)`.

### compensation
PK `(id)`. **FKs point at `company_os.team_members` (a table OUTSIDE this recon set), not `people`.**
```
id, team_member_id(uuid NOT NULL -> team_members(id) ON DELETE CASCADE),
comp_type(text NOT NULL 'base_salary'), amount_cents(int8 NOT NULL),
currency(text NOT NULL 'usd'), pay_period(text NOT NULL 'annual'),
effective_from(date NOT NULL), effective_to(date), is_current(bool NOT NULL true),
change_reason, approved_by(uuid -> team_members(id)), notes, created_at, updated_at,
salary_vnd(int8), salary_usd_cents(int8)
```
- CHECK: `comp_type IN ('base_salary','hourly','bonus','commission','equity','stipend','allowance','overtime','billable')`; `pay_period IN ('annual','monthly','semi_monthly','biweekly','weekly','hourly','one_time')`.
- Indexes: `compensation_pkey`; `idx_compensation_member(team_member_id)`; **partial unique** `idx_compensation_current(team_member_id, comp_type) WHERE is_current`.

### token_purchases
PK `(id)`. Currently 0 rows.
```
id                | uuid        | NOT NULL | gen_random_uuid()
company_id        | uuid        | NOT NULL  -> companies(id)
person_id         | uuid        | NOT NULL  -> people(id)
order_id          | uuid        | NULL      -> orders(id)   [orders is OUTSIDE this set]
packs             | int4        | NOT NULL
tokens            | int4        | NOT NULL
amount_cents      | int8        | NOT NULL
currency          | text        | NOT NULL | 'usd'
status            | text        | NOT NULL | 'pending'
stripe_session_id | text        | NULL
created_at        | timestamptz | NOT NULL | now()
paid_at           | timestamptz | NULL
```
- FKs: `company_id -> companies(id)`; `person_id -> people(id)`; `order_id -> company_os.orders(id)`.
- CHECK: `packs >= 1 AND packs <= 4`; `status IN ('pending','paid','expired')`.
- Indexes: `token_purchases_pkey(id)`; `token_purchases_company_idx(company_id)`; `token_purchases_session_idx(stripe_session_id)`.

### client_roadmap_overview
**PK is `(company_id)`, no surrogate `id`.** One row per company.
```
company_id | uuid        | NOT NULL  -> companies(id) ON DELETE CASCADE  (PK)
body       | text        | NOT NULL | ''
updated_at | timestamptz | NOT NULL | now()
updated_by | text        | NULL
```
- FK: `company_id -> companies(id) ON DELETE CASCADE`.
- Index: `client_roadmap_overview_pkey(company_id)`.

### client_roadmap_groups
PK `(id)`. UNIQUE `(company_id, key)`. **Links via `company_id`.**
```
id, company_id(uuid NOT NULL -> companies(id) ON DELETE CASCADE),
key(text NOT NULL), step_label(text), title(text NOT NULL), intro(text),
sort_order(int4 NOT NULL 0), archived_at, archived_by, created_at, updated_at
```
- FK: `company_id -> companies(id) ON DELETE CASCADE`.
- Indexes: `client_roadmap_groups_pkey(id)`; UNIQUE `(company_id,key)`; `client_roadmap_groups_company_idx(company_id, sort_order)`.

### client_backlog_items
PK `(id)`. **Links via `company_id`.** Note `group_key` is a plain `text` (references `client_roadmap_groups.key` by convention, NOT a DB FK).
```
id, company_id(uuid NOT NULL -> companies(id) ON DELETE CASCADE),
group_key(text NOT NULL), ref(text), title(text NOT NULL), who(text),
today_state(text), build_desc(text), needs(_text NOT NULL '{}'),
token_low(int4), token_high(int4),
edge8_priority(text NOT NULL 'later'), client_priority(text),
client_note(text), source(text NOT NULL 'edge8'), status(text NOT NULL 'accepted'),
sort_order(int4 NOT NULL 0), archived_at, archived_by, created_at, updated_at,
client_sort_order(int4)
```
- FK: `company_id -> companies(id) ON DELETE CASCADE`.
- CHECK: `edge8_priority IN ('now','next','later','park')`; `client_priority IN ('now','next','later','park') OR NULL`; `source IN ('edge8','client')`; `status IN ('proposed','accepted','active','shipped','parked')`.
- Indexes: `client_backlog_items_pkey(id)`; `client_backlog_items_company_idx(company_id)`; `client_backlog_items_company_group_idx(company_id, group_key, sort_order)`; **partial unique** `client_backlog_items_company_ref_key(company_id, ref) WHERE ref IS NOT NULL`.

### boards
PK `(id)`. UNIQUE `slug`. **Link column is `client_company_id` (nullable), the naming exception.**
```
id                | uuid        | NOT NULL | gen_random_uuid()
name              | text        | NOT NULL
slug              | text        | NOT NULL
description       | text        | NULL
client_company_id | uuid        | NULL      -> companies(id)
owner_id          | uuid        | NULL      -> people(id)
status            | text        | NOT NULL | 'active'
sort_order        | int4        | NOT NULL | 0
metadata          | jsonb       | NOT NULL | '{}'
archived_at       | timestamptz | NULL
archived_by       | text        | NULL
created_at        | timestamptz | NOT NULL | now()
updated_at        | timestamptz | NOT NULL | now()
```
- FKs: `client_company_id -> companies(id)` (no cascade); `owner_id -> people(id)`.
- No CHECK constraints (status is free text).
- Indexes: `boards_pkey(id)`; UNIQUE `boards_slug_key(slug)`; `boards_client_idx(client_company_id)`.

### board_columns
PK `(id)`. Cascade-owned by board.
```
id, board_id(uuid NOT NULL -> boards(id) ON DELETE CASCADE),
name(text NOT NULL), position(int4 NOT NULL 0), is_done(bool NOT NULL false),
created_at, updated_at
```
- Indexes: `board_columns_pkey(id)`; `board_columns_board_idx(board_id)`.

### board_members
PK `(id)`. UNIQUE `(board_id, person_id)`.
```
id, board_id(uuid NOT NULL -> boards(id) ON DELETE CASCADE),
person_id(uuid NOT NULL -> people(id) ON DELETE CASCADE),
role(text NOT NULL 'member'), created_at
```
- Indexes: `board_members_pkey`; UNIQUE `(board_id,person_id)`; `board_members_board_idx`; `board_members_person_idx`.

### sprints
PK `(id)`. Owned by board; optional FK to `company_os.meetings` (OUTSIDE this set).
```
id, board_id(uuid NOT NULL -> boards(id) ON DELETE CASCADE),
name(text NOT NULL), goal(text), starts_on(date), ends_on(date),
status(text NOT NULL 'active'), closed_at(timestamptz), sort_order(int4 NOT NULL 0),
created_at, updated_at, meeting_id(uuid -> meetings(id)),
focus_improvement(text), going_well(text), meeting_summary(text)
```
- FKs: `board_id -> boards(id) ON DELETE CASCADE`; `meeting_id -> company_os.meetings(id)`.
- Indexes: `sprints_pkey(id)`; `sprints_board_idx(board_id)`.

### tasks
PK `(id)`. Rich FK set; self-FK `parent_task_id`. `human_tokens` column present (HTT-relevant).
```
id, title(text NOT NULL), description(text),
board_id(uuid -> boards(id) ON DELETE CASCADE),
board_column_id(uuid -> board_columns(id)),
sprint_id(uuid -> sprints(id)),
position(float8 NOT NULL 0),
assignee_id(uuid -> people(id)), created_by(uuid -> people(id)),
status(text NOT NULL 'open'), priority(text NOT NULL 'p3'),
due_date(date), completed_at(timestamptz), internal(bool NOT NULL false),
subject_type(text), subject_id(uuid),
metadata(jsonb NOT NULL '{}'), archived_at, archived_by, created_at, updated_at,
parent_task_id(uuid -> tasks(id) ON DELETE CASCADE),
human_tokens(int4)
```
- FKs: `board_id -> boards(id) ON DELETE CASCADE`; `board_column_id -> board_columns(id)`; `sprint_id -> sprints(id)`; `assignee_id -> people(id)`; `created_by -> people(id)`; `parent_task_id -> tasks(id) ON DELETE CASCADE`.
- No CHECK constraints (status/priority free text).
- Indexes: `tasks_pkey(id)`; `tasks_board_idx`; `tasks_column_idx`; `tasks_sprint_idx`; `tasks_assignee_idx`; `tasks_parent_idx`; `tasks_subject_idx(subject_type, subject_id)`.

### task_stage_log
PK `(id)`. Movement audit trail.
```
id, task_id(uuid NOT NULL -> tasks(id) ON DELETE CASCADE),
from_column_id(uuid -> board_columns(id)), to_column_id(uuid -> board_columns(id)),
from_sprint_id(uuid -> sprints(id)), to_sprint_id(uuid -> sprints(id)),
kind(text NOT NULL 'move'), moved_by(uuid -> people(id)), note(text),
moved_at(timestamptz NOT NULL now())
```
- Indexes: `task_stage_log_pkey(id)`; `task_stage_log_task_idx(task_id)`.

### task_comments
PK `(id)`.
```
id, task_id(uuid NOT NULL -> tasks(id) ON DELETE CASCADE),
author_person_id(uuid -> people(id)), author_label(text NOT NULL),
body(text NOT NULL), created_at
```
- Indexes: `task_comments_pkey(id)`; `task_comments_task_idx(task_id)`.

### surveys
PK `(id)`. `slug` present but **NO explicit UNIQUE constraint on slug** (only PK on id).
```
id, slug(text NOT NULL), name(text NOT NULL), description(text),
status(text NOT NULL 'draft'), intro_text, thank_you_text,
metadata(jsonb NOT NULL '{}'), created_at, updated_at,
is_anonymous(bool NOT NULL false), created_by(text), archived_at, purpose(text)
```
- No FKs, no CHECK constraints.
- Index: `surveys_pkey(id)` only.

### survey_fields
PK `(id)`. Owned by survey.
```
id, survey_id(uuid NOT NULL -> surveys(id) ON DELETE CASCADE),
position(int4 NOT NULL 0), type(text NOT NULL), label(text NOT NULL),
help_text(text), required(bool NOT NULL false), config(jsonb NOT NULL '{}'),
created_at, updated_at
```
- Indexes: `survey_fields_pkey(id)`; `survey_fields_survey_idx(survey_id, position)`.

### survey_responses
PK `(id)`.
```
id, survey_id(uuid NOT NULL -> surveys(id) ON DELETE CASCADE),
person_id(uuid -> people(id) ON DELETE SET NULL),
cohort_slug(text), respondent_name(text), respondent_email(text),
submitted_at(timestamptz NOT NULL now()), created_at,
respondent_kind(text), metadata(jsonb NOT NULL '{}')
```
- FKs: `survey_id -> surveys(id) ON DELETE CASCADE`; `person_id -> people(id) ON DELETE SET NULL`.
- Indexes: `survey_responses_pkey(id)`; `survey_responses_survey_idx(survey_id, submitted_at DESC)`.

### survey_answers
PK `(id)`. UNIQUE `(response_id, field_id)`.
```
id, response_id(uuid NOT NULL -> survey_responses(id) ON DELETE CASCADE),
field_id(uuid NOT NULL -> survey_fields(id) ON DELETE CASCADE),
value(text), value_json(jsonb), created_at
```
- Indexes: `survey_answers_pkey(id)`; UNIQUE `survey_answers_response_field_key(response_id, field_id)`; `survey_answers_response_idx(response_id)`.

---

## Cross-schema / out-of-set FK targets (noted, not fully mapped)

- `people.auth_user_id -> auth.users(id)`
- `compensation.team_member_id`, `compensation.approved_by -> company_os.team_members(id)` (separate table from `people`)
- `sprints.meeting_id -> company_os.meetings(id)`
- `token_purchases.order_id -> company_os.orders(id)`

---

## Functions / RPCs in `company_os`

14 functions total. **None touch roadmap / board / ai_programs / portal** (so no bodies extracted per the task rule). Signatures:

| proname | args | returns | SECURITY DEFINER |
|---|---|---|---|
| assign_equipment | p_equipment_id uuid, p_person_id uuid, p_assigned_at date, p_condition_out text, p_note text, p_actor text | uuid | no |
| campaign_recipient_stats | p_campaign_id uuid | TABLE(status text, n bigint) | yes |
| claim_campaign_batch | p_campaign_id uuid, p_limit integer, p_reclaim_after interval | TABLE(id uuid, person_id uuid, email text) | yes |
| email_delivery_stats | p_since timestamptz, p_campaign_id uuid | TABLE(event_type text, unique_emails bigint) | yes |
| handle_updated_at | (trigger fn) | trigger | no |
| meetings_normalize_type_tg | (trigger fn) | trigger | no |
| new_ticket_code | len integer | text | no |
| normalize_meeting_type | raw text | text | no |
| offboard_team_member | p_team_member_id uuid, p_status text, p_end_date date, p_actor text | jsonb | no |
| register_for_event | p_event_id uuid, p_person_id uuid, p_product_id uuid, p_attendee_name text, p_attendee_email text, p_guest_count integer, p_hold_for_payment boolean, p_order_id uuid | jsonb | yes |
| return_equipment | p_equipment_id uuid, p_returned_at date, p_condition_in text, p_note text | uuid | no |
| set_amount_usd_cents | (trigger fn) | trigger | yes |
| set_deal_positions | p_ids uuid[], p_start integer | void | no |
| workshop_attendees_total | p_year integer | integer | no |

Trigger functions of interest: `handle_updated_at` (the standard `updated_at` touch, almost certainly wired to most tables' `BEFORE UPDATE`), `set_amount_usd_cents` (compensation), `meetings_normalize_type_tg` (meetings). No roadmap/board/portal-specific triggers exist in this function set.

## Enums / domains

**None.** `pg_type` for `company_os` returns zero rows of typtype `e` (enum) or `d` (domain). All constrained columns use `text` + `CHECK (col = ANY (ARRAY[...]))`. A re-key/migration does not need to touch any enum types.

## Grants & schema access convention

Direct table ACLs (`aclexplode` of `relacl`) for the standard Supabase roles:

- **`service_role`**: `SELECT, INSERT, UPDATE, DELETE` on every company_os table checked, **except `boards` and `tasks`, which grant only `SELECT, INSERT, UPDATE` (NO DELETE)**. (boards/tasks rely on `archived_at` soft-delete instead of hard delete.)
- **`authenticated`**: no table grants; `has_schema_privilege('authenticated','company_os','USAGE') = false`.
- **`anon`**: no table grants; `has_schema_privilege('anon','company_os','USAGE') = false`.
- **`service_role`**: `has_schema_privilege('service_role','company_os','USAGE') = true`.

`information_schema.role_table_grants` returned empty for these roles because it is filtered to the connecting role's own grants; the authoritative source is `pg_class.relacl` above.

**Convention:** the entire `company_os` schema is reachable only through `service_role` (the FE proxy's upstream token / backend). No direct client (`authenticated`/`anon`) access. Any new HTT tables should follow the same pattern: `GRANT USAGE ON SCHEMA company_os TO service_role`; `GRANT SELECT,INSERT,UPDATE[,DELETE] ON <table> TO service_role`; enable RLS; add no `authenticated`/`anon` grants.

## RLS

- **RLS is ENABLED on all 23 tables** (`relrowsecurity = true`); `relforcerowsecurity = false` everywhere (service_role, as table owner-adjacent superuser-like role, bypasses RLS regardless).
- **Policy counts:** `companies`, `people`, `person_companies` = 5 each; `portal_members`, `surveys`, `survey_fields`, `survey_responses`, `survey_answers` = 4 each; **all others (ai_programs, program_plans, program_documents, compensation, token_purchases, client_roadmap_overview, client_roadmap_groups, client_backlog_items, boards, board_columns, board_members, sprints, tasks, task_stage_log, task_comments) = 0 policies.**
- **Every existing policy targets bespoke roles only**, `chatbot_reader`, `chatbot_writer`, `team_chatbot_reader`, with `qual = true` / `with_check = true` (blanket allow for those roles' SELECT/INSERT/UPDATE). **No policy targets `authenticated`, `anon`, or `service_role`.**
- **Verdict on the plan's claim** ("RLS enabled with NO policies, app-code gating"): correct in substance for the roadmap/board/program/task group (0 policies) and correct for the standard client roles everywhere (no `authenticated`/`anon`/`service_role` policies → those roles get nothing except via service_role bypass). The nuance: 8 tables DO carry policies, but only for the internal `chatbot_*` roles, not the app's user-facing roles. App-code gating via service_role holds.
