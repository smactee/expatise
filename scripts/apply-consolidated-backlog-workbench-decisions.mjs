#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  STAGING_DIR,
  ensureDir,
  fileExists,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const lang = String(args.lang ?? "ja").trim().toLowerCase() || "ja";
const dataset = String(args.dataset ?? DEFAULT_DATASET);
const backlogId = String(args["backlog-id"] ?? "consolidated-backlog").trim().toLowerCase() || "consolidated-backlog";

const sourceDocPath = path.join(STAGING_DIR, `consolidated-backlog.${lang}.json`);
const workbenchDecisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${backlogId}-workbench-decisions.json`);
const unresolvedDecisionsPath = path.join(STAGING_DIR, `${lang}-${backlogId}-unresolved-decisions.json`);
const reviewedPreviewPath = path.join(STAGING_DIR, `translations.${lang}.${backlogId}.preview.json`);
const reviewDecisionsPath = path.join(STAGING_DIR, `${lang}-${backlogId}-review-decisions.json`);
const reportPath = path.join(REPORTS_DIR, `apply-consolidated-backlog-workbench-decisions-${lang}.json`);

for (const requiredPath of [sourceDocPath, workbenchDecisionsPath]) {
  if (!fileExists(requiredPath)) {
    throw new Error(`Required input not found: ${path.relative(process.cwd(), requiredPath)}`);
  }
}

await ensureDir(STAGING_DIR);
await ensureDir(REPORTS_DIR);

const sourceDoc = readJson(sourceDocPath);
const workbenchDoc = readJson(workbenchDecisionsPath);
const sourceItems = Array.isArray(sourceDoc.items) ? sourceDoc.items : [];
const workbenchItems = Array.isArray(workbenchDoc.items) ? workbenchDoc.items : [];

const sourceByItemId = new Map(sourceItems.map((item) => [String(item?.itemId ?? ""), item]));

for (const item of workbenchItems) {
  if (String(item?.section ?? "").trim() !== "unresolved") {
    throw new Error(
      `Consolidated backlog apply only supports unresolved-section items, found section=${JSON.stringify(item?.section)} for ${JSON.stringify(item?.itemId ?? item?.id ?? null)}.`,
    );
  }
}

const unresolvedDecisionsDoc = {
  generatedAt: stableNow(),
  lang,
  batchId: backlogId,
  dataset,
  sourceWorkbenchDecisionsPath: path.relative(process.cwd(), workbenchDecisionsPath),
  sourceBacklogPath: path.relative(process.cwd(), sourceDocPath),
  items: workbenchItems.map((item) => {
    const sourceItem = sourceByItemId.get(String(item?.itemId ?? "")) ?? null;
    return {
      itemId: String(item?.itemId ?? "").trim() || null,
      sourceSection: "unresolved",
      sourceImage: String(item?.sourceImage ?? "").trim() || sourceItem?.sourceImage || null,
      approvedQid: normalizeText(item?.approvedQid),
      initialSuggestedQid: normalizeText(item?.initialSuggestedQid),
      createNewQuestion: item?.createNewQuestion === true,
      keepUnresolved: item?.keepUnresolved === true,
      deleteQuestion: item?.deleteQuestion === true,
      confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
      newQuestionLocalAnswerKey: normalizeChoiceKey(item?.newQuestionLocalAnswerKey),
      answerKeyUnknown: item?.answerKeyUnknown === true || item?.unknown === true,
      currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey),
      useCurrentStagedAnswerKey: item?.useCurrentStagedAnswerKey === true,
      reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
      sourceExplanation: normalizeText(item?.sourceExplanation),
      recommendedAction: normalizeText(sourceItem?.recommendedAction),
    };
  }),
};

const emptyReviewedPreviewDoc = {
  meta: {
    locale: lang,
    generatedAt: stableNow(),
    reviewedBatchId: backlogId,
    dataset,
    stagingOnly: true,
    synthesizedBy: "apply-consolidated-backlog-workbench-decisions",
  },
  questions: {},
};

const emptyReviewDecisionsDoc = {
  generatedAt: stableNow(),
  lang,
  batchId: backlogId,
  dataset,
  source: "consolidated-backlog-empty-review-input",
  items: [],
};

await writeJson(unresolvedDecisionsPath, unresolvedDecisionsDoc);
await writeJson(reviewedPreviewPath, emptyReviewedPreviewDoc);
await writeJson(reviewDecisionsPath, emptyReviewDecisionsDoc);

runNodeScript("scripts/apply-unresolved-decisions.mjs", [
  "--lang", lang,
  "--batch", backlogId,
  "--dataset", dataset,
  "--unresolved-path", sourceDocPath,
  "--decisions-path", unresolvedDecisionsPath,
  "--reviewed-preview-path", reviewedPreviewPath,
  "--review-decisions-path", reviewDecisionsPath,
]);

runNodeScript("scripts/prepare-new-question-promotion-preview.mjs", [
  "--lang", lang,
  "--batch", backlogId,
  "--dataset", dataset,
]);

await writeJson(reportPath, {
  generatedAt: stableNow(),
  lang,
  dataset,
  backlogId,
  sourceBacklogPath: path.relative(process.cwd(), sourceDocPath),
  sourceWorkbenchDecisionsPath: path.relative(process.cwd(), workbenchDecisionsPath),
  unresolvedDecisionsPath: path.relative(process.cwd(), unresolvedDecisionsPath),
  reviewedPreviewPath: path.relative(process.cwd(), reviewedPreviewPath),
  reviewDecisionsPath: path.relative(process.cwd(), reviewDecisionsPath),
  decisionCount: unresolvedDecisionsDoc.items.length,
  approvedExistingQidCount: unresolvedDecisionsDoc.items.filter((item) => item.approvedQid).length,
  createNewQuestionCount: unresolvedDecisionsDoc.items.filter((item) => item.createNewQuestion === true).length,
  keepUnresolvedCount: unresolvedDecisionsDoc.items.filter((item) => item.keepUnresolved === true).length,
  deleteQuestionCount: unresolvedDecisionsDoc.items.filter((item) => item.deleteQuestion === true).length,
});

console.log(
  `Applied consolidated backlog decisions for ${lang}: ${unresolvedDecisionsDoc.items.length} item(s) processed.`,
);

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function runNodeScript(scriptPath, argsList) {
  execFileSync(process.execPath, [path.join(process.cwd(), scriptPath), ...argsList.map(String)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}
