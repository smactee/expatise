// decision-consistency — guardrail that flags localized review decisions whose
// approved master qid disagrees with the source item on QUESTION TYPE or on a
// NUMERIC option set. Both signals were calibrated on es batch-007 (2026-06-05):
//   - type mismatch:        0 false-positives across the batch's final decisions
//   - numeric-option gate:  all 10 correct numeric-MCQ matches scored 1.0;
//                           the one wrong pick (q1006 vs q0498) scored 0.33.
// A threshold of 0.5 catches the wrong pick, tolerates one OCR'd-number error,
// and never trips a correct match.
//
// IMPORTANT: general (prose) option-set overlap is intentionally NOT gated —
// cross-lingual glossing makes it too noisy (≈60% of CORRECT matches scored <0.5
// in calibration). Only numeric option sets, where digits are language-invariant,
// are reliable enough to hard-gate.

import fs from "node:fs";
import path from "node:path";
import { getBatchFiles, getDatasetPaths, REPORTS_DIR, normalizeLang, normalizeBatchId } from "./pipeline.mjs";

export const NUMERIC_OVERLAP_GATE = 0.5;

// True/False answer tokens across the locales this project handles, so a 2-option
// "Verdadero / Falso" item declared MCQ is recognized as an effective ROW.
const TRUE_FALSE_TOKENS = [
  "true", "false", "verdadero", "falso", "vrai", "faux", "richtig", "falsch",
  "correcto", "incorrecto", "正确", "错误", "对", "错", "正しい", "間違い",
  "правда", "ложь", "верно", "неверно", "صحيح", "خطأ", "예", "아니오",
];

export function normalizeQuestionType(value) {
  if (!value) return null;
  const u = String(value).trim().toUpperCase();
  if (["ROW", "TRUE_FALSE", "TRUEFALSE", "TF", "BOOLEAN"].includes(u)) return "ROW";
  if (["MCQ", "MULTIPLE_CHOICE", "MULTIPLE-CHOICE", "CHOICE"].includes(u)) return "MCQ";
  return u;
}

function stripOptionLabel(value) {
  return String(value ?? "").replace(/^\s*[A-Da-d]\s*[).:\-]\s*/, "").trim();
}

export function optionTexts(options) {
  if (!Array.isArray(options)) return [];
  return options
    .map((o) => stripOptionLabel(typeof o === "string" ? o : o?.text ?? o?.label ?? o?.value ?? ""))
    .filter(Boolean);
}

export function isTrueFalseOptionSet(options) {
  const texts = optionTexts(options).map((t) => t.toLowerCase());
  if (texts.length < 1 || texts.length > 2) return false;
  return texts.every((t) => TRUE_FALSE_TOKENS.some((tok) => t === tok || t.split(/\s+/).includes(tok)));
}

export function isNumericOptionSet(options) {
  const texts = optionTexts(options);
  if (texts.length < 3) return false;
  const withNumber = texts.filter((t) => /\d/.test(t)).length;
  // nearly every option must be a number (speeds, distances, points, fines, days…)
  return withNumber >= Math.max(3, texts.length - 1);
}

export function extractNumbers(options) {
  const set = new Set();
  for (const t of optionTexts(options)) {
    const cleaned = t.replace(/(\d)[,\s](\d{3})\b/g, "$1$2"); // 12,000 / 12 000 -> 12000
    const matches = cleaned.match(/\d+(?:\.\d+)?/g);
    if (matches) matches.forEach((m) => set.add(parseFloat(m)));
  }
  return set;
}

export function numericJaccard(a, b) {
  if (!a.size || !b.size) return null;
  let intersection = 0;
  for (const x of a) if (b.has(x)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

// Derive the effective source type from option shape when the matcher didn't supply one.
export function deriveSourceType(sourceOptions) {
  if (isTrueFalseOptionSet(sourceOptions)) return "ROW";
  const texts = optionTexts(sourceOptions);
  if (texts.length >= 3) return "MCQ";
  if (texts.length === 0) return "ROW"; // bare statement, no options
  return null; // 1–2 non-true/false options: ambiguous, don't assert
}

// Core check for a single matched item. Returns an array of findings (possibly empty).
export function checkItemConsistency({ approvedQid, effectiveSourceType, masterType, sourceOptions, masterOptions }) {
  const findings = [];
  const srcType = normalizeQuestionType(effectiveSourceType) ?? deriveSourceType(sourceOptions);
  const mstType = normalizeQuestionType(masterType);

  if (srcType && mstType && srcType !== mstType) {
    findings.push({
      code: "type-mismatch",
      severity: "block",
      sourceType: srcType,
      masterType: mstType,
      message: `source is ${srcType} but approved master ${approvedQid} is ${mstType}`,
    });
  }

  // Numeric option-set gate — only when BOTH sides are numeric MCQs.
  if (mstType === "MCQ" && isNumericOptionSet(sourceOptions) && isNumericOptionSet(masterOptions)) {
    const overlap = numericJaccard(extractNumbers(sourceOptions), extractNumbers(masterOptions));
    if (overlap != null && overlap < NUMERIC_OVERLAP_GATE) {
      findings.push({
        code: "numeric-option-mismatch",
        severity: "block",
        numericOverlap: Number(overlap.toFixed(2)),
        threshold: NUMERIC_OVERLAP_GATE,
        sourceNumbers: [...extractNumbers(sourceOptions)].sort((a, b) => a - b),
        masterNumbers: [...extractNumbers(masterOptions)].sort((a, b) => a - b),
        message: `numeric option overlap ${overlap.toFixed(2)} < ${NUMERIC_OVERLAP_GATE} vs master ${approvedQid}`,
      });
    }
  }

  return findings;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function itemsOf(doc) {
  if (!doc) return [];
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc.items)) return doc.items;
  return [];
}

// Run the guardrail over a batch's reviewed decisions. Loads source options from
// intake, the matcher's effectiveQuestionType from matched/review/unresolved, and
// the master from questions.json. Writes a report and returns a summary.
export function runBatchConsistencyCheck({
  lang,
  batchId,
  dataset = undefined,
  decisionsPath,
  reportPath = undefined,
  write = true,
}) {
  const safeLang = normalizeLang(lang);
  const safeBatch = normalizeBatchId(batchId);
  const { intakePath, matchedPath, reviewNeededPath, unresolvedPath } = getBatchFiles(safeLang, safeBatch);
  const { questionsPath } = getDatasetPaths(...(dataset ? [dataset] : []));

  const decisions = itemsOf(readJson(decisionsPath));
  const intake = itemsOf(fs.existsSync(intakePath) ? readJson(intakePath) : null);
  const questions = (readJson(questionsPath).questions ?? []);
  const qById = new Map(questions.map((q) => [q.id, q]));

  // effectiveQuestionType per itemId from matcher outputs
  const effByItem = new Map();
  for (const p of [matchedPath, reviewNeededPath, unresolvedPath]) {
    if (!fs.existsSync(p)) continue;
    for (const it of itemsOf(readJson(p))) {
      const eff = it.analysis?.effectiveQuestionType ?? it.effectiveQuestionType ?? null;
      if (it.itemId && eff && !effByItem.has(it.itemId)) effByItem.set(it.itemId, eff);
    }
  }

  const intakeByItem = new Map(intake.map((it) => [it.itemId, it]));
  const checked = [];
  for (const d of decisions) {
    if (d.deleteQuestion === true || d.createNewQuestion === true || d.keepUnresolved === true) continue;
    if (!d.approvedQid) continue;
    const master = qById.get(d.approvedQid);
    if (!master) {
      checked.push({ itemId: d.itemId, approvedQid: d.approvedQid, findings: [{ code: "unknown-qid", severity: "block", message: `approved qid ${d.approvedQid} not found in master` }] });
      continue;
    }
    const src = intakeByItem.get(d.itemId) ?? {};
    const sourceOptions = src.optionsRaw?.length ? src.optionsRaw : (src.optionsTranslated ?? src.translatedOptions ?? []);
    const findings = checkItemConsistency({
      approvedQid: d.approvedQid,
      effectiveSourceType: effByItem.get(d.itemId) ?? null,
      masterType: master.type,
      sourceOptions,
      masterOptions: master.options ?? [],
    });
    if (findings.length) checked.push({ itemId: d.itemId, approvedQid: d.approvedQid, findings });
  }

  const blocks = checked.filter((c) => c.findings.some((f) => f.severity === "block"));
  const resolvedReportPath = reportPath ?? path.join(REPORTS_DIR, `decision-consistency-${safeLang}-${safeBatch}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    lang: safeLang,
    batchId: safeBatch,
    decisionsPath,
    gate: { numericOverlapThreshold: NUMERIC_OVERLAP_GATE },
    summary: {
      approvedDecisions: decisions.filter((d) => d.approvedQid && !d.deleteQuestion && !d.createNewQuestion && !d.keepUnresolved).length,
      itemsWithFindings: checked.length,
      blockingItems: blocks.length,
      byCode: checked.flatMap((c) => c.findings).reduce((acc, f) => ((acc[f.code] = (acc[f.code] ?? 0) + 1), acc), {}),
    },
    ok: blocks.length === 0,
    items: checked,
  };

  if (write) {
    fs.mkdirSync(path.dirname(resolvedReportPath), { recursive: true });
    fs.writeFileSync(resolvedReportPath, JSON.stringify(report, null, 2));
  }

  return { ...report, reportPath: resolvedReportPath };
}
