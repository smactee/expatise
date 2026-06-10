#!/usr/bin/env node
//
// PRECISE answer-key meaning check. For each localized MCQ, compares the English
// gloss of the option marked correct against the master qid's correct-option
// English text, and flags when a DIFFERENT local option is the better meaning
// match (i.e. the answer key is wrong by meaning even though the qid is right).
//
// Needs per-option English glosses (`optionsGlossEn`), present in the batch
// imports (matched/review-needed/unresolved) — production strips them — so this
// runs against batch data.
//
// Modes:
//   --lang es --batch batch-009        check one batch (assigned key from its decisions)
//   --lang es --retro                  sweep every batch for the language; assigned key =
//                                       what actually SHIPPED (production localeCorrectOptionKey)
//
// Report-only. Writes generated/reports/answer-key-meaning-<lang>[-<batch>].json.

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  textSimilarity,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";
import { checkAnswerKeyMeaning, normalizeKey } from "../qbank-tools/lib/answer-key-consistency.mjs";

const args = parseArgs();
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const lang = String(args.lang ?? "").trim();
if (!lang) throw new Error("Provide --lang <lang>.");
const datasetPaths = getDatasetPaths(dataset, "ko");

// --- master (read-only) ---
const masterDoc = readJson(datasetPaths.questionsPath);
const masterList = Array.isArray(masterDoc?.questions) ? masterDoc.questions : Object.values(masterDoc?.questions ?? masterDoc ?? {});
const masterByQid = new Map();
for (const q of masterList) if (q?.id) masterByQid.set(q.id, q);

// --- strip a leading "A) " / "A " option-letter prefix from a gloss ---
function cleanGloss(s) {
  if (!s) return s;
  return String(s).replace(/^\s*[A-Da-d]\s*[).:\-]?\s*/, "").trim() || String(s).trim();
}
// build options [{key, glossEn}] from an item's optionsGlossEn (index -> A/B/C/D)
function optionsFromItem(item) {
  const gloss = Array.isArray(item?.optionsGlossEn) ? item.optionsGlossEn : [];
  return gloss.map((g, i) => ({ key: "ABCD"[i] ?? String(i + 1), glossEn: cleanGloss(g) }));
}

// --- load batch items keyed by itemId (matched + review-needed + unresolved) ---
function loadBatchItems(batch) {
  const out = new Map();
  for (const kind of ["matched", "review-needed", "unresolved"]) {
    const f = path.join("imports", lang, batch, `${kind}.json`);
    if (!fs.existsSync(f)) continue;
    const d = readJson(f);
    let arr = Array.isArray(d) ? d : d.items ?? d.matched ?? d.reviewNeeded ?? d.unresolved ?? [];
    if (!Array.isArray(arr)) arr = [];
    for (const it of arr) if (it?.itemId) out.set(it.itemId, it);
  }
  return out;
}

// --- map approvedQid -> {batch, itemId, confirmedKey} from decisions ---
function loadDecisions() {
  const decDir = "qbank-tools/history/decisions";
  const byQid = new Map();
  if (!fs.existsSync(decDir)) return byQid;
  for (const f of fs.readdirSync(decDir)) {
    const mm = new RegExp(`^${lang}-(batch-[\\w-]+)-workbench-decisions\\.json$`).exec(f);
    if (!mm) continue;
    const batch = mm[1];
    const doc = readJson(path.join(decDir, f));
    const items = Array.isArray(doc) ? doc : doc.items ?? [];
    for (const d of items) {
      const qid = d?.approvedQid;
      if (!qid) continue;
      byQid.set(qid, {
        batch,
        itemId: d.itemId,
        confirmedKey: normalizeKey(d.confirmedCorrectOptionKey),
        useStaged: d.useCurrentStagedAnswerKey === true,
      });
    }
  }
  return byQid;
}

const generatedAt = stableNow();
const retro = args.retro === true || args.retro === "true";
const batchArg = args.batch ? String(args.batch) : null;

const decisionsByQid = loadDecisions();
const itemCache = new Map(); // batch -> Map(itemId->item)
function itemsFor(batch) {
  if (!itemCache.has(batch)) itemCache.set(batch, loadBatchItems(batch));
  return itemCache.get(batch);
}

// production shipped keys (used as assigned key in retro mode)
const prodPath = path.join(datasetPaths.datasetDir, `translations.${lang}.json`);
const prod = fs.existsSync(prodPath) ? readJson(prodPath) : { questions: {} };
const prodQuestions = prod?.questions ?? {};

const results = [];

function checkQid(qid, { assignedKey, batch, itemId }) {
  const master = masterByQid.get(qid);
  if (!master) return;
  const items = itemsFor(batch);
  const item = items.get(itemId);
  if (!item) {
    results.push({ qid, status: "no-source-item", batch, itemId, assignedKey });
    return;
  }
  const options = optionsFromItem(item);
  if (options.length === 0) return; // not an MCQ source (ROW) — skip
  const r = checkAnswerKeyMeaning({ qid, masterQuestion: master, options, assignedKey, textSimilarity });
  results.push({ ...r, batch, itemId });
}

if (batchArg) {
  // single-batch mode: assigned key from the batch decisions
  for (const [qid, info] of decisionsByQid) {
    if (info.batch !== batchArg) continue;
    const assignedKey = info.confirmedKey ?? normalizeKey(prodQuestions[qid]?.localeCorrectOptionKey);
    checkQid(qid, { assignedKey, batch: info.batch, itemId: info.itemId });
  }
} else {
  // retro sweep: every localized qid; assigned key = what shipped to production
  for (const [qid, info] of decisionsByQid) {
    const assignedKey = normalizeKey(prodQuestions[qid]?.localeCorrectOptionKey) ?? info.confirmedKey;
    checkQid(qid, { assignedKey, batch: info.batch, itemId: info.itemId });
  }
}

// --- report ---
const summary = {};
for (const r of results) summary[r.status] = (summary[r.status] ?? 0) + 1;
const mismatches = results.filter((r) => r.status === "mismatch");
const review = results.filter((r) => ["ambiguous", "weak-evidence", "no-assigned-key", "row-has-key"].includes(r.status));

console.log(`\n=== ${lang}${batchArg ? " " + batchArg : " (retro: all batches)"} — answer-key meaning check ===`);
console.log(`  checked ${results.length} | ok ${summary.ok ?? 0} | MISMATCH ${mismatches.length} | ambiguous ${summary.ambiguous ?? 0} | weak ${summary["weak-evidence"] ?? 0} | no-src ${summary["no-source-item"] ?? 0}`);

if (mismatches.length) {
  console.log(`\n  --- MISMATCHES (answer key likely wrong by meaning) ---`);
  for (const r of mismatches.sort((a, b) => b.expectedScore - a.expectedScore)) {
    console.log(
      `   ${r.qid} [${r.batch}] assigned ${r.assignedKey} ("${trunc(r.assignedGloss)}", sim ${r.assignedScore}) ≠ expected ${r.expectedKey} ("${trunc(r.expectedGloss)}", sim ${r.expectedScore}) | master correct ${r.masterCorrectKey}: "${trunc(r.masterCorrectText)}"`,
    );
  }
}
if (review.length) {
  console.log(`\n  --- REVIEW (ambiguous / weak evidence) ---`);
  for (const r of review.sort((a, b) => (b.expectedScore ?? 0) - (a.expectedScore ?? 0)).slice(0, 40)) {
    console.log(
      `   ${r.qid} [${r.batch}] ${r.status}: assigned ${r.assignedKey} (sim ${r.assignedScore}) vs expected ${r.expectedKey} (sim ${r.expectedScore}) | master "${trunc(r.masterCorrectText)}"`,
    );
  }
  if (review.length > 40) console.log(`   … and ${review.length - 40} more (see report)`);
}

const suffix = batchArg ? `-${batchArg}` : "-retro";
const reportPath = path.join(REPORTS_DIR, `answer-key-meaning-${lang}${suffix}.json`);
await writeJson(reportPath, { generatedAt, dataset, lang, batch: batchArg, retro, summary, mismatchCount: mismatches.length, results });
console.log(`\nSummary: ${JSON.stringify(summary)}`);
console.log(`Report: ${path.relative(process.cwd(), reportPath)}`);
console.log(mismatches.length ? `\n${mismatches.length} likely-wrong answer key(s). Review the report.` : `\nNo clear answer-key meaning mismatches.`);
process.exitCode = mismatches.length > 0 ? 1 : 0;

function trunc(s, n = 44) {
  if (!s) return "";
  const t = String(s);
  return t.length > n ? t.slice(0, n) + "…" : t;
}
