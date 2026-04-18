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
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const includedSections = parseIncludedSections(args["include-sections"]);
const workbenchTitle =
  (typeof args["workbench-title"] === "string" ? args["workbench-title"].trim() : "") ||
  `${lang.toUpperCase()} Batch Workbench`;
const workbenchDescription =
  (typeof args["workbench-description"] === "string" ? args["workbench-description"].trim() : "") ||
  (
    includedSections?.length === 1 && includedSections[0] === "auto-matched"
      ? "Retroactive manual audit of previously auto-matched items using the same unified workbench flow. Export one decisions JSON; do not apply any corrections until review is complete."
      : "One page for existing-qid review, answer-key confirmation, and unresolved rescue/new-question handling. Export one decisions JSON, then apply everything in one pass."
  );

await ensurePipelineDirs({ lang, batchId });

const batchFiles = getBatchFiles(lang, batchId);
const matchedPath = args["matched-path"]
  ? path.resolve(String(args["matched-path"]))
  : batchFiles.matchedPath;
const reviewNeededPath = args["review-needed-path"]
  ? path.resolve(String(args["review-needed-path"]))
  : batchFiles.reviewNeededPath;
const unresolvedPath = args["unresolved-path"]
  ? path.resolve(String(args["unresolved-path"]))
  : batchFiles.unresolvedPath;
const htmlPath = args["html-path"]
  ? path.resolve(String(args["html-path"]))
  : path.join(REPORTS_DIR, `${lang}-${batchId}-workbench.html`);
const decisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-workbench-decisions.json`);
const decisionsFileName = path.basename(decisionsPath);
const storageKey = `qbank-workbench:${lang}:${batchId}:${decisionsFileName}`;

for (const [sectionId, requiredPath] of [
  ["auto-matched", matchedPath],
  ["review-needed", reviewNeededPath],
  ["unresolved", unresolvedPath],
]) {
  if (!shouldIncludeSection(sectionId, includedSections)) {
    continue;
  }
  if (!fileExists(requiredPath)) {
    throw new Error(`Required input not found: ${path.relative(process.cwd(), requiredPath)}`);
  }
}

const matchedDoc = fileExists(matchedPath) ? readJson(matchedPath) : { items: [] };
const reviewDoc = fileExists(reviewNeededPath) ? readJson(reviewNeededPath) : { items: [] };
const unresolvedDoc = fileExists(unresolvedPath) ? readJson(unresolvedPath) : { items: [] };

const matchedItems = Array.isArray(matchedDoc.items) ? matchedDoc.items : [];
const reviewItems = Array.isArray(reviewDoc.items) ? reviewDoc.items : [];
const unresolvedItems = Array.isArray(unresolvedDoc.items) ? unresolvedDoc.items : [];

const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [question.qid, question]));

const normalizedAutoMatchedItems = matchedItems.map((item, index) =>
  normalizeWorkbenchAutoMatchedItem(item, {
    section: "auto-matched",
    index,
    batchDir: batchFiles.batchDir,
    questionMap,
    lang,
    batchId,
  }),
);

const normalizedReviewItems = reviewItems.map((item, index) =>
  normalizeWorkbenchReviewItem(item, {
    section: "review-needed",
    index,
    batchDir: batchFiles.batchDir,
    questionMap,
    lang,
    batchId,
  }),
);
const normalizedUnresolvedItems = unresolvedItems.map((item, index) =>
  normalizeWorkbenchUnresolvedItem(item, {
    section: "unresolved",
    index,
    batchDir: batchFiles.batchDir,
    questionMap,
    lang,
    batchId,
  }),
);

const sourceItems = [
  ...(shouldIncludeSection("auto-matched", includedSections) ? normalizedAutoMatchedItems : []),
  ...(shouldIncludeSection("review-needed", includedSections) ? normalizedReviewItems : []),
  ...(shouldIncludeSection("unresolved", includedSections) ? normalizedUnresolvedItems : []),
];

const defaultDecisions = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourcePaths: {
    matched: path.relative(process.cwd(), matchedPath),
    reviewNeeded: path.relative(process.cwd(), reviewNeededPath),
    unresolved: path.relative(process.cwd(), unresolvedPath),
  },
  items: sourceItems.map(buildDefaultDecision),
};

const existingDecisions = fileExists(decisionsPath) ? readJson(decisionsPath) : null;
const mergedDecisions = mergeExistingDecisions(defaultDecisions, existingDecisions);

await writeJson(decisionsPath, mergedDecisions);
await writeText(htmlPath, buildHtml({
  lang,
  batchId,
  dataset,
  workbenchTitle,
  workbenchDescription,
  visibleSections: includedSections,
  counts: {
    autoMatched: shouldIncludeSection("auto-matched", includedSections) ? normalizedAutoMatchedItems.length : 0,
    reviewNeeded: shouldIncludeSection("review-needed", includedSections) ? normalizedReviewItems.length : 0,
    unresolved: shouldIncludeSection("unresolved", includedSections) ? normalizedUnresolvedItems.length : 0,
    answerKeyConfirmations:
      shouldIncludeSection("auto-matched", includedSections)
        ? normalizedAutoMatchedItems.filter((item) => item.answerKeyNeedsManualConfirmation === true).length
        : 0,
  },
  items: sourceItems,
  decisions: mergedDecisions.items,
  decisionsPath: path.relative(REPORTS_DIR, decisionsPath).split(path.sep).join("/"),
  decisionsFileName,
  storageKey,
  questionTypeByQid: Object.fromEntries(
    context.questions.map((question) => [question.qid, question.type ?? null]),
  ),
  questionExplanationByQid: Object.fromEntries(
    context.questions.map((question) => [question.qid, typeof question.explanation === "string" ? question.explanation : ""]),
  ),
}));

console.log(`Wrote ${path.relative(process.cwd(), htmlPath)} and ${path.relative(process.cwd(), decisionsPath)}.`);

function buildDefaultDecision(item) {
  const base = {
    id: item.id,
    section: item.section,
    itemId: item.itemId ?? null,
    sourceImage: item.sourceImage ?? null,
    qid: item.qid ?? null,
    approvedQid: item.section === "auto-matched" || item.section === "answer-key" ? item.qid : null,
    initialSuggestedQid: item.initialSuggestedQid ?? item.qid ?? null,
    createNewQuestion: item.defaultCreateNewQuestion === true,
    keepUnresolved: item.defaultCreateNewQuestion === true ? false : item.section === "unresolved",
    deleteQuestion: false,
    confirmedCorrectOptionKey: null,
    newQuestionLocalAnswerKey: normalizeChoiceKey(item?.newQuestionLocalAnswerKey) ?? null,
    answerKeyUnknown: false,
    currentStagedLocaleCorrectOptionKey: item.currentStagedLocaleCorrectOptionKey ?? null,
    useCurrentStagedAnswerKey: false,
    reviewerNotes: "",
    sourceExplanation: null,
    newQuestionProvisionalTopic: item.provisionalTopic ?? null,
    newQuestionProvisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
  };

  const autoMatchedLocalAnswerKey = deriveAutoMatchedLocalAnswerKeyDefault(item);
  if (autoMatchedLocalAnswerKey) {
    base.confirmedCorrectOptionKey = autoMatchedLocalAnswerKey;
  }

  return base;
}

function deriveAutoMatchedLocalAnswerKeyDefault(item) {
  if (item?.section !== "auto-matched") {
    return null;
  }

  const targetMeaning = normalizeText(item.canonicalCorrectOptionText);
  if (!targetMeaning) {
    return null;
  }

  const candidateOrder = [];
  const stagedKey = normalizeChoiceKey(item.currentStagedLocaleCorrectOptionKey);
  if (stagedKey) {
    candidateOrder.push(stagedKey);
  }
  for (const key of ["A", "B", "C", "D"]) {
    if (!candidateOrder.includes(key)) {
      candidateOrder.push(key);
    }
  }

  const scoredCandidates = candidateOrder.map((key, orderIndex) => {
    const optionIndex = key.charCodeAt(0) - 65;
    const glossCandidate = normalizeText(parseChoice(item.optionsGlossEn?.[optionIndex]).body ?? item.optionsGlossEn?.[optionIndex]);
    const textCandidate = normalizeText(parseChoice(item.optionsRawJa?.[optionIndex]).body ?? item.optionsRawJa?.[optionIndex]);

    return {
      key,
      orderIndex,
      glossScore: glossCandidate ? textSimilarity(glossCandidate, targetMeaning) : null,
      textScore: textCandidate ? textSimilarity(textCandidate, targetMeaning) : null,
    };
  });

  function chooseWinner(scoreKey, minimumScore, minimumGap) {
    const ranked = scoredCandidates
      .filter((candidate) => Number.isFinite(candidate[scoreKey]))
      .sort((left, right) => {
        const scoreDelta = Number(right[scoreKey]) - Number(left[scoreKey]);
        if (scoreDelta !== 0) {
          return scoreDelta;
        }
        return left.orderIndex - right.orderIndex;
      });

    const best = ranked[0] ?? null;
    if (!best || Number(best[scoreKey]) < minimumScore) {
      return null;
    }

    const runnerUpScore = Number(ranked[1]?.[scoreKey] ?? 0);
    if (Number(best[scoreKey]) - runnerUpScore < minimumGap) {
      return null;
    }

    return best.key;
  }

  return (
    chooseWinner("glossScore", 0.78, 0.12) ??
    chooseWinner("textScore", 0.92, 0.2) ??
    null
  );
}

function mergeExistingDecisions(defaultDoc, existingDoc) {
  if (!existingDoc || !Array.isArray(existingDoc.items)) {
    return defaultDoc;
  }

  const byId = new Map(existingDoc.items.map((item) => [String(item?.id ?? ""), item]));
  return {
    ...defaultDoc,
    generatedAt: stableNow(),
    items: defaultDoc.items.map((item) => {
      const previous = byId.get(item.id);
      if (!previous || typeof previous !== "object") {
        return item;
      }

      return {
        ...item,
        approvedQid: previous.deleteQuestion === true ? null : normalizeText(previous.approvedQid) ?? item.approvedQid,
        createNewQuestion: previous.deleteQuestion === true ? false : previous.createNewQuestion === true,
        keepUnresolved: previous.deleteQuestion === true ? false : previous.keepUnresolved === true,
        deleteQuestion: previous.deleteQuestion === true,
        confirmedCorrectOptionKey: normalizeChoiceKey(previous.confirmedCorrectOptionKey) ?? item.confirmedCorrectOptionKey,
        newQuestionLocalAnswerKey:
          normalizeChoiceKey(previous.newQuestionLocalAnswerKey) ??
          (
            previous.createNewQuestion === true
              ? normalizeChoiceKey(previous.confirmedCorrectOptionKey)
              : null
          ) ??
          item.newQuestionLocalAnswerKey,
        answerKeyUnknown: previous.answerKeyUnknown === true || previous.unknown === true,
        currentStagedLocaleCorrectOptionKey:
          normalizeChoiceKey(previous.currentStagedLocaleCorrectOptionKey) ?? item.currentStagedLocaleCorrectOptionKey,
        useCurrentStagedAnswerKey: previous.useCurrentStagedAnswerKey === true,
        reviewerNotes: normalizeText(previous.reviewerNotes) ?? "",
        sourceExplanation: normalizeEditableText(previous.sourceExplanation, { preserveEmpty: true }) ?? item.sourceExplanation,
        newQuestionProvisionalTopic: normalizeText(previous.newQuestionProvisionalTopic) ?? item.newQuestionProvisionalTopic,
        newQuestionProvisionalSubtopics: normalizeSubtopics(previous.newQuestionProvisionalSubtopics, item.newQuestionProvisionalSubtopics),
      };
    }),
  };
}

function normalizeSubtopics(value, fallback = []) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }

  const text = normalizeText(value);
  if (!text) {
    return Array.isArray(fallback) ? fallback : [];
  }

  return text
    .split(/[,\n]/)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function normalizeWorkbenchReviewItem(item, { section, index, batchDir, questionMap, lang: sourceLang, batchId: sourceBatchId }) {
  const topCandidates = (Array.isArray(item.topCandidates) ? item.topCandidates : []).slice(0, 4);
  const topScore = Number(item.match?.score ?? topCandidates[0]?.score ?? 0);
  const initialSuggestedQid = normalizeText(item.match?.qid ?? topCandidates[0]?.qid);
  const initialSuggestedQuestion = initialSuggestedQid ? questionMap.get(initialSuggestedQid) ?? null : null;
  const initialSuggestedPreview = initialSuggestedQuestion
    ? buildMatchedPreviewEntry({ sourceItem: item, question: initialSuggestedQuestion, lang: sourceLang, batchId: sourceBatchId })
    : null;

  return {
    id: `${section}:${item.itemId}`,
    section,
    index: index + 1,
    itemId: item.itemId,
    sourceImage: item.sourceImage ?? null,
    screenshotPath: item.screenshotPath ?? (item.sourceImage ? relativeFromReports(path.join(batchDir, item.sourceImage)) : null),
    hasImage: typeof item.hasImage === "boolean" ? item.hasImage : null,
    candidateSetLabel: item.analysis?.candidateImageParityMode ?? inferCandidateSetLabel(item.hasImage),
    initialSuggestedQid,
    currentStagedLocaleCorrectOptionKey: initialSuggestedPreview?.localeCorrectOptionKey ?? null,
    effectiveQuestionType: item.effectiveQuestionType ?? item.analysis?.effectiveQuestionType ?? item.analysis?.declaredQuestionType ?? null,
    promptRawJa: item.promptRawJa ?? item.localizedText?.prompt ?? null,
    promptGlossEn: item.promptGlossEn ?? item.translatedText?.prompt ?? null,
    optionsRawJa: sourceOptionsRaw(item),
    optionsGlossEn: sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? item.localizedText?.correctAnswer ?? null,
    newQuestionLocalAnswerKey: normalizeChoiceKey(item?.newQuestionLocalAnswerKey) ?? null,
    ocrConfidence: item.ocrConfidence ?? null,
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    sourceConceptSlots: item.sourceConceptSlots ?? null,
    reason: item.reason ?? null,
    analysis: item.analysis ?? null,
    recommendedAction: "needs-existing-qid-review",
    topCandidates: topCandidates.map((candidate) => normalizeCandidate(candidate, topScore, questionMap)),
  };
}

function normalizeWorkbenchAutoMatchedItem(item, { section, index, batchDir, questionMap, lang: sourceLang, batchId: sourceBatchId }) {
  const matchedQid = normalizeText(item?.match?.qid);
  const matchedQuestion = matchedQid ? questionMap.get(matchedQid) ?? null : null;
  const staged = matchedQuestion
    ? buildMatchedPreviewEntry({ sourceItem: item, question: matchedQuestion, lang: sourceLang, batchId: sourceBatchId })
    : null;
  const topCandidates = (Array.isArray(item.topCandidates) ? item.topCandidates : []).slice(0, 4);
  const topScore = Number(item.match?.score ?? topCandidates[0]?.score ?? 0);

  return {
    id: `${section}:${item.itemId}`,
    section,
    index: index + 1,
    itemId: item.itemId,
    sourceImage: item.sourceImage ?? null,
    screenshotPath: item.screenshotPath ?? (item.sourceImage ? relativeFromReports(path.join(batchDir, item.sourceImage)) : null),
    hasImage: typeof item.hasImage === "boolean" ? item.hasImage : null,
    qid: matchedQid,
    number: item?.match?.number ?? matchedQuestion?.number ?? null,
    matchScore: item?.match?.score ?? null,
    matchScoreGap: item?.match?.scoreGap ?? null,
    candidateSetLabel: item.analysis?.candidateImageParityMode ?? inferCandidateSetLabel(item.hasImage),
    initialSuggestedQid: matchedQid,
    currentStagedLocaleCorrectOptionKey: staged?.localeCorrectOptionKey ?? null,
    canonicalCorrectOptionText: matchedQuestion?.correctAnswer?.correctOptionText ?? null,
    answerKeyNeedsManualConfirmation: staged?.answerKeyNeedsManualConfirmation === true,
    answerKeyConfirmationReason: staged?.answerKeyConfirmationReason ?? null,
    effectiveQuestionType: item.analysis?.effectiveQuestionType ?? item.analysis?.declaredQuestionType ?? matchedQuestion?.type ?? null,
    promptRawJa: item.promptRawJa ?? item.localizedText?.prompt ?? null,
    promptGlossEn: item.promptGlossEn ?? item.translatedText?.prompt ?? null,
    optionsRawJa: sourceOptionsRaw(item),
    optionsGlossEn: sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? item.localizedText?.correctAnswer ?? null,
    newQuestionLocalAnswerKey: normalizeChoiceKey(item?.newQuestionLocalAnswerKey) ?? null,
    ocrConfidence: item.ocrConfidence ?? null,
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    sourceConceptSlots: item.sourceConceptSlots ?? null,
    reason: item.reason ?? null,
    analysis: item.analysis ?? null,
    recommendedAction: "quick-review-auto-match",
    topCandidates: topCandidates.map((candidate) => normalizeCandidate(candidate, topScore, questionMap)),
  };
}

function normalizeWorkbenchUnresolvedItem(item, { section, index, batchDir, questionMap, lang: sourceLang, batchId: sourceBatchId }) {
  const topCandidates = (Array.isArray(item.topCandidates) ? item.topCandidates : []).slice(0, 4);
  const topScore = Number(item.analysis?.topScore ?? topCandidates[0]?.score ?? 0);
  const initialSuggestedQid = normalizeText(topCandidates[0]?.qid);
  const initialSuggestedQuestion = initialSuggestedQid ? questionMap.get(initialSuggestedQid) ?? null : null;
  const initialSuggestedPreview = initialSuggestedQuestion
    ? buildMatchedPreviewEntry({ sourceItem: item, question: initialSuggestedQuestion, lang: sourceLang, batchId: sourceBatchId })
    : null;

  return {
    id: `${section}:${item.itemId}`,
    section,
    index: index + 1,
    itemId: item.itemId,
    sourceImage: item.sourceImage ?? null,
    screenshotPath: item.screenshotPath ?? (item.sourceImage ? relativeFromReports(path.join(batchDir, item.sourceImage)) : null),
    hasImage: typeof item.hasImage === "boolean" ? item.hasImage : null,
    candidateSetLabel: item.analysis?.candidateImageParityMode ?? inferCandidateSetLabel(item.hasImage),
    initialSuggestedQid,
    currentStagedLocaleCorrectOptionKey:
      initialSuggestedPreview?.localeCorrectOptionKey ??
      item.currentStagedLocaleCorrectOptionKey ??
      null,
    defaultCreateNewQuestion: item.defaultCreateNewQuestion === true,
    effectiveQuestionType: item.effectiveQuestionType ?? item.analysis?.effectiveQuestionType ?? item.analysis?.declaredQuestionType ?? null,
    promptRawJa: item.promptRawJa ?? null,
    promptGlossEn: item.promptGlossEn ?? null,
    optionsRawJa: sourceOptionsRaw(item),
    optionsGlossEn: sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    newQuestionLocalAnswerKey: normalizeChoiceKey(item?.newQuestionLocalAnswerKey) ?? null,
    ocrConfidence: item.ocrConfidence ?? null,
    provisionalTopic: item.provisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    sourceConceptSlots: item.sourceConceptSlots ?? null,
    reason: item.reason ?? null,
    analysis: item.analysis ?? null,
    sourceBatchId: item.sourceBatchId ?? null,
    backlogKind: item.backlogKind ?? null,
    backlogStatus: item.backlogStatus ?? null,
    sourceBacklogPath: item.sourceBacklogPath ?? null,
    provenance: Array.isArray(item.provenance) ? item.provenance : [],
    recommendedAction: classifyUnresolvedItem(item),
    topCandidates: topCandidates.map((candidate) => normalizeCandidate(candidate, topScore, questionMap)),
  };
}

function normalizeWorkbenchAnswerKeyItem(item, { index, batchDir, questionMap }) {
  const qid = normalizeText(item?.match?.qid);
  if (!qid) {
    return null;
  }

  const question = questionMap.get(qid);
  if (!question) {
    return null;
  }

  const staged = buildMatchedPreviewEntry({
    sourceItem: item,
    question,
    lang,
    batchId,
  });

  if (question.type !== "MCQ" || staged.answerKeyNeedsManualConfirmation !== true) {
    return null;
  }

  return {
    id: `answer-key:${qid}`,
    section: "answer-key",
    index: index + 1,
    qid,
    number: question.number ?? null,
    itemId: item.itemId ?? null,
    sourceImage: item.sourceImage ?? null,
    screenshotPath: item.screenshotPath ?? (item.sourceImage ? relativeFromReports(path.join(batchDir, item.sourceImage)) : null),
    hasImage: typeof item.hasImage === "boolean" ? item.hasImage : null,
    candidateSetLabel: item.analysis?.candidateImageParityMode ?? inferCandidateSetLabel(item.hasImage),
    initialSuggestedQid: qid,
    effectiveQuestionType: "MCQ",
    promptRawJa: staged.previewEntry.promptRawJa ?? null,
    promptGlossEn: staged.previewEntry.promptGlossEn ?? null,
    optionsRawJa: Array.isArray(staged.previewEntry.localeOptionOrder)
      ? staged.previewEntry.localeOptionOrder.map((entry) => entry?.sourceText ?? null).filter(Boolean)
      : sourceOptionsRaw(item),
    optionsGlossEn: Array.isArray(staged.previewEntry.localeOptionOrder)
      ? staged.previewEntry.localeOptionOrder.map((entry) => entry?.sourceGlossEn ?? null)
      : sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    ocrConfidence: item.ocrConfidence ?? null,
    currentStagedLocaleCorrectOptionKey: staged.previewEntry.localeCorrectOptionKey ?? null,
    answerKeyConfirmationReason: staged.previewEntry.answerKeyConfirmationReason ?? null,
    canonicalPrompt: question.prompt ?? null,
    canonicalCorrectOptionId: question.correctAnswer?.correctOptionId ?? null,
    canonicalCorrectOptionKey: question.correctAnswer?.correctOptionKey ?? null,
    canonicalCorrectOptionText: question.correctAnswer?.correctOptionText ?? null,
    localeOptionOrder: staged.previewEntry.localeOptionOrder ?? [],
  };
}

function normalizeCandidate(candidate, topScore, questionMap) {
  const canonicalQuestion = candidate?.qid ? questionMap.get(candidate.qid) ?? null : null;
  const resolvedType = canonicalQuestion?.type ?? candidate?.type ?? null;
  const resolvedOptions = resolvedType === "MCQ"
    ? (
      Array.isArray(canonicalQuestion?.options) && canonicalQuestion.options.length > 0
        ? canonicalQuestion.options.map((option) => ({
          id: option?.originalKey ?? option?.id ?? null,
          text: option?.text ?? option?.sourceText ?? option?.translatedText ?? null,
        }))
        : (Array.isArray(candidate?.options)
          ? candidate.options.map((option) => ({
            id: option?.id ?? null,
            text: option?.text ?? null,
          }))
          : [])
    )
    : [];

  return {
    qid: candidate?.qid ?? null,
    number: canonicalQuestion?.number ?? candidate?.number ?? null,
    type: resolvedType,
    rawCandidateType: candidate?.type ?? null,
    score: candidate?.score ?? null,
    scoreGapFromTop:
      Number.isFinite(topScore) && Number.isFinite(Number(candidate?.score))
        ? roundNumber(topScore - Number(candidate.score))
        : null,
    prompt: canonicalQuestion?.prompt ?? candidate?.prompt ?? null,
    options: resolvedOptions,
    correctOptionId: canonicalQuestion?.correctAnswer?.correctOptionId ?? candidate?.correctAnswer?.correctOptionId ?? null,
    correctOptionKey: canonicalQuestion?.correctAnswer?.correctOptionKey ?? candidate?.correctAnswer?.correctOptionKey ?? null,
    correctRow: canonicalQuestion?.correctAnswer?.correctRow ?? candidate?.correctAnswer?.correctRow ?? null,
    correctAnswerText:
      canonicalQuestion?.correctAnswer?.correctOptionText ??
      candidate?.correctAnswer?.correctOptionText ??
      candidate?.correctAnswer?.correctOptionKey ??
      null,
    hasImage: canonicalQuestion?.image?.hasImage === true || candidate?.image?.hasImage === true,
    imagePath: canonicalQuestion?.image?.currentAssetSrc
      ? relativeFromReports(path.join(process.cwd(), "public", canonicalQuestion.image.currentAssetSrc.replace(/^\//, "")))
      : candidate?.image?.currentAssetSrc
        ? relativeFromReports(path.join(process.cwd(), "public", candidate.image.currentAssetSrc.replace(/^\//, "")))
      : null,
  };
}

function inferCandidateSetLabel(hasImage) {
  if (hasImage === true) {
    return "image-only candidate set";
  }

  if (hasImage === false) {
    return "text-only candidate set";
  }

  return null;
}

function classifyUnresolvedItem(item) {
  const analysis = item.analysis ?? {};
  const topCandidates = Array.isArray(item.topCandidates) ? item.topCandidates : [];
  const topGap = Number(analysis.topGap ?? 0);
  const topScore = Number(analysis.topScore ?? topCandidates[0]?.score ?? 0);
  const plausibleShortlist = analysis.plausibleShortlist === true;

  if (plausibleShortlist && topScore >= 40 && topGap >= 1.5) {
    return "possible-existing-qid-rescue";
  }

  if (!plausibleShortlist && topScore < 38) {
    return "likely-new-question-candidate";
  }

  return "still-unclear";
}

function buildHtml({
  lang,
  batchId,
  dataset,
  workbenchTitle,
  workbenchDescription,
  visibleSections,
  counts,
  items,
  decisions,
  decisionsPath,
  decisionsFileName,
  storageKey,
  questionTypeByQid,
  questionExplanationByQid,
}) {
  const autoMatched = items.filter((item) => item.section === "auto-matched");
  const reviewNeeded = items.filter((item) => item.section === "review-needed");
  const unresolved = items.filter((item) => item.section === "unresolved");
  const answerKey = items.filter((item) => item.section === "answer-key");
  const sectionSet = new Set(visibleSections ?? ["auto-matched", "review-needed", "answer-key", "unresolved"]);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(workbenchTitle)}</title>
  <style>
    :root {
      --bg: #f4f0e8;
      --paper: #fffdf8;
      --ink: #1f1a17;
      --muted: #6d6257;
      --line: #d8cec1;
      --accent: #165d52;
      --accent-soft: #e4f2ef;
      --warn: #8c4f16;
      --warn-soft: #f8ead7;
      --note: #4f3b96;
      --note-soft: #ece8ff;
      --correct-bg: #e5f3eb;
      --correct-border: rgba(22, 93, 82, 0.28);
      --correct-shadow: 0 8px 18px rgba(22, 93, 82, 0.10);
      --shadow: 0 12px 28px rgba(38, 25, 10, 0.08);
      --radius: 18px;
      --mono: "SFMono-Regular", Menlo, Consolas, monospace;
      --sans: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Georgia, serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(22, 93, 82, 0.10), transparent 32%),
        radial-gradient(circle at top right, rgba(140, 79, 22, 0.10), transparent 28%),
        var(--bg);
      color: var(--ink);
      font-family: var(--sans);
    }
    .page {
      width: min(1460px, calc(100vw - 28px));
      margin: 22px auto 44px;
    }
    .hero, .section, .item {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 22px;
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 24px 28px;
      margin-bottom: 18px;
    }
    .hero h1 {
      margin: 0 0 8px;
      font-size: clamp(28px, 4vw, 42px);
      line-height: 1;
    }
    .hero p {
      margin: 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.5;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-top: 18px;
    }
    .stat {
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 12px 14px;
      background: #fcf8f1;
    }
    .stat strong {
      display: block;
      margin-top: 6px;
      font-size: 24px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-top: 18px;
    }
    .page-end {
      margin-top: 28px;
      padding-bottom: 12px;
    }
    .export-status {
      margin-top: 12px;
      padding: 10px 12px;
      border: 1px solid rgba(140, 79, 22, 0.28);
      border-radius: 14px;
      background: var(--warn-soft);
      color: var(--warn);
      font-size: 13px;
      line-height: 1.45;
    }
    button {
      border: 0;
      border-radius: 999px;
      padding: 10px 14px;
      font: inherit;
      cursor: pointer;
      background: var(--accent);
      color: #fff;
    }
    button.secondary {
      background: #e8dfd2;
      color: var(--ink);
    }
    .hint {
      color: var(--muted);
      font-size: 13px;
    }
    .section {
      padding: 18px;
      margin-top: 18px;
    }
    .section h2 {
      margin: 0 0 6px;
      font-size: 26px;
    }
    .section > p {
      margin: 0;
      color: var(--muted);
    }
    .list {
      display: grid;
      gap: 14px;
      margin-top: 16px;
    }
    .item {
      padding: 14px;
      display: grid;
      gap: 14px;
      grid-template-columns: minmax(260px, 320px) minmax(0, 1fr) 320px;
      align-items: start;
      scroll-margin-top: 20px;
    }
    .item.needs-attention {
      border-color: rgba(140, 79, 22, 0.48);
      box-shadow: 0 0 0 3px rgba(140, 79, 22, 0.14), var(--shadow);
    }
    .item h3 {
      margin: 0;
      font-size: 21px;
      line-height: 1.15;
    }
    .eyebrow {
      color: var(--muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 6px;
    }
    .image-frame {
      border: 1px solid var(--line);
      border-radius: 16px;
      overflow: hidden;
      background: #f1ebdf;
      min-height: 180px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease;
    }
    .image-frame img {
      width: 100%;
      height: auto;
      display: block;
    }
    .image-button {
      all: unset;
      display: block;
      width: 100%;
      cursor: zoom-in;
    }
    .image-button:hover .image-frame,
    .image-button:focus-visible .image-frame {
      border-color: rgba(22, 93, 82, 0.28);
      box-shadow: 0 12px 28px rgba(46, 31, 15, 0.12);
      transform: translateY(-1px);
    }
    .image-button:focus-visible .image-frame {
      outline: 2px solid rgba(22, 93, 82, 0.34);
      outline-offset: 3px;
    }
    .image-zoom-hint {
      position: absolute;
      right: 10px;
      bottom: 10px;
      padding: 4px 8px;
      border-radius: 999px;
      border: 1px solid rgba(46, 31, 15, 0.12);
      background: rgba(255, 252, 246, 0.92);
      color: var(--muted);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      pointer-events: none;
      box-shadow: 0 6px 18px rgba(46, 31, 15, 0.08);
    }
    .image-fallback {
      padding: 14px;
      text-align: center;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
      word-break: break-word;
    }
    .filename {
      margin-top: 8px;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
      word-break: break-all;
    }
    .filename-number {
      margin-right: 6px;
      color: var(--ink);
      font-weight: 700;
    }
    .item.needs-attention .filename-number {
      color: var(--warn);
    }
    .source-block, .decision-block {
      min-width: 0;
    }
    .control-needs-attention {
      border-color: rgba(140, 79, 22, 0.42) !important;
      background: #fff8ef !important;
      box-shadow: 0 0 0 2px rgba(140, 79, 22, 0.12);
    }
    .source-card {
      display: grid;
      gap: 10px;
    }
    .label {
      display: block;
      margin-bottom: 4px;
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .prompt {
      font-size: 17px;
      line-height: 1.45;
      margin: 0;
    }
    .gloss {
      margin-top: 4px;
      color: var(--muted);
      font-size: 14px;
      line-height: 1.45;
    }
    .options {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .option {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 9px 11px;
      background: #fbf7f0;
    }
    .option-current {
      background: var(--correct-bg);
      border-color: var(--correct-border);
      box-shadow: var(--correct-shadow);
      transform: translateY(-1px);
    }
    .option-key {
      display: inline-flex;
      width: 24px;
      font-family: var(--mono);
      color: var(--accent);
    }
    .option-current .option-key {
      font-weight: 800;
    }
    .option-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }
    .option-correct-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      border: 1px solid var(--correct-border);
      background: rgba(22, 93, 82, 0.10);
      color: var(--accent);
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }
    .option-gloss {
      margin-top: 4px;
      color: var(--muted);
      font-size: 13px;
    }
    .mini-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .fact {
      border: 1px solid var(--line);
      border-radius: 12px;
      background: #faf5ee;
      padding: 10px 12px;
    }
    .fact.warn {
      background: var(--warn-soft);
      border-color: rgba(140, 79, 22, 0.18);
    }
    .fact .value {
      font-size: 14px;
      line-height: 1.4;
      word-break: break-word;
    }
    .candidate-list {
      display: grid;
      gap: 10px;
    }
    .candidate {
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fcf8f1;
      padding: 12px;
    }
    .candidate-head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    }
    .candidate-badges {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 9px;
      border: 1px solid var(--line);
      border-radius: 999px;
      font-size: 12px;
      background: #f3ede4;
      color: var(--muted);
    }
    .pill.note {
      background: var(--note-soft);
      color: var(--note);
      border-color: rgba(79, 59, 150, 0.18);
    }
    .pill.warn {
      background: var(--warn-soft);
      color: var(--warn);
      border-color: rgba(140, 79, 22, 0.18);
    }
    .candidate .prompt {
      font-size: 15px;
    }
    .candidate-media {
      margin-top: 8px;
    }
    .candidate-image-frame {
      min-height: 120px;
      max-width: 260px;
      margin-top: 8px;
    }
    .lightbox[hidden] {
      display: none;
    }
    .lightbox {
      position: fixed;
      inset: 0;
      z-index: 80;
      display: grid;
      place-items: center;
      padding: 20px;
      background: rgba(28, 18, 8, 0.72);
      backdrop-filter: blur(4px);
    }
    .lightbox-backdrop {
      position: absolute;
      inset: 0;
      cursor: zoom-out;
    }
    .lightbox-dialog {
      position: relative;
      z-index: 1;
      width: min(96vw, 1180px);
      max-height: calc(100vh - 40px);
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(255, 248, 239, 0.18);
      border-radius: 18px;
      overflow: hidden;
      background: #fdf9f2;
      box-shadow: 0 28px 80px rgba(15, 10, 5, 0.32);
    }
    .lightbox-toolbar {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      border-bottom: 1px solid var(--line);
      background: #f8f1e6;
    }
    .lightbox-meta {
      display: grid;
      gap: 4px;
    }
    .lightbox-title {
      font-size: 15px;
      line-height: 1.4;
      word-break: break-word;
    }
    .lightbox-subtitle {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .lightbox-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .lightbox-zoom-value {
      min-width: 64px;
      text-align: center;
      padding: 7px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: #fff;
      font-family: var(--mono);
      font-size: 12px;
      color: var(--muted);
    }
    .lightbox-close {
      flex: 0 0 auto;
    }
    .lightbox-body {
      overflow: auto;
      padding: 16px;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      background: #f4ecdf;
    }
    .lightbox-body.is-zoomed {
      justify-content: flex-start;
      align-items: flex-start;
    }
    .lightbox-body.is-zoomed .lightbox-stage {
      justify-content: flex-start;
      align-items: flex-start;
    }
    .lightbox-stage {
      min-width: 100%;
      min-height: 100%;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      position: relative;
    }
    .lightbox-stage.is-draggable {
      cursor: grab;
    }
    .lightbox-stage.is-dragging {
      cursor: grabbing;
    }
    .lightbox-body img {
      display: block;
      max-width: none;
      height: auto;
      border-radius: 14px;
      box-shadow: 0 18px 48px rgba(24, 16, 8, 0.18);
      background: #fffdf8;
      user-select: none;
      -webkit-user-drag: none;
    }
    .lightbox-fallback {
      display: grid;
      gap: 10px;
      max-width: 680px;
      text-align: center;
      padding: 28px;
    }
    .candidate .options {
      margin-top: 8px;
    }
    .decision-block {
      border: 1px solid var(--line);
      border-radius: 16px;
      background: #fcf8f1;
      padding: 14px;
      position: sticky;
      top: 14px;
    }
    .decision-row {
      margin-bottom: 12px;
    }
    .decision-actions {
      display: grid;
      gap: 8px;
    }
    .decision-actions label, .answer-key-choices label {
      display: flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 8px 10px;
      background: #fff;
      cursor: pointer;
    }
    .decision-actions input, .answer-key-choices input {
      margin: 0;
    }
    input[type="text"], textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px 12px;
      font: inherit;
      background: #fff;
    }
    textarea {
      min-height: 74px;
      resize: vertical;
    }
    .answer-key-choices {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }
    .answer-key-toolbar {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }
    .answer-key-toolbar button {
      padding: 8px 10px;
      font-size: 13px;
    }
    details {
      margin-top: 10px;
    }
    summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 13px;
    }
    pre {
      white-space: pre-wrap;
      font-family: var(--mono);
      font-size: 12px;
      background: #f6f0e6;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 10px;
      overflow: auto;
    }
    @media (max-width: 1100px) {
      .item {
        grid-template-columns: 1fr;
      }
      .decision-block {
        position: static;
      }
      .mini-grid {
        grid-template-columns: 1fr;
      }
      .answer-key-choices {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(workbenchTitle)}</h1>
      <p>${escapeHtml(workbenchDescription)}</p>
      <div class="stats">
        <div class="stat"><span class="label">Batch</span><strong>${escapeHtml(batchId)}</strong></div>
        <div class="stat"><span class="label">Dataset</span><strong>${escapeHtml(dataset)}</strong></div>
        <div class="stat"><span class="label">Auto-Matched</span><strong>${counts.autoMatched}</strong></div>
        <div class="stat"><span class="label">Review-Needed</span><strong>${counts.reviewNeeded}</strong></div>
        <div class="stat"><span class="label">Unresolved</span><strong>${counts.unresolved}</strong></div>
        <div class="stat"><span class="label">Answer-Key Checks</span><strong>${counts.answerKeyConfirmations}</strong></div>
      </div>
      <div class="toolbar">
        <button id="reset" class="secondary">Reset Local Edits</button>
      </div>
    </section>

    ${sectionSet.has("auto-matched") ? renderSectionShell("auto-matched", "Auto-Matched (Quick Review)", `${autoMatched.length} item(s) auto-matched by the pipeline and surfaced for quick human confirmation.`) : ""}
    ${sectionSet.has("review-needed") ? renderSectionShell("review-needed", "Review-Needed", `${reviewNeeded.length} item(s) that need an approve/new/unresolved decision.`) : ""}
    ${sectionSet.has("answer-key") && answerKey.length > 0 ? renderSectionShell("answer-key", "Answer-Key Confirmations", `${answerKey.length} auto-matched MCQ item(s) whose staged locale key still needs explicit confirmation.`) : ""}
    ${sectionSet.has("unresolved") ? renderSectionShell("unresolved", "Unresolved", `${unresolved.length} item(s) that may need rescue, new-question staging, or to remain unresolved.`) : ""}
    <section class="page-end">
      <div class="toolbar">
        <button id="export-json">Export Decisions JSON</button>
        <span class="hint">Editable file: <span class="mono">${escapeHtml(decisionsPath)}</span></span>
      </div>
      <div class="export-status" id="export-status" role="alert" aria-live="assertive" hidden></div>
    </section>
  </div>
  <div class="lightbox" id="image-lightbox" hidden>
    <div class="lightbox-backdrop" data-lightbox-close></div>
    <div class="lightbox-dialog" role="dialog" aria-modal="true" aria-labelledby="image-lightbox-title">
      <div class="lightbox-toolbar">
        <div class="lightbox-meta">
          <div class="label">Image Preview</div>
          <div class="lightbox-title" id="image-lightbox-title"></div>
          <div class="lightbox-subtitle">Double-click or Cmd/Ctrl + wheel to zoom. Drag or scroll when zoomed.</div>
        </div>
        <div class="lightbox-controls">
          <button type="button" class="secondary" id="image-lightbox-fit">Fit</button>
          <button type="button" class="secondary" id="image-lightbox-zoom-out" aria-label="Zoom out">-</button>
          <div class="lightbox-zoom-value" id="image-lightbox-zoom-value">100%</div>
          <button type="button" class="secondary" id="image-lightbox-zoom-in" aria-label="Zoom in">+</button>
          <button type="button" class="lightbox-close secondary" data-lightbox-close>Close</button>
        </div>
      </div>
      <div class="lightbox-body" id="image-lightbox-body">
        <div class="lightbox-stage" id="image-lightbox-stage">
          <img id="image-lightbox-img" alt="">
        </div>
        <div class="image-fallback lightbox-fallback" id="image-lightbox-fallback" hidden>
          <div>Unable to load image preview.</div>
          <div class="filename" id="image-lightbox-path"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const ITEMS = ${serializeJsonForInlineScript(items)};
    const ITEMS_BY_ID = new Map(ITEMS.map((item) => [item.id, item]));
    const INITIAL_DECISIONS = ${serializeJsonForInlineScript(decisions)};
    const VISIBLE_SECTIONS = ${serializeJsonForInlineScript(Array.from(sectionSet))};
    const DISPLAY_ITEMS = VISIBLE_SECTIONS.flatMap((sectionId) => ITEMS.filter((item) => item.section === sectionId));
    const DISPLAY_INDEX_BY_ID = new Map(DISPLAY_ITEMS.map((item, index) => [item.id, index + 1]));
    const QUESTION_TYPE_BY_QID = ${serializeJsonForInlineScript(questionTypeByQid)};
    const QUESTION_EXPLANATION_BY_QID = ${serializeJsonForInlineScript(questionExplanationByQid)};
    const STORAGE_KEY = ${JSON.stringify(storageKey)};
    const EXPORT_FILE_NAME = ${JSON.stringify(decisionsFileName)};
    const ACTIVE_REVIEW_LOCALE = ${JSON.stringify(lang)};
    const ROW_DISPLAY_LABELS = {
      en: { R: 'Right', W: 'Wrong' },
      ko: { R: 'Y', W: 'N' },
      ja: { R: 'Yes', W: 'No' },
    };
    const LIGHTBOX = document.getElementById('image-lightbox');
    const LIGHTBOX_BODY = document.getElementById('image-lightbox-body');
    const LIGHTBOX_STAGE = document.getElementById('image-lightbox-stage');
    const LIGHTBOX_IMAGE = document.getElementById('image-lightbox-img');
    const LIGHTBOX_FALLBACK = document.getElementById('image-lightbox-fallback');
    const LIGHTBOX_TITLE = document.getElementById('image-lightbox-title');
    const LIGHTBOX_PATH = document.getElementById('image-lightbox-path');
    const LIGHTBOX_ZOOM_VALUE = document.getElementById('image-lightbox-zoom-value');
    const LIGHTBOX_ZOOM_IN = document.getElementById('image-lightbox-zoom-in');
    const LIGHTBOX_ZOOM_OUT = document.getElementById('image-lightbox-zoom-out');
    const LIGHTBOX_FIT = document.getElementById('image-lightbox-fit');
    const EXPORT_STATUS = document.getElementById('export-status');
    const LIGHTBOX_ZOOM_STEP = 1.2;
    let lightboxReturnFocus = null;
    let lightboxDrag = null;
    let exportBlockState = null;
    const lightboxState = {
      zoom: 1,
      fitZoom: 1,
      minZoom: 0.2,
      maxZoom: 5,
      naturalWidth: 0,
      naturalHeight: 0,
    };

    function clone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeDecisionChoiceKey(value) {
      const text = String(value ?? '').trim().toUpperCase();
      return /^[A-D]$/.test(text) ? text : null;
    }

    function normalizeLoadedDecision(item) {
      const decision = { ...item };
      const deleteQuestion = decision.deleteQuestion === true;
      const fallbackNewQuestionLocalAnswerKey = decision.createNewQuestion === true
        ? (
          normalizeDecisionChoiceKey(decision.newQuestionLocalAnswerKey) ||
          normalizeDecisionChoiceKey(decision.confirmedCorrectOptionKey)
        )
        : normalizeDecisionChoiceKey(decision.newQuestionLocalAnswerKey);

      decision.deleteQuestion = deleteQuestion;
      decision.approvedQid = deleteQuestion ? null : (decision.approvedQid || null);
      decision.createNewQuestion = deleteQuestion ? false : decision.createNewQuestion === true;
      decision.keepUnresolved = deleteQuestion ? false : decision.keepUnresolved === true;
      decision.confirmedCorrectOptionKey = normalizeDecisionChoiceKey(decision.confirmedCorrectOptionKey);
      decision.newQuestionLocalAnswerKey = fallbackNewQuestionLocalAnswerKey || null;
      decision.currentStagedLocaleCorrectOptionKey = normalizeDecisionChoiceKey(decision.currentStagedLocaleCorrectOptionKey);
      decision.answerKeyUnknown = decision.answerKeyUnknown === true || decision.unknown === true;
      decision.useCurrentStagedAnswerKey = decision.useCurrentStagedAnswerKey === true;

      return decision;
    }

    function loadState() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return clone(INITIAL_DECISIONS).map((item) => normalizeLoadedDecision(item));
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return clone(INITIAL_DECISIONS).map((item) => normalizeLoadedDecision(item));
        const byId = new Map(parsed.map((item) => [item.id, item]));
        return INITIAL_DECISIONS.map((item) => normalizeLoadedDecision({ ...item, ...(byId.get(item.id) || {}) }));
      } catch {
        return clone(INITIAL_DECISIONS).map((item) => normalizeLoadedDecision(item));
      }
    }

    let state = loadState();

    function saveState() {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }

    function download(filename, content, type) {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    }

    function setExportStatus(message) {
      const text = String(message ?? '').trim();
      EXPORT_STATUS.textContent = text;
      EXPORT_STATUS.hidden = !text;
    }

    function clearExportBlockDecorations() {
      document.querySelectorAll('.item.needs-attention').forEach((element) => {
        element.classList.remove('needs-attention');
      });
      document.querySelectorAll('.control-needs-attention').forEach((element) => {
        element.classList.remove('control-needs-attention');
      });
    }

    function clearExportBlockState() {
      exportBlockState = null;
      clearExportBlockDecorations();
      setExportStatus('');
    }

    function getItemCompletionIssue(item, decision) {
      if (!item || !decision) {
        return {
          reason: 'Choose a decision before exporting.',
          focusTarget: 'decision',
        };
      }

      if (item.section === 'answer-key') {
        if (!hasStructuredAnswerKeyDecision(item, decision)) {
          return {
            reason: 'Confirm the locale answer key or mark it unknown before exporting.',
            focusTarget: 'answer-key',
          };
        }
        return null;
      }

      const approvedQid = normalizeDecisionQid(decision.approvedQid);
      const hasApprovedQid = Boolean(approvedQid);
      const hasNewQuestionDecision = decision.createNewQuestion === true;
      const hasDeleteQuestionDecision = decision.deleteQuestion === true;
      const hasKeepUnresolvedDecision = !hasApprovedQid && !hasNewQuestionDecision && decision.keepUnresolved === true;

      if (!hasApprovedQid && !hasNewQuestionDecision && !hasKeepUnresolvedDecision && !hasDeleteQuestionDecision) {
        return {
          reason: 'Choose an existing qid, create a new question, keep it unresolved, or delete question before exporting.',
          focusTarget: 'decision',
        };
      }

      if (hasNewQuestionDecision && requiresLocalAnswerKeyForNewQuestion(item, decision) && !hasStructuredAnswerKeyDecision(item, decision)) {
        return {
          reason: 'Confirm the local answer key for this new question before exporting.',
          focusTarget: 'answer-key',
        };
      }

      if (hasApprovedQid && itemNeedsStructuredAnswerKey(item, decision) && !hasStructuredAnswerKeyDecision(item, decision)) {
        return {
          reason: 'Confirm the locale answer key for this manual qid change before exporting.',
          focusTarget: 'answer-key',
        };
      }

      return null;
    }

    function findFirstIncompleteItem() {
      for (const item of DISPLAY_ITEMS) {
        const issue = getItemCompletionIssue(item, getDecision(item.id));
        if (issue) {
          return {
            itemId: item.id,
            issue,
          };
        }
      }

      return null;
    }

    function getExportBlockElements(itemId, issue) {
      const article = document.querySelector('[data-item-id=' + JSON.stringify(itemId) + ']');
      if (!article) {
        return {
          article: null,
          control: null,
          decorationTarget: null,
        };
      }

      let control = null;
      if (issue.focusTarget === 'answer-key') {
        const answerName = 'answer-' + itemId;
        control =
          article.querySelector('input[name=' + JSON.stringify(answerName) + ']:checked') ||
          article.querySelector('input[name=' + JSON.stringify(answerName) + ']') ||
          article.querySelector('[data-use-current-answer-key=' + JSON.stringify(itemId) + ']');
      } else {
        const modeName = 'mode-' + itemId;
        control =
          article.querySelector('input[name=' + JSON.stringify(modeName) + ']:checked') ||
          article.querySelector('input[name=' + JSON.stringify(modeName) + ']') ||
          article.querySelector('[data-approved-qid-for=' + JSON.stringify(itemId) + ']');
      }

      if (!control) {
        control = article.querySelector('input, textarea, button');
      }

      return {
        article,
        control,
        decorationTarget: control?.closest?.('label') || control || null,
      };
    }

    function applyExportBlockFeedback(options = {}) {
      clearExportBlockDecorations();

      if (!exportBlockState) {
        setExportStatus('');
        return;
      }

      const item = ITEMS_BY_ID.get(exportBlockState.itemId);
      if (!item) {
        clearExportBlockState();
        return;
      }

      const questionNumber = DISPLAY_INDEX_BY_ID.get(exportBlockState.itemId) ?? item.index ?? '?';
      setExportStatus(
        'Export blocked until all questions are answered. Question ' +
        questionNumber +
        ' needs attention: ' +
        exportBlockState.issue.reason
      );

      const { article, control, decorationTarget } = getExportBlockElements(exportBlockState.itemId, exportBlockState.issue);
      if (article) {
        article.classList.add('needs-attention');
      }
      if (decorationTarget) {
        decorationTarget.classList.add('control-needs-attention');
      }

      if (options.scroll === false || !article) {
        return;
      }

      article.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (control && typeof control.focus === 'function') {
        requestAnimationFrame(() => {
          try {
            control.focus({ preventScroll: true });
          } catch {
            control.focus();
          }
        });
      }
    }

    function syncExportBlockState(options = {}) {
      if (!exportBlockState) {
        return;
      }

      const nextIncomplete = findFirstIncompleteItem();
      if (!nextIncomplete) {
        clearExportBlockState();
        return;
      }

      exportBlockState = nextIncomplete;
      applyExportBlockFeedback({ scroll: options.scroll === true });
    }

    function exportJson() {
      const nextIncomplete = findFirstIncompleteItem();
      if (nextIncomplete) {
        exportBlockState = nextIncomplete;
        applyExportBlockFeedback({ scroll: true });
        return;
      }

      clearExportBlockState();
      const payload = {
        exportedAt: new Date().toISOString(),
        lang: ${JSON.stringify(lang)},
        batchId: ${JSON.stringify(batchId)},
        dataset: ${JSON.stringify(dataset)},
        source: "workbench",
        items: state,
      };
      download(EXPORT_FILE_NAME, JSON.stringify(payload, null, 2) + "\\n", "application/json");
    }

    function getDecision(id) {
      return state.find((item) => item.id === id);
    }

    function normalizeDecisionQid(value) {
      const text = String(value ?? '').trim();
      return text || null;
    }

    function getApprovedMasterQuestionType(decision) {
      const approvedQid = normalizeDecisionQid(decision?.approvedQid);
      return approvedQid ? (QUESTION_TYPE_BY_QID[approvedQid] || null) : null;
    }

    function getResolvedQuestionType(item, decision) {
      const approvedMasterType = getApprovedMasterQuestionType(decision);
      if (approvedMasterType) {
        return approvedMasterType;
      }

      return item?.effectiveQuestionType || null;
    }

    function getTypeMismatchInfo(item, decision) {
      const sourceType = item?.effectiveQuestionType || null;
      const approvedMasterType = getApprovedMasterQuestionType(decision);
      const approvedQid = normalizeDecisionQid(decision?.approvedQid);

      if (!sourceType || !approvedMasterType || sourceType === approvedMasterType) {
        return null;
      }

      return {
        sourceType,
        approvedMasterType,
        approvedQid,
      };
    }

    function getCurrentStagedAnswerKey(id) {
      return (
        getDecision(id)?.currentStagedLocaleCorrectOptionKey ||
        ITEMS_BY_ID.get(id)?.currentStagedLocaleCorrectOptionKey ||
        null
      );
    }

    function parseVisibleChoice(value) {
      const text = String(value ?? '').replace(/\s+/g, ' ').trim();
      if (!text) {
        return { key: null, body: null };
      }

      const match = text.match(/^\s*([A-Z])[\s.:：、．\)\]-]+(.*)$/i);
      if (match) {
        const body = String(match[2] ?? '').replace(/\s+/g, ' ').trim();
        return {
          key: match[1].toUpperCase(),
          body: body || null,
        };
      }

      return {
        key: null,
        body: text,
      };
    }

    function fallbackVisibleChoiceKey(index) {
      return String.fromCharCode(65 + index);
    }

    function selectorForActiveElement(element) {
      if (!element || element === document.body) {
        return null;
      }

      if (element.dataset?.approvedQidFor) {
        return '[data-approved-qid-for=' + JSON.stringify(element.dataset.approvedQidFor) + ']';
      }

      if (element.dataset?.notesFor) {
        return '[data-notes-for=' + JSON.stringify(element.dataset.notesFor) + ']';
      }

      if (element.dataset?.newTopicFor) {
        return '[data-new-topic-for=' + JSON.stringify(element.dataset.newTopicFor) + ']';
      }

      if (element.dataset?.newSubtopicsFor) {
        return '[data-new-subtopics-for=' + JSON.stringify(element.dataset.newSubtopicsFor) + ']';
      }

      if (element.dataset?.useCurrentAnswerKey) {
        return '[data-use-current-answer-key=' + JSON.stringify(element.dataset.useCurrentAnswerKey) + ']';
      }

      if (element.dataset?.useQid && element.dataset?.qid) {
        return '[data-use-qid=' + JSON.stringify(element.dataset.useQid) + '][data-qid=' + JSON.stringify(element.dataset.qid) + ']';
      }

      if (element.name && element.value) {
        return '[name=' + JSON.stringify(element.name) + '][value=' + JSON.stringify(element.value) + ']';
      }

      return null;
    }

    function captureRenderContext() {
      const active = document.activeElement;
      const context = {
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        selector: selectorForActiveElement(active),
      };

      if (active && typeof active.selectionStart === 'number' && typeof active.selectionEnd === 'number') {
        context.selectionStart = active.selectionStart;
        context.selectionEnd = active.selectionEnd;
      }

      return context;
    }

    function restoreRenderContext(context) {
      if (!context) {
        return;
      }

      window.scrollTo(context.scrollX, context.scrollY);

      if (!context.selector) {
        return;
      }

      const nextActive = document.querySelector(context.selector);
      if (!nextActive) {
        return;
      }

      try {
        nextActive.focus({ preventScroll: true });
      } catch {
        nextActive.focus();
      }

      if (
        typeof context.selectionStart === 'number' &&
        typeof context.selectionEnd === 'number' &&
        typeof nextActive.setSelectionRange === 'function'
      ) {
        nextActive.setSelectionRange(context.selectionStart, context.selectionEnd);
      }

      window.scrollTo(context.scrollX, context.scrollY);
    }

    function updateDecision(id, patch, options = {}) {
      state = state.map((item) => item.id === id ? { ...item, ...patch } : item);
      saveState();

      if (options.rerender !== false) {
        render({ preserveContext: options.preserveContext !== false });
        return;
      }

      syncExportBlockState();
    }

    function useCandidate(id, qid) {
      updateDecision(id, { approvedQid: qid || "", createNewQuestion: false, keepUnresolved: false, deleteQuestion: false });
    }

    function setDecisionMode(id, mode) {
      if (mode === "approve") {
        updateDecision(id, { createNewQuestion: false, keepUnresolved: false, deleteQuestion: false });
        return;
      }
      if (mode === "new") {
        updateDecision(id, {
          approvedQid: null,
          createNewQuestion: true,
          keepUnresolved: false,
          deleteQuestion: false,
          useCurrentStagedAnswerKey: false,
          answerKeyUnknown: false,
        });
        return;
      }
      if (mode === "delete") {
        // Delete question intentionally resolves the item without promotion or follow-up.
        updateDecision(id, { approvedQid: null, createNewQuestion: false, keepUnresolved: false, deleteQuestion: true });
        return;
      }
      updateDecision(id, { approvedQid: null, createNewQuestion: false, keepUnresolved: true, deleteQuestion: false });
    }

    function itemNeedsStructuredAnswerKey(item, decision) {
      return Boolean(
        item &&
        getResolvedQuestionType(item, decision) === 'MCQ' &&
        item.initialSuggestedQid &&
        decision?.approvedQid &&
        decision.approvedQid !== item.initialSuggestedQid
      );
    }

    function requiresLocalAnswerKeyForNewQuestion(item, decision) {
      return Boolean(
        item &&
        decision?.createNewQuestion === true &&
        getAnswerKeyVariant(item, decision) !== null
      );
    }

    function allowsUnknownAnswerKey(item, decision) {
      return Boolean(item && decision?.createNewQuestion !== true);
    }

    function getSelectedAnswerKey(item, decision) {
      if (!decision) {
        return null;
      }

      if (decision.createNewQuestion === true) {
        return normalizeDecisionChoiceKey(decision.newQuestionLocalAnswerKey);
      }

      if (decision.useCurrentStagedAnswerKey === true && decision.currentStagedLocaleCorrectOptionKey) {
        return normalizeDecisionChoiceKey(decision.currentStagedLocaleCorrectOptionKey);
      }

      return normalizeDecisionChoiceKey(decision.confirmedCorrectOptionKey);
    }

    function hasStructuredAnswerKeyDecision(item, decision) {
      return Boolean(
        decision &&
        (
          getSelectedAnswerKey(item, decision) ||
          (allowsUnknownAnswerKey(item, decision) && decision.answerKeyUnknown === true)
        )
      );
    }

    function getAnswerKeyVariant(item, decision) {
      if (!item) {
        return null;
      }

      if (item.section === 'answer-key') {
        return 'mcq';
      }

      const resolvedQuestionType = getResolvedQuestionType(item, decision);
      if (resolvedQuestionType === 'ROW') {
        return 'row';
      }

      if (resolvedQuestionType === 'MCQ') {
        return 'mcq';
      }

      return null;
    }

    function getVisibleChoiceKeys(item, decision) {
      const variant = getAnswerKeyVariant(item, decision);
      if (!variant) {
        return [];
      }

      if (variant === 'row') {
        return ['A', 'B'];
      }

      const rawOptions = Array.isArray(item?.optionsRawJa) ? item.optionsRawJa : [];
      const glossOptions = Array.isArray(item?.optionsGlossEn) ? item.optionsGlossEn : [];
      const length = Math.max(rawOptions.length, glossOptions.length);
      const keys = [];

      for (let index = 0; index < length; index += 1) {
        const rawChoice = parseVisibleChoice(rawOptions[index]);
        const glossChoice = parseVisibleChoice(glossOptions[index]);
        const key = normalizeDecisionChoiceKey(rawChoice.key) ||
          normalizeDecisionChoiceKey(glossChoice.key) ||
          normalizeDecisionChoiceKey(fallbackVisibleChoiceKey(index));

        if (key && !keys.includes(key)) {
          keys.push(key);
        }
      }

      return keys.length > 0 ? keys : ['A', 'B', 'C', 'D'];
    }

    function getAnswerKeyChoices(item, decision) {
      const variant = getAnswerKeyVariant(item, decision);
      const visibleKeys = getVisibleChoiceKeys(item, decision);
      if (variant === 'row') {
        const choices = [
          { value: 'A', label: 'A', hint: 'Yes / Right / True' },
          { value: 'B', label: 'B', hint: 'No / Wrong / False' },
        ].filter((choice) => visibleKeys.includes(choice.value));
        if (allowsUnknownAnswerKey(item, decision)) {
          choices.push({ value: 'unknown', label: 'UNKNOWN', hint: null });
        }
        return choices;
      }

      if (variant === 'mcq') {
        const choices = visibleKeys.map((key) => ({ value: key, label: key, hint: null }));
        if (allowsUnknownAnswerKey(item, decision)) {
          choices.push({ value: 'unknown', label: 'UNKNOWN', hint: null });
        }
        return choices;
      }

      return [];
    }

    function getAnswerKeyLabelText(item, decision) {
      if (item?.section === 'answer-key') {
        return 'Confirm / Override';
      }

      if (decision?.createNewQuestion === true) {
        return 'Local Answer Key (required for new question)';
      }

      if (itemNeedsStructuredAnswerKey(item, decision)) {
        return 'Locale Answer Key (required for manual qid change)';
      }

      if (getAnswerKeyVariant(item, decision)) {
        return 'Locale Answer Key (optional)';
      }

      return '';
    }

    function getAnswerKeyNoteText(item, decision) {
      if (decision?.createNewQuestion === true) {
        const choiceText = getVisibleChoiceKeys(item, decision).join('/');
        const hasAnswerKey = hasStructuredAnswerKeyDecision(item, decision);
        return hasAnswerKey
          ? 'Structured local answer key recorded for the new question.'
          : 'Required because Create new question is selected. Select ' + choiceText + '.';
      }

      if (itemNeedsStructuredAnswerKey(item, decision)) {
        const choiceText = getVisibleChoiceKeys(item, decision).join('/');
        const currentStagedInstruction = item.currentStagedLocaleCorrectOptionKey
          ? ' Select "Use current staged key", choose ' + choiceText + ', or mark unknown.'
          : ' Choose ' + choiceText + ' or mark unknown.';
        return hasStructuredAnswerKeyDecision(item, decision)
          ? 'Structured locale answer-key confirmation recorded for manual qid change from ' + String(item.initialSuggestedQid || '') + '.'
          : 'Required because approved qid differs from initial suggestion ' + String(item.initialSuggestedQid || '') + '.' + currentStagedInstruction;
      }

      return '';
    }

    function getRowDisplayLabel(rowValue) {
      const labels = ROW_DISPLAY_LABELS[ACTIVE_REVIEW_LOCALE] || ROW_DISPLAY_LABELS.en;
      return labels[rowValue] || ROW_DISPLAY_LABELS.en[rowValue] || rowValue || '';
    }

    function getRowCanonicalHint(rowValue) {
      if (rowValue === 'R') {
        return 'R · right / true';
      }
      if (rowValue === 'W') {
        return 'W · wrong / false';
      }
      return '';
    }

    function normalizeRowValue(value) {
      const normalized = String(value ?? '').trim().toLowerCase();
      if (!normalized) {
        return null;
      }

      if (
        normalized === 'r' ||
        normalized === 'right' ||
        normalized === 'true' ||
        normalized === 'yes' ||
        normalized === 'y' ||
        /(^|[^a-z])(yes|right|true|y)([^a-z]|$)/.test(normalized) ||
        /はい/.test(normalized)
      ) {
        return 'R';
      }

      if (
        normalized === 'w' ||
        normalized === 'wrong' ||
        normalized === 'false' ||
        normalized === 'no' ||
        normalized === 'n' ||
        /(^|[^a-z])(no|wrong|false|n)([^a-z]|$)/.test(normalized) ||
        /いいえ/.test(normalized)
      ) {
        return 'W';
      }

      return null;
    }

    function getRowSourceOptionMap(item) {
      const rawOptions = Array.isArray(item?.optionsRawJa) ? item.optionsRawJa : [];
      const optionGlosses = Array.isArray(item?.optionsGlossEn) ? item.optionsGlossEn : [];
      const byRow = new Map();

      rawOptions.forEach((option, index) => {
        const rowValue = normalizeRowValue(option);
        if (!rowValue || byRow.has(rowValue)) {
          return;
        }

        byRow.set(rowValue, {
          raw: option || '',
          gloss: optionGlosses[index] || '',
        });
      });

      return byRow;
    }

    function inferSourceRowSelection(item) {
      const direct = normalizeRowValue(item?.correctAnswerRaw);
      if (direct) {
        return direct;
      }

      const key = String(item?.correctKeyRaw ?? '').trim().toUpperCase();
      if (/^[A-D]$/.test(key)) {
        const rawOptions = Array.isArray(item?.optionsRawJa) ? item.optionsRawJa : [];
        const keyedOption = rawOptions.find((option) =>
          String(option ?? '').trim().toUpperCase().startsWith(key)
        );
        const keyedRow = normalizeRowValue(keyedOption);
        if (keyedRow) {
          return keyedRow;
        }
      }

      return null;
    }

    function renderNormalizedRowChoices({ highlightRow = null, rawByRow = null, sourceSide = false }) {
      return '<ol class="options">' +
        ['R', 'W'].map((rowValue) => {
          const rawEntry = rawByRow?.get?.(rowValue) || null;
          return '<li class="option' + (highlightRow === rowValue ? ' option-current' : '') + '">' +
            '<div class="option-row"><div><span class="option-key">' + escapeHtml(getRowDisplayLabel(rowValue)) + '</span></div>' +
              (highlightRow === rowValue ? '<span class="option-correct-badge">Correct</span>' : '') +
            '</div>' +
            '<div class="option-gloss">' + escapeHtml(getRowCanonicalHint(rowValue)) + '</div>' +
            (sourceSide && rawEntry?.raw ? '<div class="option-gloss">OCR: ' + escapeHtml(rawEntry.raw) + '</div>' : '') +
            (sourceSide && rawEntry?.gloss ? '<div class="option-gloss">Gloss: ' + escapeHtml(rawEntry.gloss) + '</div>' : '') +
          '</li>';
        }).join('') +
      '</ol>';
    }

    function renderImage(item) {
      if (!item.screenshotPath) {
        return '<div class="image-frame"><div class="image-fallback">Screenshot not available</div></div>';
      }
      return renderInlineImage(item.screenshotPath, item.sourceImage || item.itemId || item.qid || "screenshot", "image-frame", {
        caption: item.sourceImage || item.itemId || item.qid || 'Source screenshot',
      });
    }

    function renderInlineImage(imagePath, altText, frameClass, options = {}) {
      const encodedPath = encodeURI(imagePath);
      const caption = options.caption || altText || imagePath || 'image';
      return '<button type="button" class="image-button" data-lightbox-src="' + escapeHtml(encodedPath) + '" data-lightbox-alt="' + escapeHtml(altText || "image") + '" data-lightbox-caption="' + escapeHtml(caption) + '">' +
        '<span class="' + escapeHtml(frameClass || 'image-frame') + '">' +
          '<img src="' + encodedPath + '" alt="' + escapeHtml(altText || "image") + '" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'grid\\';">' +
          '<span class="image-fallback" style="display:none;">Unable to load image<div class="filename">' + escapeHtml(imagePath) + '</div></span>' +
          '<span class="image-zoom-hint">Click to enlarge</span>' +
        '</span>' +
      '</button>';
    }

    function renderOptionList(item, highlightKey) {
      const options = Array.isArray(item.optionsRawJa) ? item.optionsRawJa : [];
      const glosses = Array.isArray(item.optionsGlossEn) ? item.optionsGlossEn : [];
      return options.map((option, index) => {
        const key = option && /^[A-D]/i.test(option) ? option.trim().charAt(0).toUpperCase() : String.fromCharCode(65 + index);
        const isHighlight = highlightKey && highlightKey === key;
        return '<li class="option' + (isHighlight ? ' option-current' : '') + '">' +
          '<div class="option-row"><div><span class="option-key">' + escapeHtml(key) + '</span>' + escapeHtml(option || '') + '</div>' +
            (isHighlight ? '<span class="option-correct-badge">Correct</span>' : '') +
          '</div>' +
          (glosses[index] ? '<div class="option-gloss">' + escapeHtml(glosses[index]) + '</div>' : '') +
        '</li>';
      }).join('');
    }

    function renderSourceOptionSection(item, decision) {
      const resolvedQuestionType = getResolvedQuestionType(item, decision);
      if (resolvedQuestionType === 'ROW') {
        return '<div><span class="label">ROW Choices</span>' +
          renderNormalizedRowChoices({
            highlightRow: inferSourceRowSelection(item),
            rawByRow: getRowSourceOptionMap(item),
            sourceSide: true,
          }) +
        '</div>';
      }

      if ((item.optionsRawJa || []).length > 0) {
        return '<div><span class="label">Options</span><ol class="options">' + renderOptionList(item, item.section === 'answer-key' ? item.currentStagedLocaleCorrectOptionKey : null) + '</ol></div>';
      }

      return '';
    }

    function renderCandidate(candidate, itemId) {
      const candidateType = candidate.type || null;
      const isRowCandidate = candidateType === 'ROW';
      const rowValue = isRowCandidate
        ? normalizeRowValue(candidate.correctRow || candidate.correctAnswerText || candidate.correctOptionKey)
        : null;
      const correctOptionKey = String(candidate.correctOptionKey ?? '').trim().toUpperCase() || null;
      const options = rowValue
        ? renderNormalizedRowChoices({ highlightRow: rowValue })
        : (candidate.options || []).map((option) => {
          const optionKey = String(option.id ?? '').trim().toUpperCase() || null;
          const isCorrect = Boolean(correctOptionKey && optionKey && optionKey === correctOptionKey);
          return '<li class="option' + (isCorrect ? ' option-current' : '') + '">' +
            '<div class="option-row"><div><span class="option-key">' + escapeHtml(option.id || '?') + '</span>' + escapeHtml(option.text || '') + '</div>' +
              (isCorrect ? '<span class="option-correct-badge">Correct</span>' : '') +
            '</div>' +
          '</li>';
        }).join('');
      return '<article class="candidate">' +
        '<div class="candidate-head">' +
          '<div class="candidate-badges">' +
            '<span class="pill note">' + escapeHtml(candidate.qid || 'unknown') + '</span>' +
            '<span class="pill">#' + escapeHtml(candidate.number ?? '') + '</span>' +
            '<span class="pill">' + escapeHtml(candidate.type || '') + '</span>' +
            (candidate.rawCandidateType && candidate.rawCandidateType !== candidate.type
              ? '<span class="pill warn">resolved from ' + escapeHtml(candidate.rawCandidateType) + '</span>'
              : '') +
            '<span class="pill">score ' + escapeHtml(candidate.score ?? '') + '</span>' +
            (candidate.scoreGapFromTop != null ? '<span class="pill">gap ' + escapeHtml(candidate.scoreGapFromTop) + '</span>' : '') +
            '<span class="pill">' + escapeHtml(candidate.hasImage ? 'has image' : 'no image') + '</span>' +
          '</div>' +
          '<button type="button" data-use-qid="' + escapeHtml(itemId) + '" data-qid="' + escapeHtml(candidate.qid || '') + '">Use qid</button>' +
        '</div>' +
        '<div class="prompt">' + escapeHtml(candidate.prompt || '') + '</div>' +
        (candidate.imagePath
          ? '<div class="candidate-media">' + renderInlineImage(candidate.imagePath, candidate.qid || 'candidate image', 'image-frame candidate-image-frame', {
              caption: [candidate.qid || null, candidate.prompt || null].filter(Boolean).join(' · ') || 'Candidate image',
            }) + '</div>'
          : '') +
        (options ? (rowValue ? options : '<ol class="options">' + options + '</ol>') : '') +
        (rowValue
          ? '<div class="gloss">Correct: ' + escapeHtml(getRowDisplayLabel(rowValue)) + '</div>'
          : (candidate.correctAnswerText ? '<div class="gloss">Correct answer: ' + escapeHtml(candidate.correctAnswerText) + '</div>' : '')) +
        (candidate.imagePath ? '<div class="filename">' + escapeHtml(candidate.imagePath) + '</div>' : '') +
      '</article>';
    }

    function renderStructuredAnswerKeyNote(item, decision) {
      const noteText = getAnswerKeyNoteText(item, decision);
      if (!noteText) {
        return '';
      }

      return '<div class="fact' + (hasStructuredAnswerKeyDecision(item, decision) ? '' : ' warn') + '"><span class="label">Answer-Key Confirmation</span><div class="value">' +
        escapeHtml(noteText) +
      '</div></div>';
    }

    function renderDecisionPanel(item, decision) {
      const selectedAnswerKey = getSelectedAnswerKey(item, decision);
      const answerChoices = getAnswerKeyChoices(item, decision).map((choice) => {
        const checked = choice.value === 'unknown'
          ? allowsUnknownAnswerKey(item, decision) && decision.answerKeyUnknown === true
          : selectedAnswerKey === choice.value;
        return '<label><input type="radio" name="answer-' + escapeHtml(item.id) + '" value="' + escapeHtml(choice.value) + '"' + (checked ? ' checked' : '') + '>' +
          '<span>' + escapeHtml(choice.label + (choice.hint ? ' (' + choice.hint + ')' : '')) + '</span></label>';
      }).join('');
      const resolvedQuestionType = getResolvedQuestionType(item, decision);
      const answerKeyVariant = getAnswerKeyVariant(item, decision);
      const showAnswerKey =
        item.section === 'answer-key' ||
        answerKeyVariant === 'mcq' ||
        (decision.createNewQuestion === true && answerKeyVariant === 'row');
      const explanationValue = getResolvedSourceExplanation(item, decision);

      if (item.section === 'answer-key') {
        return '<div class="decision-block">' +
          '<div class="decision-row"><span class="label">Current Staged Key</span><div class="fact"><div class="value mono">' + escapeHtml(item.currentStagedLocaleCorrectOptionKey || 'unknown') + '</div></div></div>' +
          '<div class="decision-row"><span class="label">Confirm / Override</span><div class="answer-key-choices">' + answerChoices + '</div>' +
            (item.currentStagedLocaleCorrectOptionKey
              ? '<div class="answer-key-toolbar"><button type="button" data-use-current-answer-key="' + escapeHtml(item.id) + '">Use current staged key (' + escapeHtml(item.currentStagedLocaleCorrectOptionKey) + ')</button></div>'
              : '') + '</div>' +
          '<label class="label" for="notes-' + escapeHtml(item.id) + '">Reviewer Notes</label>' +
          '<textarea id="notes-' + escapeHtml(item.id) + '" data-notes-for="' + escapeHtml(item.id) + '">' + escapeHtml(decision.reviewerNotes || '') + '</textarea>' +
          '<label class="label" for="explanation-' + escapeHtml(item.id) + '">Explanation</label>' +
          '<textarea id="explanation-' + escapeHtml(item.id) + '" data-source-explanation-for="' + escapeHtml(item.id) + '" placeholder="Optional English/source explanation for questions.json">' + escapeHtml(explanationValue) + '</textarea>' +
        '</div>';
      }

      return '<div class="decision-block">' +
        '<div class="decision-row">' +
          '<span class="label">Decision</span>' +
          '<div class="decision-actions">' +
            '<label><input type="radio" name="mode-' + escapeHtml(item.id) + '" value="approve"' + (decision.approvedQid && decision.deleteQuestion !== true ? ' checked' : '') + '><span>' + escapeHtml(item.section === 'auto-matched' ? 'Confirm auto-match / existing qid' : 'Approve existing qid') + '</span></label>' +
            '<label><input type="radio" name="mode-' + escapeHtml(item.id) + '" value="new"' + (decision.createNewQuestion && decision.deleteQuestion !== true ? ' checked' : '') + '><span>Create new question</span></label>' +
            '<label><input type="radio" name="mode-' + escapeHtml(item.id) + '" value="unresolved"' + (!decision.approvedQid && !decision.createNewQuestion && decision.keepUnresolved && decision.deleteQuestion !== true ? ' checked' : '') + '><span>Keep unresolved</span></label>' +
            '<label><input type="radio" name="mode-' + escapeHtml(item.id) + '" value="delete"' + (decision.deleteQuestion === true ? ' checked' : '') + '><span>Delete question</span></label>' +
        '</div>' +
        '</div>' +
        '<div class="decision-row"><span class="label">Approved Qid</span><input type="text" value="' + escapeHtml(decision.approvedQid || '') + '" data-approved-qid-for="' + escapeHtml(item.id) + '" placeholder="q0123"></div>' +
        (showAnswerKey
          ? '<div class="decision-row"><span class="label" data-answer-key-label-for="' + escapeHtml(item.id) + '">' + escapeHtml(getAnswerKeyLabelText(item, decision)) + '</span><div class="answer-key-choices">' + answerChoices + '</div>' +
              (item.currentStagedLocaleCorrectOptionKey && decision.createNewQuestion !== true
                ? '<div class="answer-key-toolbar"><button type="button" data-use-current-answer-key="' + escapeHtml(item.id) + '">Use current staged key (' + escapeHtml(item.currentStagedLocaleCorrectOptionKey) + ')</button></div>'
                : '') +
            '</div><div data-answer-key-note-for="' + escapeHtml(item.id) + '">' + renderStructuredAnswerKeyNote(item, decision) + '</div>'
          : '') +
        '<div class="decision-row"><span class="label">New-Question Topic (optional)</span><input type="text" value="' + escapeHtml(decision.newQuestionProvisionalTopic || '') + '" data-new-topic-for="' + escapeHtml(item.id) + '" placeholder="road-safety"></div>' +
        '<div class="decision-row"><span class="label">New-Question Subtopics (comma or newline separated)</span><textarea data-new-subtopics-for="' + escapeHtml(item.id) + '" placeholder="traffic-signals:road-signs">' + escapeHtml((decision.newQuestionProvisionalSubtopics || []).join(', ')) + '</textarea></div>' +
        '<label class="label" for="notes-' + escapeHtml(item.id) + '">Reviewer Notes</label>' +
        '<textarea id="notes-' + escapeHtml(item.id) + '" data-notes-for="' + escapeHtml(item.id) + '">' + escapeHtml(decision.reviewerNotes || '') + '</textarea>' +
        '<label class="label" for="explanation-' + escapeHtml(item.id) + '">Explanation</label>' +
        '<textarea id="explanation-' + escapeHtml(item.id) + '" data-source-explanation-for="' + escapeHtml(item.id) + '" placeholder="Optional English/source explanation for questions.json">' + escapeHtml(explanationValue) + '</textarea>' +
      '</div>';
    }

    function renderCard(item) {
      const decision = getDecision(item.id);
      const displayNumber = DISPLAY_INDEX_BY_ID.get(item.id) ?? item.index ?? '?';
      const typeMismatch = getTypeMismatchInfo(item, decision);
      const facts = [];
      if (item.reason) facts.push(['Reason', item.reason]);
      if (item.ocrConfidence) facts.push(['OCR', item.ocrConfidence]);
      if (item.section === 'auto-matched' && item.qid) facts.push(['Matched Qid', item.qid]);
      if (item.section === 'auto-matched' && item.matchScore != null) facts.push(['Match Score', item.matchScore]);
      if (item.section === 'auto-matched' && item.matchScoreGap != null) facts.push(['Match Gap', item.matchScoreGap]);
      if (item.candidateSetLabel) facts.push(['Candidate Set', item.candidateSetLabel]);
      if (item.initialSuggestedQid) facts.push(['Initial Suggested Qid', item.initialSuggestedQid]);
      if (item.currentStagedLocaleCorrectOptionKey) facts.push(['Current Staged Key', item.currentStagedLocaleCorrectOptionKey]);
      if (item.answerKeyNeedsManualConfirmation && item.answerKeyConfirmationReason) {
        facts.push(['Answer-Key Check', item.answerKeyConfirmationReason]);
      }
      if (item.provisionalTopic) facts.push(['Topic', item.provisionalTopic]);
      if (Array.isArray(item.provisionalSubtopics) && item.provisionalSubtopics.length > 0) facts.push(['Subtopics', item.provisionalSubtopics.join(', ')]);
      if (item.sourceBatchId) facts.push(['Source Batch', item.sourceBatchId]);
      if (item.backlogKind) facts.push(['Backlog', item.backlogKind]);
      if (item.backlogStatus) facts.push(['Backlog Status', item.backlogStatus]);
      if (item.section === 'answer-key') {
        facts.push(['Canonical Prompt', item.canonicalPrompt || '']);
        facts.push(['Canonical Correct', [item.canonicalCorrectOptionKey, item.canonicalCorrectOptionText].filter(Boolean).join(' · ')]);
      }
      return '<article class="item" data-item-id="' + escapeHtml(item.id) + '">' +
        '<div>' +
          '<div class="eyebrow">' + escapeHtml(item.section.replace('-', ' ')) + '</div>' +
          '<h3>' + escapeHtml(item.section === 'answer-key' ? item.qid : (item.itemId || item.sourceImage || 'item')) + '</h3>' +
          renderImage(item) +
          '<div class="filename"><span class="filename-number">' + escapeHtml(displayNumber) + '.</span>' + escapeHtml(item.sourceImage || item.itemId || item.qid || '') + '</div>' +
        '</div>' +
        '<div class="source-block">' +
          '<div class="source-card">' +
            '<div><span class="label">Japanese Prompt</span><p class="prompt">' + escapeHtml(item.promptRawJa || '') + '</p>' + (item.promptGlossEn ? '<div class="gloss">' + escapeHtml(item.promptGlossEn) + '</div>' : '') + '</div>' +
            renderSourceOptionSection(item, decision) +
            '<div class="mini-grid">' +
              facts.map(([label, value]) => '<div class="fact"><span class="label">' + escapeHtml(label) + '</span><div class="value">' + escapeHtml(value || '') + '</div></div>').join('') +
              (typeMismatch
                ? '<div class="fact warn"><span class="label">Type Mismatch</span><div class="value">Source inferred ' + escapeHtml(typeMismatch.sourceType) + ', but approved master ' + escapeHtml(typeMismatch.approvedQid || 'qid') + ' is ' + escapeHtml(typeMismatch.approvedMasterType) + '. Rendering and answer-key handling use the approved master type.</div></div>'
                : '') +
            '</div>' +
            (item.section !== 'answer-key'
              ? ((Array.isArray(item.topCandidates) && item.topCandidates.length > 0)
                  ? '<div><span class="label">Candidates</span><div class="candidate-list">' + item.topCandidates.map((candidate) => renderCandidate(candidate, item.id)).join('') + '</div></div>'
                  : '')
              : '<div><span class="label">Answer-Key Review</span><div class="fact"><div class="value">' + escapeHtml(item.answerKeyConfirmationReason || 'Manual confirmation required.') + '</div></div></div>') +
            (item.analysis || item.sourceConceptSlots ? '<details><summary>Advanced Details</summary><pre>' + escapeHtml(JSON.stringify({ analysis: item.analysis || null, sourceConceptSlots: item.sourceConceptSlots || null }, null, 2)) + '</pre></details>' : '') +
          '</div>' +
        '</div>' +
        renderDecisionPanel(item, decision) +
      '</article>';
    }

    function renderSection(sectionId, items) {
      const target = document.querySelector('[data-section-list=\"' + sectionId + '\"]');
      target.innerHTML = items.map((item) => renderCard(item)).join('');
    }

    function syncDecisionUi(id) {
      const item = ITEMS_BY_ID.get(id);
      const decision = getDecision(id);
      if (!item || !decision) {
        return;
      }

      const modeName = 'mode-' + id;
      const approveRadio = document.querySelector('input[name=' + JSON.stringify(modeName) + '][value="approve"]');
      const newRadio = document.querySelector('input[name=' + JSON.stringify(modeName) + '][value="new"]');
      const unresolvedRadio = document.querySelector('input[name=' + JSON.stringify(modeName) + '][value="unresolved"]');
      const deleteRadio = document.querySelector('input[name=' + JSON.stringify(modeName) + '][value="delete"]');

      if (approveRadio) {
        approveRadio.checked = Boolean(decision.approvedQid && decision.deleteQuestion !== true);
      }
      if (newRadio) {
        newRadio.checked = Boolean(!decision.approvedQid && decision.createNewQuestion && decision.deleteQuestion !== true);
      }
      if (unresolvedRadio) {
        unresolvedRadio.checked = Boolean(!decision.approvedQid && !decision.createNewQuestion && decision.keepUnresolved && decision.deleteQuestion !== true);
      }
      if (deleteRadio) {
        deleteRadio.checked = decision.deleteQuestion === true;
      }

      const answerKeyLabel = document.querySelector('[data-answer-key-label-for=' + JSON.stringify(id) + ']');
      if (answerKeyLabel) {
        answerKeyLabel.textContent = getAnswerKeyLabelText(item, decision);
      }

      const answerKeyNote = document.querySelector('[data-answer-key-note-for=' + JSON.stringify(id) + ']');
      if (answerKeyNote) {
        answerKeyNote.innerHTML = renderStructuredAnswerKeyNote(item, decision);
      }
    }

    function getResolvedSourceExplanation(item, decision) {
      if (decision && decision.sourceExplanation !== null && decision.sourceExplanation !== undefined) {
        return decision.sourceExplanation;
      }

      const qid = String(
        decision?.approvedQid ||
        item?.qid ||
        item?.initialSuggestedQid ||
        ''
      ).trim();

      if (!qid) {
        return '';
      }

      return String(QUESTION_EXPLANATION_BY_QID[qid] || '');
    }

    function clampLightboxZoom(value) {
      return Math.min(lightboxState.maxZoom, Math.max(lightboxState.minZoom, value));
    }

    function updateLightboxControls() {
      const percent = Math.round(lightboxState.zoom * 100);
      LIGHTBOX_ZOOM_VALUE.textContent = percent + '%';
      LIGHTBOX_ZOOM_IN.disabled = lightboxState.zoom >= lightboxState.maxZoom - 0.001;
      LIGHTBOX_ZOOM_OUT.disabled = lightboxState.zoom <= lightboxState.minZoom + 0.001;
      const zoomed = lightboxState.zoom > lightboxState.fitZoom + 0.01;
      LIGHTBOX_BODY.classList.toggle('is-zoomed', zoomed);
      LIGHTBOX_STAGE.classList.toggle('is-draggable', zoomed && !LIGHTBOX_IMAGE.hidden);
    }

    function updateLightboxImageDimensions() {
      if (!lightboxState.naturalWidth || LIGHTBOX_IMAGE.hidden) {
        return;
      }

      LIGHTBOX_IMAGE.style.width = Math.max(48, Math.round(lightboxState.naturalWidth * lightboxState.zoom)) + 'px';
      LIGHTBOX_IMAGE.style.height = 'auto';
      updateLightboxControls();
    }

    function buildLightboxAnchor(clientX, clientY) {
      const imageRect = LIGHTBOX_IMAGE.getBoundingClientRect();
      if (!imageRect.width || !imageRect.height) {
        return null;
      }

      const relativeX = Math.min(1, Math.max(0, (clientX - imageRect.left) / imageRect.width));
      const relativeY = Math.min(1, Math.max(0, (clientY - imageRect.top) / imageRect.height));
      return { clientX, clientY, relativeX, relativeY };
    }

    function applyLightboxZoom(nextZoom, options = {}) {
      if (!lightboxState.naturalWidth) {
        return;
      }

      const clamped = clampLightboxZoom(nextZoom);
      lightboxState.zoom = clamped;
      updateLightboxImageDimensions();

      const anchor = options.anchor || null;
      if (anchor) {
        requestAnimationFrame(() => {
          const imageRect = LIGHTBOX_IMAGE.getBoundingClientRect();
          const targetX = imageRect.left + (imageRect.width * anchor.relativeX);
          const targetY = imageRect.top + (imageRect.height * anchor.relativeY);
          LIGHTBOX_BODY.scrollLeft += targetX - anchor.clientX;
          LIGHTBOX_BODY.scrollTop += targetY - anchor.clientY;
        });
      }
    }

    function computeFitZoom() {
      if (!lightboxState.naturalWidth || !lightboxState.naturalHeight) {
        return 1;
      }

      const viewportWidth = Math.max(1, LIGHTBOX_BODY.clientWidth - 16);
      const viewportHeight = Math.max(1, LIGHTBOX_BODY.clientHeight - 16);
      return Math.min(
        1,
        viewportWidth / lightboxState.naturalWidth,
        viewportHeight / lightboxState.naturalHeight,
      );
    }

    function fitLightboxImage() {
      if (!lightboxState.naturalWidth) {
        return;
      }

      lightboxState.fitZoom = computeFitZoom();
      applyLightboxZoom(lightboxState.fitZoom);
      LIGHTBOX_BODY.scrollLeft = 0;
      LIGHTBOX_BODY.scrollTop = 0;
    }

    function openLightbox(src, altText, caption) {
      if (!src) {
        return;
      }

      lightboxReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      LIGHTBOX.hidden = false;
      LIGHTBOX_TITLE.textContent = caption || altText || src;
      LIGHTBOX_PATH.textContent = src;
      LIGHTBOX_STAGE.hidden = false;
      LIGHTBOX_FALLBACK.hidden = true;
      LIGHTBOX_IMAGE.hidden = false;
      LIGHTBOX_IMAGE.style.width = '';
      LIGHTBOX_IMAGE.style.height = '';
      lightboxState.zoom = 1;
      lightboxState.fitZoom = 1;
      lightboxState.naturalWidth = 0;
      lightboxState.naturalHeight = 0;
      updateLightboxControls();
      LIGHTBOX_IMAGE.src = src;
      LIGHTBOX_IMAGE.alt = altText || caption || 'Image preview';
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      if (LIGHTBOX.hidden) {
        return;
      }

      LIGHTBOX.hidden = true;
      LIGHTBOX_IMAGE.removeAttribute('src');
      LIGHTBOX_IMAGE.alt = '';
      LIGHTBOX_IMAGE.style.width = '';
      LIGHTBOX_IMAGE.style.height = '';
      LIGHTBOX_IMAGE.hidden = false;
      LIGHTBOX_STAGE.hidden = false;
      LIGHTBOX_STAGE.classList.remove('is-dragging', 'is-draggable');
      LIGHTBOX_BODY.classList.remove('is-zoomed');
      LIGHTBOX_FALLBACK.hidden = true;
      LIGHTBOX_TITLE.textContent = '';
      LIGHTBOX_PATH.textContent = '';
      lightboxDrag = null;
      lightboxState.zoom = 1;
      lightboxState.fitZoom = 1;
      lightboxState.naturalWidth = 0;
      lightboxState.naturalHeight = 0;
      document.body.style.overflow = '';

      if (lightboxReturnFocus && typeof lightboxReturnFocus.focus === 'function') {
        lightboxReturnFocus.focus({ preventScroll: true });
      }
      lightboxReturnFocus = null;
    }

    function bindEventHandlers() {
      document.querySelectorAll('[data-lightbox-src]').forEach((button) => {
        button.addEventListener('click', () => {
          openLightbox(button.dataset.lightboxSrc, button.dataset.lightboxAlt, button.dataset.lightboxCaption);
        });
      });

      document.querySelectorAll('[data-use-qid]').forEach((button) => {
        button.addEventListener('click', () => useCandidate(button.dataset.useQid, button.dataset.qid));
      });

      document.querySelectorAll('input[name^=\"mode-\"]').forEach((input) => {
        input.addEventListener('change', () => setDecisionMode(input.name.replace(/^mode-/, ''), input.value));
      });

      document.querySelectorAll('[data-approved-qid-for]').forEach((input) => {
        input.addEventListener('input', () => {
          const id = input.dataset.approvedQidFor;
          updateDecision(
            id,
            {
              approvedQid: input.value.trim() || null,
              createNewQuestion: false,
              keepUnresolved: false,
              deleteQuestion: false,
            },
            { rerender: false },
          );
          syncDecisionUi(id);
        });

        input.addEventListener('change', () => {
          const id = input.dataset.approvedQidFor;
          updateDecision(
            id,
            {
              approvedQid: input.value.trim() || null,
              createNewQuestion: false,
              keepUnresolved: false,
              deleteQuestion: false,
            },
            { preserveContext: false },
          );
        });
      });

      document.querySelectorAll('input[name^=\"answer-\"]').forEach((input) => {
        input.addEventListener('change', () => {
          const id = input.name.replace(/^answer-/, '');
          const decision = getDecision(id);
          if (input.value === 'unknown') {
            if (decision?.createNewQuestion === true) {
              return;
            }
            updateDecision(id, {
              confirmedCorrectOptionKey: null,
              newQuestionLocalAnswerKey: null,
              useCurrentStagedAnswerKey: false,
              answerKeyUnknown: true,
            });
          } else if (decision?.createNewQuestion === true) {
            updateDecision(id, {
              newQuestionLocalAnswerKey: input.value,
              useCurrentStagedAnswerKey: false,
              answerKeyUnknown: false,
            });
          } else {
            updateDecision(id, {
              confirmedCorrectOptionKey: input.value,
              useCurrentStagedAnswerKey: false,
              answerKeyUnknown: false,
            });
          }
        });
      });

      document.querySelectorAll('[data-use-current-answer-key]').forEach((button) => {
        button.addEventListener('click', () => {
          const id = button.dataset.useCurrentAnswerKey;
          const current = getCurrentStagedAnswerKey(id);
          if (!current) {
            return;
          }
          updateDecision(id, {
            confirmedCorrectOptionKey: current,
            useCurrentStagedAnswerKey: true,
            answerKeyUnknown: false,
          });
        });
      });

      document.querySelectorAll('[data-notes-for]').forEach((textarea) => {
        textarea.addEventListener('input', () => updateDecision(textarea.dataset.notesFor, { reviewerNotes: textarea.value }, { rerender: false }));
      });

      document.querySelectorAll('[data-source-explanation-for]').forEach((textarea) => {
        textarea.addEventListener('input', () => updateDecision(
          textarea.dataset.sourceExplanationFor,
          { sourceExplanation: textarea.value },
          { rerender: false },
        ));
      });

      document.querySelectorAll('[data-new-topic-for]').forEach((input) => {
        input.addEventListener('input', () => updateDecision(
          input.dataset.newTopicFor,
          { newQuestionProvisionalTopic: input.value.trim() || null },
          { rerender: false },
        ));
      });

      document.querySelectorAll('[data-new-subtopics-for]').forEach((textarea) => {
        textarea.addEventListener('input', () => updateDecision(textarea.dataset.newSubtopicsFor, {
          newQuestionProvisionalSubtopics: textarea.value
            .split(/[,\\n]/)
            .map((entry) => entry.trim())
            .filter(Boolean),
        }, { rerender: false }));
      });
    }

    LIGHTBOX_FIT.addEventListener('click', () => {
      fitLightboxImage();
    });

    LIGHTBOX_ZOOM_IN.addEventListener('click', () => {
      applyLightboxZoom(lightboxState.zoom * LIGHTBOX_ZOOM_STEP);
    });

    LIGHTBOX_ZOOM_OUT.addEventListener('click', () => {
      applyLightboxZoom(lightboxState.zoom / LIGHTBOX_ZOOM_STEP);
    });

    LIGHTBOX.addEventListener('click', (event) => {
      if (event.target.closest('[data-lightbox-close]')) {
        closeLightbox();
        return;
      }

      if (event.target === LIGHTBOX || event.target.classList.contains('lightbox-backdrop')) {
        closeLightbox();
      }
    });

    LIGHTBOX_STAGE.addEventListener('click', (event) => {
      if (event.target === LIGHTBOX_STAGE && !lightboxDrag?.moved) {
        closeLightbox();
      }
    });

    LIGHTBOX_IMAGE.addEventListener('load', () => {
      lightboxState.naturalWidth = LIGHTBOX_IMAGE.naturalWidth || 0;
      lightboxState.naturalHeight = LIGHTBOX_IMAGE.naturalHeight || 0;
      fitLightboxImage();
    });

    LIGHTBOX_IMAGE.addEventListener('error', () => {
      LIGHTBOX_IMAGE.hidden = true;
      LIGHTBOX_STAGE.hidden = true;
      LIGHTBOX_FALLBACK.hidden = false;
      updateLightboxControls();
    });

    LIGHTBOX_IMAGE.addEventListener('dblclick', (event) => {
      event.preventDefault();
      const anchor = buildLightboxAnchor(event.clientX, event.clientY);
      const targetZoom = lightboxState.zoom > (lightboxState.fitZoom * 1.4)
        ? lightboxState.fitZoom
        : Math.max(1, lightboxState.fitZoom * 2);
      applyLightboxZoom(targetZoom, { anchor });
    });

    LIGHTBOX_BODY.addEventListener('wheel', (event) => {
      if (LIGHTBOX.hidden || !(event.metaKey || event.ctrlKey)) {
        return;
      }

      event.preventDefault();
      const anchor = buildLightboxAnchor(event.clientX, event.clientY);
      const factor = event.deltaY < 0 ? LIGHTBOX_ZOOM_STEP : (1 / LIGHTBOX_ZOOM_STEP);
      applyLightboxZoom(lightboxState.zoom * factor, { anchor });
    }, { passive: false });

    LIGHTBOX_STAGE.addEventListener('pointerdown', (event) => {
      if (LIGHTBOX.hidden || event.button !== 0 || lightboxState.zoom <= lightboxState.fitZoom + 0.01) {
        return;
      }

      lightboxDrag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: LIGHTBOX_BODY.scrollLeft,
        startScrollTop: LIGHTBOX_BODY.scrollTop,
        moved: false,
      };
      LIGHTBOX_STAGE.classList.add('is-dragging');
      event.preventDefault();
    });

    LIGHTBOX_STAGE.addEventListener('pointermove', (event) => {
      if (!lightboxDrag || event.pointerId !== lightboxDrag.pointerId) {
        return;
      }

      const deltaX = event.clientX - lightboxDrag.startX;
      const deltaY = event.clientY - lightboxDrag.startY;
      if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
        lightboxDrag.moved = true;
      }
      LIGHTBOX_BODY.scrollLeft = lightboxDrag.startScrollLeft - deltaX;
      LIGHTBOX_BODY.scrollTop = lightboxDrag.startScrollTop - deltaY;
    });

    function clearLightboxDrag(event) {
      if (!lightboxDrag || (event && event.pointerId !== lightboxDrag.pointerId)) {
        return;
      }

      LIGHTBOX_STAGE.classList.remove('is-dragging');
      lightboxDrag = null;
    }

    LIGHTBOX_STAGE.addEventListener('pointerup', clearLightboxDrag);
    LIGHTBOX_STAGE.addEventListener('pointercancel', clearLightboxDrag);
    LIGHTBOX_STAGE.addEventListener('pointerleave', clearLightboxDrag);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !LIGHTBOX.hidden) {
        event.preventDefault();
        closeLightbox();
      }
    });

    window.addEventListener('resize', () => {
      if (LIGHTBOX.hidden || !lightboxState.naturalWidth) {
        return;
      }

      const wasFit = Math.abs(lightboxState.zoom - lightboxState.fitZoom) < 0.02;
      lightboxState.fitZoom = computeFitZoom();
      if (wasFit) {
        fitLightboxImage();
      } else {
        updateLightboxControls();
      }
    });

    function render(options = {}) {
      const context = options.preserveContext ? captureRenderContext() : null;
      VISIBLE_SECTIONS.forEach((sectionId) => {
        const target = document.querySelector('[data-section-list="' + sectionId + '"]');
        if (!target) {
          return;
        }
        renderSection(sectionId, ITEMS.filter((item) => item.section === sectionId));
      });

      bindEventHandlers();
      restoreRenderContext(context);
      syncExportBlockState();
    }

    document.getElementById('export-json').addEventListener('click', exportJson);
    document.getElementById('reset').addEventListener('click', () => {
      clearExportBlockState();
      state = clone(INITIAL_DECISIONS);
      saveState();
      render();
    });

    render();
  </script>
</body>
</html>`;
}

function renderSectionShell(sectionId, title, subtitle) {
  return `
    <section class="section">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(subtitle)}</p>
      <div class="list" data-section-list="${escapeHtml(sectionId)}"></div>
    </section>
  `;
}

function parseIncludedSections(value) {
  if (value == null) {
    return null;
  }

  const allowed = new Set(["auto-matched", "review-needed", "answer-key", "unresolved"]);
  const entries = String(value)
    .split(/[,\s]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (entries.length === 0) {
    return null;
  }

  const seen = new Set();
  const sections = [];

  for (const entry of entries) {
    if (!allowed.has(entry)) {
      throw new Error(`Unsupported include section: ${entry}`);
    }
    if (!seen.has(entry)) {
      sections.push(entry);
      seen.add(entry);
    }
  }

  return sections;
}

function shouldIncludeSection(sectionId, includedSections) {
  if (!includedSections) {
    return true;
  }

  return includedSections.includes(sectionId);
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

function buildMatchedPreviewEntry({ sourceItem, question, lang: sourceLang, batchId: sourceBatchId }) {
  const promptRawJa = sourceItem.promptRawJa ?? sourceItem.localizedText?.prompt ?? null;
  const promptGlossEn = sourceItem.promptGlossEn ?? sourceItem.translatedText?.prompt ?? null;
  const optionsRawJa = sourceOptionsRaw(sourceItem);
  const optionsGlossEn = sourceOptionsGloss(sourceItem);
  const explanation = normalizeText(sourceItem.localizedText?.explanation) ?? "";
  const previewEntry = {
    prompt: promptRawJa,
    explanation,
    sourceMode: "auto-matched-screenshot-batch",
    confidence: "auto-matched",
    reviewStatus: "staged-preview",
    sourceImage: sourceItem.sourceImage ?? null,
    sourceItemId: sourceItem.itemId ?? null,
    reviewerNotes: "",
    promptRawJa,
    promptGlossEn,
    correctKeyRaw: sourceItem.correctKeyRaw ?? null,
    correctAnswerRaw: sourceItem.correctAnswerRaw ?? null,
    canonicalQuestionType: question.type,
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

    return {
      previewEntry,
      localeCorrectOptionKey: correctAlignment.localeCorrectOptionKey,
      answerKeyNeedsManualConfirmation: correctAlignment.needsManualConfirmation,
    };
  }

  previewEntry.optionsRawJa = [];
  previewEntry.optionsGlossEn = [];
  previewEntry.localeCorrectOptionKey = null;
  previewEntry.answerKeyNeedsManualConfirmation = false;
  previewEntry.answerKeyConfirmationReason = "ROW question; no locale-specific option key applies.";

  return {
    previewEntry,
    localeCorrectOptionKey: null,
    answerKeyNeedsManualConfirmation: false,
  };
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

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeEditableText(value, options = {}) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.replace(/\r\n/g, "\n").trim();
  if (text) {
    return text;
  }

  return options.preserveEmpty === true ? "" : null;
}

function roundNumber(value) {
  if (!Number.isFinite(Number(value))) {
    return null;
  }

  return Math.round((Number(value) + Number.EPSILON) * 1000) / 1000;
}

function relativeFromReports(targetPath) {
  return path.relative(REPORTS_DIR, targetPath).split(path.sep).join("/");
}

function serializeJsonForInlineScript(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
