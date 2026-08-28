// Two rules the FAST goals page depends on:
//
// 1. A coaching profile may exist before anyone coaches it. Members own their
//    FAST goals (/team/goals), and a member with no manager on file must still
//    be able to set one, so coach_id becomes optional. Getting them a manager
//    is the company's problem, not a blocker on their goals. The daily coaching
//    cycle skips coachless profiles (no 1-1 rhythm to run).
// 2. A goal records who wrote it, so a member can delete only their own. Goals
//    their coach or manager set for them stay put (existing rows: null author,
//    i.e. not member-authored).
//
// Run from the repo root: node scripts/coaching/coach-optional.mjs
// Idempotent: dropping a NOT NULL twice is a no-op, the column add is guarded.
import { sql } from '../crm/db.mjs';

const statements = [
  `alter table company_os.coaching_profiles alter column coach_id drop not null`,
  `alter table company_os.goals add column if not exists created_by uuid references company_os.team_members(id)`,
];

for (const s of statements) await sql.unsafe(s);
console.log(`applied ${statements.length} statements`);
await sql.end();
