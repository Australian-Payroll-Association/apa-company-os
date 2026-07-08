# Candidate-Profile Satellite

**Date:** 2026-07-08 · **Status:** Approved by Dave (D1 satellite: yes; D2 fold
candidates: yes; D3 drop current_company_id: per recommendation) · follows the
lead-satellite pattern (docs/plans/2026-07-07-lead-satellite-refactor.md).

## Problem
Five ATS columns live on `people` (headline, current_title, current_company_id,
portfolio_url, do_not_hire) — recruiting-role state on the universal person
table, introduced by the June person-direct ATS refactor. Measured: the four
profile columns are empty (0 rows); do_not_hire has 128 flags, all on people
with applications.

## Target
- `company_os.candidate_profile`: person_id (unique, FK CASCADE), headline,
  current_title, portfolio_url, do_not_hire (bool, default false), pool_status.
- `current_company_id` dropped, not moved — person_companies already models
  employer links (it was empty anyway).
- Fold: the retired `candidates` table's pool_status (285 rows:
  do_not_pursue 128 / active 62 / passive 54 / placed 41) becomes
  candidate_profile.pool_status; do_not_hire := people flag OR do_not_pursue.
  Other candidates fields are empty; they stay in the table until Phase 5
  (drop candidates) which this fold un-blocks.

## Phases
1. **Expand** (applied 2026-07-08): create satellite + archive
   (company_os_archive.people_ats_fields) + backfill. Verified: 285 profiles,
   128 do_not_hire, 0 team members flagged.
2. **App**: talent applications page/actions/jobs board read/write the
   satellite (embedded via people); contact 360 recruiting shelf reads it;
   identity fields (phone, linkedin_url) stay on people.
3. **Contract** (after deploy): delta re-sync do_not_hire, then drop the five
   columns from people. No views reference them (people_with_deals selects
   explicit columns; team_directory untouched).
