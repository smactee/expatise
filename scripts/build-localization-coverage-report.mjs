#!/usr/bin/env node

import {
  DEFAULT_DATASET,
  batchOptionsFromArgs,
  discoverKnownLanguages,
  fileExists,
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
const knownLanguages = discoverKnownLanguages({ dataset });
const questionsDoc = readJson(datasetPaths.questionsPath);
const questions = Array.isArray(questionsDoc.questions) ? questionsDoc.questions : Array.isArray(questionsDoc) ? questionsDoc : [];
const coverageByLang = new Map();

for (const knownLang of knownLanguages) {
  if (knownLang === "en") {
    coverageByLang.set(knownLang, new Set(questions.map((question) => question.id)));
    continue;
  }

  const translationPath = getDatasetPaths(dataset, knownLang).translationPath;
  if (!fileExists(translationPath)) {
    coverageByLang.set(knownLang, null);
    continue;
  }

  const translationDoc = readJson(translationPath);
  coverageByLang.set(knownLang, new Set(Object.keys(translationDoc.questions ?? {})));
}

const qids = questions.map((question) => ({
  qid: question.id,
  number: Number(question.number),
  coverage: Object.fromEntries(
    knownLanguages.map((knownLang) => [
      knownLang,
      existingCoverageState(knownLang, coverageByLang.get(knownLang), question.id),
    ]),
  ),
}));

const existingCoverageSummary = Object.fromEntries(
  knownLanguages.map((knownLang) => [
    knownLang,
    {
      present: qids.filter((entry) => entry.coverage[knownLang] === "present").length,
      missing: qids.filter((entry) => entry.coverage[knownLang] === "missing").length,
      master: qids.filter((entry) => entry.coverage[knownLang] === "master").length,
      notPublished: qids.filter((entry) => entry.coverage[knownLang] === "not-published").length,
    },
  ]),
);

const newCandidateDoc = fileExists(newQuestionFiles.candidatesPath)
  ? readJson(newQuestionFiles.candidatesPath)
  : { items: [] };
const newCandidates = Array.isArray(newCandidateDoc.items) ? newCandidateDoc.items : [];

const report = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  knownLanguages,
  sourceCandidatesPath: fileExists(newQuestionFiles.candidatesPath)
    ? newQuestionFiles.candidatesPath
    : null,
  existingCoverageSummary,
  qids,
  newQuestionCandidates: newCandidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    sourceLang: candidate.sourceLang,
    status: candidate.status,
    languageSpecific: true,
    coverage: Object.fromEntries(
      knownLanguages.map((knownLang) => [
        knownLang,
        knownLang === candidate.sourceLang ? "candidate-source" : "missing",
      ]),
    ),
    linkedExistingAssetCandidate: candidate.linkedExistingAssetCandidate ?? null,
  })),
};

await writeJson(newQuestionFiles.coverageReportPath, report);

console.log(
  `Wrote coverage report to ${newQuestionFiles.coverageReportPath}.`,
);

function existingCoverageState(knownLang, coverageSet, qid) {
  if (knownLang === "en") {
    return "master";
  }

  if (!coverageSet) {
    return "not-published";
  }

  return coverageSet.has(qid) ? "present" : "missing";
}
