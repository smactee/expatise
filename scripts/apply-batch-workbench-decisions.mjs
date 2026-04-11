#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  batchOptionsFromArgs,
  ensurePipelineDirs,
  fileExists,
  getBatchFiles,
  getNewQuestionFiles,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
} from "../qbank-tools/lib/pipeline.mjs";

const args = parseArgs();
const { lang, batchId } = batchOptionsFromArgs(args);
const dataset = String(args.dataset ?? DEFAULT_DATASET);

await ensurePipelineDirs({ lang, batchId });

const batchFiles = getBatchFiles(lang, batchId);
const newQuestionFiles = getNewQuestionFiles(lang, batchId);
const workbenchDecisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, `${lang}-${batchId}-workbench-decisions.json`);

if (!fileExists(workbenchDecisionsPath)) {
  throw new Error(`Workbench decisions file not found: ${path.relative(process.cwd(), workbenchDecisionsPath)}`);
}

const workbenchDoc = readJson(workbenchDecisionsPath);
const workbenchItems = Array.isArray(workbenchDoc.items) ? workbenchDoc.items : [];

const reviewDecisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-review-decisions.json`);
const answerKeyDecisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-answer-key-decisions.json`);
const reviewScopedAnswerKeyDecisionsPath = path.join(
  STAGING_DIR,
  `${lang}-${batchId}-answer-key-decisions.review-scope.json`,
);
const unresolvedDecisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-unresolved-decisions.json`);
const previewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.preview.json`);
const existingPreviewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.existing.preview.json`);
const existingDecisionsPath = path.join(STAGING_DIR, `${lang}-${batchId}-existing-qid-decisions.json`);
const fullPreviewPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.full.preview.json`);
const fullDryRunPath = path.join(STAGING_DIR, `translations.${lang}.${batchId}.full.merge-dry-run.json`);
const fullReportPath = path.join(REPORTS_DIR, `full-batch-merge-review-${lang}-${batchId}.json`);
const workbenchApplyReportPath = path.join(REPORTS_DIR, `apply-workbench-decisions-${lang}-${batchId}.json`);
const questionsPath = path.join(ROOT, "public", "qbank", dataset, "questions.json");
const explanationReportPath = path.join(REPORTS_DIR, `apply-workbench-explanations-${lang}-${batchId}.json`);

const matchedDoc = readJson(batchFiles.matchedPath);
const matchedItems = Array.isArray(matchedDoc.items) ? matchedDoc.items : [];
const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [question.qid, question]));

const reviewDecisionItems = [];
const answerKeyDecisionItems = [];
const unresolvedDecisionItems = [];
const singleItemAnswerKeyDecisions = [];
const newQuestionOverrides = new Map();
const sourceExplanationUpdates = new Map();

const counts = {
  autoMatched: matchedItems.length,
  reviewedApproved: 0,
  rescuedUnresolved: 0,
  newQuestionCandidates: 0,
  answerKeyConfirmations: 0,
};

for (const rawItem of workbenchItems) {
  const item = normalizeWorkbenchDecision(rawItem);

  if (item.section === "auto-matched") {
    const structuralOverride =
      item.createNewQuestion === true ||
      item.keepUnresolved === true ||
      !item.approvedQid ||
      item.approvedQid !== item.initialSuggestedQid;

    if (structuralOverride) {
      reviewDecisionItems.push({
        itemId: item.itemId,
        sourceSection: item.section,
        approvedQid: item.approvedQid,
        initialSuggestedQid: item.initialSuggestedQid,
        noneOfThese: false,
        createNewQuestion: item.createNewQuestion,
        keepUnresolved: item.keepUnresolved === true,
        unsure: !item.approvedQid && !item.createNewQuestion,
        confirmedCorrectOptionKey: resolveStructuredAnswerKey(item),
        answerKeyUnknown: item.answerKeyUnknown === true,
        currentStagedLocaleCorrectOptionKey: item.currentStagedLocaleCorrectOptionKey,
        useCurrentStagedAnswerKey: item.useCurrentStagedAnswerKey === true,
        reviewerNotes: item.reviewerNotes,
        sourceExplanation: item.sourceExplanation,
      });

      if (item.approvedQid) {
        counts.reviewedApproved += 1;
      }

      if (item.createNewQuestion) {
        counts.newQuestionCandidates += 1;
        rememberNewQuestionOverrides(newQuestionOverrides, item);
      }
    }

    if (item.approvedQid && shouldWriteAnswerKeyDecision(item, questionMap.get(item.approvedQid))) {
      answerKeyDecisionItems.push({
        qid: item.approvedQid,
        confirmedCorrectOptionKey: resolveStructuredAnswerKey(item),
        unknown: item.answerKeyUnknown === true,
        reviewerNotes: item.reviewerNotes,
      });
      if (resolveStructuredAnswerKey(item)) {
        counts.answerKeyConfirmations += 1;
      }
    }

    recordSourceExplanationUpdate(sourceExplanationUpdates, item, item.approvedQid);

    continue;
  }

  if (item.section === "review-needed") {
    reviewDecisionItems.push({
      itemId: item.itemId,
      sourceSection: item.section,
      approvedQid: item.approvedQid,
      initialSuggestedQid: item.initialSuggestedQid,
      noneOfThese: false,
      createNewQuestion: item.createNewQuestion,
      keepUnresolved: item.keepUnresolved === true,
      unsure: !item.approvedQid && !item.createNewQuestion,
      confirmedCorrectOptionKey: resolveStructuredAnswerKey(item),
      answerKeyUnknown: item.answerKeyUnknown === true,
      currentStagedLocaleCorrectOptionKey: item.currentStagedLocaleCorrectOptionKey,
      useCurrentStagedAnswerKey: item.useCurrentStagedAnswerKey === true,
      reviewerNotes: item.reviewerNotes,
      sourceExplanation: item.sourceExplanation,
    });

    if (item.approvedQid) {
      counts.reviewedApproved += 1;
      recordSourceExplanationUpdate(sourceExplanationUpdates, item, item.approvedQid);
      if (shouldWriteAnswerKeyDecision(item, questionMap.get(item.approvedQid))) {
        answerKeyDecisionItems.push({
          qid: item.approvedQid,
          confirmedCorrectOptionKey: resolveStructuredAnswerKey(item),
          unknown: item.answerKeyUnknown === true,
          reviewerNotes: item.reviewerNotes,
        });
        if (resolveStructuredAnswerKey(item)) {
          counts.answerKeyConfirmations += 1;
        }
      }
    }

    if (item.createNewQuestion) {
      counts.newQuestionCandidates += 1;
      rememberNewQuestionOverrides(newQuestionOverrides, item);
    }

    continue;
  }

  if (item.section === "unresolved") {
    unresolvedDecisionItems.push({
      itemId: item.itemId,
      sourceSection: item.section,
      sourceImage: item.sourceImage,
      approvedQid: item.approvedQid,
      initialSuggestedQid: item.initialSuggestedQid,
      createNewQuestion: item.createNewQuestion,
      keepUnresolved: !item.approvedQid && !item.createNewQuestion ? true : item.keepUnresolved,
      confirmedCorrectOptionKey: resolveStructuredAnswerKey(item),
      answerKeyUnknown: item.answerKeyUnknown === true,
      currentStagedLocaleCorrectOptionKey: item.currentStagedLocaleCorrectOptionKey,
      useCurrentStagedAnswerKey: item.useCurrentStagedAnswerKey === true,
      reviewerNotes: item.reviewerNotes,
      sourceExplanation: item.sourceExplanation,
      recommendedAction: rawItem.recommendedAction ?? null,
    });

    if (item.approvedQid) {
      counts.rescuedUnresolved += 1;
      recordSourceExplanationUpdate(sourceExplanationUpdates, item, item.approvedQid);
      if (resolveStructuredAnswerKey(item)) {
        counts.answerKeyConfirmations += 1;
      }
    }

    if (item.createNewQuestion) {
      counts.newQuestionCandidates += 1;
      rememberNewQuestionOverrides(newQuestionOverrides, item);
    }

    continue;
  }

  if (item.section === "answer-key") {
    const resolvedKey = resolveStructuredAnswerKey(item);

    singleItemAnswerKeyDecisions.push({
      qid: item.qid,
      sourceItemId: item.itemId,
      sourceImage: item.sourceImage,
      currentStagedLocaleCorrectOptionKey: item.currentStagedLocaleCorrectOptionKey,
      confirmedCorrectOptionKey: resolvedKey,
      unknown: item.answerKeyUnknown === true || !resolvedKey,
      reviewerNotes: item.reviewerNotes,
    });

    recordSourceExplanationUpdate(sourceExplanationUpdates, item, item.qid);

    if (resolvedKey) {
      counts.answerKeyConfirmations += 1;
    }
  }
}

const reviewDecisionsDoc = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceWorkbenchDecisionsPath: path.relative(process.cwd(), workbenchDecisionsPath),
  items: reviewDecisionItems,
};
const answerKeyDecisionsDoc = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceWorkbenchDecisionsPath: path.relative(process.cwd(), workbenchDecisionsPath),
  items: answerKeyDecisionItems,
};
const unresolvedDecisionsDoc = {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceWorkbenchDecisionsPath: path.relative(process.cwd(), workbenchDecisionsPath),
  items: unresolvedDecisionItems,
};

await writeJson(reviewDecisionsPath, reviewDecisionsDoc);
await writeJson(answerKeyDecisionsPath, answerKeyDecisionsDoc);
await writeJson(unresolvedDecisionsPath, unresolvedDecisionsDoc);

for (const decision of singleItemAnswerKeyDecisions) {
  const targetPath = path.join(STAGING_DIR, `${lang}-${batchId}-${decision.qid}-answer-key-decision.json`);
  await writeJson(targetPath, {
    generatedAt: stableNow(),
    lang,
    batchId,
    dataset,
    qid: decision.qid,
    item: {
      qid: decision.qid,
      sourceItemId: decision.sourceItemId,
      sourceImage: decision.sourceImage,
      currentStagedLocaleCorrectOptionKey: decision.currentStagedLocaleCorrectOptionKey,
      confirmedCorrectOptionKey: decision.confirmedCorrectOptionKey,
      unknown: decision.unknown,
      reviewerNotes: decision.reviewerNotes,
    },
  });
}

runNodeScript("scripts/stage-reviewed-batch.mjs", [
  "--lang", lang,
  "--batch", batchId,
  "--decisions-path", reviewDecisionsPath,
]);

const reviewPreviewDoc = readJson(previewPath);
const reviewScopedAnswerKeyDecisionsDoc = buildScopedAnswerKeyDecisionsDoc({
  decisionsDoc: answerKeyDecisionsDoc,
  previewDoc: reviewPreviewDoc,
  sourceWorkbenchDecisionsPath: workbenchDecisionsPath,
  lang,
  batchId,
  dataset,
});

await writeJson(reviewScopedAnswerKeyDecisionsPath, reviewScopedAnswerKeyDecisionsDoc);

runNodeScript("scripts/apply-answer-key-decisions.mjs", [
  "--lang", lang,
  "--batch", batchId,
  "--preview-path", previewPath,
  "--decisions-path", reviewScopedAnswerKeyDecisionsPath,
]);

runNodeScript("scripts/apply-unresolved-decisions.mjs", [
  "--lang", lang,
  "--batch", batchId,
  "--decisions-path", unresolvedDecisionsPath,
  "--reviewed-preview-path", previewPath,
  "--review-decisions-path", reviewDecisionsPath,
]);

await applyNewQuestionOverrides(newQuestionFiles.candidatesPath, newQuestionOverrides);

const explanationApplyResult = await applySourceExplanationUpdates({
  questionsPath,
  reportPath: explanationReportPath,
  sourceWorkbenchDecisionsPath: workbenchDecisionsPath,
  lang,
  batchId,
  dataset,
  updates: sourceExplanationUpdates,
});

runNodeScript("scripts/build-full-batch-staging-preview.mjs", [
  "--lang", lang,
  "--batch", batchId,
  "--reviewed-preview-path", existingPreviewPath,
  "--review-decisions-path", existingDecisionsPath,
  "--answer-key-decisions-path", answerKeyDecisionsPath,
]);

await applyNewQuestionOverrides(newQuestionFiles.candidatesPath, newQuestionOverrides);

const fullReport = readJson(fullReportPath);
const fullPreview = readJson(fullPreviewPath);
const newQuestionCandidatesDoc = fileExists(newQuestionFiles.candidatesPath)
  ? readJson(newQuestionFiles.candidatesPath)
  : { items: [] };

await writeJson(workbenchApplyReportPath, {
  generatedAt: stableNow(),
  lang,
  batchId,
  dataset,
  sourceWorkbenchDecisionsPath: path.relative(process.cwd(), workbenchDecisionsPath),
  sourceMatchedPath: path.relative(process.cwd(), batchFiles.matchedPath),
  reviewDecisionsPath: path.relative(process.cwd(), reviewDecisionsPath),
  answerKeyDecisionsPath: path.relative(process.cwd(), answerKeyDecisionsPath),
  reviewScopedAnswerKeyDecisionsPath: path.relative(process.cwd(), reviewScopedAnswerKeyDecisionsPath),
  unresolvedDecisionsPath: path.relative(process.cwd(), unresolvedDecisionsPath),
  fullPreviewPath: path.relative(process.cwd(), fullPreviewPath),
  fullDryRunPath: path.relative(process.cwd(), fullDryRunPath),
  fullReportPath: path.relative(process.cwd(), fullReportPath),
  questionsPath: path.relative(process.cwd(), questionsPath),
  explanationReportPath: path.relative(process.cwd(), explanationReportPath),
  counts: {
    autoMatched: counts.autoMatched,
    reviewedFinalized: counts.reviewedApproved,
    rescuedUnresolved: counts.rescuedUnresolved,
    newQuestionCandidates: Array.isArray(newQuestionCandidatesDoc.items) ? newQuestionCandidatesDoc.items.length : 0,
    sourceExplanationUpdates: explanationApplyResult.updatedCount,
    finalMergeReadyTotal: Number(fullReport.totalQidsReadyForMerge ?? Object.keys(fullPreview.questions ?? {}).length),
    blockerCount: Array.isArray(fullReport.blockers) ? fullReport.blockers.length : 0,
  },
  sourceExplanationSummary: {
    decidedCount: explanationApplyResult.decidedCount,
    updatedCount: explanationApplyResult.updatedCount,
    unchangedCount: explanationApplyResult.unchangedCount,
    updatedQids: explanationApplyResult.updatedQids,
  },
  blockers: Array.isArray(fullReport.blockers) ? fullReport.blockers : [],
  safeToMergeNextStep: fullReport.safeToMergeNextStep === true,
});

console.log(
  `Applied workbench decisions for ${lang} ${batchId}: ${fullReport.totalQidsReadyForMerge ?? 0} merge-ready, ${Array.isArray(fullReport.blockers) ? fullReport.blockers.length : 0} blocker(s).`,
);

function normalizeWorkbenchDecision(item) {
  return {
    id: String(item?.id ?? "").trim(),
    section: String(item?.section ?? "").trim(),
    itemId: String(item?.itemId ?? "").trim() || null,
    sourceImage: String(item?.sourceImage ?? "").trim() || null,
    qid: normalizeText(item?.qid),
    approvedQid: normalizeText(item?.approvedQid),
    initialSuggestedQid: normalizeText(item?.initialSuggestedQid),
    createNewQuestion: item?.createNewQuestion === true,
    keepUnresolved: item?.keepUnresolved === true,
    confirmedCorrectOptionKey: normalizeChoiceKey(item?.confirmedCorrectOptionKey),
    answerKeyUnknown: item?.answerKeyUnknown === true || item?.unknown === true,
    currentStagedLocaleCorrectOptionKey: normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey),
    useCurrentStagedAnswerKey: item?.useCurrentStagedAnswerKey === true,
    reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
    sourceExplanation: normalizeExplanationText(item?.sourceExplanation, { preserveEmpty: true }),
    newQuestionProvisionalTopic: normalizeText(item?.newQuestionProvisionalTopic),
    newQuestionProvisionalSubtopics: normalizeSubtopics(item?.newQuestionProvisionalSubtopics),
  };
}

function rememberNewQuestionOverrides(targetMap, item) {
  const key = item.sourceImage ?? item.itemId;
  if (!key) {
    return;
  }

  targetMap.set(key, {
    provisionalTopic: item.newQuestionProvisionalTopic ?? null,
    provisionalSubtopics: Array.isArray(item.newQuestionProvisionalSubtopics) ? item.newQuestionProvisionalSubtopics : [],
    reviewerNotes: item.reviewerNotes ?? "",
    sourceExplanation: normalizeExplanationText(item.sourceExplanation),
  });
}

async function applyNewQuestionOverrides(candidatesPath, overrides) {
  if (overrides.size === 0 || !fileExists(candidatesPath)) {
    return;
  }

  const doc = readJson(candidatesPath);
  const items = Array.isArray(doc.items) ? doc.items : [];
  let changed = false;

  for (const item of items) {
    const key = item?.sourceImage ?? item?.itemId ?? null;
    const override = key ? overrides.get(key) : null;
    if (!override) {
      continue;
    }

    if (override.provisionalTopic) {
      item.provisionalTopic = override.provisionalTopic;
      changed = true;
    }

    if (override.provisionalSubtopics.length > 0) {
      item.provisionalSubtopics = [...override.provisionalSubtopics];
      changed = true;
    }

    if (override.reviewerNotes) {
      item.reviewerNotes = override.reviewerNotes;
      changed = true;
    }

    if (override.sourceExplanation) {
      item.sourceExplanation = override.sourceExplanation;
      changed = true;
    }
  }

  if (changed) {
    doc.generatedAt = stableNow();
    await writeJson(candidatesPath, doc);
  }
}

function normalizeSubtopics(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter(Boolean);
  }

  const text = normalizeText(value);
  if (!text) {
    return [];
  }

  return text
    .split(/[,\n]/)
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function normalizeExplanationText(value, options = {}) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.replace(/\r\n/g, "\n").trim();
  if (text) {
    return text;
  }

  return options.preserveEmpty === true ? "" : null;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function resolveStructuredAnswerKey(item) {
  if (item?.useCurrentStagedAnswerKey === true) {
    return normalizeChoiceKey(item?.currentStagedLocaleCorrectOptionKey);
  }

  return normalizeChoiceKey(item?.confirmedCorrectOptionKey);
}

function shouldWriteAnswerKeyDecision(item, approvedQuestion) {
  if (!approvedQuestion || approvedQuestion.type !== "MCQ") {
    return false;
  }

  if (item?.answerKeyUnknown === true) {
    return true;
  }

  return Boolean(resolveStructuredAnswerKey(item));
}

function buildScopedAnswerKeyDecisionsDoc({
  decisionsDoc,
  previewDoc,
  sourceWorkbenchDecisionsPath,
  lang: sourceLang,
  batchId: sourceBatchId,
  dataset: sourceDataset,
}) {
  const previewQids = new Set(
    Object.keys(
      previewDoc?.questions && typeof previewDoc.questions === "object"
        ? previewDoc.questions
        : {},
    ),
  );
  const allItems = Array.isArray(decisionsDoc?.items) ? decisionsDoc.items : [];

  return {
    generatedAt: stableNow(),
    lang: sourceLang,
    batchId: sourceBatchId,
    dataset: sourceDataset,
    scope: "review-preview-only",
    sourceWorkbenchDecisionsPath: path.relative(process.cwd(), sourceWorkbenchDecisionsPath),
    sourceFullAnswerKeyDecisionsPath: path.relative(process.cwd(), answerKeyDecisionsPath),
    previewQidCount: previewQids.size,
    excludedQids: allItems
      .map((item) => normalizeText(item?.qid))
      .filter((qid) => qid && !previewQids.has(qid)),
    items: allItems.filter((item) => {
      const qid = normalizeText(item?.qid);
      return Boolean(qid && previewQids.has(qid));
    }),
  };
}

function recordSourceExplanationUpdate(targetMap, item, qid) {
  const normalizedQid = normalizeText(qid);
  const sourceExplanation = normalizeExplanationText(item?.sourceExplanation);

  if (!normalizedQid || !sourceExplanation) {
    return;
  }

  const existing = targetMap.get(normalizedQid);
  if (existing && existing.sourceExplanation !== sourceExplanation) {
    throw new Error(
      `Conflicting source explanations provided for ${normalizedQid}: ${JSON.stringify({
        existing: existing.sourceExplanation,
        incoming: sourceExplanation,
      })}`,
    );
  }

  if (!existing) {
    targetMap.set(normalizedQid, {
      qid: normalizedQid,
      sourceExplanation,
      sourceImage: item?.sourceImage ?? null,
      itemId: item?.itemId ?? null,
      section: item?.section ?? null,
    });
  }
}

async function applySourceExplanationUpdates({
  questionsPath,
  reportPath,
  sourceWorkbenchDecisionsPath,
  lang: sourceLang,
  batchId: sourceBatchId,
  dataset: sourceDataset,
  updates,
}) {
  const doc = readJson(questionsPath);
  const isArray = Array.isArray(doc);
  const questions = isArray ? doc : Array.isArray(doc?.questions) ? doc.questions : null;

  if (!questions) {
    throw new Error(`questions.json does not contain a questions array: ${path.relative(process.cwd(), questionsPath)}`);
  }

  const byId = new Map(
    questions.map((question, index) => [normalizeText(question?.id), { index, question }]),
  );
  const items = [];
  const updatedQids = [];
  let updatedCount = 0;
  let unchangedCount = 0;

  for (const [qid, update] of [...updates.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const current = byId.get(qid);
    if (!current) {
      throw new Error(`Question id not found in questions.json: ${qid}`);
    }

    const existingExplanation = normalizeExplanationText(current.question?.explanation, { preserveEmpty: true }) ?? "";
    if (existingExplanation === update.sourceExplanation) {
      unchangedCount += 1;
      items.push({
        qid,
        itemId: update.itemId,
        sourceImage: update.sourceImage,
        section: update.section,
        action: "unchanged",
        sourceExplanation: update.sourceExplanation,
      });
      continue;
    }

    questions[current.index] = {
      ...current.question,
      explanation: update.sourceExplanation,
    };
    updatedCount += 1;
    updatedQids.push(qid);
    items.push({
      qid,
      itemId: update.itemId,
      sourceImage: update.sourceImage,
      section: update.section,
      action: "updated",
      previousExplanation: existingExplanation,
      sourceExplanation: update.sourceExplanation,
    });
  }

  if (updatedCount > 0) {
    await writeJson(
      questionsPath,
      isArray ? questions : { ...doc, questions },
    );
  }

  await writeJson(reportPath, {
    generatedAt: stableNow(),
    lang: sourceLang,
    batchId: sourceBatchId,
    dataset: sourceDataset,
    sourceWorkbenchDecisionsPath: path.relative(process.cwd(), sourceWorkbenchDecisionsPath),
    questionsPath: path.relative(process.cwd(), questionsPath),
    decidedCount: updates.size,
    updatedCount,
    unchangedCount,
    updatedQids,
    items,
  });

  return {
    decidedCount: updates.size,
    updatedCount,
    unchangedCount,
    updatedQids,
  };
}

function runNodeScript(scriptPath, argsList) {
  execFileSync(process.execPath, [path.join(process.cwd(), scriptPath), ...argsList.map(String)], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}
