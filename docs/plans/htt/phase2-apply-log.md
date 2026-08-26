# Phase 2 apply log: tracker to edge8 data copy

**Applied:** 2026-08-26, via `supabase db query --linked` (role postgres) against edge8 project
`wwchefrgkkxmhlkntufm`, from a point-in-time export of tracker project `znnnxubopsbvpvtvrtne`
(exported the same day). Generator: `scripts/htt/phase2-copy.mjs` + `scripts/htt/phase2-identity-map.json`.
The generated SQL is idempotent (identity upserts, ON CONFLICT (id) DO NOTHING, guarded ledgers)
and split into numbered files under the Management API request-size cap.

## What landed (verified against source)

| Object | Rows | Verification |
|---|---|---|
| company_os.ai_programs (created_by='htt-phase2') | 22 | one per tracker project, deterministic ids |
| htt.repos | 22 | tracker project uuids kept as repo ids |
| htt.pull_requests | 5387 | author_person_id mapped on all 3633 authored PRs |
| htt.token_entries | 1131 | 1133 source rows, 2 merged (see below); amount sum 3,704,842,244 exact |
| htt.man_hour_entries | 268 | hours sum 1,767.92 exact |
| htt.client_identities | 20 | |
| htt.pr_attribution_overrides | 1 | |
| htt.sync_runs | 613 | |
| htt.project_goals | 56 | inserted ordered by original seq; live order verified identical |
| htt.goal_events | 2 | |
| htt.project_summaries | 42 | |
| htt.token_allocations | 7 | seq order verified identical (latest-wins preserved) |
| company_os.person_git_emails | 14 | ex contributor_aliases, source='discovered' |
| company_os.company_github_orgs | 5 | unambiguous orgs only |
| companies.is_ai_program = true | 5 | Edge8, WHA, EO Vietnam, DOXA Talent, APA |
| people.github_login backfilled | 5 | dhajdu, quanchau8, TracNg99, dnakhoa, luke-dinh |

## Identity decisions to note

- Tracker members **Lan Anh** and **Anh Pham** resolve to the same person
  (Pham Thi Hoang Lan Anh, anh.pham@edge8.ai). Two token_entries pairs collided on the
  (person, repo, day, kind) unique index and were merged by summing amounts (ids kept:
  0a472300, 2c1b3d02; ids absorbed: b311ab5e, 780a33ef). No man-hour collisions.
- **NGUYEN DANG TRAC** (the WHA-side member) is the same human as **Trac Nguyen**; both map to
  Nguyen Dang Trac (trac.nguyen@edge8.ai).
- **Quan Chau** maps to team member Chau Dinh Trung Quan (quan@edge8.ai); qdchau@gmail.com is
  attached as his discovered git email.
- Personal GitHub accounts (dhajdu, drnilssen, maureenbirdsall, ronaldramosodoxa, noahgit1022,
  Edge8-Axl) were deliberately NOT inserted into company_github_orgs (org_login is globally
  unique, one org = one company); repo identity lives on ai_programs.github_repo regardless.

## Re-running

Re-export the tracker tables (`select * from public.<t>` per table into `<t>.json`), then:

```
node scripts/htt/phase2-copy.mjs <export-dir> <out.sql>
supabase db query --linked -f <out>.01.sql   # ... in order
```

Safe to re-apply; existing rows are skipped and the seq ledgers only load when empty.
