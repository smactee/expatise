#!/usr/bin/env node
//
// ship-batch — one command to take a reviewed batch from exported decisions all
// the way into production, with the dry-run safety gate enforced.
//
// Usage:
//   npm run ship-batch -- --lang es --batch batch-003
//   npm run ship-batch -- --lang es --batch batch-003 --export-dir /some/other/dir
//
// It runs the full post-review chain and ABORTS before touching production if
// anything is unsafe:
//   1. locate the reviewed export (default dir: /Users/huni/Downloads/Expatise)
//   2. pre-flight: dispositions, intra-batch duplicate qids, qids already shipped
//      for this language (would create a cross-batch duplicate), missing decisions
//   3. back up staging + copy the reviewed export onto staging
//   4. apply-batch-workbench-decisions  (builds the full preview + dry-run gate)
//   5. GATE: full-batch-merge-review must report safeToMergeNextStep && 0 blockers
//   6. apply-production-localization-merge (explicit .full.* paths — the npm
//      defaults point at the wrong, older preview files)
//   7. build-decision-memory + refresh-correction-rules (feed the matcher)
//
// The vestigial Codex-era build-codex-human-decision-memory step is intentionally
// skipped (agent-driven flow has no Codex snapshot; the match-history loop already
// captures the batch from staging).

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import {
  parseArgs,
  getDatasetPaths,
  normalizeLang,
  normalizeBatchId,
  DEFAULT_DATASET,
  STAGING_DIR,
  REPORTS_DIR,
  ROOT,
} from "../qbank-tools/lib/pipeline.mjs";
import { runBatchConsistencyCheck } from "../qbank-tools/lib/decision-consistency.mjs";

const DEFAULT_EXPORT_DIR = "/Users/huni/Downloads/Expatise";

function die(msg) {
  console.error(`\n✖ ship-batch aborted: ${msg}\n`);
  process.exit(1);
}
const ok = (msg) => console.log(`  ✓ ${msg}`);
const step = (msg) => console.log(`\n▶ ${msg}`);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

function runNpm(name, extra = []) {
  const cmd = `npm run ${name}${extra.length ? ` -- ${extra.map(String).join(" ")}` : ""}`;
  try {
    execSync(cmd, { stdio: "inherit", cwd: ROOT });
  } catch {
    die(`step "${name}" failed (see output above). Production state may be partial — check git status.`);
  }
}

const args = parseArgs();
const lang = normalizeLang(args.lang);
const batchId = normalizeBatchId(args.batch);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const exportDir = args["export-dir"] ? path.resolve(String(args["export-dir"])) : DEFAULT_EXPORT_DIR;
const allowConsistencyMismatch = args["allow-consistency-mismatch"] === true || args["allow-consistency-mismatch"] === "true";

const exportPath = path.join(exportDir, `${lang}-${batchId}-workbench-decisions.json`);
const stagingPath = path.join(STAGING_DIR, `${lang}-${batchId}-workbench-decisions.json`);
const datasetPaths = getDatasetPaths(dataset, lang);
const productionPath = datasetPaths.translationPath;
const fullPreviewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.full.preview.json`);
const fullDryRunPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.full.merge-dry-run.json`);
const mergeReviewPath = path.join(REPORTS_DIR, `full-batch-merge-review-${lang}-${batchId}.json`);

console.log(`\n=== ship-batch: ${lang} ${batchId} (dataset ${dataset}) ===`);

// 1. Locate the reviewed export.
if (!fs.existsSync(exportPath)) {
  die(`reviewed decisions not found at ${exportPath}\n  (override the folder with --export-dir <path>)`);
}
ok(`found reviewed export: ${exportPath}`);

// 2. Pre-flight safety checks on the export.
const exportDoc = readJson(exportPath);
const items = Array.isArray(exportDoc.items) ? exportDoc.items : [];
if (items.length === 0) die("export contains no items.");

const counts = { approve: 0, createNew: 0, keepUnresolved: 0, delete: 0, none: 0 };
const seenQid = new Map();
const dupIntra = new Set();
const prodDoc = fs.existsSync(productionPath) ? readJson(productionPath) : { questions: {} };
const claimedQids = new Set(Object.keys(prodDoc.questions ?? {}));
const dupClaimed = new Set();

for (const it of items) {
  const action = it.deleteQuestion
    ? "delete"
    : it.createNewQuestion
      ? "createNew"
      : it.keepUnresolved
        ? "keepUnresolved"
        : it.approvedQid
          ? "approve"
          : "none";
  counts[action] += 1;
  if (action === "approve" && it.approvedQid) {
    if (seenQid.has(it.approvedQid)) dupIntra.add(it.approvedQid);
    else seenQid.set(it.approvedQid, it.itemId);
    if (claimedQids.has(it.approvedQid)) dupClaimed.add(it.approvedQid);
  }
}

console.log(`  dispositions: ${JSON.stringify(counts)}`);
if (counts.none > 0) die(`${counts.none} item(s) have no decision. Resolve them in the workbench before shipping.`);
if (dupIntra.size > 0) die(`duplicate qids approved within this batch: ${[...dupIntra].join(", ")}`);
if (dupClaimed.size > 0) {
  die(
    `these approved qids are ALREADY localized for "${lang}" in production (shipping would duplicate): ${[...dupClaimed].join(", ")}.\n` +
    `  If you are intentionally re-shipping an already-merged batch, this guard is doing its job — stop and reconsider.`,
  );
}
if (counts.keepUnresolved > 0) console.log(`  ⚠ ${counts.keepUnresolved} item(s) kept unresolved — they will NOT be merged.`);
if (counts.createNew > 0) console.log(`  ⚠ ${counts.createNew} potential-new question(s) — held aside for the end-of-run joint review, not merged into production.`);
if (counts.delete > 0) console.log(`  ⚠ ${counts.delete} item(s) marked delete — held out of production.`);
ok(`pre-flight clean: ${counts.approve} approve, no duplicates, no missing decisions`);

// 2b. Type / numeric-option consistency gate (calibrated on es batch-007).
//     Hard-blocks an approved item whose source disagrees with its master qid on
//     question type, or whose numeric option set barely overlaps the master's.
//     Prose option overlap is intentionally NOT gated (too noisy cross-lingually).
step("decision-consistency gate (type + numeric-option mismatches)");
const consistency = runBatchConsistencyCheck({ lang, batchId, dataset, decisionsPath: exportPath });
console.log(`  findings: ${JSON.stringify(consistency.summary.byCode)} (report: ${path.relative(ROOT, consistency.reportPath)})`);
if (!consistency.ok) {
  for (const item of consistency.items) {
    for (const f of item.findings.filter((x) => x.severity === "block")) {
      console.error(`    ✗ ${item.itemId.replace(/.*at /, "")} [${item.approvedQid}] ${f.code}: ${f.message}`);
    }
  }
  if (allowConsistencyMismatch) {
    console.log(`  ⚠ ${consistency.summary.blockingItems} consistency block(s) OVERRIDDEN via --allow-consistency-mismatch`);
  } else {
    die(
      `${consistency.summary.blockingItems} approved item(s) disagree with their master qid on type/numeric-options.\n` +
      `  Fix the qid(s) in the workbench and re-export, or pass --allow-consistency-mismatch if these are deliberate.`,
    );
  }
} else {
  ok("consistency gate clean (no type/numeric-option mismatches)");
}

// 3. Back up staging, then copy the reviewed export onto staging.
if (fs.existsSync(stagingPath)) {
  const bak = `${stagingPath}.bak-ship-${Date.now()}`;
  fs.copyFileSync(stagingPath, bak);
  ok(`backed up existing staging → ${path.basename(bak)}`);
}
fs.copyFileSync(exportPath, stagingPath);
ok("merged reviewed export onto staging");

// 4. Apply decisions + build the full preview and dry-run gate.
step("apply-batch-workbench-decisions (build preview + dry-run gate)");
runNpm("apply-batch-workbench-decisions", ["--lang", lang, "--batch", batchId]);

// 5. Enforce the dry-run gate BEFORE touching production.
if (!fs.existsSync(mergeReviewPath)) die(`merge-review report not produced at ${mergeReviewPath}`);
const review = readJson(mergeReviewPath);
const blockers = Array.isArray(review.blockers) ? review.blockers : [];
if (review.safeToMergeNextStep !== true || blockers.length > 0) {
  console.error(`  safeToMergeNextStep: ${review.safeToMergeNextStep}`);
  console.error(`  blockers (${blockers.length}):`, blockers.slice(0, 10));
  die("dry-run gate is NOT clean — production was NOT touched. Fix the flagged items, re-review, re-export.");
}
if (!fs.existsSync(fullPreviewPath) || !fs.existsSync(fullDryRunPath)) {
  die("full preview / dry-run artifacts missing after apply step — not safe to merge.");
}
ok(`dry-run gate clean (safeToMergeNextStep=true, 0 blockers, ${review.totalQidsReadyForMerge ?? "?"} ready)`);

// 6. Production merge (explicit .full.* paths — npm defaults point at the wrong files).
const beforeCount = fs.existsSync(productionPath) ? Object.keys(readJson(productionPath).questions ?? {}).length : 0;
step("apply-production-localization-merge (writes production translations)");
runNpm("apply-production-localization-merge", [
  "--lang", lang,
  "--batch", batchId,
  "--preview-path", path.relative(ROOT, fullPreviewPath),
  "--dry-run-path", path.relative(ROOT, fullDryRunPath),
  "--dry-run-review-path", path.relative(ROOT, mergeReviewPath),
]);
const afterDoc = readJson(productionPath);
const afterCount = Object.keys(afterDoc.questions ?? {}).length;
ok(`production "${lang}": ${beforeCount} → ${afterCount} questions (+${afterCount - beforeCount})`);

// 7. Feed the matcher: decision memory + correction rules.
step("build-decision-memory");
runNpm("build-decision-memory");
step("refresh-correction-rules");
runNpm("refresh-correction-rules");

// 7.5 Persist potential-new questions for the end-of-run joint review.
//     apply-batch-workbench-decisions already wrote the per-batch candidates file into
//     staging; copy it into history/decisions/ (durable — survives staging cleanup) so that
//     at the end `review-new-question-promotions --lang <lang>` (no --batch) globs+aggregates
//     EVERY batch's potential-new items for one joint review.
if (counts.createNew > 0) {
  step("persist potential-new candidates for end-of-run joint review");
  const candidatesName = `new-question-candidates.${lang}.${batchId}.json`;
  const stagedCandidates = path.join(STAGING_DIR, candidatesName);
  if (fs.existsSync(stagedCandidates)) {
    const durableDir = path.join(ROOT, "qbank-tools", "history", "decisions");
    fs.mkdirSync(durableDir, { recursive: true });
    fs.copyFileSync(stagedCandidates, path.join(durableDir, candidatesName));
    ok(`${counts.createNew} potential-new question(s) persisted → review jointly later with: npm run review-new-question-promotions -- --lang ${lang}`);
  } else {
    console.warn(`  ⚠ expected candidates file ${candidatesName} not found in staging — joint review may miss this batch.`);
  }
}

// 8. Summary.
console.log(`\n=== ✓ shipped ${lang} ${batchId} ===`);
console.log(`  production translations.${lang}.json: ${afterCount} questions, mergedBatches ${JSON.stringify(afterDoc.meta?.mergedBatches ?? [])}`);
console.log(`  verify + commit: npm run guard-protected-qbank-files  &&  npm run build`);
