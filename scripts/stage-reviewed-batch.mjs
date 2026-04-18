#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_DATASET,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  fileExists,
  getBatchFiles,
  getNewQuestionFiles,
  getReviewArtifactPaths,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  textSimilarity,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);

await ensurePipelineDirs({ lang, batchId });

const batchFiles = getBatchFiles(lang, batchId);
const reviewPaths = getReviewArtifactPaths(lang, batchId);
const newQuestionFiles = getNewQuestionFiles(lang, batchId);
const followUpPath = path.join(STAGING_DIR, `follow-up-review.${lang}.${batchId}.json`);
const previewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);
const decisionPath = resolveDecisionPath({
  explicitPath: args["decisions-path"],
  lang,
  batchId,
  fallbackPath: reviewPaths.decisionsTemplateJsonPath,
});

if (!fileExists(decisionPath)) {
  throw new Error(`Review decisions file not found: ${path.relative(process.cwd(), decisionPath)}`);
}

const reviewDoc = readJson(batchFiles.reviewNeededPath);
const reviewItems = Array.isArray(reviewDoc.items) ? reviewDoc.items : [];
const matchedDoc = fileExists(batchFiles.matchedPath) ? readJson(batchFiles.matchedPath) : { items: [] };
const matchedItems = Array.isArray(matchedDoc.items) ? matchedDoc.items : [];
const sourceItemMap = new Map();
for (const item of reviewItems) {
  if (item?.itemId) {
    sourceItemMap.set(item.itemId, item);
  }
}
for (const item of matchedItems) {
  if (item?.itemId && !sourceItemMap.has(item.itemId)) {
    sourceItemMap.set(item.itemId, item);
  }
}
const decisionsDoc = readJson(decisionPath);
const decisionItems = Array.isArray(decisionsDoc.items) ? decisionsDoc.items : [];
const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [question.qid, question]));

const counts = {
  approvedExistingQid: 0,
  createNewQuestion: 0,
  deleteQuestion: 0,
  noneOfThese: 0,
  unsure: 0,
  localeSpecificCorrectOptionKey: 0,
  manualAnswerKeyConfirmation: 0,
};

const previewQuestions = {};
const approvalRecords = [];
const followUpItems = [];
const decisionSnapshotItems = [];
const newQuestionItems = [];
let candidateOrdinal = 1;

for (const rawDecision of decisionItems) {
  const decision = normalizeDecision(rawDecision);
  const itemId = String(rawDecision?.itemId ?? "").trim();
  const sourceItem = sourceItemMap.get(itemId) ?? null;
  const status = decisionStatus(decision);

  decisionSnapshotItems.push({
    itemId,
    sourceSection: normalizeText(rawDecision?.sourceSection) ?? null,
    sourceImage: sourceItem?.sourceImage ?? null,
    currentTopQid: sourceItem?.match?.qid ?? sourceItem?.topCandidates?.[0]?.qid ?? null,
    currentTopScore: sourceItem?.match?.score ?? sourceItem?.topCandidates?.[0]?.score ?? null,
    approvedQid: decision.approvedQid,
    noneOfThese: decision.noneOfThese,
    createNewQuestion: decision.createNewQuestion,
    deleteQuestion: decision.deleteQuestion === true,
    newQuestionLocalAnswerKey: resolveNewQuestionLocalAnswerKey(decision),
    unsure: decision.unsure,
    reviewerNotes: decision.reviewerNotes,
    status,
  });

  if (!sourceItem) {
    followUpItems.push({
      itemId,
      sourceImage: null,
      status: "missing-source-review-item",
      reviewerNotes: decision.reviewerNotes,
      sourceDecisionPath: path.relative(process.cwd(), decisionPath),
    });
    continue;
  }

  if (decision.approvedQid) {
    const question = questionMap.get(decision.approvedQid);
    if (!question) {
      followUpItems.push(buildFollowUpItem(sourceItem, decision, {
        status: "approved-qid-not-found",
        reason: `Approved qid ${decision.approvedQid} was not found in the ${dataset} master bank.`,
      }));
      continue;
    }

    const approvedPreview = buildApprovedPreviewEntry({ sourceItem, decision, question, lang, batchId });
    previewQuestions[question.qid] = approvedPreview.previewEntry;
    approvalRecords.push({
      itemId: sourceItem.itemId,
      sourceImage: sourceItem.sourceImage ?? null,
      approvedQid: question.qid,
      localeCorrectOptionKey: approvedPreview.localeCorrectOptionKey,
      answerKeyNeedsManualConfirmation: approvedPreview.answerKeyNeedsManualConfirmation,
      answerKeyConfirmationReason: approvedPreview.answerKeyConfirmationReason,
    });

    counts.approvedExistingQid += 1;
    if (approvedPreview.localeCorrectOptionKey) {
      counts.localeSpecificCorrectOptionKey += 1;
    }
    if (approvedPreview.answerKeyNeedsManualConfirmation) {
      counts.manualAnswerKeyConfirmation += 1;
    }
    continue;
  }

  if (decision.createNewQuestion) {
    if (!resolveNewQuestionLocalAnswerKey(decision)) {
      throw new Error(`Create-new decision for ${itemId || sourceItem.sourceImage || "unknown-item"} is missing newQuestionLocalAnswerKey.`);
    }
    counts.createNewQuestion += 1;
    newQuestionItems.push(buildNewQuestionCandidate({
      item: sourceItem,
      decision,
      lang,
      batchId,
      ordinal: candidateOrdinal,
    }));
    candidateOrdinal += 1;
    continue;
  }

  if (decision.deleteQuestion) {
    counts.deleteQuestion += 1;
    continue;
  }

  if (decision.noneOfThese) {
    counts.noneOfThese += 1;
    followUpItems.push(buildFollowUpItem(sourceItem, decision, {
      status: "none-of-these",
      reason: "Reviewer rejected the current shortlist for this item.",
    }));
    continue;
  }

  counts.unsure += 1;
  followUpItems.push(buildFollowUpItem(sourceItem, decision, {
    status: "unsure",
    reason: "Reviewer marked this item as unsure and it needs follow-up review.",
  }));
}

const previewDoc = {
  meta: {
    locale: lang,
    generatedAt: stableNow(),
    reviewedBatchId: batchId,
    dataset,
    sourceReviewDecisionsPath: path.relative(process.cwd(), decisionPath),
    sourceReviewNeededPath: path.relative(process.cwd(), batchFiles.reviewNeededPath),
    approvedCount: counts.approvedExistingQid,
    createNewQuestionCount: counts.createNewQuestion,
    deleteQuestionCount: counts.deleteQuestion,
    noneOfTheseCount: counts.noneOfThese,
    unsureCount: counts.unsure,
    localeSpecificCorrectOptionKeyCount: counts.localeSpecificCorrectOptionKey,
    manualAnswerKeyConfirmationCount: counts.manualAnswerKeyConfirmation,
    stagingOnly: true,
    answerKeyPolicy: "Locale-specific answer keys are derived by answer meaning and preserved independently from the English master letter.",
  },
  questions: previewQuestions,
};

const newQuestionDecisionsDoc = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  scope: "review-needed",
  sourceReviewDecisionsPath: path.relative(process.cwd(), decisionPath),
  items: decisionSnapshotItems,
};

const newQuestionCandidatesDoc = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceDecisionPath: path.relative(process.cwd(), newQuestionFiles.decisionsPath),
  items: newQuestionItems,
};

const followUpDoc = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceReviewDecisionsPath: path.relative(process.cwd(), decisionPath),
  items: followUpItems,
};

await writeJson(previewPath, previewDoc);
await writeJson(newQuestionFiles.decisionsPath, newQuestionDecisionsDoc);
await writeJson(newQuestionFiles.candidatesPath, newQuestionCandidatesDoc);
await writeJson(followUpPath, followUpDoc);

console.log(
  [
    `Approved existing-qid: ${counts.approvedExistingQid}`,
    `createNewQuestion: ${counts.createNewQuestion}`,
    `deleteQuestion: ${counts.deleteQuestion}`,
    `noneOfThese: ${counts.noneOfThese}`,
    `unsure: ${counts.unsure}`,
    `localeCorrectOptionKey: ${counts.localeSpecificCorrectOptionKey}`,
    `manualAnswerKeyConfirmation: ${counts.manualAnswerKeyConfirmation}`,
  ].join(", "),
);

function resolveDecisionPath({ explicitPath, lang: sourceLang, batchId: sourceBatchId, fallbackPath }) {
  if (explicitPath) {
    return path.resolve(String(explicitPath));
  }

  const exportedPath = path.join(STAGING_DIR, `${sourceLang}-${sourceBatchId}-review-decisions.json`);
  if (fileExists(exportedPath)) {
    return exportedPath;
  }

  return fallbackPath;
}

function normalizeDecision(item) {
  const deleteQuestion = item?.deleteQuestion === true;
  const approvedQid = normalizeText(item?.approvedQid);
  const noneOfThese = item?.noneOfThese === true;
  const createNewQuestion = deleteQuestion ? false : item?.createNewQuestion === true;
  const unsure =
    approvedQid || noneOfThese || createNewQuestion || deleteQuestion
      ? false
      : item?.unsure !== false;

  return {
    sourceSection: normalizeText(item?.sourceSection) ?? null,
    approvedQid: deleteQuestion ? null : (approvedQid || null),
    initialSuggestedQid: normalizeText(item?.initialSuggestedQid) ?? null,
    noneOfThese,
    createNewQuestion,
    keepUnresolved: deleteQuestion ? false : item?.keepUnresolved === true,
    deleteQuestion,
    unsure,
    confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
    newQuestionLocalAnswerKey: normalizeChoiceKey(
      item?.newQuestionLocalAnswerKey ?? (
        item?.createNewQuestion === true
          ? item?.confirmedCorrectOptionKey
          : null
      ),
    ),
    answerKeyUnknown: item?.answerKeyUnknown === true || item?.unknown === true,
    currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey),
    useCurrentStagedAnswerKey: item?.useCurrentStagedAnswerKey === true,
    reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
  };
}

function decisionStatus(decision) {
  if (decision.approvedQid) {
    return "approved-existing-qid";
  }

  if (decision.createNewQuestion) {
    return "selected-for-new-question";
  }

  if (decision.deleteQuestion) {
    return "deleted-question";
  }

  if (decision.noneOfThese) {
    return "none-of-these";
  }

  if (decision.unsure) {
    return "needs-review";
  }

  return "pending-review";
}

function buildApprovedPreviewEntry({ sourceItem, decision, question, lang: sourceLang, batchId: sourceBatchId }) {
  const promptRawJa = sourceItem.promptRawJa ?? sourceItem.localizedText?.prompt ?? null;
  const promptGlossEn = sourceItem.promptGlossEn ?? sourceItem.translatedText?.prompt ?? null;
  const optionsRawJa = sourceOptionsRaw(sourceItem);
  const optionsGlossEn = sourceOptionsGloss(sourceItem);
  const explanation = normalizeText(sourceItem.localizedText?.explanation) ?? "";
  const previewEntry = {
    prompt: promptRawJa,
    explanation,
    sourceMode: "reviewed-screenshot-batch",
    confidence: "reviewed-approved",
    reviewStatus: "staged-preview",
    sourceImage: sourceItem.sourceImage ?? null,
    sourceItemId: sourceItem.itemId,
    reviewerNotes: decision.reviewerNotes,
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
    },
  };

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

    if (requiresStructuredAnswerKeyConfirmation(decision, question)) {
      previewEntry.answerKeyNeedsManualConfirmation = true;
      previewEntry.answerKeyConfirmationReason = decision.answerKeyUnknown
        ? `Approved qid differs from initial suggestion ${decision.initialSuggestedQid}; reviewer marked the locale-specific answer key as unknown.`
        : `Approved qid differs from initial suggestion ${decision.initialSuggestedQid}; structured locale answer-key confirmation is required.`;
      previewEntry.manualQidChangeRequiresAnswerKeyConfirmation = true;
      previewEntry.initialSuggestedQid = decision.initialSuggestedQid;
      previewEntry.initialSuggestedLocaleCorrectOptionKey = decision.currentStagedLocaleCorrectOptionKey ?? null;
    }

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
      reason: "Could not align the approved canonical correct option to a reviewed Japanese choice.",
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
  const needsManualConfirmation = best < 0.65 || gap < 0.08 || (visibleKey && visibleKey !== sourceMatch.sourceKey);

  return {
    localeCorrectOptionKey: sourceMatch.sourceKey,
    sourceText: sourceMatch.rawText,
    sourceGlossEn: sourceMatch.glossText,
    needsManualConfirmation,
    reason: needsManualConfirmation
      ? visibleKey && visibleKey !== sourceMatch.sourceKey
        ? `Visible Japanese answer key ${visibleKey} disagrees with meaning-based alignment ${sourceMatch.sourceKey}.`
        : best < 0.65
          ? "Meaning-based option alignment was weak; verify the Japanese correct option key manually."
          : "Top option alignment was too close to another source choice; verify the Japanese correct option key manually."
      : "Meaning-based option alignment cleanly identified the Japanese correct option key.",
    alignmentScore: sourceMatch.alignmentScore,
    method: visibleKey ? "visible-key-and-meaning" : "meaning-derived",
  };
}

function buildNewQuestionCandidate({ item, decision, lang: sourceLang, batchId: sourceBatchId, ordinal }) {
  return {
    candidateId: `nqc-${sourceLang}-${sourceBatchId}-${String(ordinal).padStart(3, "0")}`,
    sourceLang,
    sourceImage: item.sourceImage ?? null,
    effectiveQuestionType: item.analysis?.effectiveQuestionType ?? item.analysis?.declaredQuestionType ?? null,
    promptRawJa: item.promptRawJa ?? null,
    promptGlossEn: item.promptGlossEn ?? null,
    optionsRawJa: sourceOptionsRaw(item),
    optionsGlossEn: sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    newQuestionLocalAnswerKey: resolveNewQuestionLocalAnswerKey(decision),
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    linkedExistingAssetCandidate: linkedExistingAssetCandidate(item),
    reviewerNotes: decision.reviewerNotes,
    status: "pending-superset-review",
  };
}

function buildFollowUpItem(item, decision, { status, reason }) {
  return {
    itemId: item.itemId,
    sourceImage: item.sourceImage ?? null,
    status,
    reason,
    reviewerNotes: decision.reviewerNotes,
    approvedQid: decision.approvedQid,
    promptRawJa: item.promptRawJa ?? item.localizedText?.prompt ?? null,
    promptGlossEn: item.promptGlossEn ?? item.translatedText?.prompt ?? null,
    optionsRawJa: sourceOptionsRaw(item),
    optionsGlossEn: sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    topCandidates: Array.isArray(item.topCandidates) ? item.topCandidates : [],
  };
}

function linkedExistingAssetCandidate(item) {
  const candidate = (Array.isArray(item.topCandidates) ? item.topCandidates : []).find(
    (entry) => entry?.image?.currentAssetSrc,
  );

  if (!candidate) {
    return null;
  }

  return {
    qid: candidate.qid,
    number: candidate.number,
    score: candidate.score ?? null,
    currentAssetSrc: candidate.image?.currentAssetSrc ?? null,
    assetHashes: Array.isArray(candidate.image?.assetHashes) ? candidate.image.assetHashes : [],
    status: "unconfirmed-existing-production-asset",
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

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function requiresStructuredAnswerKeyConfirmation(decision, question) {
  if (!question || question.type !== "MCQ") {
    return false;
  }

  if (!decision?.approvedQid || !decision?.initialSuggestedQid) {
    return false;
  }

  if (decision.approvedQid === decision.initialSuggestedQid) {
    return false;
  }

  if (decision.useCurrentStagedAnswerKey === true && decision.currentStagedLocaleCorrectOptionKey) {
    return false;
  }

  if (decision.confirmedCorrectOptionKey) {
    return false;
  }

  return true;
}

function resolveNewQuestionLocalAnswerKey(decision) {
  if (decision?.createNewQuestion !== true) {
    return null;
  }

  return normalizeChoiceKey(
    decision?.newQuestionLocalAnswerKey ?? (
      decision?.confirmedCorrectOptionKey
    ),
  );
}
