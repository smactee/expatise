// scripts/validate-qbank.mjs
import fs from "node:fs";
import path from "node:path";
import { EXPECTED_TYPE_RANGES, inRange } from "./tag-dictionary.mjs";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function parseArgs() {
  const a = process.argv.slice(2);
  const get = (k) => {
    const i = a.indexOf(k);
    return i >= 0 ? a[i + 1] : null;
  };
  return {
    qpath: get("--q"),
    publicRoot: get("--publicRoot") || "public",
  };
}

function fileExists(p) {
  try { return fs.existsSync(p); } catch { return false; }
}

const { qpath, publicRoot } = parseArgs();
if (!qpath) {
  console.error("Usage: node scripts/validate-qbank.mjs --q <questions.json> [--publicRoot public]");
  process.exit(1);
}

const data = readJson(qpath);
const questions = data.questions || [];

let mcq = 0, row = 0;
const errors = [];
const typeMismatches = [];

for (const q of questions) {
  if (!q.id || !q.prompt) errors.push(`Missing id/prompt at #${q.number}`);
  if (q.type === "mcq") {
    mcq++;
    const opts = q.options || [];
    if (opts.length !== 4) errors.push(`MCQ #${q.number} has ${opts.length} options`);
    const ids = new Set(opts.map(o => o.id));
    if (!q.correctOptionId || !ids.has(q.correctOptionId)) {
      errors.push(`MCQ #${q.number} missing/invalid correctOptionId`);
    }
  } else {
    row++;
    if (!q.correctRow || !["R","W"].includes(q.correctRow)) {
      errors.push(`ROW #${q.number} missing/invalid correctRow`);
    }
  }

  // asset files exist
  for (const a of (q.assets || [])) {
    if (!a.src) errors.push(`Asset missing src at #${q.number}`);
    const disk = path.join(publicRoot, a.src.replace(/^\//, ""));
    if (!fileExists(disk)) errors.push(`Missing asset file for #${q.number}: ${disk}`);
  }
}

// Soft type validation by your ranges
for (const r of EXPECTED_TYPE_RANGES) {
  const slice = questions.filter(q => inRange(q.number, r));
  if (!slice.length) continue;
  const ok = slice.filter(q => q.type === r.expectedType).length;
  const pct = Math.round((ok / slice.length) * 100);
  if (pct < 95) {
    typeMismatches.push(`Range ${r.from}-${r.to} expected ${r.expectedType}: ${pct}% match (${ok}/${slice.length})`);
  }
}

console.log("===== QBANK VALIDATION REPORT =====");
console.log(`Total: ${questions.length}`);
console.log(`ROW:   ${row}`);
console.log(`MCQ:   ${mcq}`);
console.log("");

if (typeMismatches.length) {
  console.log("⚠️ Type mismatches (soft checks):");
  for (const m of typeMismatches) console.log(" - " + m);
  console.log("");
}

if (errors.length) {
  console.log(`❌ Errors (${errors.length}):`);
  for (const e of errors.slice(0, 50)) console.log(" - " + e);
  if (errors.length > 50) console.log(`...and ${errors.length - 50} more`);
  process.exit(1);
} else {
  console.log("✅ No hard errors found.");
}
