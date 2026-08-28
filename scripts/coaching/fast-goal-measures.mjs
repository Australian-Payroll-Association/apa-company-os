// My FAST Goals: give goals the measure a member sets on their own
// goal (the Specific half of FAST). The Edges ladder columns already on the
// table carry a target when a goal hangs off a company metric; these carry it
// when the goal is the member's own.
// Run from the repo root: node scripts/coaching/fast-goal-measures.mjs
// Idempotent: every statement is IF NOT EXISTS, safe to re-run.
import { sql } from '../crm/db.mjs';

const statements = [
  `alter table company_os.goals add column if not exists metric_unit text`,
  `alter table company_os.goals add column if not exists start_value numeric`,
  `alter table company_os.goals add column if not exists target_value numeric`,
  `alter table company_os.goals add column if not exists current_value numeric`,
  `alter table company_os.goals add column if not exists due_date date`,
];

for (const s of statements) await sql.unsafe(s);
console.log(`applied ${statements.length} statements`);
await sql.end();
