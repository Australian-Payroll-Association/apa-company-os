// CLI runner for the role-family AI screen (no dev server needed):
//   npx tsx scripts/family-screen-run.ts [--force] [--family ai_engineer]
// Screens every application whose req is tagged with a role_family and that
// has a resume, skipping apps already screened for that family unless
// --force. Loads .env.local manually so lib/supabase.ts sees the env.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  for (const line of file.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    const [, k, raw] = m;
    if (process.env[k] !== undefined) continue;
    process.env[k] = raw.replace(/^"(.*)"$/, "$1").trim();
  }
}

const CONCURRENCY = 4;

async function main() {
  loadEnvLocal();
  const force = process.argv.includes("--force");
  const famArg = process.argv.indexOf("--family");
  const onlyFamily = famArg > -1 ? process.argv[famArg + 1] : null;

  const { companyOs } = await import("../lib/supabase");
  const { screenApplicationForFamily } = await import("../lib/family-screen");
  const { ROLE_FAMILIES } = await import("../lib/role-families");

  const { data: reqs, error: reqErr } = await companyOs
    .from("job_requisitions")
    .select("id, title, metadata")
    .not("metadata->>role_family", "is", null);
  if (reqErr) throw new Error(reqErr.message);
  const famByReq = new Map<string, string>();
  for (const r of reqs ?? []) {
    const fam = (r.metadata as { role_family?: string })?.role_family;
    if (fam && (!onlyFamily || fam === onlyFamily)) famByReq.set(r.id, fam);
  }

  const { data: apps, error: appErr } = await companyOs
    .from("applications")
    .select("id, job_requisition_id, resume_document_id, metadata")
    .in("job_requisition_id", [...famByReq.keys()])
    .limit(2000);
  if (appErr) throw new Error(appErr.message);

  const todo: { id: string; family: string }[] = [];
  let skippedNoResume = 0;
  let skippedDone = 0;
  for (const a of apps ?? []) {
    const family = famByReq.get(a.job_requisition_id as string)!;
    if (!a.resume_document_id) {
      skippedNoResume++;
      continue;
    }
    const existing = (a.metadata as { family_screen?: { family?: string } })?.family_screen;
    if (!force && existing?.family === family) {
      skippedDone++;
      continue;
    }
    todo.push({ id: a.id as string, family });
  }
  console.log(
    `${todo.length} applications to screen (${skippedNoResume} without resume, ${skippedDone} already screened). Families: ${ROLE_FAMILIES.map((f) => f.key).join(", ")}`,
  );

  let done = 0;
  let failed = 0;
  const queue = [...todo];
  async function worker() {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const res = await screenApplicationForFamily(item.id, item.family as never);
      done++;
      if (!res.ok) {
        failed++;
        console.error(`  FAIL ${item.id} (${item.family}): ${res.error}`);
      }
      if (done % 10 === 0) console.log(`  ${done}/${todo.length} screened...`);
    }
  }
  const started = Date.now();
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(
    `Done in ${Math.round((Date.now() - started) / 1000)}s — ${done - failed}/${todo.length} screened, ${failed} failed.`,
  );
  if (failed > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
