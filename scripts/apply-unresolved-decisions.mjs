#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  fileExists,
  getBatchFiles,
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

const batchFiles = getBatchFiles(lang, batchId);
const unresolvedPath = args["unresolved-path"]
  ? path.resolve(String(args["unresolved-path"]))
  : batchFiles.unresolvedPath;
const unresolvedDecisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-unresolved-decisions.json`);
const reviewedPreviewPath = args["reviewed-preview-path"]
  ? path.resolve(String(args["reviewed-preview-path"]))
  : path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);
const reviewDecisionsPath = args["review-decisions-path"]
  ? path.resolve(String(args["review-decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-review-decisions.json`);

const rescuedPreviewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.rescued.preview.json`);
const existingPreviewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.existing.preview.json`);
const existingDecisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-existing-qid-decisions.json`);
const newQuestionDecisionsPath = path.join(STAGING_DIR, `new-question-decisions.${lang}.${batchId}.json`);
const newQuestionCandidatesPath = path.join(STAGING_DIR, `new-question-candidates.${lang}.${batchId}.json`);
const followUpPath = path.join(STAGING_DIR, `follow-up-review.${lang}.${batchId}.unresolved.json`);
const reportPath = path.join(REPORTS_DIR, `apply-unresolved-decisions-${lang}-${batchId}.json`);

await ensurePipelineDirs({ lang, batchId });

for (const requiredPath of [unresolvedPath, unresolvedDecisionsPath, reviewedPreviewPath, reviewDecisionsPath]) {
  if (!fileExists(requiredPath)) {
    throw new Error(`Required input not found: ${path.relative(process.cwd(), requiredPath)}`);
  }
}

const unresolvedDoc = readJson(unresolvedPath);
const unresolvedDecisionsDoc = readJson(unresolvedDecisionsPath);
const reviewedPreviewDoc = readJson(reviewedPreviewPath);
const reviewDecisionsDoc = readJson(reviewDecisionsPath);
const existingNewQuestionDecisionsDoc = fileExists(newQuestionDecisionsPath)
  ? readJson(newQuestionDecisionsPath)
  : { items: [] };
const existingNewQuestionCandidatesDoc = fileExists(newQuestionCandidatesPath)
  ? readJson(newQuestionCandidatesPath)
  : { items: [] };

const unresolvedItems = Array.isArray(unresolvedDoc.items) ? unresolvedDoc.items : [];
const unresolvedItemsById = new Map();
for (const item of unresolvedItems) {
  if (item?.itemId) {
    unresolvedItemsById.set(String(item.itemId), item);
  }
  if (item?.sourceImage) {
    unresolvedItemsById.set(String(item.sourceImage), item);
  }
}

const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [question.qid, question]));

const appliedAt = stableNow();
const rescuedQuestions = {};
const rescuedDecisionItems = [];
const newQuestionDecisionItems = [];
const newQuestionCandidates = [];
const followUpItems = [];
const decisionIssues = [];
const rescueOverlaps = [];

let rescueOrdinal = 1;
let newQuestionOrdinal = 1;

for (const rawDecision of Array.isArray(unresolvedDecisionsDoc.items) ? unresolvedDecisionsDoc.items : []) {
  const decision = normalizeUnresolvedDecision(rawDecision);
  const sourceItem = unresolvedItemsById.get(decision.itemId) ?? unresolvedItemsById.get(decision.sourceImage);

  if (!sourceItem) {
    decisionIssues.push({
      itemId: decision.itemId,
      sourceImage: decision.sourceImage,
      reason: "unresolved-source-item-not-found",
    });
    continue;
  }

  if (decision.approvedQid) {
    const question = questionMap.get(decision.approvedQid);
    if (!question) {
      decisionIssues.push({
        itemId: sourceItem.itemId ?? null,
        approvedQid: decision.approvedQid,
        reason: "approved-qid-not-found-in-master",
      });
      continue;
    }

    const staged = buildApprovedPreviewEntry({
      sourceItem,
      decision,
      question,
      lang,
      batchId,
      sourceMode: "unresolved-rescue-screenshot-batch",
    });

    const structuredAnswerKey = resolveStructuredAnswerKey(decision);
    if (question.type === "MCQ" && structuredAnswerKey) {
      const localeOptionEntry = findEntryByKey(staged.previewEntry.localeOptionOrder, structuredAnswerKey);
      const meaningEntry = findEntryByKey(staged.previewEntry.optionMeaningMap, structuredAnswerKey);
      if (localeOptionEntry && meaningEntry) {
        staged.previewEntry.localeCorrectOptionKey = structuredAnswerKey;
        staged.previewEntry.answerKeyNeedsManualConfirmation = false;
        staged.previewEntry.answerKeyConfirmationReason =
          `Confirmed during unresolved rescue review on ${appliedAt}; reviewer selected locale key ${structuredAnswerKey}.`;
        staged.previewEntry.answerKeyConfirmedAt = appliedAt;
        staged.previewEntry.answerKeyDecisionSourcePath = path.relative(process.cwd(), unresolvedDecisionsPath);
        staged.previewEntry.answerKeyReviewerNotes = decision.reviewerNotes;
        staged.previewEntry.reviewerSuggestedLocaleCorrectOptionKey = structuredAnswerKey;
        applyConfirmedMapping(staged.previewEntry, {
          confirmedKey: structuredAnswerKey,
          localeOptionEntry,
          meaningEntry,
        });
      } else {
        staged.previewEntry.reviewerSuggestedLocaleCorrectOptionKey = structuredAnswerKey;
      }
    } else if (requiresStructuredAnswerKeyConfirmation(decision, question)) {
      staged.previewEntry.answerKeyNeedsManualConfirmation = true;
      staged.previewEntry.answerKeyConfirmationReason = decision.answerKeyUnknown
        ? `Approved qid differs from initial suggestion ${decision.initialSuggestedQid}; reviewer marked the locale-specific answer key as unknown.`
        : `Approved qid differs from initial suggestion ${decision.initialSuggestedQid}; structured locale answer-key confirmation is required.`;
      staged.previewEntry.manualQidChangeRequiresAnswerKeyConfirmation = true;
      staged.previewEntry.initialSuggestedQid = decision.initialSuggestedQid;
      staged.previewEntry.initialSuggestedLocaleCorrectOptionKey = decision.currentStagedLocaleCorrectOptionKey ?? null;
    } else if (question.type === "MCQ" && decision.answerKeyUnknown === true) {
      staged.previewEntry.answerKeyNeedsManualConfirmation = true;
      staged.previewEntry.answerKeyConfirmationReason =
        "Reviewer marked the locale-specific answer key as unknown during unresolved rescue review.";
      staged.previewEntry.answerKeyDecisionSourcePath = path.relative(process.cwd(), unresolvedDecisionsPath);
      staged.previewEntry.answerKeyReviewerNotes = decision.reviewerNotes;
      if (decision.currentStagedLocaleCorrectOptionKey) {
        staged.previewEntry.initialSuggestedLocaleCorrectOptionKey = decision.currentStagedLocaleCorrectOptionKey;
      }
    }

    staged.previewEntry.unresolvedRescueMetadata = {
      decisionSourcePath: path.relative(process.cwd(), unresolvedDecisionsPath),
      recommendedAction: decision.recommendedAction ?? null,
      reviewerNotes: decision.reviewerNotes,
    };

    if (rescuedQuestions[question.qid]) {
      if (entriesEquivalent(rescuedQuestions[question.qid], staged.previewEntry)) {
        rescueOverlaps.push({
          qid: question.qid,
          sourceItemId: sourceItem.itemId ?? null,
          resolution: "kept-equivalent-existing-rescue-record",
        });
      } else {
        throw new Error(
          `Conflicting rescue records detected for ${question.qid}: ${JSON.stringify(differingFields(rescuedQuestions[question.qid], staged.previewEntry))}`,
        );
      }
    } else {
      rescuedQuestions[question.qid] = staged.previewEntry;
    }

    rescuedDecisionItems.push({
      itemId: sourceItem.itemId ?? null,
      sourceSection: "unresolved",
      sourceImage: sourceItem.sourceImage ?? null,
      approvedQid: question.qid,
      noneOfThese: false,
      createNewQuestion: false,
      keepUnresolved: false,
      unsure: false,
      reviewerNotes: decision.reviewerNotes,
      decisionSource: "unresolved-rescue-review",
      recommendedAction: decision.recommendedAction ?? null,
    });
    rescueOrdinal += 1;
    continue;
  }

  if (decision.createNewQuestion) {
    newQuestionDecisionItems.push({
      itemId: sourceItem.itemId ?? null,
      sourceImage: sourceItem.sourceImage ?? null,
      createNewQuestion: true,
      reviewerNotes: decision.reviewerNotes,
      decisionSource: "unresolved-rescue-review",
      recommendedAction: decision.recommendedAction ?? null,
    });
    newQuestionCandidates.push(
      buildNewQuestionCandidate({
        item: sourceItem,
        decision,
        lang,
        batchId,
        ordinal: newQuestionOrdinal,
      }),
    );
    newQuestionOrdinal += 1;
    continue;
  }

  followUpItems.push(buildFollowUpItem(sourceItem, decision, {
    status: decision.keepUnresolved ? "kept-unresolved" : "needs-follow-up",
    reason: decision.keepUnresolved
      ? "Reviewer chose to keep this item unresolved."
      : "No approved existing qid or new-question selection was provided.",
  }));
}

const reviewedQuestions = reviewedPreviewDoc?.questions && typeof reviewedPreviewDoc.questions === "object"
  ? reviewedPreviewDoc.questions
  : {};
const combinedExistingQuestions = {};
const combinedOverlaps = [];
const combinedConflicts = [];

for (const [qid, entry] of Object.entries(reviewedQuestions)) {
  combinedExistingQuestions[qid] = structuredClone(entry);
}

for (const [qid, entry] of Object.entries(rescuedQuestions)) {
  if (!(qid in combinedExistingQuestions)) {
    combinedExistingQuestions[qid] = structuredClone(entry);
    continue;
  }

  if (entriesEquivalent(combinedExistingQuestions[qid], entry)) {
    combinedOverlaps.push({
      qid,
      sourceA: "reviewed-preview",
      sourceB: "rescued-unresolved",
      resolution: "kept-existing-equivalent-record",
    });
    continue;
  }

  combinedConflicts.push({
    qid,
    sourceA: "reviewed-preview",
    sourceB: "rescued-unresolved",
    differingFields: differingFields(combinedExistingQuestions[qid], entry),
  });
}

if (combinedConflicts.length > 0) {
  throw new Error(
    `Conflicting qid(s) detected while combining reviewed and rescued existing-qid previews:\n${JSON.stringify(combinedConflicts, null, 2)}`,
  );
}

const existingApprovedDecisionItems = [
  ...(Array.isArray(reviewDecisionsDoc.items) ? reviewDecisionsDoc.items : []),
  ...rescuedDecisionItems,
];

const rescuedPreviewDoc = {
  meta: {
    locale: lang,
    generatedAt: appliedAt,
    reviewedBatchId: batchId,
    dataset,
    sourceUnresolvedPath: path.relative(process.cwd(), unresolvedPath),
    sourceUnresolvedDecisionPath: path.relative(process.cwd(), unresolvedDecisionsPath),
    rescuedExistingQidCount: Object.keys(rescuedQuestions).length,
    manualAnswerKeyConfirmationCount: Object.values(rescuedQuestions)
      .filter((entry) => entry?.answerKeyNeedsManualConfirmation === true)
      .length,
    stagingOnly: true,
  },
  questions: rescuedQuestions,
};

const existingPreviewDoc = {
  meta: {
    locale: lang,
    generatedAt: appliedAt,
    reviewedBatchId: batchId,
    dataset,
    sourceReviewedPreviewPath: path.relative(process.cwd(), reviewedPreviewPath),
    sourceUnresolvedDecisionPath: path.relative(process.cwd(), unresolvedDecisionsPath),
    reviewedExistingQidCount: Object.keys(reviewedQuestions).length,
    rescuedExistingQidCount: Object.keys(rescuedQuestions).length,
    duplicateEquivalentCount: combinedOverlaps.length,
    totalExistingQidCount: Object.keys(combinedExistingQuestions).length,
    manualAnswerKeyConfirmationCount: Object.values(combinedExistingQuestions)
      .filter((entry) => entry?.answerKeyNeedsManualConfirmation === true)
      .length,
    stagingOnly: true,
    note: "This preview combines reviewed/finalized batch items with unresolved existing-qid rescue decisions only.",
  },
  questions: combinedExistingQuestions,
};

const existingDecisionsDoc = {
  generatedAt: appliedAt,
  lang,
  batchId,
  dataset,
  sourceReviewDecisionsPath: path.relative(process.cwd(), reviewDecisionsPath),
  sourceUnresolvedDecisionPath: path.relative(process.cwd(), unresolvedDecisionsPath),
  items: existingApprovedDecisionItems,
};

const newQuestionDecisionsDoc = {
  generatedAt: appliedAt,
  lang,
  batchId,
  dataset,
  sourceDecisionPath: path.relative(process.cwd(), unresolvedDecisionsPath),
  items: mergeDecisionItems(
    Array.isArray(existingNewQuestionDecisionsDoc.items) ? existingNewQuestionDecisionsDoc.items : [],
    newQuestionDecisionItems,
  ),
};

const newQuestionCandidatesDoc = {
  generatedAt: appliedAt,
  lang,
  batchId,
  dataset,
  sourceDecisionPath: path.relative(process.cwd(), newQuestionDecisionsPath),
  items: mergeCandidateItems(
    Array.isArray(existingNewQuestionCandidatesDoc.items) ? existingNewQuestionCandidatesDoc.items : [],
    newQuestionCandidates,
  ),
};

const followUpDoc = {
  generatedAt: appliedAt,
  lang,
  batchId,
  dataset,
  sourceDecisionPath: path.relative(process.cwd(), unresolvedDecisionsPath),
  items: followUpItems,
};

await writeJson(rescuedPreviewPath, rescuedPreviewDoc);
await writeJson(existingPreviewPath, existingPreviewDoc);
await writeJson(existingDecisionsPath, existingDecisionsDoc);
await writeJson(newQuestionDecisionsPath, newQuestionDecisionsDoc);
await writeJson(newQuestionCandidatesPath, newQuestionCandidatesDoc);
await writeJson(followUpPath, followUpDoc);

const rescuedManualConfirmationQids = Object.entries(rescuedQuestions)
  .filter(([, entry]) => entry?.answerKeyNeedsManualConfirmation === true)
  .map(([qid]) => qid);

await writeJson(reportPath, {
  generatedAt: appliedAt,
  lang,
  batchId,
  dataset,
  sourceUnresolvedPath: path.relative(process.cwd(), unresolvedPath),
  sourceUnresolvedDecisionPath: path.relative(process.cwd(), unresolvedDecisionsPath),
  rescuedPreviewPath: path.relative(process.cwd(), rescuedPreviewPath),
  existingPreviewPath: path.relative(process.cwd(), existingPreviewPath),
  existingDecisionsPath: path.relative(process.cwd(), existingDecisionsPath),
  newQuestionDecisionsPath: path.relative(process.cwd(), newQuestionDecisionsPath),
  newQuestionCandidatesPath: path.relative(process.cwd(), newQuestionCandidatesPath),
  followUpPath: path.relative(process.cwd(), followUpPath),
  rescuedExistingQidCount: Object.keys(rescuedQuestions).length,
  newQuestionCandidateCount: newQuestionCandidates.length,
  followUpCount: followUpItems.length,
  rescuedManualAnswerKeyConfirmationCount: rescuedManualConfirmationQids.length,
  rescuedManualAnswerKeyConfirmationQids: rescuedManualConfirmationQids,
  rescueOverlaps,
  combinedOverlaps,
  decisionIssues,
  safeForFullBatchDryRun: decisionIssues.length === 0 && combinedConflicts.length === 0,
});

console.log(
  `Applied unresolved decisions for ${lang} ${batchId}: ${Object.keys(rescuedQuestions).length} rescued existing-qid item(s), ${newQuestionCandidates.length} new-question candidate(s).`,
);

function normalizeUnresolvedDecision(item) {
  return {
    itemId: String(item?.itemId ?? "").trim(),
    sourceImage: String(item?.sourceImage ?? "").trim(),
    approvedQid: normalizeText(item?.approvedQid),
    createNewQuestion: item?.createNewQuestion === true,
    keepUnresolved: item?.keepUnresolved === true,
    confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
    answerKeyUnknown: item?.answerKeyUnknown === true || item?.unknown === true,
    currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey),
    initialSuggestedQid: normalizeText(item?.initialSuggestedQid),
    useCurrentStagedAnswerKey: item?.useCurrentStagedAnswerKey === true,
    reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
    recommendedAction: normalizeText(item?.recommendedAction),
  };
}

function mergeDecisionItems(existingItems, incomingItems) {
  const byKey = new Map();
  for (const item of existingItems) {
    const key = decisionItemKey(item);
    if (key) {
      byKey.set(key, structuredClone(item));
    }
  }
  for (const item of incomingItems) {
    const key = decisionItemKey(item);
    if (key) {
      byKey.set(key, structuredClone(item));
    }
  }
  return [...byKey.values()];
}

function mergeCandidateItems(existingItems, incomingItems) {
  const byKey = new Map();
  for (const item of existingItems) {
    const key = candidateItemKey(item);
    if (key) {
      byKey.set(key, structuredClone(item));
    }
  }
  for (const item of incomingItems) {
    const key = candidateItemKey(item);
    if (key) {
      byKey.set(key, structuredClone(item));
    }
  }
  return [...byKey.values()];
}

function decisionItemKey(item) {
  return normalizeText(item?.itemId) ?? normalizeText(item?.sourceImage) ?? normalizeText(item?.candidateId);
}

function candidateItemKey(item) {
  return normalizeText(item?.sourceImage) ?? normalizeText(item?.candidateId);
}

function buildApprovedPreviewEntry({
  sourceItem,
  decision,
  question,
  lang: sourceLang,
  batchId: sourceBatchId,
  sourceMode,
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
    confidence: "reviewed-approved",
    reviewStatus: "staged-preview",
    sourceImage: sourceItem.sourceImage ?? null,
    sourceItemId: sourceItem.itemId ?? null,
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
      approvalSource: "unresolved-rescue-review",
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

    return {
      previewEntry,
      localeCorrectOptionKey: correctAlignment.localeCorrectOptionKey,
      answerKeyNeedsManualConfirmation: correctAlignment.needsManualConfirmation,
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
    itemId: item.itemId ?? null,
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

function resolveStructuredAnswerKey(decision) {
  if (decision?.useCurrentStagedAnswerKey === true) {
    return normalizeChoiceKey(decision?.currentStagedLocaleCorrectOptionKey);
  }

  return normalizeChoiceKey(decision?.confirmedCorrectOptionKey);
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

  if (decision.answerKeyUnknown === true) {
    return true;
  }

  return true;
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

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}
