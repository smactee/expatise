#!/usr/bin/env node

import path from "node:path";

import {
  DEFAULT_DATASET,
  batchOptionsFromArgs,
  getBatchFiles,
  getNewQuestionFiles,
  getReviewArtifactPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";
import {
  loadDecisionMemory,
  loadDuplicateAudit,
  loadMasterQuestions,
  normalizeCandidate,
  reviewNewQuestionDuplicateSafety,
} from "../qbank-tools/lib/new-question-promotion-gate.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const scope = String(args.scope ?? "review-needed").trim().toLowerCase();

const batchFiles = getBatchFiles(lang, batchId);
const reviewPaths = getReviewArtifactPaths(lang, batchId, { scope });
const newQuestionFiles = getNewQuestionFiles(lang, batchId);
const reviewDoc = readJson(batchFiles.reviewNeededPath);
const reviewItems = Array.isArray(reviewDoc.items) ? reviewDoc.items : [];
const decisionsDoc = readJson(reviewPaths.decisionsTemplateJsonPath);
const decisionMap = new Map(
  (Array.isArray(decisionsDoc.items) ? decisionsDoc.items : []).map((item) => [item.itemId, normalizeDecision(item)]),
);
const master = loadMasterQuestions({ dataset });
const decisionMemory = loadDecisionMemory();
const duplicateAudit = loadDuplicateAudit();

const decisionSnapshot = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  scope,
  sourceReviewDecisionsPath: path.relative(process.cwd(), reviewPaths.decisionsTemplateJsonPath),
  items: reviewItems.map((item) => {
    const decision = decisionMap.get(item.itemId) ?? normalizeDecision({});
    return {
      itemId: item.itemId,
      sourceImage: item.sourceImage ?? null,
      currentTopQid: item.match?.qid ?? item.topCandidates?.[0]?.qid ?? null,
      currentTopScore: item.match?.score ?? item.topCandidates?.[0]?.score ?? null,
      approvedQid: decision.approvedQid,
      noneOfThese: decision.noneOfThese,
      createNewQuestion: decision.createNewQuestion,
      unsure: decision.unsure,
      reviewerNotes: decision.reviewerNotes,
      status: decisionStatus(decision),
    };
  }),
};

let candidateOrdinal = 1;
const candidateItems = [];

for (const item of reviewItems) {
  const decision = decisionMap.get(item.itemId) ?? normalizeDecision({});
  if (!decision.createNewQuestion) {
    continue;
  }

  const candidate = {
    candidateId: `nqc-${lang}-${batchId}-${String(candidateOrdinal).padStart(3, "0")}`,
    sourceLang: lang,
    sourceImage: item.sourceImage ?? null,
    effectiveQuestionType: item.analysis?.effectiveQuestionType ?? item.analysis?.declaredQuestionType ?? null,
    promptRawJa: item.promptRawJa ?? null,
    promptGlossEn: item.promptGlossEn ?? null,
    optionsRawJa: Array.isArray(item.optionsRawJa) ? item.optionsRawJa : [],
    optionsGlossEn: Array.isArray(item.optionsGlossEn) ? item.optionsGlossEn : [],
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
  const duplicateSafety = reviewNewQuestionDuplicateSafety({
    candidate: normalizeCandidate(candidate, {
      inputPath: newQuestionFiles.candidatesPath,
      lang,
      batch: batchId,
    }),
    masterQuestions: master.questions,
    decisionMemory: decisionMemory.records,
    duplicateAudit,
  });

  candidateItems.push({
    ...candidate,
    duplicateSafety,
    status: statusForDuplicateSafety(duplicateSafety),
  });

  candidateOrdinal += 1;
}

const candidateDoc = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceDecisionPath: path.relative(process.cwd(), newQuestionFiles.decisionsPath),
  sourceDuplicateSafetyPaths: {
    masterQuestions: path.relative(process.cwd(), master.questionsPath),
    rawQuestions: path.relative(process.cwd(), master.rawQuestionsPath),
    imageColorTags: path.relative(process.cwd(), master.imageTagsPath),
    decisionMemory: path.relative(process.cwd(), decisionMemory.memoryPath),
    duplicateAudit: path.relative(process.cwd(), duplicateAudit.auditPath),
  },
  duplicateSafetySummary: summarizeDuplicateSafety(candidateItems),
  items: candidateItems,
};

await writeJson(newQuestionFiles.decisionsPath, decisionSnapshot);
await writeJson(newQuestionFiles.candidatesPath, candidateDoc);

console.log(
  `Staged ${candidateItems.length} new-question candidate(s) in ${path.relative(process.cwd(), newQuestionFiles.candidatesPath)}.`,
);

function normalizeDecision(item) {
  const approvedQid = normalizeText(item?.approvedQid);
  const noneOfThese = item?.noneOfThese === true;
  const createNewQuestion = item?.createNewQuestion === true;
  const unsure =
    approvedQid || noneOfThese || createNewQuestion
      ? false
      : item?.unsure !== false;

  return {
    approvedQid: approvedQid || null,
    noneOfThese,
    createNewQuestion,
    unsure,
    reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
  };
}

function normalizeText(value) {
  const text = String(value ?? "").trim();
  return text || null;
}

function decisionStatus(decision) {
  if (decision.createNewQuestion) {
    return "selected-for-new-question";
  }

  if (decision.approvedQid) {
    return "approved-existing-qid";
  }

  if (decision.noneOfThese) {
    return "none-of-these";
  }

  if (decision.unsure) {
    return "needs-review";
  }

  return "pending-review";
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

function statusForDuplicateSafety(duplicateSafety) {
  if (duplicateSafety.promotionRecommendation === "blockDuplicate") return "blocked-duplicate";
  if (duplicateSafety.promotionRecommendation === "linkToExistingQid") return "link-to-existing-qid";
  if (duplicateSafety.promotionRecommendation === "needsDuplicateReview") return "needs-duplicate-review";
  return "pending-superset-review";
}

function summarizeDuplicateSafety(items) {
  return {
    candidatesBlocked: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "blockDuplicate").length,
    candidatesNeedingDuplicateReview: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "needsDuplicateReview").length,
    candidatesLinkedToExistingQid: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "linkToExistingQid").length,
    candidatesSafeToPromote: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "safeToPromote").length,
  };
}
