#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  fileExists,
  parseArgs,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

function normalizeChoiceKey(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  if (!raw) return null;
  return /^[A-Z]$/.test(raw) ? raw : null;
}

function normalizeQuestionType(value) {
  return String(value ?? "").trim().toUpperCase() === "ROW" ? "ROW" : "MCQ";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripOptionKeyPrefix(text, sourceKey) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const keyPattern = sourceKey ? escapeRegExp(sourceKey) : "[A-Z]";
  const stripped = raw.replace(
    new RegExp(`^${keyPattern}(?:[\\s\\.:：\\)\\]\\-])?\\s*`, "i"),
    ""
  ).trim();
  return stripped || raw;
}

function extractQuestionList(doc) {
  if (Array.isArray(doc)) return doc;
  if (doc && Array.isArray(doc.questions)) return doc.questions;
  return [];
}

function sanitizeAlignmentEntry(entry) {
  const sourceKey = normalizeChoiceKey(entry?.sourceKey);
  return {
    sourceIndex: Number.isFinite(entry?.sourceIndex) ? Number(entry.sourceIndex) : undefined,
    sourceKey,
    sourceText: String(entry?.sourceText ?? "").trim() || undefined,
    sourceTextBody: stripOptionKeyPrefix(entry?.sourceTextBody ?? entry?.sourceText ?? "", sourceKey) || undefined,
    canonicalOptionId: String(entry?.canonicalOptionId ?? "").trim() || undefined,
    canonicalOptionKey: normalizeChoiceKey(entry?.canonicalOptionKey),
    canonicalOptionText: String(entry?.canonicalOptionText ?? "").trim() || undefined,
    alignmentScore: Number.isFinite(entry?.alignmentScore) ? Number(entry.alignmentScore) : undefined,
    alignmentMethod: String(entry?.alignmentMethod ?? "").trim() || undefined,
    manualAnswerKeyConfirmed: entry?.manualAnswerKeyConfirmed === true ? true : undefined,
    confirmedAsCorrectKey: entry?.confirmedAsCorrectKey === true ? true : undefined,
  };
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  );
}

function sanitizeQuestionEntry(question) {
  const canonicalType = normalizeQuestionType(question?.canonicalQuestionType);
  const output = {
    prompt: String(question?.prompt ?? question?.promptRawJa ?? "").trim(),
    explanation: String(question?.explanation ?? "").trim(),
    sourceMode: "direct",
    confidence: "high",
    reviewStatus: "ready",
  };

  if (canonicalType !== "MCQ") {
    return output;
  }

  const localeOptionOrder = Array.isArray(question?.localeOptionOrder)
    ? question.localeOptionOrder.map((entry) => cleanObject(sanitizeAlignmentEntry(entry)))
    : [];
  const optionMeaningMap = Array.isArray(question?.optionMeaningMap)
    ? question.optionMeaningMap.map((entry) => cleanObject(sanitizeAlignmentEntry(entry)))
    : [];

  const orderedOptions = {};
  for (const entry of localeOptionOrder) {
    const optionId = String(entry.canonicalOptionId ?? "").trim();
    if (!optionId || optionId in orderedOptions) {
      continue;
    }
    const text = stripOptionKeyPrefix(entry.sourceTextBody ?? entry.sourceText ?? "", entry.sourceKey);
    if (text) {
      orderedOptions[optionId] = text;
    }
  }

  for (const [optionId, optionText] of Object.entries(question?.options ?? {})) {
    if (!(optionId in orderedOptions)) {
      orderedOptions[optionId] = stripOptionKeyPrefix(optionText, null);
    }
  }

  return cleanObject({
    ...output,
    options: Object.keys(orderedOptions).length > 0 ? orderedOptions : undefined,
    localeOptionOrder: localeOptionOrder.length > 0 ? localeOptionOrder : undefined,
    optionMeaningMap: optionMeaningMap.length > 0 ? optionMeaningMap : undefined,
    localeCorrectOptionKey: normalizeChoiceKey(question?.localeCorrectOptionKey),
  });
}

function validateMergedQuestion({ qid, mergedEntry, previewEntry, masterQuestion }) {
  const canonicalType = normalizeQuestionType(masterQuestion?.type);
  const localeOptionOrder = Array.isArray(mergedEntry.localeOptionOrder) ? mergedEntry.localeOptionOrder : [];
  const optionMeaningMap = Array.isArray(mergedEntry.optionMeaningMap) ? mergedEntry.optionMeaningMap : [];
  const localeCorrectOptionKey = normalizeChoiceKey(mergedEntry.localeCorrectOptionKey);
  const previewOrder = Array.isArray(previewEntry?.localeOptionOrder) ? previewEntry.localeOptionOrder : [];

  const orderPreserved =
    canonicalType !== "MCQ"
      ? true
      : JSON.stringify(
          localeOptionOrder.map((entry) => ({
            sourceKey: normalizeChoiceKey(entry?.sourceKey),
            canonicalOptionId: String(entry?.canonicalOptionId ?? "").trim(),
          }))
        ) === JSON.stringify(
          previewOrder.map((entry) => ({
            sourceKey: normalizeChoiceKey(entry?.sourceKey),
            canonicalOptionId: String(entry?.canonicalOptionId ?? "").trim(),
          }))
        );

  const mappedMeaning = canonicalType !== "MCQ"
    ? null
    : optionMeaningMap.find((entry) => normalizeChoiceKey(entry?.sourceKey) === localeCorrectOptionKey) ?? null;

  const keyPresent = canonicalType !== "MCQ" ? true : Boolean(localeCorrectOptionKey);
  const keyMapped = canonicalType !== "MCQ" ? true : Boolean(mappedMeaning);

  return {
    qid,
    type: canonicalType,
    qidExists: Boolean(masterQuestion),
    localeOptionOrderPreserved: orderPreserved,
    localeCorrectOptionKeyPresent: keyPresent,
    localeCorrectOptionKeyMapped: keyMapped,
    localeCorrectOptionKey,
    correctMeaningCanonicalOptionId: mappedMeaning?.canonicalOptionId ?? null,
  };
}

const args = parseArgs();
const lang = String(args.lang ?? "ja").trim() || "ja";
const batchId = String(args.batch ?? args.batchId ?? "batch-001").trim() || "batch-001";
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;

const previewPath = args["preview-path"]
  ? path.resolve(String(args["preview-path"]))
  : path.join(ROOT, "qbank-tools", "generated", "staging", `translations.${lang}.${batchId}.preview.json`);
const dryRunPath = args["dry-run-path"]
  ? path.resolve(String(args["dry-run-path"]))
  : path.join(ROOT, "qbank-tools", "generated", "staging", `translations.${lang}.${batchId}.merge-dry-run.json`);
const dryRunReviewPath = args["dry-run-review-path"]
  ? path.resolve(String(args["dry-run-review-path"]))
  : path.join(ROOT, "qbank-tools", "generated", "reports", `dry-run-merge-review-${lang}-${batchId}.json`);
const productionPath = path.join(ROOT, "public", "qbank", dataset, `translations.${lang}.json`);
const masterQuestionsPath = path.join(ROOT, "public", "qbank", dataset, "questions.json");
const reportJsonPath = path.join(REPORTS_DIR, `production-merge-${lang}-${batchId}.json`);
const reportMdPath = path.join(REPORTS_DIR, `production-merge-${lang}-${batchId}.md`);

const previewDoc = readJson(previewPath);
const dryRunDoc = readJson(dryRunPath);
const dryRunReview = readJson(dryRunReviewPath);
const existingProductionDoc = fileExists(productionPath)
  ? readJson(productionPath)
  : { meta: { locale: lang }, questions: {} };
const masterQuestions = extractQuestionList(readJson(masterQuestionsPath));
const masterById = new Map(masterQuestions.map((question) => [String(question?.id ?? "").trim(), question]));

const previewQuestions = previewDoc?.questions && typeof previewDoc.questions === "object" ? previewDoc.questions : {};
const qidsToMerge = Object.keys(previewQuestions).sort();
const existingCountBefore = Object.keys(existingProductionDoc.questions ?? {}).length;
const overlappingProductionQids = qidsToMerge.filter((qid) => qid in (existingProductionDoc.questions ?? {}));

const nextQuestions = {
  ...(existingProductionDoc.questions ?? {}),
};

for (const qid of qidsToMerge) {
  nextQuestions[qid] = sanitizeQuestionEntry(previewQuestions[qid]);
}

const existingCountAfter = Object.keys(nextQuestions).length;

const nextDoc = {
  meta: {
    ...(existingProductionDoc.meta ?? {}),
    locale: lang,
    translatedQuestions: existingCountAfter,
    generatedAt: new Date().toISOString(),
    mergedBatches: Array.from(
      new Set([...(existingProductionDoc.meta?.mergedBatches ?? []), batchId].map((value) => String(value)))
    ),
    localeAnswerKeySupport: true,
  },
  questions: nextQuestions,
};

await writeJson(productionPath, nextDoc);

const validations = qidsToMerge.map((qid) =>
  validateMergedQuestion({
    qid,
    mergedEntry: nextQuestions[qid],
    previewEntry: previewDoc?.questions?.[qid],
    masterQuestion: masterById.get(qid),
  })
);

const blockers = [];
for (const validation of validations) {
  if (!validation.qidExists) blockers.push(`${validation.qid}: qid not found in master questions`);
  if (!validation.localeOptionOrderPreserved) blockers.push(`${validation.qid}: locale option order mismatch`);
  if (!validation.localeCorrectOptionKeyPresent) blockers.push(`${validation.qid}: locale correct option key missing`);
  if (!validation.localeCorrectOptionKeyMapped) blockers.push(`${validation.qid}: locale correct option key did not map through optionMeaningMap`);
}

const runtimeSupport = {
  existedBeforeMerge: true,
  addedByMerge: false,
  summary: "loadDataset already applies localeOptionOrder for translated MCQs, preserves localized originalKey labels, and keeps canonical correctOptionId for scoring.",
};

const report = {
  generatedAt: new Date().toISOString(),
  lang,
  batchId,
  dataset,
  filesChanged: [
    path.relative(ROOT, productionPath),
    path.relative(ROOT, reportJsonPath),
    path.relative(ROOT, reportMdPath),
  ],
  sourcePreviewPath: path.relative(ROOT, previewPath),
  sourceDryRunPath: path.relative(ROOT, dryRunPath),
  sourceDryRunReviewPath: path.relative(ROOT, dryRunReviewPath),
  qidsMerged: qidsToMerge,
  qidCount: qidsToMerge.length,
  productionTranslatedCountBefore: existingCountBefore,
  productionTranslatedCountAfter: existingCountAfter,
  productionOverlapCount: overlappingProductionQids.length,
  overlappingProductionQids,
  runtimeSupport,
  dryRunReadyQidCount: Number(dryRunDoc?.meta?.readyQidCount ?? qidsToMerge.length),
  dryRunBlockerCount: Number(dryRunDoc?.meta?.blockerCount ?? 0),
  previousDryRunSafeToMerge: dryRunReview?.safeToMergeNextStep === true,
  validations,
  blockers,
  q0781LocaleCorrectOptionKey: nextQuestions.q0781?.localeCorrectOptionKey ?? null,
  readyForNextBatch: blockers.length === 0,
  note: `${lang} qbank content is now production-merged. Full app-locale exposure for ${lang} remains a separate concern from qbank runtime support.`,
};

const lines = [
  `# Production Merge Report · ${lang} ${batchId}`,
  "",
  `- Dataset: ${dataset}`,
  `- Qids merged: ${qidsToMerge.length}`,
  `- Production translated count before merge: ${existingCountBefore}`,
  `- Production translated count after merge: ${existingCountAfter}`,
  `- Production overlap count: ${overlappingProductionQids.length}`,
  `- Runtime support already existed: ${report.runtimeSupport.existedBeforeMerge ? "yes" : "no"}`,
  `- Runtime support added: ${report.runtimeSupport.addedByMerge ? "yes" : "no"}`,
  `- Ready for next batch: ${blockers.length === 0 ? "yes" : "no"}`,
  "",
  "## Files Changed",
  ...report.filesChanged.map((filePath) => `- ${filePath}`),
  "",
  "## Qids Merged",
  ...qidsToMerge.map((qid) => `- ${qid}`),
  "",
  "## Validation",
  ...validations.map((validation) => {
    const bits = [
      validation.type,
      `order=${validation.localeOptionOrderPreserved ? "ok" : "bad"}`,
      `key=${validation.localeCorrectOptionKeyPresent ? validation.localeCorrectOptionKey ?? "n/a" : "missing"}`,
      `mapped=${validation.localeCorrectOptionKeyMapped ? "ok" : "bad"}`,
    ];
    return `- ${validation.qid}: ${bits.join(", ")}`;
  }),
];

if (blockers.length > 0) {
  lines.push("", "## Blockers", ...blockers.map((blocker) => `- ${blocker}`));
}

await writeJson(reportJsonPath, report);
await writeText(reportMdPath, `${lines.join("\n")}\n`);

console.log(`Merged ${qidsToMerge.length} ${lang} localization(s) into ${path.relative(ROOT, productionPath)}.`);
