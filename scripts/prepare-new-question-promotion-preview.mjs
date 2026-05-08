#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  STAGING_DIR,
  batchOptionsFromArgs,
  discoverKnownLanguages,
  getDatasetPaths,
  getNewQuestionFiles,
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
const datasetPaths = getDatasetPaths(dataset);
const newQuestionFiles = getNewQuestionFiles(lang, batchId);
const candidatesDoc = readJson(newQuestionFiles.candidatesPath);
const candidates = Array.isArray(candidatesDoc.items) ? candidatesDoc.items : [];
const knownLanguages = discoverKnownLanguages({ dataset });
const highestQuestionNumber = highestMasterNumber(datasetPaths.questionsPath);
const nextQxOrdinal = nextSyntheticOrdinal();
const master = loadMasterQuestions({ dataset });
const decisionMemory = loadDecisionMemory();
const duplicateAudit = loadDuplicateAudit();

const previewItems = candidates.map((candidate, index) => {
  const duplicateSafety = reviewNewQuestionDuplicateSafety({
    candidate: normalizeCandidate(candidate, {
      index,
      inputPath: newQuestionFiles.candidatesPath,
      lang,
      batch: batchId,
    }),
    masterQuestions: master.questions,
    decisionMemory: decisionMemory.records,
    duplicateAudit,
  });

  return {
    candidateId: candidate.candidateId,
    proposedQid: `qx${String(nextQxOrdinal + index).padStart(4, "0")}`,
    proposedMasterNumber: highestQuestionNumber + index + 1,
    sourceLang: candidate.sourceLang,
    sourceImage: candidate.sourceImage,
    effectiveQuestionType: candidate.effectiveQuestionType,
    newQuestionLocalAnswerKey: candidate.newQuestionLocalAnswerKey ?? null,
    provisionalTopic: candidate.provisionalTopic,
    provisionalSubtopics: candidate.provisionalSubtopics,
    linkedExistingAssetCandidate: candidate.linkedExistingAssetCandidate ?? null,
    duplicateSafety,
    nearestExistingQids: duplicateSafety.nearestExistingQids,
    duplicateScore: duplicateSafety.duplicateScore,
    memoryLabelsFound: duplicateSafety.memoryLabelsFound,
    promotionRecommendation: duplicateSafety.promotionRecommendation,
    placeholderLocalizationCoverage: Object.fromEntries(
      knownLanguages.map((knownLang) => [
        knownLang,
        localizationPlaceholderState(candidate, knownLang),
      ]),
    ),
    status: statusForDuplicateSafety(duplicateSafety),
  };
});

const preview = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceCandidatesPath: path.relative(process.cwd(), newQuestionFiles.candidatesPath),
  sourceDuplicateSafetyPaths: {
    masterQuestions: path.relative(process.cwd(), master.questionsPath),
    rawQuestions: path.relative(process.cwd(), master.rawQuestionsPath),
    imageColorTags: path.relative(process.cwd(), master.imageTagsPath),
    decisionMemory: path.relative(process.cwd(), decisionMemory.memoryPath),
    duplicateAudit: path.relative(process.cwd(), duplicateAudit.auditPath),
  },
  duplicateSafetySummary: summarizeDuplicateSafety(previewItems),
  highestExistingQuestionNumber: highestQuestionNumber,
  knownLanguages,
  items: previewItems,
};

await writeJson(newQuestionFiles.promotionPreviewPath, preview);

console.log(
  `Prepared ${preview.items.length} promotion preview item(s) in ${path.relative(process.cwd(), newQuestionFiles.promotionPreviewPath)}.`,
);

function highestMasterNumber(questionsPath) {
  const doc = readJson(questionsPath);
  const questions = Array.isArray(doc.questions) ? doc.questions : Array.isArray(doc) ? doc : [];
  return questions.reduce((max, question) => Math.max(max, Number(question.number) || 0), 0);
}

function nextSyntheticOrdinal() {
  let maxOrdinal = 0;

  for (const entry of fs.readdirSync(STAGING_DIR, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.startsWith("new-question-promotion-preview.") || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = path.join(STAGING_DIR, entry.name);
    try {
      const doc = readJson(filePath);
      for (const item of Array.isArray(doc.items) ? doc.items : []) {
        const match = String(item?.proposedQid ?? "").match(/^qx(\d+)$/i);
        if (match?.[1]) {
          maxOrdinal = Math.max(maxOrdinal, Number(match[1]));
        }
      }
    } catch {
      continue;
    }
  }

  return maxOrdinal + 1;
}

function localizationPlaceholderState(candidate, knownLang) {
  if (knownLang === candidate.sourceLang) {
    return "source-extracted";
  }

  if (knownLang === "en") {
    return "missing-master-canonical";
  }

  return "missing-localization";
}

function statusForDuplicateSafety(duplicateSafety) {
  if (duplicateSafety.promotionRecommendation === "blockDuplicate") return "blocked-duplicate";
  if (duplicateSafety.promotionRecommendation === "linkToExistingQid") return "link-to-existing-qid";
  if (duplicateSafety.promotionRecommendation === "needsDuplicateReview") return "needs-duplicate-review";
  return "preview-only";
}

function summarizeDuplicateSafety(items) {
  return {
    candidatesBlocked: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "blockDuplicate").length,
    candidatesNeedingDuplicateReview: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "needsDuplicateReview").length,
    candidatesLinkedToExistingQid: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "linkToExistingQid").length,
    candidatesSafeToPromote: items.filter((item) => item.duplicateSafety?.promotionRecommendation === "safeToPromote").length,
  };
}
