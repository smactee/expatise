#!/usr/bin/env node
//
// Apply the human-reviewed answer-key corrections from the es answer-key review
// workbench (2026-06-11), plus the q0780 master-answer ripple across all
// localized languages.
//
// Two jobs:
//  1. Six es answer-key corrections (human-confirmed via the review workbench):
//     the shipped localeCorrectOptionKey pointed at the wrong local option.
//     For each, rebuild the qid's option alignment from the batch's English
//     glosses (one-to-one assignment vs master options), set the confirmed key,
//     and re-home the canonical-keyed `options` texts accordingly.
//  2. q0780 ripple: the master correct answer changed q0780_o2 ("narrow bridge")
//     → q0780_o3 ("narrow road") — owner-approved master cleanup corroborated by
//     the master's own answerRaw:"C". Every language's local key must follow.
//     For map-carrying languages whose stamped entry hid the true alignment, the
//     true canonical id is recovered by process of elimination (the one id no
//     reviewed entry claims).
//
// Validations: after edits, every touched qid must have (a) exactly one
// confirmedAsCorrectKey entry, (b) that entry's canonicalOptionId == master
// correctOptionId, (c) `options` keyed by exactly the master option ids.

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  getDatasetPaths,
  readJson,
  stableNow,
  textSimilarity,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const dataset = DEFAULT_DATASET;
const datasetPaths = getDatasetPaths(dataset, "ko");
const appliedAt = stableNow();

const masterDoc = readJson(datasetPaths.questionsPath);
const masterByQid = new Map(masterDoc.questions.filter((q) => q?.id).map((q) => [q.id, q]));

// ---------- helpers ----------
function cleanGloss(s) {
  if (!s) return "";
  return String(s).replace(/^\s*[A-Da-d]\s*[).:\-]?\s*/, "").trim() || String(s).trim();
}

// exhaustive 1:1 assignment, 4x4 max — mirrors chooseBestAssignment in
// build-full-batch-staging-preview.mjs
function assignOptions(localGlosses, masterOptions) {
  let bestTotal = -Infinity;
  let bestMap = null;
  const n = localGlosses.length;
  function walk(i, used, total, mapping) {
    if (i >= n) {
      if (total > bestTotal) {
        bestTotal = total;
        bestMap = [...mapping];
      }
      return;
    }
    for (const mo of masterOptions) {
      if (used.has(mo.id)) continue;
      const score = Number(textSimilarity(localGlosses[i], mo.text)) || 0;
      used.add(mo.id);
      mapping.push({ localIndex: i, master: mo, score });
      walk(i + 1, used, total + score, mapping);
      mapping.pop();
      used.delete(mo.id);
    }
  }
  walk(0, new Set(), 0, []);
  return bestMap ?? [];
}

function setEntryCanonical(entry, masterOption, { score = null, method, confirmed = false }) {
  entry.canonicalOptionId = masterOption.id;
  entry.canonicalOptionKey = masterOption.originalKey;
  entry.canonicalOptionText = masterOption.text;
  if (score != null) entry.alignmentScore = score;
  entry.alignmentMethod = method;
  if (confirmed) {
    entry.manualAnswerKeyConfirmed = true;
    entry.confirmedAsCorrectKey = true;
  } else {
    delete entry.manualAnswerKeyConfirmed;
    delete entry.confirmedAsCorrectKey;
  }
}

function rebuildOptionsDict(question, entries) {
  const next = {};
  for (const e of entries) {
    if (e?.canonicalOptionId) next[e.canonicalOptionId] = e.sourceTextBody ?? e.sourceText ?? "";
  }
  question.options = next;
}

function validateQid({ lang, qid, question, master }) {
  const errors = [];
  const entries = question.optionMeaningMap ?? [];
  const confirmed = entries.filter((e) => e?.confirmedAsCorrectKey === true);
  if (entries.length) {
    if (confirmed.length !== 1) errors.push(`${lang}/${qid}: ${confirmed.length} confirmedAsCorrectKey entries (want 1)`);
    const keyEntry = entries.find((e) => e?.sourceKey === question.localeCorrectOptionKey);
    if (!keyEntry) errors.push(`${lang}/${qid}: localeCorrectOptionKey ${question.localeCorrectOptionKey} not in meaning map`);
    else if (keyEntry.canonicalOptionId !== master.correctOptionId)
      errors.push(`${lang}/${qid}: key entry aligns to ${keyEntry.canonicalOptionId}, master correct is ${master.correctOptionId}`);
    const ids = entries.map((e) => e?.canonicalOptionId).sort();
    const want = master.options.map((o) => o.id).sort();
    if (JSON.stringify(ids) !== JSON.stringify(want)) errors.push(`${lang}/${qid}: canonical ids ${ids} != master ${want}`);
    const optIds = Object.keys(question.options ?? {}).sort();
    if (JSON.stringify(optIds) !== JSON.stringify(want)) errors.push(`${lang}/${qid}: options dict keys ${optIds} != master ${want}`);
  }
  return errors;
}

const changeLog = [];
const allErrors = [];

// ---------- job 1: six es corrections ----------
const ES_FIXES = [
  { qid: "q0517", batch: "batch-007", newKey: "D" },
  { qid: "q0164", batch: "batch-011", newKey: "C" },
  { qid: "q0107", batch: "batch-009", newKey: "A" },
  { qid: "q0816", batch: "batch-009", newKey: "D" },
  { qid: "q0623", batch: "batch-008", newKey: "C" },
  { qid: "q0890", batch: "batch-009", newKey: "B" },
];

function batchItemFor(lang, batch, qid) {
  // find the batch item whose decision approved this qid
  const decPath = path.join("qbank-tools/history/decisions", `${lang}-${batch}-workbench-decisions.json`);
  const dec = readJson(decPath);
  const items = Array.isArray(dec) ? dec : dec.items ?? [];
  const d = items.find((x) => x?.approvedQid === qid);
  if (!d) throw new Error(`No decision for ${qid} in ${decPath}`);
  for (const kind of ["matched", "review-needed", "unresolved"]) {
    const f = path.join("imports", lang, batch, `${kind}.json`);
    if (!fs.existsSync(f)) continue;
    const doc = readJson(f);
    let arr = Array.isArray(doc) ? doc : doc.items ?? doc.matched ?? doc.reviewNeeded ?? doc.unresolved ?? [];
    if (!Array.isArray(arr)) arr = [];
    const it = arr.find((x) => x?.itemId === d.itemId);
    if (it) return it;
  }
  throw new Error(`No batch item ${d.itemId} for ${qid} in ${batch}`);
}

const esPath = path.join(datasetPaths.datasetDir, "translations.es.json");
const esDoc = readJson(esPath);

for (const fix of ES_FIXES) {
  const master = masterByQid.get(fix.qid);
  const question = esDoc.questions[fix.qid];
  if (!master || !question) throw new Error(`Missing master or es entry for ${fix.qid}`);
  const item = batchItemFor("es", fix.batch, fix.qid);
  const glosses = (item.optionsGlossEn ?? []).map(cleanGloss);
  const assignment = assignOptions(glosses, master.options);

  for (const listName of ["localeOptionOrder", "optionMeaningMap"]) {
    const entries = question[listName] ?? [];
    for (const entry of entries) {
      const idx = entry.sourceIndex ?? "ABCD".indexOf(entry.sourceKey);
      const a = assignment.find((x) => x.localIndex === idx);
      if (!a) continue;
      const isConfirmedKey = entry.sourceKey === fix.newKey;
      if (isConfirmedKey && a.master.id !== master.correctOptionId) {
        // Human confirmed this key as correct; trust the human over the gloss
        // assignment. Swap: give this entry the master correct option, and give
        // the entry the assignment wanted for it to whoever held master-correct.
        const holder = assignment.find((x) => x.master.id === master.correctOptionId);
        if (holder) holder.master = a.master;
        a.master = master.options.find((o) => o.id === master.correctOptionId);
        a.score = null;
      }
      setEntryCanonical(entry, a.master, {
        score: a.score,
        method: isConfirmedKey ? "manual-answer-key-confirmed" : "reviewed-gloss-meaning",
        confirmed: isConfirmedKey,
      });
    }
  }
  const oldKey = question.localeCorrectOptionKey;
  question.localeCorrectOptionKey = fix.newKey;
  question.answerKeyConfirmationReason = `Answer-key meaning review 2026-06-11: reviewer changed locale key from ${oldKey} to ${fix.newKey} (master ${fix.qid} correct: ${master.options.find((o) => o.id === master.correctOptionId)?.text}).`;
  question.answerKeyConfirmedAt = appliedAt;
  rebuildOptionsDict(question, question.optionMeaningMap);
  allErrors.push(...validateQid({ lang: "es", qid: fix.qid, question, master }));
  changeLog.push({ lang: "es", qid: fix.qid, change: `key ${oldKey} -> ${fix.newKey} + map rebuild` });
}

// ---------- job 2: q0780 ripple ----------
const masterQ0780 = masterByQid.get("q0780");
if (masterQ0780.correctOptionId !== "q0780_o3") throw new Error("Master q0780 fix not applied — run after the master edit.");
const o3 = masterQ0780.options.find((o) => o.id === "q0780_o3");

for (const lang of ["en-orig", "ko", "es", "fr", "ja", "ru"]) {
  const p = path.join(datasetPaths.datasetDir, `translations.${lang}.json`);
  const doc = lang === "es" ? esDoc : readJson(p);
  const q = doc.questions?.q0780;
  if (!q) continue;
  const oldKey = q.localeCorrectOptionKey;

  if (!Array.isArray(q.optionMeaningMap) || q.optionMeaningMap.length === 0) {
    // positional languages (en-orig, ko): options keyed canonically in master
    // order, letter = position. o3 is position 2 -> "C".
    q.localeCorrectOptionKey = "C";
    changeLog.push({ lang, qid: "q0780", change: `key ${oldKey} -> C (positional, master fix ripple)` });
  } else {
    // Map-carrying languages. Recover the stamped entry's TRUE alignment by
    // process of elimination, then point the key at the entry aligned to o3.
    for (const listName of ["localeOptionOrder", "optionMeaningMap"]) {
      const entries = q[listName] ?? [];
      const stamped = entries.filter((e) => e.alignmentMethod === "manual-answer-key-confirmed");
      const reviewedIds = new Set(entries.filter((e) => e.alignmentMethod !== "manual-answer-key-confirmed").map((e) => e.canonicalOptionId));
      const leftover = masterQ0780.options.filter((o) => !reviewedIds.has(o.id));
      for (const e of stamped) {
        const trueOption = leftover.length === 1 ? leftover[0] : masterQ0780.options.find((o) => o.id === e.canonicalOptionId);
        setEntryCanonical(e, trueOption, { method: "reviewed-gloss-meaning", confirmed: false });
      }
      const keyEntry = entries.find((e) => e.canonicalOptionId === "q0780_o3");
      if (!keyEntry) throw new Error(`${lang}/q0780: no entry aligns to q0780_o3 after elimination`);
      setEntryCanonical(keyEntry, o3, { method: "manual-answer-key-confirmed", confirmed: true });
      if (listName === "optionMeaningMap") {
        q.localeCorrectOptionKey = keyEntry.sourceKey;
      }
    }
    q.answerKeyConfirmationReason = `Master q0780 answer corrected to "narrow road" (owner-approved 2026-06-11, answerRaw:"C" corroborates); locale key realigned by meaning.`;
    q.answerKeyConfirmedAt = appliedAt;
    rebuildOptionsDict(q, q.optionMeaningMap);
    allErrors.push(...validateQid({ lang, qid: "q0780", question: q, master: masterQ0780 }));
    changeLog.push({ lang, qid: "q0780", change: `key ${oldKey} -> ${q.localeCorrectOptionKey} + map repair (master fix ripple)` });
  }
  if (lang !== "es") await writeJson(p, doc);
}
await writeJson(esPath, esDoc);

// ---------- report ----------
if (allErrors.length) {
  console.error("VALIDATION FAILURES:");
  for (const e of allErrors) console.error("  " + e);
  process.exitCode = 1;
} else {
  console.log("All touched qids validated clean.");
}
for (const c of changeLog) console.log(`  ${c.lang} ${c.qid}: ${c.change}`);
await writeJson(path.join(REPORTS_DIR, "answer-key-review-fixes-2026-06-11.json"), {
  appliedAt,
  masterEdit: { qid: "q0780", from: "q0780_o2 (narrow bridge)", to: "q0780_o3 (narrow road)", evidence: "owner cross-question review + master answerRaw:'C'" },
  esFixes: ES_FIXES,
  changeLog,
  errors: allErrors,
});
console.log("Report: qbank-tools/generated/reports/answer-key-review-fixes-2026-06-11.json");
