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

const preview = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceCandidatesPath: path.relative(process.cwd(), newQuestionFiles.candidatesPath),
  highestExistingQuestionNumber: highestQuestionNumber,
  knownLanguages,
  items: candidates.map((candidate, index) => ({
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
    placeholderLocalizationCoverage: Object.fromEntries(
      knownLanguages.map((knownLang) => [
        knownLang,
        localizationPlaceholderState(candidate, knownLang),
      ]),
    ),
    status: "preview-only",
  })),
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
