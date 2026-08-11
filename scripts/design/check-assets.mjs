#!/usr/bin/env node
/**
 * Design system guardrails.
 *
 * Two checks, both born from a real defect: `@font-face` referenced
 * "SVN-Gilroy SemiBold.otf", the file was never committed, and for months every
 * heading that asked for weight 600 silently rendered as Medium. Nothing failed,
 * nothing logged, and the site quietly lost its entire bold range.
 *
 *   1. missing-asset  Every /public asset referenced from CSS or JSX exists.
 *   2. font-weight    Every font-weight used has a @font-face that can serve it.
 *
 * Check 2 is the one that would have caught the original bug. A weight with no
 * face behind it does not fall back to another family: the browser silently
 * substitutes the nearest weight in the same family, so the page looks merely
 * "a bit flat" rather than broken.
 *
 * Usage:  node scripts/design/check-assets.mjs [--warn-only]
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const PUBLIC_DIR = join(ROOT, "public");
const SCAN_DIRS = ["app", "components", "lib"];
const WARN_ONLY = process.argv.includes("--warn-only");

/** Recursively collect files with the given extensions, skipping build output. */
function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, exts, out);
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const cssFiles = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [".css"]));
const jsxFiles = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [".tsx", ".jsx"]));
const codeFiles = SCAN_DIRS.flatMap((d) => walk(join(ROOT, d), [".ts", ".tsx", ".js", ".jsx", ".mjs"]));
const errors = [];
const warnings = [];

/* ─────────────────────────────────────────────────────────────
   Check 1: every referenced /public asset actually exists.
   ───────────────────────────────────────────────────────────── */

/** Skip anything we cannot resolve statically or that isn't ours to serve. */
function isSkippable(ref) {
  return (
    !ref.startsWith("/") ||
    ref.startsWith("//") ||
    ref.includes("${") ||
    ref.includes("http") ||
    ref.startsWith("/api/") ||
    ref.startsWith("/_next/")
  );
}

/**
 * A path can be served by an App Router route handler instead of /public,
 * e.g. app/llms.txt/route.ts serves /llms.txt. Those are not missing assets.
 */
function hasRouteHandler(clean) {
  return ["ts", "tsx", "js", "jsx"].some((ext) =>
    existsSync(join(ROOT, "app", clean, `route.${ext}`))
  );
}

function recordAsset(ref, file, line) {
  if (isSkippable(ref)) return;
  const clean = decodeURIComponent(ref.split("?")[0].split("#")[0]);
  if (hasRouteHandler(clean)) return;
  if (!existsSync(join(PUBLIC_DIR, clean))) {
    errors.push({
      check: "missing-asset",
      file: relative(ROOT, file),
      line,
      msg: `references "${clean}" but public${clean} does not exist`,
    });
  }
}

/**
 * Blank out /* … *\/ comment bodies while preserving newlines, so commented-out
 * code is never reported but line numbers stay accurate.
 */
function stripCssComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

// CSS: url(...) in any property, which covers @font-face src and background images.
for (const file of cssFiles) {
  stripCssComments(readFileSync(file, "utf8")).split("\n").forEach((text, i) => {
    for (const m of text.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) {
      recordAsset(m[1].trim(), file, i + 1);
    }
  });
}

// JSX: src/href/poster literals pointing at /public. Template literals are skipped.
for (const file of jsxFiles) {
  readFileSync(file, "utf8").split("\n").forEach((text, i) => {
    for (const m of text.matchAll(/(?:src|href|poster)=["'](\/[^"']*)["']/g)) {
      const ref = m[1];
      // Route links (no file extension) are pages, not assets.
      if (!/\.[a-z0-9]{2,5}$/i.test(ref)) continue;
      recordAsset(ref, file, i + 1);
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   Check 1b: server-side reads such as
   readFileSync(join(root(), 'public/fonts/x.ttf')). These are invisible to the
   CSS/JSX scans above but break the BUILD when the file is missing, which is
   how removing a font silently broke every OpenGraph image route.
   ───────────────────────────────────────────────────────────── */

for (const file of codeFiles) {
  readFileSync(file, "utf8").split("\n").forEach((text, i) => {
    for (const m of text.matchAll(/['"`](public\/[^'"`${}]+\.[a-z0-9]{2,5})['"`]/gi)) {
      const clean = decodeURIComponent(m[1]);
      if (existsSync(join(ROOT, clean))) continue;
      errors.push({
        check: "missing-asset",
        file: relative(ROOT, file),
        line: i + 1,
        msg: `reads "${clean}" from disk but that file does not exist`,
      });
    }
  });
}

/* ─────────────────────────────────────────────────────────────
   Check 2: every font-weight used is backed by a real @font-face.
   ───────────────────────────────────────────────────────────── */

/** Parse @font-face blocks into { family, weights:[min,max], srcExists }. */
function parseFontFaces(css) {
  const faces = [];
  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const block = m[1];
    const family = block.match(/font-family:\s*['"]?([^;'"]+)['"]?\s*;/)?.[1]?.trim();
    const weightRaw = block.match(/font-weight:\s*([^;]+);/)?.[1]?.trim() ?? "400";
    const src = block.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/)?.[1]?.trim();
    if (!family) continue;
    const parts = weightRaw.split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
    const [min, max] = parts.length === 2 ? parts : [parts[0] ?? 400, parts[0] ?? 400];
    const srcExists = src
      ? existsSync(join(PUBLIC_DIR, decodeURIComponent(src.split("?")[0])))
      : false;
    faces.push({ family, min, max, src, srcExists });
  }
  return faces;
}

const allCss = cssFiles.map((f) => stripCssComments(readFileSync(f, "utf8"))).join("\n");
const faces = parseFontFaces(allCss).filter((f) => f.srcExists);

if (faces.length) {
  const available = faces.flatMap((f) => {
    const out = [];
    for (let w = f.min; w <= f.max; w += 50) out.push(w);
    return out;
  });
  const maxAvailable = Math.max(...available);

  // Collect every weight actually requested, in CSS and in inline JSX styles.
  const requested = new Map(); // weight -> [{file,line}]
  const note = (w, file, line) => {
    if (!Number.isFinite(w)) return;
    if (!requested.has(w)) requested.set(w, []);
    requested.get(w).push({ file: relative(ROOT, file), line });
  };

  for (const file of cssFiles) {
    readFileSync(file, "utf8").split("\n").forEach((text, i) => {
      if (/@font-face/.test(text)) return;
      for (const m of text.matchAll(/font-weight:\s*(\d{3})/g)) note(Number(m[1]), file, i + 1);
    });
  }
  for (const file of jsxFiles) {
    readFileSync(file, "utf8").split("\n").forEach((text, i) => {
      for (const m of text.matchAll(/fontWeight:\s*["']?(\d{3})["']?/g)) note(Number(m[1]), file, i + 1);
    });
  }

  for (const [weight, sites] of [...requested.entries()].sort((a, b) => a[0] - b[0])) {
    const covered = faces.some((f) => weight >= f.min && weight <= f.max);
    if (covered) continue;
    const entry = {
      check: "font-weight-without-face",
      file: sites[0].file,
      line: sites[0].line,
      msg:
        `font-weight ${weight} is used in ${sites.length} place(s) but no @font-face provides it ` +
        `(heaviest available: ${maxAvailable}). The browser will silently render the nearest ` +
        `weight instead of failing. Text meant to be bold will not be bold.`,
    };
    // Weights above the heaviest real face are the silent-degradation case.
    if (weight > maxAvailable) warnings.push(entry);
    else errors.push(entry);
  }
}

/* ─────────────────────────────────────────────────────────────
   Check 3: type and spacing values sit on the documented scales.

   Both scales were derived from what the codebase already uses rather than
   imposed, so most values already conform. See the Scales section of
   docs/product/edge8-design-system.md for the reasoning and the numbers.

   Reported as warnings, not errors: an off-scale value is a design smell, not
   a broken build, and the remaining offenders are tracked in the inventory.
   ───────────────────────────────────────────────────────────── */

const TYPE_SCALE = [11, 12, 13, 14, 15, 16, 18, 20, 24, 28, 32, 40, 48, 64, 80];
const SPACE_SCALE = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 80, 96, 120];

const offScale = { type: new Map(), space: new Map() };
const noteOff = (kind, value, file, line) => {
  const key = String(value);
  if (!offScale[kind].has(key)) offScale[kind].set(key, { count: 0, first: `${file}:${line}` });
  offScale[kind].get(key).count++;
};

for (const file of cssFiles) {
  stripCssComments(readFileSync(file, "utf8")).split("\n").forEach((text, i) => {
    // px only. em/rem/% are relative and intentionally exempt.
    for (const m of text.matchAll(/font-size:\s*([0-9]+(?:\.[0-9]+)?)px/g)) {
      const v = Number(m[1]);
      if (!TYPE_SCALE.includes(v)) noteOff("type", v, relative(ROOT, file), i + 1);
    }
    for (const m of text.matchAll(/\b(?:gap|padding|margin):\s*([^;]+);/g)) {
      for (const p of m[1].matchAll(/([0-9]+)px/g)) {
        const v = Number(p[1]);
        if (!SPACE_SCALE.includes(v)) noteOff("space", v, relative(ROOT, file), i + 1);
      }
    }
  });
}
for (const file of jsxFiles) {
  readFileSync(file, "utf8").split("\n").forEach((text, i) => {
    for (const m of text.matchAll(/fontSize:\s*["']?([0-9]+(?:\.[0-9]+)?)(?:px)?["']?(?![0-9a-zA-Z.%])/g)) {
      const v = Number(m[1]);
      if (!TYPE_SCALE.includes(v)) noteOff("type", v, relative(ROOT, file), i + 1);
    }
  });
}

for (const [kind, label, scale] of [
  ["type", "type scale", TYPE_SCALE],
  ["space", "spacing scale", SPACE_SCALE],
]) {
  const entries = [...offScale[kind].entries()].sort((a, b) => b[1].count - a[1].count);
  if (!entries.length) continue;
  const total = entries.reduce((n, [, v]) => n + v.count, 0);
  const worst = entries.slice(0, 6).map(([v, d]) => `${v}px x${d.count}`).join(", ");
  warnings.push({
    check: `off-${kind}-scale`,
    file: entries[0][1].first.split(":")[0],
    line: Number(entries[0][1].first.split(":")[1]),
    msg:
      `${total} declaration(s) sit off the ${label} across ${entries.length} value(s): ${worst}` +
      `${entries.length > 6 ? ", ..." : ""}. Scale: ${scale.join(", ")}.`,
  });
}

/* ───────────────────────────── report ───────────────────────────── */

const label = (e) => `  ${e.file}:${e.line}\n    [${e.check}] ${e.msg}`;

if (warnings.length) {
  console.log(`\n⚠  ${warnings.length} design-system warning(s):\n`);
  warnings.forEach((w) => console.log(label(w)));
}

if (errors.length) {
  console.error(`\n✗ ${errors.length} design-system error(s):\n`);
  errors.forEach((e) => console.error(label(e)));
  console.error("");
  if (!WARN_ONLY) process.exit(1);
}

if (!errors.length && !warnings.length) {
  console.log(`✓ design assets OK: ${cssFiles.length} CSS and ${jsxFiles.length} JSX files checked`);
}
