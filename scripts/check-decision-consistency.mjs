#!/usr/bin/env node
// check-decision-consistency — runs the type / numeric-option guardrail over a
// batch's reviewed (or in-progress) workbench decisions and prints which approved
// items disagree with their master qid. Exits non-zero when blocking findings
// exist, so it can gate a ship.
//
// Usage:
//   npm run check-decision-consistency -- --lang es --batch batch-007
//   npm run check-decision-consistency -- --lang es --batch batch-007 --decisions /path/to/decisions.json
//
// Defaults to the staging workbench decisions; pass --decisions to point at an
// exported reviewed file.

import path from "node:path";
import { parseArgs, stringArg, normalizeLang, normalizeBatchId, STAGING_DIR } from "../qbank-tools/lib/pipeline.mjs";
import { runBatchConsistencyCheck } from "../qbank-tools/lib/decision-consistency.mjs";

const args = parseArgs();
const lang = normalizeLang(stringArg(args, "lang"));
const batchId = normalizeBatchId(stringArg(args, "batch"));

if (!lang || !batchId) {
  console.error("usage: --lang <lang> --batch <batch> [--decisions <path>]");
  process.exit(2);
}

const decisionsPath =
  stringArg(args, "decisions") ??
  path.join(STAGING_DIR, `${lang}-${batchId}-workbench-decisions.json`);

const report = runBatchConsistencyCheck({ lang, batchId, decisionsPath });

console.log(`decision-consistency: ${lang} ${batchId}`);
console.log(`  decisions:          ${decisionsPath}`);
console.log(`  approved checked:   ${report.summary.approvedDecisions}`);
console.log(`  items w/ findings:  ${report.summary.itemsWithFindings}`);
console.log(`  blocking items:     ${report.summary.blockingItems}`);
console.log(`  by code:            ${JSON.stringify(report.summary.byCode)}`);

for (const item of report.items) {
  const short = item.itemId.replace(/.*at /, "");
  for (const f of item.findings) {
    const mark = f.severity === "block" ? "✗" : "⚠";
    console.log(`  ${mark} ${short} [${item.approvedQid}] ${f.code}: ${f.message}`);
  }
}

console.log(`  report:             ${report.reportPath}`);

if (!report.ok) {
  console.error(`\n✗ ${report.summary.blockingItems} item(s) have blocking type/option mismatches.`);
  process.exit(1);
}
console.log("\n✓ no blocking type/option mismatches.");
