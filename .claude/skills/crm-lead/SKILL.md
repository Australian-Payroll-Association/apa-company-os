---
name: crm-lead
description: Add a new lead to the Edge8 CRM (Supabase company_os) or enrich/update an existing person, company, or lead — from a pasted email, calendar invite, note, or details. Trigger phrases "add this to the CRM", "add a new lead", "log this lead", "add {name} to the CRM", "new CRM contact", "update {name}'s CRM record", "add a note to {contact}", "attach {person} to {company}".
---

# CRM lead capture (Edge8 company_os)

Turn a raw signal — a forwarded email, a calendar invite, a business card, a
"we just met X" note — into correctly-modelled CRM rows, or add information to a
record that already exists. There is **no manual "Add lead" form** in the admin;
this skill is the intake path until there is one.

## Target database

- Project: **Edge8 Company Database**, ref `wwchefrgkkxmhlkntufm`.
- Confirm before writing: `NEXT_PUBLIC_SUPABASE_URL` in `.env.local` must be
  `https://wwchefrgkkxmhlkntufm.supabase.co`.
- Run SQL with the Supabase MCP `execute_sql` tool (`project_id: wwchefrgkkxmhlkntufm`).
  If the MCP is down, fall back to the Management API path in the user's
  `supabase-sql-access-path` memory.
- Everything lives in the **`company_os`** schema. Always fully qualify tables.

## Schema gotchas (read this — the app code lies)

The app helpers (`lib/company-os.ts`, `app/api/contact/route.ts`) write columns
that **do not exist in the live DB**. Do not copy them:

- `people` has **no** `source_brand_id`. `inquiries` has **no** `brand_id`.
- `execute_sql` returns only the **last** statement's rows. Put your final
  read-back / RETURNING as a single trailing `select`, or you won't see results.
- `companies` has **no** unique index on name or domain, so you cannot
  `on conflict` a company — look it up first, insert only if absent.

If unsure a column exists, verify:
`select column_name from information_schema.columns where table_schema='company_os' and table_name='<t>';`

## Vocabulary (CHECK-enforced — using anything else fails the insert)

| Column | Allowed values |
|---|---|
| `companies.lifecycle_stage` | `none`, `subscriber`, `lead`, `mql`, `sql`, `opportunity`, `customer`, `evangelist` — **account-level**; people do not carry a stage |
| `lead.status` | `new`, `attempting`, `connected`, `meeting_booked`, `open_deal`, `unqualified`, `nurture` |
| `people.persona` | `null`, `vendor`, `prospect`, `client`, `job_seeker`, `employee`, `student` |
| `lead.disqualified_reason` | `no_budget`, `no_need`, `bad_timing`, `no_authority`, `unresponsive`, `competitor`, `not_icp`, `other` |

**The lead model (satellite):** being a lead is a role, not a person attribute.
`company_os.lead` holds one row per person being worked (`person_id` unique,
`status`, `sla_due_at`, `attempt_count`, `disqualified_reason`). `people` has
**no** `lifecycle_stage`/`lead_status` columns. Employees/candidates never get a
`lead` row. The account's funnel position is `companies.lifecycle_stage`
(raise-only: never move a company backwards).
| `inquiries.type` | `general`, `keynote`, `consultation`, `coaching`, `retreat`, `newsletter`, `trip`, `service`, `partnership`, `checkout`, `other` |
| `inquiries.status` | `new_lead`, `contacted`, `qualified`, `discovery_call`, `proposal`, `won`, `lost`, `nurture`, `archived` |
| `interactions.kind` | `note`, `call`, `email`, `meeting`, `message`, `status_change`, `system` |
| `person_companies.role` | `owner_founder`, `executive`, `employee`, `primary`, `secondary`, `board`, `advisor`, `other` |

Idempotency keys: `people.email` is unique; `person_companies (person_id, company_id)`
and `lead.person_id` are unique.

## Decide who gets a lead row first

Classify the person before writing:

- **The buyer / decision-maker** (this is "the lead"): `persona='prospect'` on
  the person, plus a `company_os.lead` row with the right `status`:
  - Cold inbound (they filled a form or cold-emailed asking): `status='new'`
    and `sla_due_at = now() + interval '4 hours'` (speed-to-lead clock).
  - Warm referral / already in conversation: `status='connected'`, no SLA.
  - A meeting is already booked: `status='meeting_booked'`, no SLA.
- **A gatekeeper / EA / referrer / plus-one** (not buying): no `lead` row,
  `persona=null`. They are a contact, linked to the company, not a lead.
  Do not give them an inquiry or an SLA.
- **Never demote**: if a `lead` row already exists with an active status
  (`new`/`attempting`/`connected`/`meeting_booked`/`open_deal`), or the person
  has an open/won deal (they're a customer), leave the lead state alone and
  enrich (Flow B) instead.

Do **not** create a `deal`. Deals are opened after discovery, from the Leads
queue ("book meeting & hand off") or manually once there's value to size.

## Flow A — add a new lead

1. Extract from the input: person name + email (the key), phone, title, company
   name + domain, the ask/topic, warmth/source, and any meeting (when / channel).
2. Confirm the classification above with the operator if it's ambiguous
   (who's the lead vs a contact; warm vs cold).
3. Run one atomic statement. Template (fill `{{...}}`, delete the secondary-contact
   and meeting CTEs if not needed):

```sql
with co as (
  -- get-or-create company (no unique key, so look up then insert)
  select id from company_os.companies where domain = '{{domain}}' or name = '{{Company Name}}'
  limit 1
),
co_ins as (
  insert into company_os.companies (name, domain, website, country, notes, metadata)
  select '{{Company Name}}', '{{domain}}', '{{https://domain}}', '{{Country}}', '{{notes}}', '{}'::jsonb
  where not exists (select 1 from co)
  returning id
),
company as (
  select id from co union all select id from co_ins
),
lead_person as (
  insert into company_os.people
    (email, full_name, first_name, last_name, phone, source, persona, notes, metadata)
  values
    ('{{email}}','{{Full Name}}','{{First}}','{{Last}}','{{phone|null}}','{{referral|inbound|outbound}}',
     'prospect','{{one-line context}}', '{}'::jsonb)
  on conflict (email) do update set  -- fill blanks only, never clobber
     full_name = coalesce(company_os.people.full_name, excluded.full_name),
     phone     = coalesce(company_os.people.phone, excluded.phone),
     updated_at = now()
  returning id
),
lead as (
  -- the lead satellite row: this is what makes them a lead
  insert into company_os.lead (person_id, status, sla_due_at, source)
  select id, '{{new|connected|meeting_booked}}', {{now()+interval '4 hours' | null}},
         '{{referral|inbound|outbound}}'
  from lead_person
  on conflict (person_id) do nothing  -- never demote an existing lead
  returning person_id
),
link as (
  insert into company_os.person_companies (person_id, company_id, role, title, is_primary)
  select lead_person.id, company.id, 'primary', {{'Title'|null}}, true from lead_person, company
  on conflict (person_id, company_id) do nothing
  returning person_id
),
stage as (
  -- raise the account (never lower it): none/subscriber → lead
  update company_os.companies c set lifecycle_stage = 'lead', updated_at = now()
  from company
  where c.id = company.id and c.lifecycle_stage in ('none','subscriber')
  returning c.id
),
inq as (
  insert into company_os.inquiries (person_id, type, subject, message, source, status, metadata)
  select lead_person.id, '{{consultation|general|...}}', '{{Subject}}', '{{What they want}}',
         '{{referral|inbound|outbound}}', 'new_lead',
         jsonb_build_object('company','{{Company Name}}')
  from lead_person
  returning id
),
mtg as (  -- OPTIONAL: only if a meeting/call is already booked
  insert into company_os.interactions (kind, subject, body, occurred_at, person_id, company_id, metadata)
  select 'meeting', '{{Meeting subject}}', '{{Meeting notes}}',
         timestamptz '{{YYYY-MM-DD HH:MM:SS+00}}', lead_person.id, company.id,
         jsonb_build_object('source','manual_entry')
  from lead_person, company
  returning id
),
trans as (
  -- status transition for the person; only when a lead row was actually created
  insert into company_os.lifecycle_transitions (person_id, from_status, to_status, reason, note)
  select person_id, null, '{{new|connected|meeting_booked}}', 'promoted_manually', '{{why}}'
  from lead
  returning id
),
co_trans as (
  -- stage transition for the account; only when the stage actually moved
  insert into company_os.lifecycle_transitions (company_id, from_stage, to_stage, reason)
  select id, 'none', 'lead', 'promoted_manually' from stage
  returning id
)
select (select id from lead_person) as person_id, (select id from company) as company_id;
```

4. For each extra contact (EA, referrer), add a person with `persona=null`, **no
   `lead` row**, and a `person_companies` link with `is_primary=false` and the
   right `role` (usually `'other'` or `'employee'`). No inquiry, no transition.
5. Timezones: store `occurred_at` in UTC. E.g. a Perth (AWST, +08) meeting at
   14 Jul 07:30 → `2026-07-13 23:30:00+00`.

## Flow B — enrich / update an existing record

1. Find the person and their lead state: `select p.id, p.full_name, p.persona,
   l.status as lead_status from company_os.people p left join company_os.lead l
   on l.person_id = p.id where p.email = '{{email}}';` (or `ilike full_name` if no email).
2. Apply only what's new — pick the relevant statements:
   - **Fill in fields** (never overwrite good data): `update company_os.people set
     phone = coalesce(phone, '{{}}'), linkedin_url = coalesce(linkedin_url, '{{}}'),
     notes = concat_ws(E'\n', notes, '{{append}}'), updated_at = now() where id = '{{id}}';`
   - **Log activity** (a call/email/meeting/note happened): insert an `interactions`
     row (`kind` from the table above, `occurred_at` in UTC, `person_id`, and
     `company_id` if known).
   - **Attach to a company**: reuse the `co`/`co_ins` pattern for the company id,
     then insert `person_companies … on conflict (person_id, company_id) do nothing`.
   - **Advance the lead** (e.g. connected → meeting_booked): update
     `company_os.lead.status` (and `updated_at`) **and** insert a matching
     `lifecycle_transitions` row (person-scoped, `from_status`/`to_status`) so
     the funnel stays truthful. Do not skip the transition.
   - **Disqualify**: keep the `lead` row, set `status='unqualified'` (or
     `'nurture'`), `sla_due_at=null`, a valid `disqualified_reason`, + a
     transition row.

## Verify (always, before reporting done)

```sql
select p.full_name, p.email::text, l.status as lead_status, l.sla_due_at, p.persona, p.source,
       c.name as company, c.lifecycle_stage as company_stage, pc.is_primary, pc.title,
       (select count(*) from company_os.inquiries i where i.person_id=p.id) as inquiries,
       (select count(*) from company_os.interactions x where x.person_id=p.id) as interactions
from company_os.people p
left join company_os.lead l on l.person_id = p.id
left join company_os.person_companies pc on pc.person_id=p.id
left join company_os.companies c on c.id=pc.company_id
where p.email = '{{email}}';
```

Then report the created/updated ids, where it shows in the admin (a lead lands in
`/admin/revenue/leads`; everyone lands in `/admin/contacts`), and any assumption
you made about classification so the operator can correct it.

## Guardrails

- Read before you write: a matching email means enrich (Flow B), never re-insert.
- Only the buyer becomes a lead; gatekeepers stay `none`. Ask if unclear.
- No deals, no invented deal value, no qualification you didn't hear.
- Cold inbound gets a 4h SLA; warm/booked does not (a fake SLA breaches instantly).
- Store times in UTC; keep enum values inside the tables above.
