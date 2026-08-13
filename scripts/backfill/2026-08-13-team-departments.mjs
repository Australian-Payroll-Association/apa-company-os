// Backfill company_os.team_members.department_id (migration 20260813130000).
//
//   node scripts/backfill/2026-08-13-team-departments.mjs          # dry run
//   node scripts/backfill/2026-08-13-team-departments.mjs --apply
//
// The rule, from Dave (2026-08-13):
//   1. On a STAFFING client -> that client's department. A staffing client is a
//      department of its own; the five that are (OnTarget, EO, Doxa, Unlock,
//      Wareease) each already have a department row, so "a department exists
//      with this client's name" IS the test for whether a client is a staffing
//      client. Bstore is a client but not a staffing one, and has no row.
//   2. Otherwise Operations or Product Development, per the map below.
//
// Idempotent: re-running sets the same values. Safe to re-run after new hires,
// though a new joiner not covered by rule 1 needs adding to INTERNAL below.

import { sql } from '../crm/db.mjs';

const APPLY = process.argv.includes('--apply');

// Everyone with no staffing-client assignment. Named explicitly rather than
// inferred from job title: "AI Engineer" appears in both Product and on three
// different clients, so the title carries no signal.
const INTERNAL = {
  Mai: 'Operations',        // Technical Recruiter
  My: 'Operations',         // Bookkeeper & Administrative Assistant
  Khoa: 'Product Development',
  Viha: 'Product Development',
  'Lan Anh': 'Product Development',
  Ginny: 'Product Development',
  Ethan: 'Product Development',
  // Bstore is a client but not a staffing client, so its people take an
  // internal department too.
  Ash: 'Product Development',
  Quan: 'Product Development',
  Dave: 'Product Development',
};

// Vo Yon teaches for OnTarget without a staff_assignments row, so rule 1 misses
// them. Named here to keep the exception visible instead of silently internal.
const CLIENT_OVERRIDE = { 'Vo Yon': 'OnTarget' };

const LIVE = ['active', 'pre_start', 'on_leave', 'notice'];

const departments = await sql`select id, name from company_os.departments where active = true`;
const deptByName = new Map(departments.map((d) => [d.name.toLowerCase(), d.id]));

const deptId = (name) => {
  const id = deptByName.get(name.toLowerCase());
  if (!id) throw new Error(`No department named "${name}"`);
  return id;
};

// A client counts as a staffing client when a department shares its name. Client
// names carry suffixes the department names drop ("On Target by Abound Health"
// -> "OnTarget", "Entrepreneurs Organization" -> "EO"), so match on a squashed
// prefix and fall back to an explicit alias.
const CLIENT_ALIAS = {
  'entrepreneurs organization': 'EO',
  'on target by abound health': 'OnTarget',
  'doxa talent': 'Doxa',
  'unlock venture partners': 'Unlock',
};

function clientDepartmentId(clientName) {
  if (!clientName) return null;
  const alias = CLIENT_ALIAS[clientName.toLowerCase()];
  if (alias) return deptByName.get(alias.toLowerCase()) ?? null;
  const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = squash(clientName);
  for (const [name, id] of deptByName) {
    if (target.startsWith(squash(name))) return id;
  }
  return null;
}

const members = await sql`
  select tm.id, coalesce(p.preferred_name, p.full_name) as person,
         tm.department_id as current_department_id,
         (
           select c.name from company_os.staff_assignments sa
           join company_os.companies c on c.id = sa.company_id
           where sa.team_member_id = tm.id and sa.status = 'active'
           order by sa.start_date desc nulls last limit 1
         ) as client
  from company_os.team_members tm
  join company_os.people p on p.id = tm.person_id
  where tm.status = any(${LIVE})
  order by person`;

const plan = [];
const unresolved = [];

for (const m of members) {
  const override = CLIENT_OVERRIDE[m.person];
  let targetId = null;
  let why = '';

  if (override) {
    targetId = deptId(override);
    why = `client override: ${override}`;
  } else {
    const fromClient = clientDepartmentId(m.client);
    if (fromClient) {
      targetId = fromClient;
      why = `staffing client: ${m.client}`;
    } else if (INTERNAL[m.person]) {
      targetId = deptId(INTERNAL[m.person]);
      why = m.client ? `${m.client} is not a staffing client, internal` : 'internal';
    }
  }

  if (!targetId) {
    unresolved.push({ person: m.person, client: m.client ?? '(none)' });
    continue;
  }
  const deptName = departments.find((d) => d.id === targetId).name;
  plan.push({ person: m.person, department: deptName, why, changed: m.current_department_id !== targetId, id: m.id, targetId });
}

console.table(plan.map(({ person, department, why, changed }) => ({ person, department, why, changed })));
if (unresolved.length > 0) {
  console.log('\nUNRESOLVED (left untouched, add them to INTERNAL):');
  console.table(unresolved);
}

if (!APPLY) {
  console.log(`\nDry run. ${plan.filter((p) => p.changed).length} of ${plan.length} would change. Re-run with --apply.`);
  await sql.end();
  process.exit(0);
}

let n = 0;
for (const p of plan.filter((x) => x.changed)) {
  await sql`update company_os.team_members set department_id = ${p.targetId}, updated_at = now() where id = ${p.id}`;
  n += 1;
}
console.log(`\nApplied: ${n} team members updated.`);
await sql.end();
