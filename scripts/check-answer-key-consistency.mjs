#!/usr/bin/env node
//
// Check that each localized MCQ's answer key matches its matched master qid's
// correct answer BY MEANING (not by letter — option order differs per language).
// See qbank-tools/lib/answer-key-consistency.mjs for the invariant + why this is
// needed (a correctly-matched qid can still carry a wrong local answer key, and
// the hand-confirm step rubber-stamps it past every existing gate).
//
// Usage:
//   node scripts/check-answer-key-consistency.mjs --lang es
//   node scripts/check-answer-key-consistency.mjs --all
//   node scripts/check-answer-key-consistency.mjs --preview-path qbank-tools/generated/staging/translations.es.batch-007.full.preview.json
//   (add --dataset 2023-test1 to override; default matches the pipeline default)
//
// Exit code is non-zero when any hard mismatch is found (mismatch / corrupt-map /
// master-correct-not-mapped / row-has-key), so it can gate a batch or CI.

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";
import {
  HARD_FAIL_STATUSES,
  REVIEW_STATUSES,
  checkTranslationsAgainstMaster,
} from "../qbank-tools/lib/answer-key-consistency.mjs";

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const datasetPaths = getDatasetPaths(dataset, "ko");
const datasetDir = datasetPaths.datasetDir;

// --- Load master (read-only; questions.json is human-locked) ---
const masterDoc = readJson(datasetPaths.questionsPath);
const masterList = Array.isArray(masterDoc?.questions)
  ? masterDoc.questions
  : Array.isArray(masterDoc)
    ? masterDoc
    : Object.values(masterDoc?.questions ?? masterDoc ?? {});
const masterByQid = new Map();
for (const q of masterList) {
  if (q && typeof q === "object" && q.id) masterByQid.set(q.id, q);
}

// --- Resolve which translations docs to check ---
const targets = []; // { lang, doc, sourceLabel }
if (args["preview-path"]) {
  const p = path.resolve(String(args["preview-path"]));
  const doc = readJson(p);
  const lang = String(doc?.meta?.locale ?? args.lang ?? "preview");
  targets.push({ lang, doc, sourceLabel: path.relative(process.cwd(), p) });
} else if (args.all) {
  for (const file of fs.readdirSync(datasetDir)) {
    const mm = /^translations\.([a-z-]+)\.json$/.exec(file);
    if (!mm) continue;
    targets.push({
      lang: mm[1],
      doc: readJson(path.join(datasetDir, file)),
      sourceLabel: path.relative(process.cwd(), path.join(datasetDir, file)),
    });
  }
} else {
  const lang = String(args.lang ?? "").trim();
  if (!lang) {
    throw new Error("Provide --lang <lang>, --all, or --preview-path <file>.");
  }
  const p = path.join(datasetDir, `translations.${lang}.json`);
  if (!fs.existsSync(p)) throw new Error(`Translations not found: ${path.relative(process.cwd(), p)}`);
  targets.push({ lang, doc: readJson(p), sourceLabel: path.relative(process.cwd(), p) });
}

const generatedAt = stableNow();
const allResults = [];
const overallSummary = {};
let hardFailTotal = 0;

for (const { lang, doc, sourceLabel } of targets) {
  const { results, summary } = checkTranslationsAgainstMaster({ translations: doc, masterByQid, lang });
  allResults.push(...results);
  for (const [k, v] of Object.entries(summary)) overallSummary[k] = (overallSummary[k] ?? 0) + v;

  const hard = results.filter((r) => HARD_FAIL_STATUSES.has(r.status));
  const review = results.filter((r) => REVIEW_STATUSES.has(r.status));
  const checked = results.length;
  hardFailTotal += hard.length;

  console.log(`\n=== ${lang}  (${sourceLabel}) ===`);
  console.log(
    `  checked ${checked} MCQ | ok ${summary.ok ?? 0} | ok-manual-confirmed ${summary["ok-manual-confirmed"] ?? 0} | HARD-FAIL ${hard.length} | review ${review.length}`,
  );
  if (hard.length) {
    console.log(`  --- HARD FAILS (answer key does not match master by meaning) ---`);
    for (const r of hard) {
      if (r.status === "mismatch") {
        console.log(
          `   ${r.qid} MISMATCH: local key ${r.actualKey} ("${trunc(r.localChosenText)}") ≠ master correct ${r.masterCorrectKey}/${r.masterCorrectId} ("${trunc(r.masterCorrectText)}"); expected local key(s) ${fmtKeys(r.expectedKeys)}`,
        );
      } else if (r.status === "corrupt-map") {
        console.log(
          `   ${r.qid} CORRUPT-MAP: duplicate canonical option(s) ${r.duplicateCanonicalIds.join(", ")} in meaning map (likely a wrong hand-confirm overwrite); local key ${r.actualKey}, master correct ${r.masterCorrectKey}/${r.masterCorrectId} ("${trunc(r.masterCorrectText)}")`,
        );
      } else if (r.status === "master-correct-not-mapped") {
        console.log(
          `   ${r.qid} NOT-MAPPED: no local option is meaning-aligned to master correct ${r.masterCorrectKey}/${r.masterCorrectId} ("${trunc(r.masterCorrectText)}"); local key ${r.actualKey}`,
        );
      } else if (r.status === "row-has-key") {
        console.log(`   ${r.qid} ROW-HAS-KEY: ROW/true-false master but locale carries option key ${r.actualKey}`);
      }
    }
  }
  if (review.length) {
    console.log(`  --- REVIEW (cannot fully verify from this data) ---`);
    for (const r of review) {
      if (r.status === "ok-manual-confirmed") {
        console.log(
          `   ${r.qid} manual-confirmed key ${r.actualKey} ("${trunc(r.localChosenText)}") → master correct "${trunc(r.masterCorrectText)}" (meaning trusted from hand-confirm; spot-check)`,
        );
      } else if (r.status === "no-data") {
        console.log(`   ${r.qid} no-data: missing optionMeaningMap or localeCorrectOptionKey (key=${r.actualKey})`);
      }
    }
  }
}

const reportPath = path.join(REPORTS_DIR, "answer-key-consistency.json");
await writeJson(reportPath, {
  generatedAt,
  dataset,
  targets: targets.map((t) => ({ lang: t.lang, source: t.sourceLabel })),
  summary: overallSummary,
  hardFailTotal,
  results: allResults,
});

console.log(`\nSummary: ${JSON.stringify(overallSummary)}`);
console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);
console.log(hardFailTotal > 0 ? `\nFAIL: ${hardFailTotal} answer-key/master mismatch(es).` : `\nPASS: no hard answer-key/master mismatches.`);
process.exitCode = hardFailTotal > 0 ? 1 : 0;

function trunc(s, n = 48) {
  if (!s) return "";
  const t = String(s);
  return t.length > n ? t.slice(0, n) + "…" : t;
}
function fmtKeys(keys) {
  return Array.isArray(keys) && keys.length ? keys.join("/") : "(none)";
}
