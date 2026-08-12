// One-time import of the historical Performance Pulse reviews (Lark form
// export) into company_os.performance_reviews. See
// docs/plans/2026-08-12-performance-reviews.md.
//
// Usage:
//   node scripts/crm/import-performance-pulse.mjs <path-to-csv>            # dry run
//   node scripts/crm/import-performance-pulse.mjs <path-to-csv> --write    # insert
//
// The CSV itself is HR data and is never committed; pass its local path.
// Rows are matched to people by exact full_name. Unmatched rows are reported
// and skipped, never guessed: duplicate/ASCII-named people rows are a known
// intake bug and a wrong link here would be worse than a missing one.
//
// Column drift in the export: early rows (pre Aug 2025) have no
// "Role Understanding & Application" value and carry a seventh "Innovation"
// column. Values are imported faithfully under the column they sit in, with
// rating_scale = 'legacy-lark' marking them non-comparable to anchored rows.

import fs from 'node:fs';
import { sql, normalizeJsonMeta } from './db.mjs';

const [csvPath, writeFlag] = process.argv.slice(2);
if (!csvPath) {
  console.error('Usage: node scripts/crm/import-performance-pulse.mjs <csv> [--write]');
  process.exit(1);
}
const WRITE = writeFlag === '--write';

// ---- tiny CSV parser (quoted fields, embedded newlines) ---------------------
function parseCsv(text) {
  const out = [];
  let row = [], cur = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n') { row.push(cur); out.push(row); row = []; cur = ''; }
    else if (ch !== '\r') cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); out.push(row); }
  return out;
}

const rows = parseCsv(fs.readFileSync(csvPath, 'utf8').replace(/^﻿/, ''));
const header = rows.shift();
const col = (name) => {
  const i = header.indexOf(name);
  if (i === -1) throw new Error(`Missing CSV column: ${name}`);
  return i;
};

const C = {
  feedbackId: col('Feedback ID'),
  created: col('Created'),
  formFor: col('Form For'),
  managerName: col('Manager Name'),
  employeeName: col('Employee Name'),
  department: col('Department'),
  employeeRole: col('Employee Role'),
  reviewType: col('Review Type'),
  roleUnderstanding: col('Role Understanding & Application'),
  workQuality: col('Work Quality & Output'),
  collaboration: col('Collaboration & Team Fit'),
  communication: col('Communication'),
  problemSolving: col('Problem-Solving'),
  learningInnovation: col('Learning & Innovation'),
  innovation: col('Innovation'),
  achievements: col('Achievements'),
  improvements: col('Areas for Improvement'),
  comments: col('Additional Comments'),
  recommendation: col('Recommendation'),
  partner: col('Partner'),
};

// "9/13/2024 6:41pm" -> ISO. Times are Vietnam local; +07 keeps the date right.
function parseCreated(s) {
  const m = s.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(am|pm)$/i);
  if (!m) throw new Error(`Unparseable Created: "${s}"`);
  let [, mo, d, y, h, min, ap] = m;
  h = Number(h) % 12 + (ap.toLowerCase() === 'pm' ? 12 : 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(mo)}-${pad(d)}T${pad(h)}:${min}:00+07:00`;
}

const DECISIONS = {
  'Continue to contract': 'continue_to_contract',
  'Extend Probation': 'extend_probation',
  'Discontinue after probation': 'discontinue',
  'Promotion': 'promotion',
};
const REVIEW_TYPES = { Probation: 'probation', Annual: 'annual' };

function ratings(r) {
  const dims = {
    role_understanding: r[C.roleUnderstanding],
    work_quality: r[C.workQuality],
    collaboration: r[C.collaboration],
    communication: r[C.communication],
    problem_solving: r[C.problemSolving],
    learning_innovation: r[C.learningInnovation],
    innovation_legacy: r[C.innovation],
  };
  const out = {};
  for (const [k, v] of Object.entries(dims)) {
    const n = Number(String(v ?? '').trim());
    if (Number.isInteger(n) && n >= 1 && n <= 5) out[k] = n;
  }
  return out;
}

// ---- resolve people ---------------------------------------------------------
const names = new Set();
for (const r of rows) {
  if (r[C.employeeName]?.trim()) names.add(r[C.employeeName].trim());
  if (r[C.managerName]?.trim()) names.add(r[C.managerName].trim());
}
const matched = await sql`
  select p.full_name, tm.id as team_member_id
  from company_os.people p
  join company_os.team_members tm on tm.person_id = p.id
  where p.full_name = any(${[...names]})`;
const tmByName = new Map(matched.map((m) => [m.full_name, m.team_member_id]));

// ---- build rows -------------------------------------------------------------
const inserts = [];
const skipped = [];
for (const r of rows) {
  if (!r[C.feedbackId]?.trim()) continue;
  const employee = r[C.employeeName]?.trim();
  const teamMemberId = tmByName.get(employee);
  if (!teamMemberId) {
    skipped.push({ id: r[C.feedbackId], employee, reason: 'no exact people match' });
    continue;
  }
  const raterKind = r[C.formFor]?.trim() === 'Employee' ? 'self' : 'manager';
  const managerName = r[C.managerName]?.trim() || null;
  const reviewerId = raterKind === 'self'
    ? teamMemberId
    : (managerName ? tmByName.get(managerName) ?? null : null);
  const rawType = r[C.reviewType]?.trim();
  const rawDecision = r[C.recommendation]?.trim();

  inserts.push({
    team_member_id: teamMemberId,
    reviewer_id: reviewerId,
    cycle_label: `pulse-${r[C.feedbackId].trim()}`,
    review_type: REVIEW_TYPES[rawType] ?? 'adhoc',
    rating_scale: 'legacy-lark',
    status: 'finalized',
    submitted_at: parseCreated(r[C.created]),
    rater_kind: raterKind,
    ratings: ratings(r),
    achievements: r[C.achievements]?.trim() || null,
    improvements: r[C.improvements]?.trim() || null,
    comments: r[C.comments]?.trim() || null,
    decision: DECISIONS[rawDecision] ?? null,
    source: 'lark_import',
    metadata: {
      feedback_id: r[C.feedbackId].trim(),
      partner: r[C.partner]?.trim() || null,
      department: r[C.department]?.trim() || null,
      employee_role: r[C.employeeRole]?.trim() || null,
      manager_name_raw: managerName,
      original_review_type: rawType || null,
      original_recommendation: rawDecision || null,
    },
  });
}

// ---- report / write ---------------------------------------------------------
console.log(`Parsed ${rows.length} rows: ${inserts.length} to import, ${skipped.length} skipped.`);
for (const s of skipped) console.log(`  SKIP #${s.id} ${s.employee}: ${s.reason}`);

if (!WRITE) {
  const byPerson = new Map();
  for (const i of inserts) {
    const key = [...tmByName.entries()].find(([, v]) => v === i.team_member_id)[0];
    byPerson.set(key, (byPerson.get(key) ?? 0) + 1);
  }
  console.log('\nRows per person:');
  for (const [name, count] of [...byPerson].sort((a, b) => b[1] - a[1]))
    console.log(`  ${count}  ${name}`);
  console.log('\nDry run. Re-run with --write to insert.');
} else {
  // Idempotent: cycle_label pulse-<id> identifies each imported row.
  let written = 0, existing = 0;
  for (const row of inserts) {
    const dup = await sql`
      select 1 from company_os.performance_reviews
      where source = 'lark_import' and cycle_label = ${row.cycle_label}`;
    if (dup.length) { existing++; continue; }
    const [{ id }] = await sql`insert into company_os.performance_reviews ${sql({
      ...row,
      ratings: JSON.stringify(row.ratings),
      metadata: JSON.stringify(row.metadata),
    })} returning id`;
    // Guard against the double-encoded jsonb quirk (see db.mjs).
    await normalizeJsonMeta('company_os.performance_reviews', id, 'ratings');
    await normalizeJsonMeta('company_os.performance_reviews', id, 'metadata');
    written++;
  }
  console.log(`Inserted ${written}, already present ${existing}.`);
}

await sql.end();
