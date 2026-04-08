#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const previewPath = args["preview-path"]
  ? path.resolve(String(args["preview-path"]))
  : path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);
const decisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-answer-key-decisions.json`);
const reportPath = path.join(REPORTS_DIR, `apply-answer-key-decisions-${lang}-${batchId}.json`);

await ensurePipelineDirs({ lang, batchId });

if (!fileExists(previewPath)) {
  throw new Error(`Staged preview not found: ${path.relative(process.cwd(), previewPath)}`);
}

if (!fileExists(decisionsPath)) {
  throw new Error(`Answer-key decisions not found: ${path.relative(process.cwd(), decisionsPath)}`);
}

const datasetPaths = getDatasetPaths(dataset, "ko");
const productionPaths = listProductionFiles(datasetPaths);
const productionHashesBefore = hashFiles(productionPaths);
const appliedAt = stableNow();

const previewDoc = readJson(previewPath);
const decisionsDoc = readJson(decisionsPath);
const questions = previewDoc?.questions && typeof previewDoc.questions === "object"
  ? previewDoc.questions
  : {};
const decisions = Array.isArray(decisionsDoc.items) ? decisionsDoc.items : [];

const updatedQids = [];
const changedQids = [];
const preservedSnapshots = new Map();
const validationErrors = [];

for (const rawDecision of decisions) {
  const decision = normalizeDecision(rawDecision);
  const question = questions[decision.qid];

  if (!question || typeof question !== "object") {
    validationErrors.push(`Missing staged preview entry for ${decision.qid}.`);
    continue;
  }

  if (String(question.canonicalQuestionType ?? "").toUpperCase() !== "MCQ") {
    continue;
  }

  preservedSnapshots.set(decision.qid, {
    localeOptionOrder: snapshotOptionOrder(question.localeOptionOrder),
    optionsRawJa: snapshotArray(question.optionsRawJa),
    optionsGlossEn: snapshotArray(question.optionsGlossEn),
  });

  if (decision.unknown) {
    question.answerKeyNeedsManualConfirmation = true;
    question.answerKeyConfirmationReason = "Reviewer marked the locale-specific answer key as unknown. Keep this item in manual confirmation.";
    question.answerKeyConfirmedAt = null;
    question.answerKeyDecisionSourcePath = path.relative(process.cwd(), decisionsPath);
    question.answerKeyReviewerNotes = decision.reviewerNotes;
    updatedQids.push(decision.qid);
    continue;
  }

  if (!decision.confirmedCorrectOptionKey) {
    validationErrors.push(`No confirmedCorrectOptionKey provided for ${decision.qid}.`);
    continue;
  }

  const previousKey = normalizeChoiceKey(question.localeCorrectOptionKey);
  const confirmedKey = decision.confirmedCorrectOptionKey;
  const localeOptionEntry = findEntryByKey(question.localeOptionOrder, confirmedKey);
  const meaningEntry = findEntryByKey(question.optionMeaningMap, confirmedKey);

  if (!localeOptionEntry) {
    validationErrors.push(`Confirmed locale key ${confirmedKey} is not present in localeOptionOrder for ${decision.qid}.`);
    continue;
  }

  if (!meaningEntry) {
    validationErrors.push(`Confirmed locale key ${confirmedKey} is not present in optionMeaningMap for ${decision.qid}.`);
    continue;
  }

  question.localeCorrectOptionKey = confirmedKey;
  question.answerKeyNeedsManualConfirmation = false;
  question.answerKeyConfirmationReason = previousKey && previousKey !== confirmedKey
    ? `Confirmed via exported answer-key review decision on ${appliedAt}; reviewer changed locale key from ${previousKey} to ${confirmedKey}.`
    : `Confirmed via exported answer-key review decision on ${appliedAt}.`;
  question.answerKeyConfirmedAt = appliedAt;
  question.answerKeyDecisionSourcePath = path.relative(process.cwd(), decisionsPath);
  question.answerKeyReviewerNotes = decision.reviewerNotes;

  applyConfirmedMapping(question, {
    confirmedKey,
    localeOptionEntry,
    meaningEntry,
  });

  updatedQids.push(decision.qid);
  if (previousKey !== confirmedKey) {
    changedQids.push(decision.qid);
  }
}

if (validationErrors.length > 0) {
  throw new Error(validationErrors.join("\n"));
}

previewDoc.meta = {
  ...(previewDoc.meta && typeof previewDoc.meta === "object" ? previewDoc.meta : {}),
  locale: lang,
  generatedAt: appliedAt,
  dataset,
  sourceAnswerKeyDecisionPath: path.relative(process.cwd(), decisionsPath),
  answerKeyConfirmedCount: updatedQids.filter((qid) => questions[qid]?.answerKeyNeedsManualConfirmation === false).length,
  manualAnswerKeyConfirmationCount: Object.values(questions)
    .filter((question) => question?.answerKeyNeedsManualConfirmation === true)
    .length,
};

const validations = [];
for (const rawDecision of decisions) {
  const decision = normalizeDecision(rawDecision);
  const question = questions[decision.qid];
  if (!question || String(question.canonicalQuestionType ?? "").toUpperCase() !== "MCQ") {
    continue;
  }

  const snapshot = preservedSnapshots.get(decision.qid);
  const orderPreserved =
    snapshotOptionOrder(question.localeOptionOrder) === snapshot.localeOptionOrder &&
    snapshotArray(question.optionsRawJa) === snapshot.optionsRawJa &&
    snapshotArray(question.optionsGlossEn) === snapshot.optionsGlossEn;

  const localeKeyPresent = decision.unknown
    ? true
    : normalizeChoiceKey(question.localeCorrectOptionKey) === decision.confirmedCorrectOptionKey;

  const mappedEntry = findEntryByKey(question.optionMeaningMap, question.localeCorrectOptionKey);
  const mappingMatches = decision.unknown
    ? true
    : Boolean(
      mappedEntry &&
      mappedEntry.canonicalOptionId === question.canonicalCorrectOptionId &&
      mappedEntry.canonicalOptionKey === question.canonicalCorrectOptionKey,
    );

  const alignmentMatches = decision.unknown
    ? true
    : Boolean(
      question.correctOptionAlignment &&
      normalizeChoiceKey(question.correctOptionAlignment.sourceKey) === decision.confirmedCorrectOptionKey &&
      question.correctOptionAlignment.canonicalOptionId === question.canonicalCorrectOptionId,
    );

  validations.push({
    qid: decision.qid,
    localeOptionOrderPreserved: orderPreserved,
    localeCorrectOptionKeyApplied: localeKeyPresent,
    optionMeaningMapAligned: mappingMatches,
    correctOptionAlignmentAligned: alignmentMatches,
  });
}

const productionHashesAfter = hashFiles(productionPaths);
const productionFilesUnchanged = compareHashes(productionHashesBefore, productionHashesAfter);

if (!productionFilesUnchanged) {
  throw new Error("Production qbank files changed unexpectedly during answer-key application.");
}

const validationFailures = validations.filter((row) =>
  !row.localeOptionOrderPreserved ||
  !row.localeCorrectOptionKeyApplied ||
  !row.optionMeaningMapAligned ||
  !row.correctOptionAlignmentAligned
);

if (validationFailures.length > 0) {
  throw new Error(`Validation failed for ${validationFailures.map((row) => row.qid).join(", ")}.`);
}

await writeJson(previewPath, previewDoc);
await writeJson(reportPath, {
  generatedAt: appliedAt,
  lang,
  batchId,
  dataset,
  previewPath: path.relative(process.cwd(), previewPath),
  sourceDecisionsPath: path.relative(process.cwd(), decisionsPath),
  appliedCount: updatedQids.length,
  changedQids,
  unchangedQids: updatedQids.filter((qid) => !changedQids.includes(qid)),
  readyForDryRunMergeReview: previewDoc.meta.manualAnswerKeyConfirmationCount === 0,
  validations,
  productionFilesUnchanged,
  productionFiles: productionPaths.map((filePath) => path.relative(process.cwd(), filePath)),
});

console.log(
  `Applied ${updatedQids.length} answer-key confirmation(s); changed keys for ${changedQids.length} qid(s).`,
);

function normalizeDecision(item) {
  return {
    qid: String(item?.qid ?? "").trim(),
    confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
    unknown: item?.unknown === true,
    reviewerNotes: String(item?.reviewerNotes ?? "").trim(),
  };
}

function applyConfirmedMapping(question, { confirmedKey, localeOptionEntry, meaningEntry }) {
  const canonicalCorrectOptionId = question.canonicalCorrectOptionId ?? null;
  const canonicalCorrectOptionKey = question.canonicalCorrectOptionKey ?? null;
  const canonicalCorrectOptionText = question.correctOptionAlignment?.canonicalOptionText ??
    question.optionMeaningMap?.find((entry) => entry?.canonicalOptionId === canonicalCorrectOptionId)?.canonicalOptionText ??
    null;

  const localeIndex = Array.isArray(question.localeOptionOrder)
    ? question.localeOptionOrder.findIndex((entry) => normalizeChoiceKey(entry?.sourceKey) === confirmedKey)
    : -1;
  if (localeIndex >= 0) {
    const previous = question.localeOptionOrder[localeIndex] ?? {};
    question.localeOptionOrder[localeIndex] = {
      ...previous,
      canonicalOptionId: canonicalCorrectOptionId,
      canonicalOptionKey: canonicalCorrectOptionKey,
      canonicalOptionText: canonicalCorrectOptionText,
      alignmentMethod: "manual-answer-key-confirmed",
      manualAnswerKeyConfirmed: true,
      confirmedAsCorrectKey: true,
    };
  }

  const meaningIndex = Array.isArray(question.optionMeaningMap)
    ? question.optionMeaningMap.findIndex((entry) => normalizeChoiceKey(entry?.sourceKey) === confirmedKey)
    : -1;
  if (meaningIndex >= 0) {
    const previous = question.optionMeaningMap[meaningIndex] ?? {};
    question.optionMeaningMap[meaningIndex] = {
      ...previous,
      canonicalOptionId: canonicalCorrectOptionId,
      canonicalOptionKey: canonicalCorrectOptionKey,
      canonicalOptionText: canonicalCorrectOptionText,
      alignmentMethod: "manual-answer-key-confirmed",
      manualAnswerKeyConfirmed: true,
      confirmedAsCorrectKey: true,
    };
  }

  question.correctOptionAlignment = {
    ...(question.correctOptionAlignment && typeof question.correctOptionAlignment === "object"
      ? question.correctOptionAlignment
      : {}),
    sourceKey: confirmedKey,
    canonicalOptionId: canonicalCorrectOptionId,
    canonicalOptionKey: canonicalCorrectOptionKey,
    canonicalOptionText: canonicalCorrectOptionText,
    sourceText: localeOptionEntry?.sourceText ?? meaningEntry?.sourceText ?? null,
    sourceGlossEn: localeOptionEntry?.sourceGlossEn ?? meaningEntry?.sourceGlossEn ?? null,
    method: "manual-answer-key-confirmed",
    manualAnswerKeyConfirmed: true,
  };
}

function findEntryByKey(entries, key) {
  if (!Array.isArray(entries)) {
    return null;
  }

  return entries.find((entry) => normalizeChoiceKey(entry?.sourceKey) === normalizeChoiceKey(key)) ?? null;
}

function snapshotOptionOrder(entries) {
  if (!Array.isArray(entries)) {
    return "[]";
  }

  return JSON.stringify(entries.map((entry) => ({
    sourceIndex: entry?.sourceIndex ?? null,
    sourceKey: entry?.sourceKey ?? null,
    sourceText: entry?.sourceText ?? null,
    sourceTextBody: entry?.sourceTextBody ?? null,
    sourceGlossEn: entry?.sourceGlossEn ?? null,
  })));
}

function snapshotArray(value) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function listProductionFiles(paths) {
  const files = [
    paths.questionsPath,
    paths.rawQuestionsPath,
    paths.tagsPatchPath,
  ].filter((filePath) => fileExists(filePath));

  if (fileExists(paths.datasetDir)) {
    for (const entry of fs.readdirSync(paths.datasetDir, { withFileTypes: true })) {
      if (!entry.isFile()) {
        continue;
      }

      if (/^translations\.[a-z0-9-]+\.json$/i.test(entry.name)) {
        files.push(path.join(paths.datasetDir, entry.name));
      }
    }
  }

  return [...new Set(files)].sort();
}

function hashFiles(files) {
  const hashes = new Map();

  for (const filePath of files) {
    hashes.set(filePath, hashFile(filePath));
  }

  return hashes;
}

function hashFile(filePath) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(filePath))
    .digest("hex");
}

function compareHashes(left, right) {
  if (left.size !== right.size) {
    return false;
  }

  for (const [filePath, hash] of left.entries()) {
    if (right.get(filePath) !== hash) {
      return false;
    }
  }

  return true;
}
