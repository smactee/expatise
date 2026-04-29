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
const notebookSuggestionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-notebooklm-suggestions.json`);
const combinedRecommendationsPath = path.join(STAGING_DIR, `${lang}-${batchId}-combined-recommendations.json`);
const notebookSuggestionsDoc = fileExists(notebookSuggestionsPath) ? readJson(notebookSuggestionsPath) : null;
const combinedRecommendationsDoc = fileExists(combinedRecommendationsPath) ? readJson(combinedRecommendationsPath) : null;
const enrichedSourceItems = enrichSourceItemsWithNotebookLm(sourceItems, {
  notebookSuggestionsDoc,
  combinedRecommendationsDoc,
});

const defaultDecisions = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourcePaths: {
    matched: path.relative(process.cwd(), matchedPath),
    reviewNeeded: path.relative(process.cwd(), reviewNeededPath),
    unresolved: path.relative(process.cwd(), unresolvedPath),
    notebookSuggestions: notebookSuggestionsDoc ? path.relative(process.cwd(), notebookSuggestionsPath) : null,
    combinedRecommendations: combinedRecommendationsDoc ? path.relative(process.cwd(), combinedRecommendationsPath) : null,
  },
  items: enrichedSourceItems.map(buildDefaultDecision),
};

const existingDecisions = fileExists(decisionsPath) ? readJson(decisionsPath) : null;
const mergedDecisions = mergeExistingDecisions(defaultDecisions, existingDecisions);
const displayPlan = buildWorkbenchDisplayPlan(enrichedSourceItems, mergedDecisions.items);

await writeJson(decisionsPath, mergedDecisions);
await writeText(htmlPath, buildHtml({
  lang,
  batchId,
  dataset,
  workbenchTitle,
  workbenchDescription,
  visibleSections: includedSections,
  counts: {
    autoMatched: displayPlan.counts.autoMatched,
    preserved: displayPlan.counts.preserved,
    reviewNeeded: displayPlan.counts.reviewNeeded,
    unresolved: displayPlan.counts.unresolved,
    answerKeyConfirmations:
      shouldIncludeSection("auto-matched", includedSections)
        ? normalizedAutoMatchedItems.filter((item) => item.answerKeyNeedsManualConfirmation === true).length
        : 0,
  },
  items: enrichedSourceItems,
  decisions: mergedDecisions.items,
  displaySectionById: displayPlan.sectionById,
  decisionsPath: path.relative(REPORTS_DIR, decisionsPath).split(path.sep).join("/"),
  decisionsFileName,
  storageKey,
  questionTypeByQid: Object.fromEntries(
    context.questions.map((question) => [question.qid, question.type ?? null]),
  ),
  questionExplanationByQid: Object.fromEntries(
    context.questions.map((question) => [question.qid, typeof question.explanation === "string" ? question.explanation : ""]),
  ),
  topicCatalog: buildTopicCatalog(context.questions),
  notebookArtifacts: {
    suggestionsPath: notebookSuggestionsDoc ? path.relative(REPORTS_DIR, notebookSuggestionsPath).split(path.sep).join("/") : null,
    combinedRecommendationsPath: combinedRecommendationsDoc ? path.relative(REPORTS_DIR, combinedRecommendationsPath).split(path.sep).join("/") : null,
  },
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

  if (
    !base.confirmedCorrectOptionKey &&
    item.section === "review-needed" &&
    normalizeChoiceKey(item.suggestedLocalAnswerKey) &&
    item.suggestedLocalAnswerKeyNeedsManualConfirmation !== true
  ) {
    base.confirmedCorrectOptionKey = normalizeChoiceKey(item.suggestedLocalAnswerKey);
  }

  return base;
}

function displayLabelFromSlug(slug) {
  return String(slug ?? "")
    .split(":")
    .pop()
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildTopicCatalog(questions) {
  const topics = new Set();
  const subtopics = new Set();

  for (const question of questions) {
    const tags = question?.tags ?? {};
    for (const topic of [tags.truthTopic, tags.weightedTopic].filter(Boolean)) {
      topics.add(topic);
    }

    for (const subtopic of [
      ...(Array.isArray(tags.truthSubtopics) ? tags.truthSubtopics : []),
      ...(Array.isArray(tags.weightedSubtopics) ? tags.weightedSubtopics : []),
    ].filter(Boolean)) {
      subtopics.add(subtopic);
      const [topic] = String(subtopic).split(":");
      if (topic) {
        topics.add(topic);
      }
    }
  }

  return {
    topics: [...topics].sort().map((slug) => ({
      slug,
      label: displayLabelFromSlug(slug),
    })),
    subtopics: [...subtopics].sort().map((slug) => ({
      slug,
      topic: String(slug).includes(":") ? String(slug).split(":")[0] : null,
      label: displayLabelFromSlug(slug),
    })),
  };
}

function enrichSourceItemsWithNotebookLm(items, { notebookSuggestionsDoc, combinedRecommendationsDoc }) {
  const suggestionsByItemId = new Map(
    (Array.isArray(notebookSuggestionsDoc?.items) ? notebookSuggestionsDoc.items : [])
      .filter((item) => item?.itemId)
      .map((item) => [String(item.itemId), item]),
  );
  const combinedByItemId = new Map(
    (Array.isArray(combinedRecommendationsDoc?.items) ? combinedRecommendationsDoc.items : [])
      .filter((item) => item?.itemId)
      .map((item) => [String(item.itemId), item]),
  );

  return items.map((item) => {
    const combined = combinedByItemId.get(String(item.itemId ?? "")) ?? null;
    return {
      ...item,
      notebookLmSuggestion: suggestionsByItemId.get(String(item.itemId ?? "")) ?? null,
      combinedRecommendation: combined?.combinedRecommendation ?? null,
      combinedRerankedCandidates: sanitizeWorkbenchDiagnostics(combined?.rerankedCandidates ?? null),
    };
  });
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
  const byItemId = buildUniqueExistingDecisionMap(existingDoc.items, "itemId");
  return {
    ...defaultDoc,
    generatedAt: stableNow(),
    items: defaultDoc.items.map((item) => {
      const previous =
        byId.get(item.id) ??
        (normalizeText(item.itemId) ? byItemId.get(normalizeText(item.itemId)) : null);
      if (!previous || typeof previous !== "object") {
        return item;
      }

      const deleteQuestion = previous.deleteQuestion === true;
      const createNewQuestion = deleteQuestion ? false : previous.createNewQuestion === true;
      const useCurrentStagedAnswerKey = createNewQuestion ? false : previous.useCurrentStagedAnswerKey === true;
      const explicitApprovedQid =
        deleteQuestion || createNewQuestion
          ? null
          : normalizeWorkbenchApprovedQidValue(previous.approvedQid);
      const keepUnresolved =
        deleteQuestion || createNewQuestion || explicitApprovedQid
          ? false
          : previous.keepUnresolved === true;

      return {
        ...item,
        approvedQid: keepUnresolved ? null : explicitApprovedQid ?? item.approvedQid,
        createNewQuestion,
        keepUnresolved,
        deleteQuestion,
        confirmedCorrectOptionKey:
          createNewQuestion
            ? null
            : useCurrentStagedAnswerKey
              ? null
              : normalizeChoiceKey(previous.confirmedCorrectOptionKey) ?? item.confirmedCorrectOptionKey,
        newQuestionLocalAnswerKey:
          createNewQuestion
            ? (
                normalizeChoiceKey(previous.newQuestionLocalAnswerKey) ??
                (
                  previous.createNewQuestion === true
                    ? normalizeChoiceKey(previous.confirmedCorrectOptionKey)
                    : null
                ) ??
                item.newQuestionLocalAnswerKey
              )
            : item.newQuestionLocalAnswerKey,
        answerKeyUnknown:
          createNewQuestion
            ? false
            : previous.answerKeyUnknown === true || previous.unknown === true,
        useCurrentStagedAnswerKey,
        reviewerNotes: normalizeText(previous.reviewerNotes) ?? "",
        sourceExplanation: normalizeEditableText(previous.sourceExplanation, { preserveEmpty: true }) ?? item.sourceExplanation,
        newQuestionProvisionalTopic: normalizeText(previous.newQuestionProvisionalTopic) ?? item.newQuestionProvisionalTopic,
        newQuestionProvisionalSubtopics: normalizeSubtopics(previous.newQuestionProvisionalSubtopics, item.newQuestionProvisionalSubtopics),
      };
    }),
  };
}

function buildUniqueExistingDecisionMap(items, key) {
  const map = new Map();
  const duplicates = new Set();

  for (const item of items) {
    const value = normalizeText(item?.[key]);
    if (!value) {
      continue;
    }

    if (map.has(value)) {
      duplicates.add(value);
      continue;
    }

    map.set(value, item);
  }

  for (const value of duplicates) {
    map.delete(value);
  }

  return map;
}

function buildWorkbenchDisplayPlan(items, decisions) {
  const decisionsById = new Map(
    (Array.isArray(decisions) ? decisions : []).map((item) => [String(item?.id ?? ""), item]),
  );
  const counts = {
    autoMatched: 0,
    preserved: 0,
    reviewNeeded: 0,
    unresolved: 0,
  };
  const sectionById = {};

  for (const item of items) {
    const displaySection = determineWorkbenchDisplaySection(item, decisionsById.get(item.id));
    sectionById[item.id] = displaySection;

    if (displaySection === "auto-matched") {
      counts.autoMatched += 1;
      continue;
    }

    if (displaySection === "preserved") {
      counts.preserved += 1;
      continue;
    }

    if (displaySection === "review-needed") {
      counts.reviewNeeded += 1;
      continue;
    }

    if (displaySection === "unresolved") {
      counts.unresolved += 1;
    }
  }

  return { counts, sectionById };
}

function determineWorkbenchDisplaySection(item, decision) {
  if (!item || item.section === "auto-matched" || item.section === "answer-key") {
    return item?.section ?? "review-needed";
  }

  const approvedQid = normalizeWorkbenchApprovedQidValue(decision?.approvedQid);
  const createNewQuestion = decision?.createNewQuestion === true;
  const deleteQuestion = decision?.deleteQuestion === true;
  const keepUnresolved = decision?.keepUnresolved === true;

  if ((item.section === "review-needed" || item.section === "unresolved") && (approvedQid || createNewQuestion || deleteQuestion)) {
    return "preserved";
  }

  if ((item.section === "review-needed" || item.section === "unresolved") && keepUnresolved) {
    return "unresolved";
  }

  return item.section;
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
    suggestedLocalAnswerKey: initialSuggestedPreview?.localeCorrectOptionKey ?? null,
    suggestedLocalAnswerKeyNeedsManualConfirmation: initialSuggestedPreview?.previewEntry?.answerKeyNeedsManualConfirmation === true,
    suggestedLocalAnswerKeyReason: initialSuggestedPreview?.previewEntry?.answerKeyConfirmationReason ?? null,
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
    analysis: sanitizeWorkbenchDiagnostics(item.analysis),
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
    suggestedLocalAnswerKey: staged?.localeCorrectOptionKey ?? null,
    suggestedLocalAnswerKeyNeedsManualConfirmation: staged?.previewEntry?.answerKeyNeedsManualConfirmation === true,
    suggestedLocalAnswerKeyReason: staged?.previewEntry?.answerKeyConfirmationReason ?? null,
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
    analysis: sanitizeWorkbenchDiagnostics(item.analysis),
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
    suggestedLocalAnswerKey: initialSuggestedPreview?.localeCorrectOptionKey ?? null,
    suggestedLocalAnswerKeyNeedsManualConfirmation: initialSuggestedPreview?.previewEntry?.answerKeyNeedsManualConfirmation === true,
    suggestedLocalAnswerKeyReason: initialSuggestedPreview?.previewEntry?.answerKeyConfirmationReason ?? null,
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
    analysis: sanitizeWorkbenchDiagnostics(item.analysis),
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

function resolveQuestionImageSrc(question) {
  const currentAssetSrc = normalizeText(question?.image?.currentAssetSrc);
  if (currentAssetSrc) {
    return currentAssetSrc;
  }

  const imageAsset = Array.isArray(question?.image?.assets)
    ? question.image.assets.find((asset) => normalizeText(asset?.src))
    : null;
  if (imageAsset) {
    return normalizeText(imageAsset.src);
  }

  const rawAsset = Array.isArray(question?.assets)
    ? question.assets.find((asset) => asset?.kind === "image" && normalizeText(asset?.src))
    : null;
  return normalizeText(rawAsset?.src);
}

function resolveWorkbenchImagePathFromAssetSrc(src) {
  const assetSrc = normalizeText(src);
  if (!assetSrc) {
    return null;
  }

  if (/^(?:data:|https?:|file:)/i.test(assetSrc)) {
    return assetSrc;
  }

  const publicRelativePath = assetSrc.replace(/^\/+/, "").replace(/^public\//, "");
  return relativeFromReports(path.join(process.cwd(), "public", publicRelativePath));
}

function normalizeCandidate(candidate, topScore, questionMap) {
  const canonicalQuestion = candidate?.qid ? questionMap.get(candidate.qid) ?? null : null;
  const resolvedType = canonicalQuestion?.type ?? candidate?.type ?? null;
  const scoreBreakdown = candidate?.scoreBreakdown && typeof candidate.scoreBreakdown === "object"
    ? {
      answerScore:
        candidate.scoreBreakdown.answerScore ??
        candidate.scoreBreakdown.answerGlossScore ??
        candidate.scoreBreakdown.correctAnswerMeaning ??
        null,
      optionSetScore:
        candidate.scoreBreakdown.optionSetScore ??
        candidate.scoreBreakdown.optionSimilarity ??
        null,
      optionKeywordScore:
        candidate.scoreBreakdown.optionKeywordScore ??
        candidate.scoreBreakdown.optionRowKeywordScore ??
        null,
      promptScore:
        candidate.scoreBreakdown.promptScore ??
        candidate.scoreBreakdown.promptSimilarity ??
        null,
      numberScore: candidate.scoreBreakdown.numberScore ?? null,
      numericGroupScore: candidate.scoreBreakdown.numericGroupScore ?? null,
      numericGroupPenalty: candidate.scoreBreakdown.numericGroupPenalty ?? null,
      contradictionPenalty: candidate.scoreBreakdown.contradictionPenalty ?? null,
      priorBonus: candidate.scoreBreakdown.priorBonus ?? null,
    }
    : null;
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
    scoreBreakdown,
    hasImage:
      canonicalQuestion?.image?.hasImage === true ||
      Boolean(resolveQuestionImageSrc(canonicalQuestion)) ||
      candidate?.image?.hasImage === true ||
      Boolean(resolveQuestionImageSrc(candidate)),
    imagePath: resolveWorkbenchImagePathFromAssetSrc(
      resolveQuestionImageSrc(canonicalQuestion) ?? resolveQuestionImageSrc(candidate),
    ),
  };
}

function sanitizeWorkbenchDiagnostics(value) {
  const hiddenKeys = new Set([
    "sourceNumericGroups",
    "candidateNumericGroups",
    "numericGroupReasonCodes",
    "numericGroupMatches",
  ]);
  const hiddenStringValues = new Set([
    "numeric-group-match",
    "numeric-range-missing-value",
  ]);

  if (Array.isArray(value)) {
    return value
      .filter((entry) => !hiddenStringValues.has(String(entry)))
      .map((entry) => sanitizeWorkbenchDiagnostics(entry));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const sanitized = {};
  for (const [key, entry] of Object.entries(value)) {
    if (hiddenKeys.has(key)) {
      continue;
    }
    sanitized[key] = sanitizeWorkbenchDiagnostics(entry);
  }
  return sanitized;
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
  displaySectionById,
  decisionsPath,
  decisionsFileName,
  storageKey,
  questionTypeByQid,
  questionExplanationByQid,
  topicCatalog,
  notebookArtifacts,
}) {
  const displaySectionMap = new Map(Object.entries(displaySectionById ?? {}));
  const itemsInDisplaySection = (sectionId) =>
    items.filter((item) => (displaySectionMap.get(item.id) ?? item.section) === sectionId);
  const autoMatched = itemsInDisplaySection("auto-matched");
  const preserved = itemsInDisplaySection("preserved");
  const reviewNeeded = itemsInDisplaySection("review-needed");
  const unresolved = itemsInDisplaySection("unresolved");
  const answerKey = itemsInDisplaySection("answer-key");
  const requestedSectionSet = new Set(visibleSections ?? ["auto-matched", "review-needed", "answer-key", "unresolved"]);
  const visibleDisplaySections = [];

  if (requestedSectionSet.has("auto-matched")) {
    visibleDisplaySections.push("auto-matched");
  }
  if (preserved.length > 0) {
    visibleDisplaySections.push("preserved");
  }
  if (requestedSectionSet.has("review-needed")) {
    visibleDisplaySections.push("review-needed");
  }
  if (requestedSectionSet.has("answer-key") && answerKey.length > 0) {
    visibleDisplaySections.push("answer-key");
  }
  if (requestedSectionSet.has("unresolved")) {
    visibleDisplaySections.push("unresolved");
  }

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
      width: min(1680px, calc(100vw - 28px));
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
      grid-template-columns: minmax(300px, 360px) minmax(420px, 1fr) minmax(280px, 320px);
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
    .source-asset-column, .source-block, .decision-block {
      min-width: 0;
    }
    .source-asset-column {
      display: grid;
      gap: 10px;
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
    .option-row-badges {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 5px;
      justify-content: flex-end;
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
    .notebook-panel {
      border: 1px solid rgba(79, 59, 150, 0.22);
      border-radius: 14px;
      background: var(--note-soft);
      padding: 12px;
      display: grid;
      gap: 10px;
    }
    .notebook-panel.conflict {
      border-color: rgba(140, 79, 22, 0.35);
      background: var(--warn-soft);
    }
    .notebook-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .notebook-warning {
      border: 1px solid rgba(140, 79, 22, 0.24);
      border-radius: 10px;
      background: rgba(255, 255, 255, 0.45);
      padding: 8px 10px;
      color: var(--warn);
      font-size: 13px;
    }
    .recommendation-review {
      display: grid;
      gap: 8px;
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
    .candidate.compact {
      padding: 10px;
      background: #fffaf2;
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
    .candidate.compact .prompt {
      font-size: 13px;
      max-height: 94px;
    }
    .recommendation-review .candidate.compact .prompt {
      max-height: none;
    }
    .candidate.compact .filename,
    .candidate.compact .options {
      display: none;
    }
    .recommendation-review .candidate.compact .options {
      display: grid;
      gap: 6px;
      margin-top: 8px;
      margin-left: 6px;
    }
    .recommendation-review .candidate.compact .option {
      padding: 7px 9px;
    }
    .recommendation-review .candidate.compact .option-row {
      align-items: flex-start;
    }
    .recommendation-review .candidate.compact .option.option-source-match {
      background: #eef7f4;
      border-color: rgba(22, 93, 82, 0.22);
    }
    .recommendation-review .candidate.compact .option.option-source-correct-match {
      border-color: rgba(22, 93, 82, 0.42);
      box-shadow: inset 3px 0 0 rgba(22, 93, 82, 0.35);
    }
    .option-match-badge {
      display: inline-flex;
      align-items: center;
      white-space: nowrap;
      margin-left: 6px;
      padding: 2px 7px;
      border: 1px solid rgba(79, 59, 150, 0.18);
      border-radius: 999px;
      background: var(--note-soft);
      color: var(--note);
      font-size: 11px;
      line-height: 1.2;
    }
    .option-match-badge.strong {
      border-color: rgba(22, 93, 82, 0.28);
      background: var(--correct-bg);
      color: var(--accent);
      font-weight: 700;
    }
    .option-alignment-warning {
      margin-top: 8px;
      padding: 7px 9px;
      border: 1px solid rgba(140, 79, 22, 0.28);
      border-radius: 10px;
      background: var(--warn-soft);
      color: var(--warn);
      font-size: 12px;
      line-height: 1.35;
    }
    .candidate-media {
      margin: 0 0 10px;
    }
    .candidate-image-unavailable {
      margin-bottom: 10px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.4;
    }
    .candidate-image-frame {
      width: 100%;
      max-width: 100%;
      min-height: 0;
      max-height: 190px;
      margin: 0;
      border-radius: 12px;
      background: #fffdf8;
    }
    .candidate-image-frame img {
      width: 100%;
      max-height: 190px;
      object-fit: contain;
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
    @media (max-width: 1180px) {
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
        <div class="stat"><span class="label">Preserved</span><strong>${counts.preserved}</strong></div>
        <div class="stat"><span class="label">Review-Needed</span><strong>${counts.reviewNeeded}</strong></div>
        <div class="stat"><span class="label">Unresolved</span><strong>${counts.unresolved}</strong></div>
        <div class="stat"><span class="label">Answer-Key Checks</span><strong>${counts.answerKeyConfirmations}</strong></div>
      </div>
      <div class="toolbar">
        <button id="reset" class="secondary">Reset Local Edits</button>
      </div>
    </section>

    ${visibleDisplaySections.includes("auto-matched") ? renderSectionShell("auto-matched", "Auto-Matched (Quick Review)", `${autoMatched.length} item(s) auto-matched by the pipeline and surfaced for quick human confirmation.`) : ""}
    ${visibleDisplaySections.includes("preserved") ? renderSectionShell("preserved", "Preserved Decisions", `${preserved.length} item(s) already carry a prior human decision and were pulled out of the pending review queues.`) : ""}
    ${visibleDisplaySections.includes("review-needed") ? renderSectionShell("review-needed", "Review-Needed", `${reviewNeeded.length} item(s) that still need an approve/new/unresolved decision.`) : ""}
    ${visibleDisplaySections.includes("answer-key") ? renderSectionShell("answer-key", "Answer-Key Confirmations", `${answerKey.length} auto-matched MCQ item(s) whose staged locale key still needs explicit confirmation.`) : ""}
    ${visibleDisplaySections.includes("unresolved") ? renderSectionShell("unresolved", "Unresolved", `${unresolved.length} item(s) that may need rescue, new-question staging, or to remain unresolved.`) : ""}
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
    const DISPLAY_SECTION_BY_ID = ${serializeJsonForInlineScript(displaySectionById)};
    const VISIBLE_SECTIONS = ${serializeJsonForInlineScript(visibleDisplaySections)};
    const DISPLAY_ITEMS = VISIBLE_SECTIONS.flatMap((sectionId) =>
      ITEMS.filter((item) => (DISPLAY_SECTION_BY_ID[item.id] || item.section) === sectionId),
    );
    const DISPLAY_INDEX_BY_ID = new Map(DISPLAY_ITEMS.map((item, index) => [item.id, index + 1]));
    const QUESTION_TYPE_BY_QID = ${serializeJsonForInlineScript(questionTypeByQid)};
    const QUESTION_EXPLANATION_BY_QID = ${serializeJsonForInlineScript(questionExplanationByQid)};
    const TOPIC_CATALOG = ${serializeJsonForInlineScript(topicCatalog)};
    const NOTEBOOK_ARTIFACTS = ${serializeJsonForInlineScript(notebookArtifacts)};
    const STORAGE_KEY = ${JSON.stringify(storageKey)};
    const EXPORT_FILE_NAME = ${JSON.stringify(decisionsFileName)};
    const ACTIVE_REVIEW_LOCALE = ${JSON.stringify(lang)};
    const ROW_DISPLAY_LABELS = {
      en: { R: 'Right', W: 'Wrong' },
      ko: { R: 'Y', W: 'N' },
      ja: { R: 'Yes', W: 'No' },
    };
    const TOPIC_SLUGS = new Set((TOPIC_CATALOG.topics || []).map((entry) => entry.slug));
    const SUBTOPIC_SLUGS = new Set((TOPIC_CATALOG.subtopics || []).map((entry) => entry.slug));
    const TOPIC_ALIAS_TO_SLUG = new Map();
    const SUBTOPIC_ALIAS_TO_ENTRIES = new Map();
    const SUBTOPICS_BY_TOPIC = new Map();
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

    function normalizeDecisionQid(value) {
      const text = String(value ?? '').trim();
      if (!text) {
        return null;
      }

      const match = text.match(/^q?(\\d+)$/i);
      if (!match) {
        return null;
      }

      const number = Number.parseInt(match[1], 10);
      if (!Number.isSafeInteger(number) || number <= 0 || number > 9999) {
        return null;
      }

      return 'q' + String(number).padStart(4, '0');
    }

    function normalizeStoredApprovedQid(value) {
      const text = String(value ?? '').trim();
      if (!text) {
        return null;
      }

      return normalizeDecisionQid(text) || text;
    }

    function normalizeTopicLabelKey(value) {
      return String(value ?? '')
        .replace(/[-_:]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }

    function slugFromDisplayLabel(value) {
      return normalizeTopicLabelKey(value).replace(/\s+/g, '-');
    }

    function addTopicAlias(alias, slug) {
      const key = normalizeTopicLabelKey(alias);
      if (key && slug && !TOPIC_ALIAS_TO_SLUG.has(key)) {
        TOPIC_ALIAS_TO_SLUG.set(key, slug);
      }
    }

    function addSubtopicAlias(alias, entry) {
      const key = normalizeTopicLabelKey(alias);
      if (!key || !entry?.slug) {
        return;
      }

      const entries = SUBTOPIC_ALIAS_TO_ENTRIES.get(key) || [];
      if (!entries.some((candidate) => candidate.slug === entry.slug)) {
        entries.push(entry);
      }
      SUBTOPIC_ALIAS_TO_ENTRIES.set(key, entries);
    }

    for (const entry of TOPIC_CATALOG.topics || []) {
      addTopicAlias(entry.slug, entry.slug);
      addTopicAlias(entry.label, entry.slug);
      addTopicAlias(slugFromDisplayLabel(entry.label), entry.slug);
    }

    for (const entry of TOPIC_CATALOG.subtopics || []) {
      addSubtopicAlias(entry.slug, entry);
      addSubtopicAlias(entry.label, entry);
      addSubtopicAlias(slugFromDisplayLabel(entry.label), entry);
      if (entry.topic) {
        const list = SUBTOPICS_BY_TOPIC.get(entry.topic) || [];
        list.push(entry);
        SUBTOPICS_BY_TOPIC.set(entry.topic, list);
      }
    }

    function normalizeTopicInputValue(value) {
      const text = String(value ?? '').replace(/\s+/g, ' ').trim();
      if (!text) {
        return null;
      }

      if (TOPIC_SLUGS.has(text)) {
        return text;
      }

      const key = normalizeTopicLabelKey(text);
      return TOPIC_ALIAS_TO_SLUG.get(key) || (TOPIC_SLUGS.has(slugFromDisplayLabel(text)) ? slugFromDisplayLabel(text) : text);
    }

    function normalizeSubtopicInputValue(value, topicValue) {
      const text = String(value ?? '').replace(/\s+/g, ' ').trim();
      if (!text) {
        return null;
      }

      if (SUBTOPIC_SLUGS.has(text)) {
        return text;
      }

      const topicSlug = normalizeTopicInputValue(topicValue);
      const key = normalizeTopicLabelKey(text);
      const topicScoped = topicSlug ? (SUBTOPICS_BY_TOPIC.get(topicSlug) || []) : [];
      const scopedMatch = topicScoped.find((entry) =>
        normalizeTopicLabelKey(entry.slug) === key ||
        normalizeTopicLabelKey(entry.label) === key ||
        slugFromDisplayLabel(entry.label) === slugFromDisplayLabel(text)
      );
      if (scopedMatch) {
        return scopedMatch.slug;
      }

      const matches = SUBTOPIC_ALIAS_TO_ENTRIES.get(key) || SUBTOPIC_ALIAS_TO_ENTRIES.get(slugFromDisplayLabel(text)) || [];
      if (matches.length === 1) {
        return matches[0].slug;
      }

      return text;
    }

    function normalizeSubtopicInputList(value, topicValue) {
      const rawValues = Array.isArray(value)
        ? value
        : String(value ?? '').split(/[,\\n]/);
      return rawValues
        .map((entry) => normalizeSubtopicInputValue(entry, topicValue))
        .filter(Boolean);
    }

    function normalizeTopicDecisionFields(decision) {
      const topic = normalizeTopicInputValue(decision?.newQuestionProvisionalTopic);
      return {
        newQuestionProvisionalTopic: topic,
        newQuestionProvisionalSubtopics: normalizeSubtopicInputList(decision?.newQuestionProvisionalSubtopics, topic),
      };
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
      decision.approvedQid = deleteQuestion ? null : normalizeStoredApprovedQid(decision.approvedQid);
      decision.createNewQuestion = deleteQuestion ? false : decision.createNewQuestion === true;
      decision.keepUnresolved = deleteQuestion ? false : decision.keepUnresolved === true;
      decision.confirmedCorrectOptionKey = normalizeDecisionChoiceKey(decision.confirmedCorrectOptionKey);
      decision.newQuestionLocalAnswerKey = fallbackNewQuestionLocalAnswerKey || null;
      decision.currentStagedLocaleCorrectOptionKey = normalizeDecisionChoiceKey(decision.currentStagedLocaleCorrectOptionKey);
      decision.answerKeyUnknown = decision.answerKeyUnknown === true || decision.unknown === true;
      decision.useCurrentStagedAnswerKey = decision.useCurrentStagedAnswerKey === true;
      Object.assign(decision, normalizeTopicDecisionFields(decision));

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

      const rawApprovedQid = String(decision.approvedQid ?? '').trim();
      const approvedQid = normalizeDecisionQid(rawApprovedQid);
      if (rawApprovedQid && !approvedQid) {
        return {
          reason: 'Approved qid must be a positive number like 92 or a canonical qid like q0092.',
          focusTarget: 'decision',
        };
      }

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
        items: state.map((item) => {
          const normalizedTopicFields = normalizeTopicDecisionFields(item);
          return {
            ...item,
            ...normalizedTopicFields,
            approvedQid: item.deleteQuestion === true ? null : normalizeDecisionQid(item.approvedQid),
          };
        }),
      };
      download(EXPORT_FILE_NAME, JSON.stringify(payload, null, 2) + "\\n", "application/json");
    }

    function getDecision(id) {
      return state.find((item) => item.id === id);
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
      state = state.map((item) => item.id === id ? normalizeLoadedDecision({ ...item, ...patch }) : item);
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

    function useCombinedRecommendation(id) {
      const item = ITEMS_BY_ID.get(id);
      const combined = item?.combinedRecommendation || null;
      if (!combined?.recommendedQid) {
        return;
      }
      const patch = {
        approvedQid: combined.recommendedQid,
        createNewQuestion: false,
        keepUnresolved: false,
        deleteQuestion: false,
      };
      const answerKey = normalizeDecisionChoiceKey(combined.recommendedAnswerKey);
      if (answerKey) {
        patch.confirmedCorrectOptionKey = answerKey;
        patch.answerKeyUnknown = false;
        patch.useCurrentStagedAnswerKey = false;
      }
      updateDecision(id, patch);
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
      const approvedQid = normalizeDecisionQid(decision?.approvedQid);
      return Boolean(
        item &&
        getResolvedQuestionType(item, decision) === 'MCQ' &&
        item.initialSuggestedQid &&
        approvedQid &&
        approvedQid !== item.initialSuggestedQid
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

    function renderNormalizedRowChoices({ highlightRow = null, rawByRow = null, sourceSide = false, optionAnnotations = null }) {
      return '<ol class="options">' +
        ['R', 'W'].map((rowValue) => {
          const rawEntry = rawByRow?.get?.(rowValue) || null;
          const annotation = optionAnnotations?.get?.(rowValue) || null;
          const isCorrect = highlightRow === rowValue;
          const optionClass = [
            'option',
            isCorrect ? 'option-current' : '',
            annotation ? 'option-source-match' : '',
            annotation && isCorrect ? 'option-source-correct-match' : '',
          ].filter(Boolean).join(' ');
          return '<li class="' + optionClass + '">' +
            '<div class="option-row"><div><span class="option-key">' + escapeHtml(getRowDisplayLabel(rowValue)) + '</span></div>' +
              '<div class="option-row-badges">' +
                renderOptionMatchBadge(annotation, isCorrect) +
                (isCorrect ? '<span class="option-correct-badge">Correct</span>' : '') +
              '</div>' +
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

    function renderCandidateImage(candidate) {
      if (candidate.imagePath) {
        return '<div class="candidate-media">' + renderInlineImage(candidate.imagePath, candidate.qid || 'candidate image', 'image-frame candidate-image-frame', {
          caption: [candidate.qid || null, candidate.prompt || null].filter(Boolean).join(' · ') || 'Candidate image',
        }) + '</div>';
      }

      if (candidate.hasImage) {
        return '<div class="candidate-image-unavailable">Image unavailable</div>';
      }

      return '';
    }

    const OPTION_FILLER_WORDS = new Set([
      'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'from', 'in', 'on',
      'at', 'by', 'with', 'as', 'is', 'are', 'be', 'being', 'been', 'can',
      'could', 'may', 'must', 'shall', 'should', 'will', 'would', 'you',
      'your', 'it', 'its', 'this', 'that', 'these', 'those',
    ]);

    function normalizeOptionText(text) {
      return String(text ?? '')
        .replace(/^\\s*[A-D][\\s.:：、．\\)\\]-]+/i, ' ')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .split(/\\s+/)
        .filter((token) => token && !OPTION_FILLER_WORDS.has(token))
        .join(' ')
        .trim();
    }

    function scoreOptionSimilarity(a, b) {
      const normalizedA = normalizeOptionText(a);
      const normalizedB = normalizeOptionText(b);
      if (!normalizedA || !normalizedB) {
        return 0;
      }
      if (normalizedA === normalizedB) {
        return 1;
      }

      const tokensA = normalizedA.split(' ').filter(Boolean);
      const tokensB = normalizedB.split(' ').filter(Boolean);
      const setA = new Set(tokensA);
      const setB = new Set(tokensB);
      let intersection = 0;
      setA.forEach((token) => {
        if (setB.has(token)) {
          intersection += 1;
        }
      });

      const dice = (2 * intersection) / Math.max(1, setA.size + setB.size);
      const containment = intersection / Math.max(1, Math.min(setA.size, setB.size));
      const containmentScore = containment >= 0.8 && intersection >= 2 ? containment * 0.94 : 0;
      const substringScore =
        (normalizedA.includes(normalizedB) || normalizedB.includes(normalizedA)) &&
        Math.min(normalizedA.length, normalizedB.length) >= 8
          ? 0.9
          : 0;
      return Math.max(dice, containmentScore, substringScore);
    }

    function buildSourceOptionEntries(item, candidateType) {
      if (candidateType === 'ROW') {
        const rawByRow = getRowSourceOptionMap(item);
        return [
          { key: 'A', rowValue: 'R', text: rawByRow.get('R')?.gloss || rawByRow.get('R')?.raw || 'Right true' },
          { key: 'B', rowValue: 'W', text: rawByRow.get('W')?.gloss || rawByRow.get('W')?.raw || 'Wrong false' },
        ];
      }

      const rawOptions = Array.isArray(item?.optionsRawJa) ? item.optionsRawJa : [];
      const glossOptions = Array.isArray(item?.optionsGlossEn) ? item.optionsGlossEn : [];
      const length = Math.max(rawOptions.length, glossOptions.length);
      const entries = [];

      for (let index = 0; index < length; index += 1) {
        const rawChoice = parseVisibleChoice(rawOptions[index]);
        const glossChoice = parseVisibleChoice(glossOptions[index]);
        const key = normalizeDecisionChoiceKey(rawChoice.key) ||
          normalizeDecisionChoiceKey(glossChoice.key) ||
          normalizeDecisionChoiceKey(fallbackVisibleChoiceKey(index));
        const text = glossChoice.body || rawChoice.body || glossOptions[index] || rawOptions[index] || '';
        if (key && text) {
          entries.push({ key, text });
        }
      }

      return entries;
    }

    function buildCandidateOptionEntries(candidate, rowValue) {
      if (rowValue) {
        return [
          { key: 'R', rowValue: 'R', text: 'Right true' },
          { key: 'W', rowValue: 'W', text: 'Wrong false' },
        ];
      }

      return (candidate.options || []).map((option, index) => {
        const key = normalizeDecisionChoiceKey(option.id) ||
          normalizeDecisionChoiceKey(fallbackVisibleChoiceKey(index));
        return key && option.text ? { key, text: option.text } : null;
      }).filter(Boolean);
    }

    function findBestOptionMatches(sourceOptions, candidateOptions) {
      const scored = [];
      sourceOptions.forEach((sourceOption) => {
        candidateOptions.forEach((candidateOption) => {
          const score = sourceOption.rowValue && candidateOption.rowValue
            ? (sourceOption.rowValue === candidateOption.rowValue ? 1 : 0)
            : scoreOptionSimilarity(sourceOption.text, candidateOption.text);
          if (score >= 0.66) {
            scored.push({ sourceOption, candidateOption, score });
          }
        });
      });

      scored.sort((a, b) => b.score - a.score);
      const usedSourceKeys = new Set();
      const usedCandidateKeys = new Set();
      const matches = new Map();

      for (const entry of scored) {
        if (usedSourceKeys.has(entry.sourceOption.key) || usedCandidateKeys.has(entry.candidateOption.key)) {
          continue;
        }
        usedSourceKeys.add(entry.sourceOption.key);
        usedCandidateKeys.add(entry.candidateOption.key);
        matches.set(entry.candidateOption.key, {
          sourceKey: entry.sourceOption.key,
          score: entry.score,
        });
      }

      return matches;
    }

    function rowValueToSourceChoiceKey(rowValue) {
      if (rowValue === 'R') {
        return 'A';
      }
      if (rowValue === 'W') {
        return 'B';
      }
      return null;
    }

    function renderOptionMatchBadge(annotation, isCorrect) {
      if (!annotation?.sourceKey) {
        return '';
      }
      return '<span class="option-match-badge' + (isCorrect ? ' strong' : '') + '">matches source ' + escapeHtml(annotation.sourceKey) + '</span>';
    }

    function buildOptionAlignmentInfo({ item, candidate, decision, rowValue, correctOptionKey }) {
      if (!item || !candidate) {
        return { annotationsByCandidateKey: new Map(), warningHtml: '' };
      }

      const sourceOptions = buildSourceOptionEntries(item, candidate.type || null);
      const candidateOptions = buildCandidateOptionEntries(candidate, rowValue);
      const annotationsByCandidateKey = findBestOptionMatches(sourceOptions, candidateOptions);
      const sourceSelectedKey =
        getSelectedAnswerKey(item, decision) ||
        normalizeDecisionChoiceKey(item.currentStagedLocaleCorrectOptionKey) ||
        normalizeDecisionChoiceKey(item.suggestedLocalAnswerKey);
      const candidateCorrectKey = rowValue
        ? rowValueToSourceChoiceKey(rowValue)
        : normalizeDecisionChoiceKey(correctOptionKey);
      const warningHtml = sourceSelectedKey && candidateCorrectKey && sourceSelectedKey !== candidateCorrectKey
        ? '<div class="option-alignment-warning">Answer-key mismatch: source ' + escapeHtml(sourceSelectedKey) + ' vs candidate ' + escapeHtml(candidateCorrectKey) + '</div>'
        : '';

      return { annotationsByCandidateKey, warningHtml };
    }

    function renderCandidate(candidate, itemId, renderOptions = {}) {
      const compact = renderOptions.compact === true;
      const candidateType = candidate.type || null;
      const isRowCandidate = candidateType === 'ROW';
      const rowValue = isRowCandidate
        ? normalizeRowValue(candidate.correctRow || candidate.correctAnswerText || candidate.correctOptionKey)
        : null;
      const correctOptionKey = String(candidate.correctOptionKey ?? '').trim().toUpperCase() || null;
      const optionAlignment = renderOptions.showOptionAlignment
        ? buildOptionAlignmentInfo({
            item: renderOptions.sourceItem || ITEMS_BY_ID.get(itemId),
            candidate,
            decision: renderOptions.decision || getDecision(itemId),
            rowValue,
            correctOptionKey,
          })
        : { annotationsByCandidateKey: new Map(), warningHtml: '' };
      const candidateOptions = rowValue
        ? renderNormalizedRowChoices({
            highlightRow: rowValue,
            optionAnnotations: optionAlignment.annotationsByCandidateKey,
          })
        : (candidate.options || []).map((option) => {
          const optionKey = String(option.id ?? '').trim().toUpperCase() || null;
          const isCorrect = Boolean(correctOptionKey && optionKey && optionKey === correctOptionKey);
          const annotation = optionAlignment.annotationsByCandidateKey.get(optionKey);
          const optionClass = [
            'option',
            isCorrect ? 'option-current' : '',
            annotation ? 'option-source-match' : '',
            annotation && isCorrect ? 'option-source-correct-match' : '',
          ].filter(Boolean).join(' ');
          return '<li class="' + optionClass + '">' +
            '<div class="option-row"><div><span class="option-key">' + escapeHtml(option.id || '?') + '</span>' + escapeHtml(option.text || '') + '</div>' +
              '<div class="option-row-badges">' +
                renderOptionMatchBadge(annotation, isCorrect) +
                (isCorrect ? '<span class="option-correct-badge">Correct</span>' : '') +
              '</div>' +
            '</div>' +
          '</li>';
        }).join('');
      return '<article class="candidate' + (compact ? ' compact' : '') + '">' +
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
        renderCandidateImage(candidate) +
        '<div class="prompt">' + escapeHtml(candidate.prompt || '') + '</div>' +
        (candidateOptions ? (rowValue ? candidateOptions : '<ol class="options">' + candidateOptions + '</ol>') : '') +
        optionAlignment.warningHtml +
        '</article>';
    }

    function renderRecommendationReview(item, decision) {
      if (!item.combinedRecommendation) {
        return '';
      }
      const topCandidate = Array.isArray(item.topCandidates) ? item.topCandidates[0] : null;
      const panel = renderNotebookLmPanel(item);
      if (!topCandidate || !panel) {
        return '';
      }
      return '<div class="recommendation-review"><span class="label">Recommendation Review</span>' +
        '<div>' +
          '<span class="label">Top Matcher Candidate</span>' +
          renderCandidate(topCandidate, item.id, {
            compact: true,
            sourceItem: item,
            decision,
            showOptionAlignment: true,
          }) +
        '</div>' +
      '</div>';
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
        '<div class="decision-row"><span class="label">Approved Qid</span><input type="text" value="' + escapeHtml(decision.approvedQid || '') + '" data-approved-qid-for="' + escapeHtml(item.id) + '" placeholder="92 or q0092"></div>' +
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

    function renderNotebookLmPanel(item) {
      const combined = item.combinedRecommendation || null;
      const suggestion = item.notebookLmSuggestion || null;
      if (!combined && !suggestion) {
        return '';
      }

      const warnings = [];
      if (combined?.confidence === 'conflict') warnings.push(combined.reason || 'NotebookLM conflicts with matcher evidence.');
      if (combined?.answerKeyConflict) warnings.push('Answer key conflict: NotebookLM and local/candidate answer key differ.');
      if (combined?.notebookQidNotInMatcherCandidates) warnings.push('NotebookLM qid is not in the matcher candidate list.');
      if (suggestion && (suggestion.isCloseMatch !== true || Number(suggestion.confidence || 0) < 70)) warnings.push('NotebookLM confidence is low; original matcher ranking is preserved.');

      return '<div class="notebook-panel' + (combined?.confidence === 'conflict' ? ' conflict' : '') + '">' +
        '<div><span class="label">Final Combined Recommendation</span>' +
          (combined
            ? '<div class="notebook-grid">' +
                renderMiniFact('Recommended Qid', combined.recommendedQid || 'none') +
                renderMiniFact('Answer Key', combined.recommendedAnswerKey || 'unknown') +
                renderMiniFact('Confidence', combined.confidence || 'unknown') +
                renderMiniFact('Sources', (combined.sources || []).join(' + ') || 'none') +
              '</div>' +
              '<div class="fact"><div class="value">' + escapeHtml(combined.reason || '') + '</div></div>' +
              '<button type="button" class="secondary" data-use-combined="' + escapeHtml(item.id) + '">Use combined recommendation</button>'
            : '<div class="fact"><div class="value">No combined recommendation has been generated yet.</div></div>') +
        '</div>' +
        (suggestion
          ? '<div><span class="label">NotebookLM Evidence</span>' +
              '<div class="notebook-grid">' +
                renderMiniFact('Suggested Qid', suggestion.notebookSuggestedQid || 'none') +
                renderMiniFact('Answer Key', suggestion.notebookAnswerKey || 'unknown') +
                renderMiniFact('Confidence', suggestion.confidence != null ? String(suggestion.confidence) : 'unknown') +
                renderMiniFact('Status', suggestion.status || 'unknown') +
              '</div>' +
              (suggestion.reason ? '<div class="fact"><span class="label">Reason</span><div class="value">' + escapeHtml(suggestion.reason) + '</div></div>' : '') +
              (suggestion.matchedText ? '<div class="fact"><span class="label">Matched Text</span><div class="value">' + escapeHtml(suggestion.matchedText) + '</div></div>' : '') +
            '</div>'
          : '') +
        (warnings.length ? warnings.map((warning) => '<div class="notebook-warning">' + escapeHtml(warning) + '</div>').join('') : '') +
      '</div>';
    }

    function renderMiniFact(label, value) {
      return '<div class="fact"><span class="label">' + escapeHtml(label) + '</span><div class="value">' + escapeHtml(value || '') + '</div></div>';
    }

    function renderFactGrid(facts) {
      return facts.map(([label, value]) => renderMiniFact(label, value)).join('');
    }

    function renderCard(item) {
      const decision = getDecision(item.id);
      const displayNumber = DISPLAY_INDEX_BY_ID.get(item.id) ?? item.index ?? '?';
      const typeMismatch = getTypeMismatchInfo(item, decision);
      const facts = [];
      const advancedFacts = [];
      if (item.reason) facts.push(['Reason', item.reason]);
      if (item.ocrConfidence) advancedFacts.push(['OCR', item.ocrConfidence]);
      if (item.section === 'auto-matched' && item.qid) facts.push(['Matched Qid', item.qid]);
      if (item.section === 'auto-matched' && item.matchScore != null) facts.push(['Match Score', item.matchScore]);
      if (item.section === 'auto-matched' && item.matchScoreGap != null) facts.push(['Match Gap', item.matchScoreGap]);
      if (item.candidateSetLabel) advancedFacts.push(['Candidate Set', item.candidateSetLabel]);
      if (item.initialSuggestedQid) advancedFacts.push(['Initial Suggested Qid', item.initialSuggestedQid]);
      if (item.currentStagedLocaleCorrectOptionKey) advancedFacts.push(['Current Staged Key', item.currentStagedLocaleCorrectOptionKey]);
      if (item.answerKeyNeedsManualConfirmation && item.answerKeyConfirmationReason) {
        facts.push(['Answer-Key Check', item.answerKeyConfirmationReason]);
      }
      if (item.provisionalTopic) advancedFacts.push(['Topic', item.provisionalTopic]);
      if (Array.isArray(item.provisionalSubtopics) && item.provisionalSubtopics.length > 0) advancedFacts.push(['Subtopics', item.provisionalSubtopics.join(', ')]);
      if (item.sourceBatchId) facts.push(['Source Batch', item.sourceBatchId]);
      if (item.backlogKind) facts.push(['Backlog', item.backlogKind]);
      if (item.backlogStatus) facts.push(['Backlog Status', item.backlogStatus]);
      if (item.section === 'answer-key') {
        facts.push(['Canonical Prompt', item.canonicalPrompt || '']);
        facts.push(['Canonical Correct', [item.canonicalCorrectOptionKey, item.canonicalCorrectOptionText].filter(Boolean).join(' · ')]);
      }
      return '<article class="item" data-item-id="' + escapeHtml(item.id) + '">' +
        '<div class="source-asset-column">' +
          '<div class="eyebrow">' + escapeHtml(item.section.replace('-', ' ')) + '</div>' +
          '<h3>' + escapeHtml(item.section === 'answer-key' ? item.qid : (item.itemId || item.sourceImage || 'item')) + '</h3>' +
          renderImage(item) +
          '<div class="filename"><span class="filename-number">' + escapeHtml(displayNumber) + '.</span>' + escapeHtml(item.sourceImage || item.itemId || item.qid || '') + '</div>' +
          (item.section !== 'answer-key'
            ? renderRecommendationReview(item, decision)
            : '') +
        '</div>' +
        '<div class="source-block">' +
          '<div class="source-card">' +
            '<div><span class="label">Source Prompt</span><p class="prompt">' + escapeHtml(item.promptRawJa || '') + '</p>' + (item.promptGlossEn ? '<div class="gloss">' + escapeHtml(item.promptGlossEn) + '</div>' : '') + '</div>' +
            renderSourceOptionSection(item, decision) +
            (item.section !== 'answer-key' ? renderNotebookLmPanel(item) : '') +
            (facts.length || typeMismatch
              ? '<div class="mini-grid">' +
                renderFactGrid(facts) +
              (typeMismatch
                ? '<div class="fact warn"><span class="label">Type Mismatch</span><div class="value">Source inferred ' + escapeHtml(typeMismatch.sourceType) + ', but approved master ' + escapeHtml(typeMismatch.approvedQid || 'qid') + ' is ' + escapeHtml(typeMismatch.approvedMasterType) + '. Rendering and answer-key handling use the approved master type.</div></div>'
                : '') +
              '</div>'
              : '') +
            (item.section !== 'answer-key'
              ? ((Array.isArray(item.topCandidates) && item.topCandidates.length > 0)
                  ? '<div><span class="label">Candidates</span><div class="candidate-list">' + item.topCandidates.map((candidate) => renderCandidate(candidate, item.id)).join('') + '</div></div>'
                  : '')
              : '<div><span class="label">Answer-Key Review</span><div class="fact"><div class="value">' + escapeHtml(item.answerKeyConfirmationReason || 'Manual confirmation required.') + '</div></div></div>') +
            (advancedFacts.length || item.analysis || item.sourceConceptSlots
              ? '<details><summary>Advanced Details</summary>' +
                  (advancedFacts.length ? '<div class="mini-grid">' + renderFactGrid(advancedFacts) + '</div>' : '') +
                  (item.analysis || item.sourceConceptSlots ? '<pre>' + escapeHtml(JSON.stringify({ analysis: item.analysis || null, sourceConceptSlots: item.sourceConceptSlots || null }, null, 2)) + '</pre>' : '') +
                '</details>'
              : '') +
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
        normalizeDecisionQid(decision?.approvedQid) ||
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

      document.querySelectorAll('[data-use-combined]').forEach((button) => {
        button.addEventListener('click', () => useCombinedRecommendation(button.dataset.useCombined));
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
              approvedQid: input.value,
              createNewQuestion: false,
              keepUnresolved: false,
              deleteQuestion: false,
            },
            { rerender: false },
          );
          syncDecisionUi(id);
        });

        function commitApprovedQidInput() {
          const id = input.dataset.approvedQidFor;
          updateDecision(
            id,
            {
              approvedQid: input.value,
              createNewQuestion: false,
              keepUnresolved: false,
              deleteQuestion: false,
            },
            { preserveContext: false },
          );
          input.value = getDecision(id)?.approvedQid || '';
        }

        input.addEventListener('blur', commitApprovedQidInput);
        input.addEventListener('change', commitApprovedQidInput);
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
          { newQuestionProvisionalTopic: input.value.replace(/\s+/g, ' ').trim() || null },
          { rerender: false },
        ));
        input.addEventListener('blur', () => {
          const id = input.dataset.newTopicFor;
          const decision = getDecision(id) || {};
          const normalizedTopic = normalizeTopicInputValue(input.value);
          const normalizedSubtopics = normalizeSubtopicInputList(decision.newQuestionProvisionalSubtopics, normalizedTopic);
          updateDecision(
            id,
            {
              newQuestionProvisionalTopic: normalizedTopic,
              newQuestionProvisionalSubtopics: normalizedSubtopics,
            },
            { rerender: false },
          );
          input.value = normalizedTopic || '';
          const subtopicsInput = document.querySelector('[data-new-subtopics-for=' + JSON.stringify(id) + ']');
          if (subtopicsInput) {
            subtopicsInput.value = normalizedSubtopics.join(', ');
          }
        });
      });

      document.querySelectorAll('[data-new-subtopics-for]').forEach((textarea) => {
        textarea.addEventListener('input', () => updateDecision(textarea.dataset.newSubtopicsFor, {
          newQuestionProvisionalSubtopics: textarea.value
            .split(/[,\\n]/)
            .map((entry) => entry.replace(/\s+/g, ' ').trim())
            .filter(Boolean),
        }, { rerender: false }));
        textarea.addEventListener('blur', () => {
          const id = textarea.dataset.newSubtopicsFor;
          const decision = getDecision(id) || {};
          const normalizedTopic = normalizeTopicInputValue(decision.newQuestionProvisionalTopic);
          const normalizedSubtopics = normalizeSubtopicInputList(textarea.value, normalizedTopic);
          updateDecision(
            id,
            {
              newQuestionProvisionalTopic: normalizedTopic,
              newQuestionProvisionalSubtopics: normalizedSubtopics,
            },
            { rerender: false },
          );
          textarea.value = normalizedSubtopics.join(', ');
          const topicInput = document.querySelector('[data-new-topic-for=' + JSON.stringify(id) + ']');
          if (topicInput) {
            topicInput.value = normalizedTopic || '';
          }
        });
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
        renderSection(
          sectionId,
          ITEMS.filter((item) => (DISPLAY_SECTION_BY_ID[item.id] || item.section) === sectionId),
        );
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
      reason: "Could not align the approved canonical correct option to a reviewed locale choice.",
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
        ? `Visible locale answer key ${visibleKey} disagrees with meaning-based alignment ${sourceMatch.sourceKey}.`
        : best < 0.65
          ? "Meaning-based option alignment was weak; verify the locale correct option key manually."
          : "Top option alignment was too close to another source choice; verify the locale correct option key manually."
      : "Meaning-based option alignment cleanly identified the locale correct option key.",
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

function normalizeCanonicalQid(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  const match = text.match(/^q?(\d+)$/i);
  if (!match) {
    return null;
  }

  const number = Number.parseInt(match[1], 10);
  if (!Number.isSafeInteger(number) || number <= 0 || number > 9999) {
    return null;
  }

  return `q${String(number).padStart(4, "0")}`;
}

function normalizeWorkbenchApprovedQidValue(value) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  return normalizeCanonicalQid(text) ?? text;
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
