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
  getBatchFiles,
  getDatasetPaths,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  textSimilarity,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);

const batchFiles = getBatchFiles(lang, batchId);
const reviewedPreviewPath = args["reviewed-preview-path"]
  ? path.resolve(String(args["reviewed-preview-path"]))
  : path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);
const reviewDecisionPath = args["review-decisions-path"]
  ? path.resolve(String(args["review-decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-review-decisions.json`);
const answerKeyDecisionPath = args["answer-key-decisions-path"]
  ? path.resolve(String(args["answer-key-decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-answer-key-decisions.json`);

const fullPreviewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.full.preview.json`);
const fullDryRunPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.full.merge-dry-run.json`);
const reportJsonPath = path.join(REPORTS_DIR, `full-batch-merge-review-${lang}-${batchId}.json`);
const reportMdPath = path.join(REPORTS_DIR, `full-batch-merge-review-${lang}-${batchId}.md`);

await ensurePipelineDirs({ lang, batchId });

for (const requiredPath of [batchFiles.matchedPath, reviewedPreviewPath, reviewDecisionPath, answerKeyDecisionPath]) {
  if (!fileExists(requiredPath)) {
    throw new Error(`Required input not found: ${path.relative(process.cwd(), requiredPath)}`);
  }
}

const matchedDoc = readJson(batchFiles.matchedPath);
const reviewedPreviewDoc = readJson(reviewedPreviewPath);
const reviewDecisionsDoc = readJson(reviewDecisionPath);
const answerKeyDecisionsDoc = readJson(answerKeyDecisionPath);
const extraAnswerKeyDecisions = loadExtraAnswerKeyDecisions({ lang, batchId });

const matchedItems = Array.isArray(matchedDoc.items) ? matchedDoc.items : [];
const reviewedQuestions = reviewedPreviewDoc?.questions && typeof reviewedPreviewDoc.questions === "object"
  ? reviewedPreviewDoc.questions
  : {};
const reviewedEntries = Object.entries(reviewedQuestions);

const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [question.qid, question]));
const approvedReviewSet = new Set(
  (Array.isArray(reviewDecisionsDoc.items) ? reviewDecisionsDoc.items : [])
    .filter((item) => typeof item?.approvedQid === "string" && item.approvedQid.trim())
    .map((item) => String(item.approvedQid).trim()),
);
const answerKeyDecisionMap = new Map(
  (Array.isArray(answerKeyDecisionsDoc.items) ? answerKeyDecisionsDoc.items : []).map((item) => [
    String(item?.qid ?? "").trim(),
    {
      confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
      unknown: item?.unknown === true,
      sourcePath: path.relative(process.cwd(), answerKeyDecisionPath),
    },
  ]),
);
for (const decision of extraAnswerKeyDecisions) {
  answerKeyDecisionMap.set(decision.qid, {
    confirmedCorrectOptionKey: decision.confirmedCorrectOptionKey,
    unknown: decision.unknown,
    sourcePath: path.relative(process.cwd(), decision.sourcePath),
  });
}

const autoPreviewQuestions = {};
const autoDerivedStats = {
  mcqCount: 0,
  rowCount: 0,
  localeCorrectOptionKeyCount: 0,
  manualAnswerKeyConfirmationCount: 0,
};
const autoInputIssues = [];

for (const item of matchedItems) {
  const qid = normalizeText(item?.match?.qid);
  if (!qid) {
    autoInputIssues.push({
      itemId: item?.itemId ?? null,
      reason: "missing-match-qid",
    });
    continue;
  }

  const question = questionMap.get(qid);
  if (!question) {
    autoInputIssues.push({
      itemId: item?.itemId ?? null,
      qid,
      reason: "master-qid-not-found",
    });
    continue;
  }

  const staged = buildStagedPreviewEntry({
    sourceItem: item,
    question,
    lang,
    batchId,
    sourceMode: "auto-matched-screenshot-batch",
    confidence: "auto-matched",
    reviewerNotes: "",
    approvalSource: "auto-match",
  });

  autoPreviewQuestions[qid] = staged.previewEntry;

  if (question.type === "MCQ") {
    autoDerivedStats.mcqCount += 1;
  } else {
    autoDerivedStats.rowCount += 1;
  }

  if (staged.localeCorrectOptionKey) {
    autoDerivedStats.localeCorrectOptionKeyCount += 1;
  }

  if (staged.answerKeyNeedsManualConfirmation) {
    autoDerivedStats.manualAnswerKeyConfirmationCount += 1;
  }
}

const combinedQuestions = {};
const qidSources = new Map();
const overlaps = [];
const conflicts = [];

for (const [qid, question] of reviewedEntries) {
  combinedQuestions[qid] = structuredClone(question);
  qidSources.set(qid, "reviewed");
}

for (const [qid, question] of Object.entries(autoPreviewQuestions)) {
  if (!(qid in combinedQuestions)) {
    combinedQuestions[qid] = structuredClone(question);
    qidSources.set(qid, "auto-matched");
    continue;
  }

  const existing = combinedQuestions[qid];
  if (entriesEquivalent(existing, question)) {
    overlaps.push({
      qid,
      sourceA: qidSources.get(qid) ?? "reviewed",
      sourceB: "auto-matched",
      resolution: "kept-existing-equivalent-record",
    });
    continue;
  }

  conflicts.push({
    qid,
    sourceA: qidSources.get(qid) ?? "reviewed",
    sourceB: "auto-matched",
    differingFields: differingFields(existing, question),
  });
}

if (conflicts.length > 0) {
  throw new Error(
    `Conflicting overlapping qid(s) detected between reviewed and auto-matched inputs:\n${JSON.stringify(conflicts, null, 2)}`,
  );
}

const appliedAt = stableNow();
const appliedExtraDecisionQids = [];
for (const decision of extraAnswerKeyDecisions) {
  const question = combinedQuestions[decision.qid];
  if (!question || String(question.canonicalQuestionType ?? "").toUpperCase() !== "MCQ") {
    continue;
  }

  applyConfirmedDecisionToQuestion({
    question,
    decision,
    decisionsPath: decision.sourcePath,
    appliedAt,
  });
  appliedExtraDecisionQids.push(decision.qid);
}

const expectedTotal = matchedItems.length + reviewedEntries.length - overlaps.length;
const finalTotal = Object.keys(combinedQuestions).length;
const finalTotalShortfallReason = finalTotal < matchedItems.length + reviewedEntries.length
  ? overlaps.length > 0
    ? `${overlaps.length} overlapping qid(s) were equivalent after normalization and were deduplicated.`
    : "The combined set is smaller than the source total because one or more input items could not be staged."
  : null;

const fullPreviewDoc = {
  meta: {
    locale: lang,
    generatedAt: stableNow(),
    reviewedBatchId: batchId,
    dataset,
    sourceMatchedPath: path.relative(process.cwd(), batchFiles.matchedPath),
    sourceReviewedPreviewPath: path.relative(process.cwd(), reviewedPreviewPath),
    sourceReviewDecisionsPath: path.relative(process.cwd(), reviewDecisionPath),
    sourceAnswerKeyDecisionsPath: path.relative(process.cwd(), answerKeyDecisionPath),
    sourceExtraAnswerKeyDecisionPaths: extraAnswerKeyDecisions.map((decision) =>
      path.relative(process.cwd(), decision.sourcePath),
    ),
    autoMatchedCount: matchedItems.length,
    reviewedCount: reviewedEntries.length,
    duplicateEquivalentCount: overlaps.length,
    duplicateConflictCount: conflicts.length,
    autoInputIssueCount: autoInputIssues.length,
    finalTotal,
    stagingOnly: true,
    answerKeyPolicy: "Locale-specific answer keys are derived by answer meaning and preserved independently from the English master letter.",
    note: "This full-batch preview combines earlier auto-matched Japanese items with the reviewed and answer-key-confirmed Japanese preview set.",
  },
  questions: combinedQuestions,
};

await writeJson(fullPreviewPath, fullPreviewDoc);

const datasetPaths = getDatasetPaths(dataset, lang);
const productionPaths = listProductionFiles(datasetPaths);
const productionHashesBefore = hashFiles(productionPaths);

const masterQuestions = buildMasterQuestionMap(datasetPaths.questionsPath);
const fullPreviewEntries = Object.entries(combinedQuestions).map(([qid, question]) => ({ qid, question }));
const validations = [];
const blockers = [];

for (const { qid, question } of fullPreviewEntries) {
  const master = masterQuestions.get(qid) ?? null;
  const canonicalType = normalizeQuestionType(question.canonicalQuestionType);
  const sourceBucket = qidSources.get(qid) ?? inferSourceBucket(question);
  const validation = {
    qid,
    sourceBucket,
    qidExists: Boolean(master),
    canonicalTypeMatchesMaster: canonicalType === normalizeQuestionType(master?.type),
    localeOptionOrderPreserved: canonicalType === "MCQ"
      ? localeOrderPreserved(question)
      : true,
    localeCorrectOptionKeyPresent: canonicalType === "MCQ"
      ? Boolean(normalizeChoiceKey(question.localeCorrectOptionKey))
      : true,
    optionMeaningMapAligned: canonicalType === "MCQ"
      ? optionMeaningMapAligned(question)
      : true,
    answerKeyDecisionConsistent: canonicalType === "MCQ"
      ? answerKeyDecisionConsistent(question, answerKeyDecisionMap.get(qid))
      : true,
    rowRemainsRow: canonicalType === "ROW"
      ? normalizeQuestionType(master?.type) === "ROW" && !normalizeChoiceKey(question.localeCorrectOptionKey)
      : true,
    answerKeyReady: canonicalType === "MCQ"
      ? question.answerKeyNeedsManualConfirmation !== true
      : true,
  };

  validation.ready = Object.entries(validation)
    .filter(([key]) => !["qid", "sourceBucket"].includes(key))
    .every(([, value]) => value === true);

  validations.push(validation);

  if (!validation.ready) {
    blockers.push({
      qid,
      sourceBucket,
      reasons: Object.entries(validation)
        .filter(([key]) => !["qid", "sourceBucket", "ready"].includes(key))
        .filter(([, value]) => value !== true)
        .map(([key]) => key),
    });
  }
}

const existingProduction = fileExists(datasetPaths.translationPath)
  ? readJson(datasetPaths.translationPath)
  : { meta: { locale: lang }, questions: {} };
const mergedQuestions = {
  ...(existingProduction?.questions && typeof existingProduction.questions === "object"
    ? existingProduction.questions
    : {}),
};

for (const { qid, question } of fullPreviewEntries) {
  mergedQuestions[qid] = structuredClone(question);
}

const dryRunMerge = {
  meta: {
    ...(existingProduction?.meta && typeof existingProduction.meta === "object" ? existingProduction.meta : {}),
    locale: lang,
    translatedQuestions: Object.keys(mergedQuestions).length,
    dataset,
    generatedAt: stableNow(),
    dryRun: true,
    dryRunBatchId: batchId,
    sourcePreviewPath: path.relative(process.cwd(), fullPreviewPath),
    sourceMatchedPath: path.relative(process.cwd(), batchFiles.matchedPath),
    sourceReviewedPreviewPath: path.relative(process.cwd(), reviewedPreviewPath),
    sourceReviewDecisionsPath: path.relative(process.cwd(), reviewDecisionPath),
    sourceAnswerKeyDecisionsPath: path.relative(process.cwd(), answerKeyDecisionPath),
    sourceExtraAnswerKeyDecisionPaths: extraAnswerKeyDecisions.map((decision) =>
      path.relative(process.cwd(), decision.sourcePath),
    ),
    autoMatchedCount: matchedItems.length,
    reviewedCount: reviewedEntries.length,
    duplicateEquivalentCount: overlaps.length,
    readyQidCount: finalTotal - blockers.length,
    blockerCount: blockers.length,
    finalBatchQidCount: finalTotal,
  },
  questions: mergedQuestions,
};

const diffSummary = fullPreviewEntries.map(({ qid, question }) => ({
  qid,
  sourceBucket: qidSources.get(qid) ?? inferSourceBucket(question),
  prompt: question.prompt ?? question.promptRawJa ?? null,
  options: question.options && typeof question.options === "object" ? question.options : {},
  localeOptionOrder: Array.isArray(question.localeOptionOrder)
    ? question.localeOptionOrder.map((entry) => ({
      sourceKey: entry?.sourceKey ?? null,
      sourceText: entry?.sourceText ?? null,
      sourceGlossEn: entry?.sourceGlossEn ?? null,
    }))
    : [],
  localeCorrectOptionKey: normalizeChoiceKey(question.localeCorrectOptionKey),
  sourceImage: question.sourceImage ?? null,
  canonicalQuestionType: normalizeQuestionType(question.canonicalQuestionType),
}));

await writeJson(fullDryRunPath, dryRunMerge);

const productionHashesAfter = hashFiles(productionPaths);
const productionFilesUnchanged = compareHashes(productionHashesBefore, productionHashesAfter);

if (!productionFilesUnchanged) {
  throw new Error("Production files changed unexpectedly while building the full-batch dry-run merge set.");
}

const reportJson = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  scope: "full-batch-preview-only",
  sourceMatchedPath: path.relative(process.cwd(), batchFiles.matchedPath),
  sourceReviewedPreviewPath: path.relative(process.cwd(), reviewedPreviewPath),
  sourceReviewDecisionsPath: path.relative(process.cwd(), reviewDecisionPath),
  sourceAnswerKeyDecisionsPath: path.relative(process.cwd(), answerKeyDecisionPath),
  sourceExtraAnswerKeyDecisionPaths: extraAnswerKeyDecisions.map((decision) =>
    path.relative(process.cwd(), decision.sourcePath),
  ),
  fullPreviewPath: path.relative(process.cwd(), fullPreviewPath),
  fullDryRunPath: path.relative(process.cwd(), fullDryRunPath),
  autoMatchedCount: matchedItems.length,
  reviewedCount: reviewedEntries.length,
  duplicateEquivalentCount: overlaps.length,
  duplicateConflictCount: conflicts.length,
  autoInputIssues,
  expectedTotal,
  finalTotal,
  finalTotalShortfallReason,
  totalQidsReadyForMerge: finalTotal - blockers.length,
  blockers,
  validations,
  overlaps,
  diffSummary,
  productionFilesUnchanged,
  productionFiles: productionPaths.map((filePath) => path.relative(process.cwd(), filePath)),
  safeToMergeNextStep: blockers.length === 0 && conflicts.length === 0 && autoInputIssues.length === 0,
  autoDerivedStats,
  reviewedApprovalCount: approvedReviewSet.size,
  appliedExtraDecisionQids,
  note: "This report covers the combined 20-item Japanese batch-001 staging set, not just the earlier 12-item reviewed preview subset.",
};

await writeJson(reportJsonPath, reportJson);
await writeText(reportMdPath, buildMarkdownReport(reportJson));

console.log(
  `Built full Japanese batch preview: ${finalTotal} qid(s), ${finalTotal - blockers.length} ready for dry-run merge review.`,
);

function buildStagedPreviewEntry({
  sourceItem,
  question,
  lang: sourceLang,
  batchId: sourceBatchId,
  sourceMode,
  confidence,
  reviewerNotes,
  approvalSource,
}) {
  const promptRawJa = sourceItem.promptRawJa ?? sourceItem.localizedText?.prompt ?? null;
  const promptGlossEn = sourceItem.promptGlossEn ?? sourceItem.translatedText?.prompt ?? null;
  const optionsRawJa = sourceOptionsRaw(sourceItem);
  const optionsGlossEn = sourceOptionsGloss(sourceItem);
  const explanation = normalizeText(sourceItem.localizedText?.explanation) ?? "";
  const previewEntry = {
    prompt: promptRawJa,
    explanation,
    sourceMode,
    confidence,
    reviewStatus: "staged-preview",
    sourceImage: sourceItem.sourceImage ?? null,
    sourceItemId: sourceItem.itemId ?? null,
    reviewerNotes,
    promptRawJa,
    promptGlossEn,
    correctKeyRaw: sourceItem.correctKeyRaw ?? null,
    correctAnswerRaw: sourceItem.correctAnswerRaw ?? null,
    canonicalQuestionType: question.type,
    stagingOnly: true,
    localeAnswerKeyPolicy: "Preserve Japanese answer meaning and source-side key independently from canonical English option letters.",
    provenance: {
      sourceLang,
      batchId: sourceBatchId,
      approvedQid: question.qid,
      approvalSource,
    },
  };

  if (Array.isArray(sourceItem.proposedLocalization?.warnings) && sourceItem.proposedLocalization.warnings.length > 0) {
    previewEntry.stagingWarnings = [...sourceItem.proposedLocalization.warnings];
  }

  if (question.type === "MCQ") {
    const sourceOptions = buildSourceOptions(optionsRawJa, optionsGlossEn);
    const canonicalOptions = buildCanonicalOptions(question);
    const alignment = alignSourceOptions(sourceOptions, canonicalOptions);
    const correctAlignment = deriveCorrectAlignment({
      sourceItem,
      question,
      alignment,
    });

    previewEntry.options = {};
    for (const option of canonicalOptions) {
      const mappedSource = alignment.byCanonicalId.get(option.id);
      previewEntry.options[option.id] = mappedSource?.rawText ?? null;
    }

    previewEntry.optionsRawJa = optionsRawJa;
    previewEntry.optionsGlossEn = optionsGlossEn;
    previewEntry.localeOptionOrder = alignment.orderedSourceOptions.map((entry) => ({
      sourceIndex: entry.sourceIndex,
      sourceKey: entry.sourceKey,
      sourceText: entry.rawText,
      sourceTextBody: entry.textBody,
      sourceGlossEn: entry.glossText ?? null,
      canonicalOptionId: entry.canonicalOptionId ?? null,
      canonicalOptionKey: entry.canonicalOptionKey ?? null,
      canonicalOptionText: entry.canonicalOptionText ?? null,
      alignmentScore: entry.alignmentScore ?? null,
      alignmentMethod: entry.alignmentMethod,
    }));
    previewEntry.optionMeaningMap = alignment.orderedSourceOptions.map((entry) => ({
      sourceKey: entry.sourceKey,
      sourceText: entry.rawText,
      sourceGlossEn: entry.glossText ?? null,
      canonicalOptionId: entry.canonicalOptionId ?? null,
      canonicalOptionKey: entry.canonicalOptionKey ?? null,
      canonicalOptionText: entry.canonicalOptionText ?? null,
      alignmentScore: entry.alignmentScore ?? null,
      alignmentMethod: entry.alignmentMethod,
    }));
    previewEntry.localeCorrectOptionKey = correctAlignment.localeCorrectOptionKey;
    previewEntry.canonicalCorrectOptionId = question.correctAnswer.correctOptionId ?? null;
    previewEntry.canonicalCorrectOptionKey = question.correctAnswer.correctOptionKey ?? null;
    previewEntry.answerKeyNeedsManualConfirmation = correctAlignment.needsManualConfirmation;
    previewEntry.answerKeyConfirmationReason = correctAlignment.reason;
    previewEntry.correctOptionAlignment = {
      sourceKey: correctAlignment.localeCorrectOptionKey,
      canonicalOptionId: question.correctAnswer.correctOptionId ?? null,
      canonicalOptionKey: question.correctAnswer.correctOptionKey ?? null,
      sourceText: correctAlignment.sourceText ?? null,
      sourceGlossEn: correctAlignment.sourceGlossEn ?? null,
      canonicalOptionText: question.correctAnswer.correctOptionText ?? null,
      alignmentScore: correctAlignment.alignmentScore,
      method: correctAlignment.method,
    };

    return {
      previewEntry,
      localeCorrectOptionKey: correctAlignment.localeCorrectOptionKey,
      answerKeyNeedsManualConfirmation: correctAlignment.needsManualConfirmation,
      answerKeyConfirmationReason: correctAlignment.reason,
    };
  }

  previewEntry.optionsRawJa = [];
  previewEntry.optionsGlossEn = [];
  previewEntry.localeCorrectOptionKey = null;
  previewEntry.canonicalCorrectRow = question.correctAnswer.correctRow ?? null;
  previewEntry.canonicalCorrectAnswer = question.correctAnswer.correctOptionText ?? null;
  previewEntry.answerKeyNeedsManualConfirmation = false;
  previewEntry.answerKeyConfirmationReason = "ROW question; no locale-specific option key applies.";

  return {
    previewEntry,
    localeCorrectOptionKey: null,
    answerKeyNeedsManualConfirmation: false,
    answerKeyConfirmationReason: previewEntry.answerKeyConfirmationReason,
  };
}

function sourceOptionsRaw(item) {
  if (Array.isArray(item.optionsRawJa) && item.optionsRawJa.length > 0) {
    return item.optionsRawJa;
  }

  if (Array.isArray(item.localizedText?.options) && item.localizedText.options.length > 0) {
    return item.localizedText.options;
  }

  return [];
}

function sourceOptionsGloss(item) {
  if (Array.isArray(item.optionsGlossEn) && item.optionsGlossEn.length > 0) {
    return item.optionsGlossEn;
  }

  if (Array.isArray(item.translatedText?.options) && item.translatedText.options.length > 0) {
    return item.translatedText.options;
  }

  return [];
}

function buildSourceOptions(optionsRawJa, optionsGlossEn) {
  const length = Math.max(optionsRawJa.length, optionsGlossEn.length);
  const rows = [];

  for (let index = 0; index < length; index += 1) {
    const rawText = normalizeText(optionsRawJa[index]) ?? null;
    const glossText = normalizeText(optionsGlossEn[index]) ?? null;
    const parsedRaw = parseChoice(rawText);
    const parsedGloss = parseChoice(glossText);
    const sourceKey = parsedRaw.key ?? parsedGloss.key ?? fallbackChoiceKey(index);
    const textBody = parsedRaw.body ?? rawText ?? parsedGloss.body ?? null;
    const glossBody = parsedGloss.body ?? glossText ?? null;

    rows.push({
      sourceIndex: index,
      sourceKey,
      rawText: rawText ?? textBody ?? null,
      textBody,
      glossText: glossText ?? glossBody ?? null,
      glossBody,
    });
  }

  return rows;
}

function buildCanonicalOptions(question) {
  return (Array.isArray(question.options) ? question.options : []).map((option, index) => ({
    id: normalizeText(option?.id) ?? `${question.qid}_o${index + 1}`,
    key: normalizeText(option?.key) ?? normalizeText(option?.originalKey) ?? fallbackChoiceKey(index),
    text: normalizeText(option?.sourceText) ?? normalizeText(option?.text) ?? null,
  }));
}

function alignSourceOptions(sourceOptions, canonicalOptions) {
  if (sourceOptions.length === 0 || canonicalOptions.length === 0) {
    return {
      orderedSourceOptions: sourceOptions.map((entry) => ({
        ...entry,
        canonicalOptionId: null,
        canonicalOptionKey: null,
        canonicalOptionText: null,
        alignmentScore: null,
        alignmentMethod: "unavailable",
      })),
      byCanonicalId: new Map(),
      scoreMatrix: new Map(),
    };
  }

  const scoreMatrix = new Map();
  for (const sourceOption of sourceOptions) {
    const row = new Map();
    for (const canonicalOption of canonicalOptions) {
      row.set(canonicalOption.id, optionMeaningSimilarity(sourceOption, canonicalOption));
    }
    scoreMatrix.set(sourceOption.sourceIndex, row);
  }

  const chosen = chooseBestAssignment(sourceOptions, canonicalOptions, scoreMatrix);
  const byCanonicalId = new Map();
  const orderedSourceOptions = sourceOptions.map((sourceOption) => {
    const canonicalOption = chosen.bySourceIndex.get(sourceOption.sourceIndex) ?? null;
    const alignmentScore = canonicalOption
      ? scoreMatrix.get(sourceOption.sourceIndex)?.get(canonicalOption.id) ?? null
      : null;
    const entry = {
      ...sourceOption,
      canonicalOptionId: canonicalOption?.id ?? null,
      canonicalOptionKey: canonicalOption?.key ?? null,
      canonicalOptionText: canonicalOption?.text ?? null,
      alignmentScore,
      alignmentMethod: sourceOption.glossText ? "reviewed-gloss-meaning" : "reviewed-raw-text",
    };

    if (canonicalOption) {
      byCanonicalId.set(canonicalOption.id, entry);
    }

    return entry;
  });

  return {
    orderedSourceOptions,
    byCanonicalId,
    scoreMatrix,
  };
}

function chooseBestAssignment(sourceOptions, canonicalOptions, scoreMatrix) {
  let bestTotal = Number.NEGATIVE_INFINITY;
  let bestMapping = new Map();

  function walk(index, usedCanonicalIds, currentTotal, currentMapping) {
    if (index >= sourceOptions.length) {
      if (currentTotal > bestTotal) {
        bestTotal = currentTotal;
        bestMapping = new Map(currentMapping);
      }
      return;
    }

    const sourceOption = sourceOptions[index];
    const row = scoreMatrix.get(sourceOption.sourceIndex) ?? new Map();
    const remaining = canonicalOptions.filter((option) => !usedCanonicalIds.has(option.id));

    if (remaining.length === 0) {
      if (currentTotal > bestTotal) {
        bestTotal = currentTotal;
        bestMapping = new Map(currentMapping);
      }
      return;
    }

    for (const canonicalOption of remaining) {
      currentMapping.set(sourceOption.sourceIndex, canonicalOption);
      usedCanonicalIds.add(canonicalOption.id);
      walk(
        index + 1,
        usedCanonicalIds,
        currentTotal + Number(row.get(canonicalOption.id) ?? 0),
        currentMapping,
      );
      usedCanonicalIds.delete(canonicalOption.id);
      currentMapping.delete(sourceOption.sourceIndex);
    }
  }

  walk(0, new Set(), 0, new Map());

  return {
    totalScore: bestTotal,
    bySourceIndex: bestMapping,
  };
}

function optionMeaningSimilarity(sourceOption, canonicalOption) {
  const scores = [
    textSimilarity(sourceOption.glossText, canonicalOption.text),
    textSimilarity(sourceOption.glossBody, canonicalOption.text),
    textSimilarity(sourceOption.textBody, canonicalOption.text),
    textSimilarity(sourceOption.rawText, canonicalOption.text),
  ].filter((score) => Number.isFinite(score));

  return scores.length > 0 ? Math.max(...scores) : 0;
}

function deriveCorrectAlignment({ sourceItem, question, alignment }) {
  if (question.type !== "MCQ") {
    return {
      localeCorrectOptionKey: null,
      needsManualConfirmation: false,
      reason: "ROW question; no locale-specific option key applies.",
      alignmentScore: null,
      method: "not-applicable",
    };
  }

  const canonicalCorrectOptionId = question.correctAnswer.correctOptionId ?? null;
  const sourceMatch = canonicalCorrectOptionId
    ? alignment.byCanonicalId.get(canonicalCorrectOptionId) ?? null
    : null;

  if (!sourceMatch) {
    return {
      localeCorrectOptionKey: normalizeText(sourceItem.correctKeyRaw),
      needsManualConfirmation: true,
      reason: "Could not align the approved canonical correct option to a Japanese choice.",
      alignmentScore: null,
      method: "unresolved",
    };
  }

  const sameCanonicalScores = [];
  for (const entry of alignment.orderedSourceOptions) {
    const score = alignment.scoreMatrix.get(entry.sourceIndex)?.get(canonicalCorrectOptionId);
    if (Number.isFinite(score)) {
      sameCanonicalScores.push(score);
    }
  }
  const sortedScores = sameCanonicalScores.sort((left, right) => right - left);
  const best = sortedScores[0] ?? 0;
  const second = sortedScores[1] ?? 0;
  const gap = best - second;
  const visibleKey = normalizeText(sourceItem.correctKeyRaw);
  const visibleKeyMismatch = Boolean(visibleKey && visibleKey !== sourceMatch.sourceKey);
  const needsManualConfirmation = best < 0.65 || gap < 0.08 || visibleKeyMismatch;

  return {
    localeCorrectOptionKey: sourceMatch.sourceKey,
    sourceText: sourceMatch.rawText,
    sourceGlossEn: sourceMatch.glossText,
    needsManualConfirmation,
    reason: needsManualConfirmation
      ? visibleKeyMismatch
        ? `Visible Japanese answer key ${visibleKey} disagrees with meaning-based alignment ${sourceMatch.sourceKey}.`
        : best < 0.65
          ? "Meaning-based option alignment was weak; verify the Japanese correct option key manually."
          : "Top option alignment was too close to another source choice; verify the Japanese correct option key manually."
      : "Meaning-based option alignment cleanly identified the Japanese correct option key.",
    alignmentScore: sourceMatch.alignmentScore,
    method: visibleKey ? "visible-key-and-meaning" : "meaning-derived",
  };
}

function parseChoice(value) {
  const text = normalizeText(value);
  if (!text) {
    return { key: null, body: null };
  }

  const match = text.match(/^\s*([A-Z])[\s.:：、．\)\]-]+(.*)$/i);
  if (match) {
    return {
      key: match[1].toUpperCase(),
      body: normalizeText(match[2]) ?? null,
    };
  }

  return {
    key: null,
    body: text,
  };
}

function fallbackChoiceKey(index) {
  return String.fromCharCode(65 + index);
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function entriesEquivalent(left, right) {
  return stableStringify(normalizedComparableEntry(left)) === stableStringify(normalizedComparableEntry(right));
}

function differingFields(left, right) {
  const fields = Object.keys({
    ...normalizedComparableEntry(left),
    ...normalizedComparableEntry(right),
  });

  return fields.filter((field) => stableStringify(left?.[field]) !== stableStringify(right?.[field]));
}

function normalizedComparableEntry(entry) {
  return {
    prompt: entry?.prompt ?? null,
    promptRawJa: entry?.promptRawJa ?? null,
    promptGlossEn: entry?.promptGlossEn ?? null,
    correctKeyRaw: entry?.correctKeyRaw ?? null,
    correctAnswerRaw: entry?.correctAnswerRaw ?? null,
    canonicalQuestionType: entry?.canonicalQuestionType ?? null,
    options: entry?.options ?? null,
    optionsRawJa: entry?.optionsRawJa ?? null,
    optionsGlossEn: entry?.optionsGlossEn ?? null,
    localeOptionOrder: entry?.localeOptionOrder ?? null,
    optionMeaningMap: entry?.optionMeaningMap ?? null,
    localeCorrectOptionKey: entry?.localeCorrectOptionKey ?? null,
    canonicalCorrectOptionId: entry?.canonicalCorrectOptionId ?? null,
    canonicalCorrectOptionKey: entry?.canonicalCorrectOptionKey ?? null,
    canonicalCorrectRow: entry?.canonicalCorrectRow ?? null,
  };
}

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortValue(value[key])]),
    );
  }

  return value ?? null;
}

function buildMasterQuestionMap(questionsPath) {
  const doc = readJson(questionsPath);
  const list = Array.isArray(doc?.questions) ? doc.questions : Object.values(doc?.questions ?? {});
  return new Map(list.map((question) => [String(question?.id ?? "").trim(), question]));
}

function normalizeQuestionType(value) {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "MCQ" || normalized === "ROW") {
    return normalized;
  }
  return normalized || null;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function localeOrderPreserved(question) {
  const raw = Array.isArray(question.optionsRawJa) ? question.optionsRawJa : [];
  const ordered = Array.isArray(question.localeOptionOrder) ? question.localeOptionOrder : [];
  if (raw.length !== ordered.length || raw.length === 0) {
    return false;
  }

  return raw.every((text, index) => String(text ?? "") === String(ordered[index]?.sourceText ?? ""));
}

function optionMeaningMapAligned(question) {
  const key = normalizeChoiceKey(question.localeCorrectOptionKey);
  if (!key) {
    return false;
  }

  const mapping = (Array.isArray(question.optionMeaningMap) ? question.optionMeaningMap : [])
    .find((entry) => normalizeChoiceKey(entry?.sourceKey) === key);

  if (!mapping) {
    return false;
  }

  return (
    String(mapping.canonicalOptionId ?? "") === String(question.canonicalCorrectOptionId ?? "") &&
    String(mapping.canonicalOptionKey ?? "") === String(question.canonicalCorrectOptionKey ?? "")
  );
}

function answerKeyDecisionConsistent(question, decision) {
  if (!decision) {
    return question?.answerKeyNeedsManualConfirmation !== true && Boolean(normalizeChoiceKey(question?.localeCorrectOptionKey));
  }

  if (decision.unknown) {
    return false;
  }

  return normalizeChoiceKey(question.localeCorrectOptionKey) === decision.confirmedCorrectOptionKey;
}

function inferSourceBucket(question) {
  return String(question?.sourceMode ?? "").includes("auto-matched") ? "auto-matched" : "reviewed";
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
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
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

function buildMarkdownReport(report) {
  const lines = [
    `# Full-Batch Dry-Run Merge Review: ${report.lang} ${report.batchId}`,
    "",
    `- Dataset: \`${report.dataset}\``,
    `- Auto-matched items: ${report.autoMatchedCount}`,
    `- Reviewed items: ${report.reviewedCount}`,
    `- Equivalent overlaps: ${report.duplicateEquivalentCount}`,
    `- Final total: ${report.finalTotal}`,
    `- Ready for merge: ${report.totalQidsReadyForMerge}`,
    `- Blockers: ${report.blockers.length}`,
    `- Safe to merge next step: ${report.safeToMergeNextStep ? "yes" : "no"}`,
    `- Full preview: \`${report.fullPreviewPath}\``,
    `- Dry-run artifact: \`${report.fullDryRunPath}\``,
    "",
  ];

  if (Array.isArray(report.appliedExtraDecisionQids) && report.appliedExtraDecisionQids.length > 0) {
    lines.push(`- Applied extra answer-key confirmations: ${report.appliedExtraDecisionQids.join(", ")}`, "");
  }

  if (report.finalTotalShortfallReason) {
    lines.push(`- Final total explanation: ${report.finalTotalShortfallReason}`, "");
  }

  if (report.autoInputIssues.length > 0) {
    lines.push("## Auto Input Issues", "");
    for (const issue of report.autoInputIssues) {
      lines.push(`- \`${issue.itemId ?? "unknown-item"}\`: ${issue.reason}${issue.qid ? ` (${issue.qid})` : ""}`);
    }
    lines.push("");
  }

  if (report.blockers.length > 0) {
    lines.push("## Blockers", "");
    for (const blocker of report.blockers) {
      lines.push(`- \`${blocker.qid}\` [${blocker.sourceBucket}]: ${blocker.reasons.join(", ")}`);
    }
    lines.push("");
  }

  lines.push("## Diff Summary", "");

  for (const entry of report.diffSummary) {
    lines.push(`### ${entry.qid}`, "");
    lines.push("```diff");
    lines.push(`+ qid: ${entry.qid}`);
    lines.push(`+ sourceBucket: ${entry.sourceBucket}`);
    lines.push(`+ type: ${entry.canonicalQuestionType}`);
    lines.push(`+ prompt: ${entry.prompt ?? ""}`);
    lines.push(`+ localeCorrectOptionKey: ${entry.localeCorrectOptionKey ?? "n/a"}`);
    lines.push(`+ sourceImage: ${entry.sourceImage ?? ""}`);
    if (entry.canonicalQuestionType === "MCQ") {
      lines.push("+ localeOptionOrder:");
      for (const option of entry.localeOptionOrder) {
        const gloss = option.sourceGlossEn ? ` (${option.sourceGlossEn})` : "";
        lines.push(`+   ${option.sourceKey}: ${option.sourceText ?? ""}${gloss}`);
      }
      lines.push("+ options:");
      for (const [optionId, text] of Object.entries(entry.options ?? {})) {
        lines.push(`+   ${optionId}: ${text ?? ""}`);
      }
    }
    lines.push("```", "");
  }

  return `${lines.join("\n")}\n`;
}

function loadExtraAnswerKeyDecisions({ lang: sourceLang, batchId: sourceBatchId }) {
  const prefix = `${sourceLang}-${sourceBatchId}-q`;
  const suffix = "answer-key-decision";
  const decisions = [];

  for (const entry of fs.readdirSync(STAGING_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) {
      continue;
    }

    const name = entry.name;
    if (!name.startsWith(prefix) || !name.includes(suffix) || !name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(STAGING_DIR, name);
    const doc = readJson(filePath);
    const rawItems = Array.isArray(doc?.items)
      ? doc.items
      : doc?.item
        ? [doc.item]
        : [];

    for (const rawItem of rawItems) {
      const qid = normalizeText(rawItem?.qid);
      if (!qid) {
        continue;
      }

      decisions.push({
        qid,
        confirmedCorrectOptionKey: normalizeChoiceKey(rawItem?.confirmedCorrectOptionKey),
        unknown: rawItem?.unknown === true,
        reviewerNotes: String(rawItem?.reviewerNotes ?? "").trim(),
        sourcePath: filePath,
      });
    }
  }

  return decisions;
}

function applyConfirmedDecisionToQuestion({ question, decision, decisionsPath, appliedAt }) {
  if (decision.unknown) {
    question.answerKeyNeedsManualConfirmation = true;
    question.answerKeyConfirmationReason = "Reviewer marked the locale-specific answer key as unknown. Keep this item in manual confirmation.";
    question.answerKeyConfirmedAt = null;
    question.answerKeyDecisionSourcePath = path.relative(process.cwd(), decisionsPath);
    question.answerKeyReviewerNotes = decision.reviewerNotes;
    return;
  }

  const confirmedKey = normalizeChoiceKey(decision.confirmedCorrectOptionKey);
  if (!confirmedKey) {
    return;
  }

  const localeOptionEntry = findEntryByKey(question.localeOptionOrder, confirmedKey);
  const meaningEntry = findEntryByKey(question.optionMeaningMap, confirmedKey);
  if (!localeOptionEntry || !meaningEntry) {
    return;
  }

  const previousKey = normalizeChoiceKey(question.localeCorrectOptionKey);
  question.localeCorrectOptionKey = confirmedKey;
  question.answerKeyNeedsManualConfirmation = false;
  question.answerKeyConfirmationReason = previousKey && previousKey !== confirmedKey
    ? `Confirmed via single-item answer-key review on ${appliedAt}; reviewer changed locale key from ${previousKey} to ${confirmedKey}.`
    : `Confirmed via single-item answer-key review on ${appliedAt}.`;
  question.answerKeyConfirmedAt = appliedAt;
  question.answerKeyDecisionSourcePath = path.relative(process.cwd(), decisionsPath);
  question.answerKeyReviewerNotes = decision.reviewerNotes;

  const canonicalCorrectOptionId = question.canonicalCorrectOptionId ?? null;
  const canonicalCorrectOptionKey = question.canonicalCorrectOptionKey ?? null;
  const canonicalCorrectOptionText =
    question.correctOptionAlignment?.canonicalOptionText ??
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
