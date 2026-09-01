// Emits supabase/03-recalc-ma000019-ruleset.sql from
// lib/recalc/rule-sets/ma000019-2026-07-01.json — keeps the SQL seed in sync
// with the generated JSON without hand-transcribing ~600 dollar figures into
// a SQL string literal. Dollar-quoted ($json$...$json$) so no escaping is
// needed for the embedded JSON's quotes.

import { readFileSync, writeFileSync } from "node:fs";

const json = readFileSync("lib/recalc/rule-sets/ma000019-2026-07-01.json", "utf8");
const ruleSet = JSON.parse(json);

function sqlString(s) {
  return `'${s.replace(/'/g, "''")}'`;
}

const sql = `-- Seeds the real MA000019 (Banking, Finance and Insurance Award 2020) rule
-- set, generated from APA's own award interpretation library — see
-- scripts/build-ma000019-ruleset.mjs and lib/recalc/rule-sets/ma000019-2026-07-01.json.
-- Apply after 02-recalc.sql. Additive only (one INSERT); does not touch the
-- original illustrative example rule set.
--
-- getDefaultRuleSet() picks the most recently created row, so this becomes
-- the active rule set once applied.

INSERT INTO company_os.recalc_rule_sets (name, description, rules) VALUES (
    ${sqlString(ruleSet.name)},
    ${sqlString(`Real award rates, generated from APA's Award Interpretation Library (${ruleSet.source}). Effective from: ${ruleSet.effective_from}.`)},
    $json$${JSON.stringify(ruleSet)}$json$::jsonb
);
`;

writeFileSync("supabase/03-recalc-ma000019-ruleset.sql", sql);
console.log("Wrote supabase/03-recalc-ma000019-ruleset.sql");
