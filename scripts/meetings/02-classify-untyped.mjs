// PR2: assign a canonical meeting_type to the rows PR1 left untyped.
//
// classification-map.json is an id -> type map produced by reading each row's
// title and summary and picking one of the seven canonical types (ambiguous
// rows fall to General). Applied only to rows still null, so an admin who typed
// a row in the meantime is never overwritten. Marks metadata.type_source =
// 'ai-classified' so these are distinguishable from human/imported types later.
//
// Pass --apply to write; default prints the review table only.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "../crm/db.mjs";

const APPLY = process.argv.includes("--apply");
const here = path.dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(fs.readFileSync(path.join(here, "classification-map.json"), "utf8"));
const VALID = new Set(["Sales", "1-1", "Leadership Sync", "Vendor Call", "General", "Performance", "Team Ceremony"]);

async function main() {
  console.log(`\n=== PR2 classify untyped meetings  (${APPLY ? "APPLY" : "REVIEW"}) ===\n`);

  const bad = Object.entries(MAP).filter(([, t]) => !VALID.has(t));
  if (bad.length) throw new Error(`Map has non-canonical types: ${JSON.stringify(bad.slice(0, 5))}`);

  const untyped = await sql`select id, title from company_os.meetings where meeting_type is null`;
  const missing = untyped.filter((r) => !MAP[r.id]);
  const tally = {};
  for (const r of untyped) if (MAP[r.id]) tally[MAP[r.id]] = (tally[MAP[r.id]] || 0) + 1;

  console.log(`Untyped rows in DB: ${untyped.length}. Mapped: ${untyped.length - missing.length}. Unmapped: ${missing.length}`);
  console.log(`Planned distribution:`, tally);
  if (missing.length) console.log(`  (unmapped -> left null:`, missing.map((r) => r.title).slice(0, 10), `)`);

  if (!APPLY) {
    console.log(`\nReview only. Re-run with --apply to write.\n`);
    await sql.end();
    return;
  }

  let n = 0;
  for (const r of untyped) {
    const t = MAP[r.id];
    if (!t) continue;
    await sql`
      update company_os.meetings
      set meeting_type = ${t},
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('type_source', 'ai-classified'),
          updated_at = now()
      where id = ${r.id} and meeting_type is null`;
    n++;
  }
  console.log(`\nApplied ${n} classifications.`);

  const remaining = await sql`select count(*) c from company_os.meetings where meeting_type is null`;
  const dist = await sql`select meeting_type, count(*) n from company_os.meetings group by 1 order by n desc`;
  console.log(`Untyped remaining: ${remaining[0].c}`);
  console.log(`Full type distribution:`);
  for (const r of dist) console.log(`  ${r.meeting_type ?? "(null)"}: ${r.n}`);
  console.log(`\nPR2 done.\n`);
  await sql.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
