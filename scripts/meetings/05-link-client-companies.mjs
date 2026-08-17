// Link client meetings to their client company (meetings.company_id). A meeting
// with a company_id is a "client meeting" and shows on the Client Meetings page;
// internal meetings stay unlinked. Companies were resolved from the external
// attendee's email domain against the CRM (see the review), plus explicit calls.
// Creates the three companies that were genuinely missing.
//
// Idempotent. Pass --apply.
import { sql } from "../crm/db.mjs";

const APPLY = process.argv.includes("--apply");
const log = (...a) => console.log(...a);

// meeting id (8-char prefix) -> client company name
const LINKS = {
  "18025c49": "Toyota Philippines (CAB Group)",
  "94f4fdcb": "Toyota Philippines (CAB Group)",
  "9a5fecda": "Bstore Pty Ltd",
  "dc9f1593": "Australian Payroll Association",
  "880696ce": "On Target by Abound Health",
  "b6b0dff9": "Accord Plumbing",
  "cce16cb9": "Gravis Law PLLC",
  "d84745c7": "Gravis Law PLLC",
  "c925335f": "National Housing Advisors, LLC",
  "44ee49fb": "Rentwest Solutions",
  "a291990a": "Work Healthy Australia",
  "5fa7060b": "Work Healthy Australia",
  "58169f0d": "Home Integrity",
  "54d3a926": "Teknorot Australia",
  "3dca02e2": "Multifunding Company",
  "6448341f": "Multifunding Company",
  "97d2df7f": "Briscoe Consulting",
  "eef3e50d": "Arca Wellness",
  "4ff46dcf": "EO Melbourne",
  "21fbf599": "G&A Corporate Consulting",
  "dcdd2b63": "Vee International",
  "13bc18c9": "Pho 24",
  "cc2d3931": "Entrepreneurs Organization",
  "44fc20b3": "Entrepreneurs Organization",
  "1e3b7b04": "Entrepreneurs Organization",
  "3ec8759a": "Entrepreneurs Organization",
  "df5aaf80": "Entrepreneurs Organization",
  "2c23a4b5": "Entrepreneurs Organization",
  "05b3d52f": "Entrepreneurs Organization",
  "dcb2065e": "Entrepreneurs Organization",
  "2ded5747": "Entrepreneurs Organization",
  "a12ea880": "Entrepreneurs Organization",
  "a0e03161": "Entrepreneurs Organization",
  "f771207f": "Entrepreneurs Organization",
  "7feda2a8": "Entrepreneurs Organization",
  "6945a870": "Entrepreneurs Organization",
  "cefc051a": "Entrepreneurs Organization",
  "da541978": "EO Vietnam",
  "a6d56bcd": "EO Vietnam",
  "8d2f08cc": "EO Vietnam",
  "59ff39ed": "EO Vietnam",
  "5eecb63a": "EO Vietnam",
  "03f01285": "EO Vietnam",
};
const NEW_COMPANIES = ["Vee International", "Pho 24", "EO Vietnam"];

async function main() {
  log(`\n=== PR5 link client meetings -> companies  (${APPLY ? "APPLY" : "DRY RUN"}) ===\n`);

  const companies = await sql`select id, name from company_os.companies`;
  const byName = new Map(companies.map((c) => [c.name.toLowerCase(), c.id]));

  // Resolve every target company; report any that are unexpectedly missing.
  const wanted = [...new Set(Object.values(LINKS))];
  const missing = wanted.filter((n) => !byName.has(n.toLowerCase()) && !NEW_COMPANIES.includes(n));
  if (missing.length) throw new Error(`Companies expected on file but missing: ${missing.join(", ")}`);
  for (const n of NEW_COMPANIES) log(`  ${byName.has(n.toLowerCase()) ? "exists" : "CREATE"}: ${n}`);

  // Map meeting id-prefix -> full id.
  const meetings = await sql`select id from company_os.meetings`;
  const fullId = new Map();
  for (const m of meetings) fullId.set(m.id.slice(0, 8), m.id);
  const unresolved = Object.keys(LINKS).filter((k) => !fullId.has(k));
  if (unresolved.length) log(`  WARN: meeting prefixes not found: ${unresolved.join(", ")}`);

  log(`\nWould link ${Object.keys(LINKS).length - unresolved.length} meetings across ${wanted.length} companies.`);
  if (!APPLY) {
    log(`\nDry run only. Re-run with --apply.\n`);
    await sql.end();
    return;
  }

  for (const n of NEW_COMPANIES) {
    if (!byName.has(n.toLowerCase())) {
      const [row] = await sql`
        insert into company_os.companies (name, metadata)
        values (${n}, ${sql.json({ created_via: "meetings-cleanup" })})
        returning id`;
      byName.set(n.toLowerCase(), row.id);
      log(`  created company ${n} (${row.id.slice(0, 8)})`);
    }
  }

  let n = 0;
  for (const [prefix, company] of Object.entries(LINKS)) {
    const id = fullId.get(prefix);
    if (!id) continue;
    const companyId = byName.get(company.toLowerCase());
    await sql`update company_os.meetings set company_id = ${companyId}, updated_at = now() where id = ${id}`;
    n++;
  }
  log(`\nLinked ${n} meetings.`);

  const dist = await sql`
    select c.name, count(*) n from company_os.meetings m
    join company_os.companies c on c.id = m.company_id
    group by 1 order by n desc`;
  log(`Client meetings by company:`);
  for (const r of dist) log(`  ${r.name}: ${r.n}`);
  const [{ total }] = await sql`select count(*) total from company_os.meetings where company_id is not null`;
  log(`\nTotal client meetings (company_id set): ${total}`);
  log(`\nPR5 done.\n`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
