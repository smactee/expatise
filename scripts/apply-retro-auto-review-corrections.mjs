#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  ensurePipelineDirs,
  fileExists,
  getBatchFiles,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  textSimilarity,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = String(args.lang ?? "ja").trim() || "ja";
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const batches = String(args.batches ?? "batch-001,batch-002,batch-003")
  .split(/[,\s]+/)
  .map((entry) => entry.trim())
  .filter(Boolean);

for (const batchId of batches) {
  await ensurePipelineDirs({ lang, batchId });
}

const batchLabel = batches.join("-");
const retroPreviewPath = path.join(STAGING_DIR, `translations.${lang}.retro-auto-${batchLabel}.preview.json`);
const retroReportJsonPath = path.join(REPORTS_DIR, `retro-auto-correction-pass-${lang}-${batchLabel}.json`);
const retroReportMdPath = path.join(REPORTS_DIR, `retro-auto-correction-pass-${lang}-${batchLabel}.md`);
const productionPath = path.join(ROOT, "public", "qbank", dataset, `translations.${lang}.json`);

if (!fileExists(productionPath)) {
  throw new Error(`Production translation file not found: ${path.relative(process.cwd(), productionPath)}`);
}

const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [String(question.qid), question]));
const productionDoc = readJson(productionPath);
const productionQuestions = productionDoc?.questions && typeof productionDoc.questions === "object"
  ? productionDoc.questions
  : {};
const productionCountBefore = Object.keys(productionQuestions).length;
const productionMergeHistory = loadProductionMergeHistory({ lang });

const itemSummaries = [];
const changePreviewQuestions = {};
const changesByQid = new Map();
const stagedNewQuestionItems = [];
const stagedUnresolvedItems = [];
const issues = [];
const supersededMappings = [];
const skippedProductionRemovals = [];

for (const batchId of batches) {
  const retroDecisionPath = path.join(STAGING_DIR, `${lang}-${batchId}-retro-auto-workbench-decisions.json`);
  if (!fileExists(retroDecisionPath)) {
    throw new Error(`Retro decision file not found: ${path.relative(process.cwd(), retroDecisionPath)}`);
  }

  const batchFiles = getBatchFiles(lang, batchId);
  const matchedDoc = readJson(batchFiles.matchedPath);
  const matchedItems = Array.isArray(matchedDoc.items) ? matchedDoc.items : [];
  const matchedByKey = new Map();

  for (const item of matchedItems) {
    if (item?.itemId) {
      matchedByKey.set(String(item.itemId), item);
    }
    if (item?.sourceImage) {
      matchedByKey.set(String(item.sourceImage), item);
    }
  }

  const retroDoc = readJson(retroDecisionPath);
  const retroItems = Array.isArray(retroDoc.items) ? retroDoc.items : [];

  for (const rawDecision of retroItems) {
    const decision = normalizeRetroDecision(rawDecision);
    const sourceItem = matchedByKey.get(decision.itemId ?? "") ?? matchedByKey.get(decision.sourceImage ?? "") ?? null;
    const originalQid = decision.initialSuggestedQid ?? normalizeText(sourceItem?.match?.qid);
    const sourceImage = sourceItem?.sourceImage ?? decision.sourceImage ?? null;

    if (!sourceItem) {
      issues.push({
        batchId,
        itemId: decision.itemId,
        sourceImage: decision.sourceImage,
        reason: "matched-source-item-not-found",
      });
      continue;
    }

    if (decision.createNewQuestion) {
      stagedNewQuestionItems.push({
        batchId,
        itemId: decision.itemId,
        sourceImage,
        initialSuggestedQid: originalQid,
        reviewerNotes: decision.reviewerNotes,
      });
      itemSummaries.push({
        batchId,
        itemId: decision.itemId,
        sourceImage,
        initialSuggestedQid: originalQid,
        approvedQid: null,
        classification: "create-new-question",
        productionAction: "staged-only",
      });
      continue;
    }

    if (decision.keepUnresolved || !decision.approvedQid) {
      stagedUnresolvedItems.push({
        batchId,
        itemId: decision.itemId,
        sourceImage,
        initialSuggestedQid: originalQid,
        reviewerNotes: decision.reviewerNotes,
      });
      itemSummaries.push({
        batchId,
        itemId: decision.itemId,
        sourceImage,
        initialSuggestedQid: originalQid,
        approvedQid: decision.approvedQid,
        classification: "unresolved",
        productionAction: "staged-only",
      });
      continue;
    }

    const question = questionMap.get(decision.approvedQid);
    if (!question) {
      issues.push({
        batchId,
        itemId: decision.itemId,
        sourceImage,
        approvedQid: decision.approvedQid,
        reason: "approved-qid-not-found-in-master",
      });
      continue;
    }

    const structuredAnswerKey = resolveStructuredAnswerKey(decision);
    const built = buildStagedPreviewEntry({
      sourceItem,
      question,
      lang,
      batchId,
      sourceMode: "retro-auto-review-correction",
      confidence: "retro-reviewed",
      reviewerNotes: decision.reviewerNotes,
      approvalSource: "retro-auto-review",
    });

    if (question.type === "MCQ" && structuredAnswerKey) {
      applyConfirmedDecisionToQuestion({
        question: built.previewEntry,
        decision: {
          confirmedCorrectOptionKey: structuredAnswerKey,
          unknown: false,
          reviewerNotes: decision.reviewerNotes,
        },
        decisionsPath: retroDecisionPath,
        appliedAt: stableNow(),
      });
    } else if (question.type === "MCQ" && decision.answerKeyUnknown === true) {
      built.previewEntry.answerKeyNeedsManualConfirmation = true;
      built.previewEntry.answerKeyConfirmationReason = "Retro reviewer marked the locale-specific answer key as unknown.";
      built.previewEntry.answerKeyReviewerNotes = decision.reviewerNotes;
      built.previewEntry.answerKeyDecisionSourcePath = path.relative(process.cwd(), retroDecisionPath);
    } else if (
      question.type === "MCQ" &&
      decision.approvedQid !== originalQid &&
      built.previewEntry.answerKeyNeedsManualConfirmation === true
    ) {
      issues.push({
        batchId,
        itemId: decision.itemId,
        sourceImage,
        initialSuggestedQid: originalQid,
        approvedQid: decision.approvedQid,
        reason: "manual-qid-change-missing-structured-answer-key",
      });
      continue;
    }

    const sanitized = sanitizeQuestionEntry(built.previewEntry);
    const currentProductionEntry = productionQuestions[question.qid] ?? null;
    const productionMatches = currentProductionEntry
      ? stableStringify(sortValue(currentProductionEntry)) === stableStringify(sortValue(sanitized))
      : false;

    let classification = "unchanged";
    let productionAction = "none";

    if (decision.approvedQid !== originalQid) {
      classification = "corrected-to-different-existing-qid";
      supersededMappings.push({
        batchId,
        itemId: decision.itemId,
        sourceImage,
        originalQid,
        correctedQid: decision.approvedQid,
      });

      if (!productionMatches) {
        productionAction = currentProductionEntry ? "overwrite-corrected-qid" : "add-corrected-qid";
      }

      if (originalQid && originalQid in productionQuestions) {
        const laterIndependentBatches = (productionMergeHistory.get(originalQid) ?? []).filter((entry) => entry !== batchId);
        skippedProductionRemovals.push({
          batchId,
          itemId: decision.itemId,
          sourceImage,
          originalQid,
          correctedQid: decision.approvedQid,
          reason: laterIndependentBatches.length > 0
            ? `Skipped deleting ${originalQid}; it also appears in later production merge batch(es): ${laterIndependentBatches.join(", ")}.`
            : `Skipped deleting ${originalQid}; production provenance is not safe to attribute exclusively to this retro-auto source item.`,
        });
      }
    } else if (structuredAnswerKey) {
      classification = "answer-key-confirmed";
      if (!productionMatches) {
        productionAction = "answer-key-only-correction";
      }
    }

    if (productionAction !== "none") {
      changePreviewQuestions[question.qid] = built.previewEntry;
      changesByQid.set(question.qid, {
        qid: question.qid,
        batchId,
        itemId: decision.itemId,
        sourceImage,
        originalQid,
        approvedQid: decision.approvedQid,
        classification,
        productionAction,
      });
    }

    itemSummaries.push({
      batchId,
      itemId: decision.itemId,
      sourceImage,
      initialSuggestedQid: originalQid,
      approvedQid: decision.approvedQid,
      structuredAnswerKey: structuredAnswerKey ?? null,
      classification,
      productionAction,
    });
  }
}

if (issues.length > 0) {
  throw new Error(`Retro auto-review pass found issues:\n${JSON.stringify(issues, null, 2)}`);
}

const changedPreviewQids = Object.keys(changePreviewQuestions).sort();
const noChangeCount = itemSummaries.filter((item) => item.productionAction === "none" && item.classification !== "create-new-question" && item.classification !== "unresolved").length;
const existingQidCorrectionsApplied = [...changesByQid.values()].filter((item) => item.classification === "corrected-to-different-existing-qid").length;
const answerKeyOnlyCorrectionsApplied = [...changesByQid.values()].filter((item) => item.productionAction === "answer-key-only-correction").length;

const retroPreviewDoc = {
  meta: {
    locale: lang,
    generatedAt: stableNow(),
    dataset,
    sourceRetroDecisionPaths: batches.map((batchId) => path.relative(process.cwd(), path.join(STAGING_DIR, `${lang}-${batchId}-retro-auto-workbench-decisions.json`))),
    retroReviewedItemCount: itemSummaries.length,
    changedQidCount: changedPreviewQids.length,
    stagingOnly: true,
    note: "Retro auto-review correction preview built only from pre-batch-004 Japanese retro auto-workbench decisions.",
  },
  questions: Object.fromEntries(changedPreviewQids.map((qid) => [qid, changePreviewQuestions[qid]])),
};

await writeJson(retroPreviewPath, retroPreviewDoc);

const nextQuestions = {
  ...productionQuestions,
};
for (const qid of changedPreviewQids) {
  nextQuestions[qid] = sanitizeQuestionEntry(changePreviewQuestions[qid]);
}

const productionCountAfter = Object.keys(nextQuestions).length;
const validations = changedPreviewQids.map((qid) =>
  validateMergedQuestion({
    qid,
    mergedEntry: nextQuestions[qid],
    previewEntry: changePreviewQuestions[qid],
    masterQuestion: questionMap.get(qid),
  }),
);
const validationFailures = validations.filter((validation) =>
  !validation.qidExists ||
  !validation.localeOptionOrderPreserved ||
  !validation.localeCorrectOptionKeyPresent ||
  !validation.localeCorrectOptionKeyMapped
);

if (validationFailures.length > 0) {
  throw new Error(`Retro auto-review validation failed:\n${JSON.stringify(validationFailures, null, 2)}`);
}

const productionChanged = changedPreviewQids.length > 0;
if (productionChanged) {
  const nextDoc = {
    ...productionDoc,
    meta: {
      ...(productionDoc.meta ?? {}),
      locale: lang,
      translatedQuestions: productionCountAfter,
      generatedAt: stableNow(),
      retroAutoAuditAppliedAt: stableNow(),
      retroAutoAuditBatches: batches,
    },
    questions: nextQuestions,
  };

  await writeJson(productionPath, nextDoc);
}

const report = {
  generatedAt: stableNow(),
  lang,
  dataset,
  batches,
  sourceRetroDecisionPaths: batches.map((batchId) => path.relative(process.cwd(), path.join(STAGING_DIR, `${lang}-${batchId}-retro-auto-workbench-decisions.json`))),
  retroReviewedItemCount: itemSummaries.length,
  noChangeCount,
  existingQidProductionCorrectionsApplied: existingQidCorrectionsApplied,
  answerKeyOnlyCorrectionsApplied,
  removedFromPreviouslyAcceptedAutoMatchedSetCount: supersededMappings.length,
  stagedCreateNewQuestionCount: stagedNewQuestionItems.length,
  stagedUnresolvedCount: stagedUnresolvedItems.length,
  productionJapaneseTranslatedCountBefore: productionCountBefore,
  productionJapaneseTranslatedCountAfter: productionChanged ? productionCountAfter : productionCountBefore,
  productionChanged,
  filesChanged: [
    path.relative(process.cwd(), retroPreviewPath),
    path.relative(process.cwd(), retroReportJsonPath),
    path.relative(process.cwd(), retroReportMdPath),
    ...(productionChanged ? [path.relative(process.cwd(), productionPath)] : []),
  ],
  changedQids: changedPreviewQids,
  changedItems: [...changesByQid.values()],
  supersededMappings,
  skippedProductionRemovals,
  stagedNewQuestionItems,
  stagedUnresolvedItems,
  validations,
  retroPassCompletedCleanly: true,
  note: productionChanged
    ? "Only production-safe existing-qid retro corrections were merged. No production qids were deleted in this pass."
    : "Retro review introduced no production-safe changes.",
  itemSummaries,
};

await writeJson(retroReportJsonPath, report);
await writeText(retroReportMdPath, buildMarkdownReport(report));

console.log(
  productionChanged
    ? `Applied retro auto-review corrections for ${lang}: ${changedPreviewQids.length} production qid update(s).`
    : `Applied retro auto-review corrections for ${lang}: no production changes required.`,
);

function normalizeRetroDecision(item) {
  return {
    itemId: normalizeText(item?.itemId),
    sourceImage: normalizeText(item?.sourceImage),
    initialSuggestedQid: normalizeText(item?.initialSuggestedQid),
    approvedQid: normalizeText(item?.approvedQid),
    createNewQuestion: item?.createNewQuestion === true,
    keepUnresolved: item?.keepUnresolved === true,
    confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
    answerKeyUnknown: item?.answerKeyUnknown === true || item?.unknown === true,
    currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey),
    useCurrentStagedAnswerKey: item?.useCurrentStagedAnswerKey === true,
    reviewerNotes: String(item?.reviewerNotes ?? "").trim(),
  };
}

function resolveStructuredAnswerKey(decision) {
  if (decision.useCurrentStagedAnswerKey === true) {
    return decision.currentStagedLocaleCorrectOptionKey ?? null;
  }
  return decision.confirmedCorrectOptionKey ?? null;
}

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
    reviewStatus: "retro-corrected-preview",
    sourceImage: sourceItem.sourceImage ?? null,
    sourceItemId: sourceItem.itemId ?? null,
    reviewerNotes,
    promptRawJa,
    promptGlossEn,
    correctKeyRaw: sourceItem.correctKeyRaw ?? null,
    correctAnswerRaw: sourceItem.correctAnswerRaw ?? null,
    canonicalQuestionType: question.type,
    stagingOnly: true,
    localeAnswerKeyPolicy: "Preserve Japanese answer meaning and source-side key independently from canonical English master letter.",
    provenance: {
      sourceLang,
      batchId: sourceBatchId,
      approvedQid: question.qid,
      approvalSource,
    },
  };

  if (question.type === "MCQ") {
    const sourceOptions = buildSourceOptions(optionsRawJa, optionsGlossEn);
    const canonicalOptions = buildCanonicalOptions(question);
    const alignment = alignSourceOptions(sourceOptions, canonicalOptions);
    const correctAlignment = deriveCorrectAlignment({ sourceItem, question, alignment });

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
      sourceTextBody: entry.textBody,
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
    ? `Confirmed via retro auto-review on ${appliedAt}; reviewer changed locale key from ${previousKey} to ${confirmedKey}.`
    : `Confirmed via retro auto-review on ${appliedAt}.`;
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

function findEntryByKey(entries, sourceKey) {
  const normalizedKey = normalizeChoiceKey(sourceKey);
  if (!normalizedKey || !Array.isArray(entries)) {
    return null;
  }

  return entries.find((entry) => normalizeChoiceKey(entry?.sourceKey) === normalizedKey) ?? null;
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

function stripOptionKeyPrefix(text, sourceKey) {
  const raw = String(text ?? "").trim();
  if (!raw) return "";
  const keyPattern = sourceKey ? escapeRegExp(sourceKey) : "[A-Z]";
  const stripped = raw.replace(
    new RegExp(`^${keyPattern}(?:[\\s\\.:：\\)\\]\\-])?\\s*`, "i"),
    "",
  ).trim();
  return stripped || raw;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
        })),
      ) === JSON.stringify(
        previewOrder.map((entry) => ({
          sourceKey: normalizeChoiceKey(entry?.sourceKey),
          canonicalOptionId: String(entry?.canonicalOptionId ?? "").trim(),
        })),
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

function loadProductionMergeHistory({ lang: sourceLang }) {
  const history = new Map();
  const names = fs.readdirSync(REPORTS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith(`production-merge-${sourceLang}-batch-`) && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();

  for (const name of names) {
    const filePath = path.join(REPORTS_DIR, name);
    const doc = readJson(filePath);
    const batchId = String(doc?.batchId ?? "").trim() || name.replace(/^production-merge-[^-]+-/, "").replace(/\.json$/, "");
    for (const qid of Array.isArray(doc?.qidsMerged) ? doc.qidsMerged : []) {
      const list = history.get(qid) ?? [];
      list.push(batchId);
      history.set(qid, list);
    }
  }

  return history;
}

function buildMarkdownReport(report) {
  const lines = [
    `# Retro Auto-Review Correction Pass · ${report.lang} ${report.batches.join(", ")}`,
    "",
    `- Retro-reviewed items checked: ${report.retroReviewedItemCount}`,
    `- No-change items: ${report.noChangeCount}`,
    `- Existing-qid production corrections applied: ${report.existingQidProductionCorrectionsApplied}`,
    `- Answer-key-only corrections applied: ${report.answerKeyOnlyCorrectionsApplied}`,
    `- Removed from previously accepted auto-matched set: ${report.removedFromPreviouslyAcceptedAutoMatchedSetCount}`,
    `- Staged as new-question: ${report.stagedCreateNewQuestionCount}`,
    `- Staged as unresolved: ${report.stagedUnresolvedCount}`,
    `- Production changed: ${report.productionChanged ? "yes" : "no"}`,
    `- Production Japanese count before: ${report.productionJapaneseTranslatedCountBefore}`,
    `- Production Japanese count after: ${report.productionJapaneseTranslatedCountAfter}`,
    "",
  ];

  if (report.changedQids.length > 0) {
    lines.push("## Production Qids Updated", "");
    for (const qid of report.changedQids) {
      const change = report.changedItems.find((item) => item.qid === qid);
      lines.push(`- \`${qid}\` via ${change?.classification ?? "correction"} (${change?.sourceImage ?? "unknown source"})`);
    }
    lines.push("");
  }

  if (report.supersededMappings.length > 0) {
    lines.push("## Superseded Auto-Match Assignments", "");
    for (const item of report.supersededMappings) {
      lines.push(`- ${item.batchId} · ${item.sourceImage}: \`${item.originalQid}\` -> \`${item.correctedQid}\``);
    }
    lines.push("");
  }

  if (report.skippedProductionRemovals.length > 0) {
    lines.push("## Skipped Production Removals", "");
    for (const item of report.skippedProductionRemovals) {
      lines.push(`- ${item.batchId} · ${item.sourceImage}: ${item.reason}`);
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
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

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
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

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}
