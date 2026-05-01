#!/usr/bin/env node

import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  booleanArg,
  ensureDir,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const LANG = "ru";
const VALID_FINAL_DECISIONS = new Set(["approve", "new", "unresolved", "delete", "ignore"]);
const MCQ_KEYS = new Set(["A", "B", "C", "D"]);
const ROW_KEYS = new Set(["Right", "Wrong"]);
const UNKNOWN_KEY = "UNKNOWN";
const MCQ_OPTION_LABELS = ["A", "B", "C", "D"];
const ROW_SOURCE_LABELS = ["A", "B"];

const args = parseArgs();
const apply = booleanArg(args, "apply", false);
const allowRisky = booleanArg(args, "allow-risky", false);
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;

const decisionsPath = args["decisions-path"]
  ? path.resolve(String(args["decisions-path"]))
  : path.join(STAGING_DIR, "ru-discrepancy-review-decisions.json");
const itemsPath = args["items-path"]
  ? path.resolve(String(args["items-path"]))
  : path.join(STAGING_DIR, "ru-discrepancy-review-items.json");

const previewJsonPath = args["report-json-path"]
  ? path.resolve(String(args["report-json-path"]))
  : path.join(REPORTS_DIR, "ru-discrepancy-apply-preview.json");
const previewMdPath = args["report-md-path"]
  ? path.resolve(String(args["report-md-path"]))
  : path.join(REPORTS_DIR, "ru-discrepancy-apply-preview.md");
const createNewStagePath = path.join(STAGING_DIR, "ru-discrepancy-create-new-candidates.json");
const missingProductionStagePath = path.join(STAGING_DIR, "ru-discrepancy-missing-production-merge-candidates.json");

if (!fileExists(decisionsPath)) {
  throw new Error(`Discrepancy decisions file not found: ${rel(decisionsPath)}`);
}
if (!fileExists(itemsPath)) {
  throw new Error(`Discrepancy review items file not found: ${rel(itemsPath)}`);
}

const generatedAt = stableNow();
const decisionDoc = readJson(decisionsPath);
const reviewItemsDoc = readJson(itemsPath);
const decisionItems = Array.isArray(decisionDoc.items) ? decisionDoc.items : [];
const reviewItems = Array.isArray(reviewItemsDoc.items) ? reviewItemsDoc.items : [];
const reviewItemById = new Map(reviewItems.map((item) => [String(item.id ?? ""), item]));

const datasetPaths = getDatasetPaths(dataset, LANG);
const masterQuestionList = extractQuestionList(readJson(datasetPaths.questionsPath));
const masterQuestionByQid = new Map(masterQuestionList.map((question) => [normalizeQid(question.id ?? question.qid), question]));
const productionDoc = fileExists(datasetPaths.translationPath)
  ? readJson(datasetPaths.translationPath)
  : { questions: {} };
const productionQuestions = productionDoc.questions && typeof productionDoc.questions === "object"
  ? productionDoc.questions
  : {};
const productionQids = new Set(Object.keys(productionQuestions).map(normalizeQid).filter(Boolean));

const workbenchCache = new Map();
const analyses = [];
const sourceTargets = new Map();
const idCounts = countStrings(decisionItems.map((item) => String(item.id ?? "")));

for (const [index, rawDecision] of decisionItems.entries()) {
  const analysis = analyzeDecision(rawDecision, index);
  analyses.push(analysis);

  if (analysis.sourceKey) {
    if (!sourceTargets.has(analysis.sourceKey)) sourceTargets.set(analysis.sourceKey, []);
    sourceTargets.get(analysis.sourceKey).push(analysis);
  }
}

for (const group of sourceTargets.values()) {
  if (group.length <= 1) continue;
  const signatures = new Set(group.map((entry) => actionSignature(entry)));
  if (signatures.size > 1) {
    for (const entry of group) {
      entry.validationErrors.push("multiple discrepancy decisions target the same source item with conflicting final actions");
    }
  }
}

for (const analysis of analyses) {
  finalizeEligibility(analysis);
}

const summary = buildSummary(analyses);
const applyResult = apply
  ? await applyReviewedChanges(analyses)
  : {
      applied: false,
      filesChanged: [],
      backups: [],
      createNewStagePath: null,
      missingProductionStagePath: null,
      note: "Dry run only. No decision, staging, or production qbank files were modified.",
    };

const report = {
  generatedAt,
  apply,
  allowRisky,
  lang: LANG,
  dataset,
  sourcePaths: {
    decisionsPath: rel(decisionsPath),
    itemsPath: rel(itemsPath),
    productionTranslationsPath: rel(datasetPaths.translationPath),
    masterQuestionsPath: rel(datasetPaths.questionsPath),
  },
  outputPaths: {
    previewJsonPath: rel(previewJsonPath),
    previewMdPath: rel(previewMdPath),
    createNewStagePath: rel(createNewStagePath),
    missingProductionStagePath: rel(missingProductionStagePath),
  },
  summary,
  applyResult,
  missingProductionQidMergeNeeded: analyses.filter((entry) => entry.missingProductionMerge.needed),
  answerKeyLetterMismatchesAccepted: analyses.filter((entry) => entry.answerKeyAlignment?.hasLetterMismatch),
  autoNormalizedRowAnswerItems: analyses.filter((entry) => entry.answerKeyAlignment?.autoNormalizedRowAnswer),
  manuallyConfirmedDuplicateLabelAnswers: analyses.filter((entry) => entry.answerKeyAlignment?.selectedIsAmbiguous && entry.confirmAmbiguousDuplicateLabel === true),
  corruptedSourceLabelItems: analyses.filter((entry) => entry.answerKeyAlignment?.hasDuplicateSourceLabels || entry.answerKeyAlignment?.hasMissingSourceLabels),
  riskyOrAmbiguousItems: analyses.filter((entry) => entry.riskyOrAmbiguous),
  skippedItems: analyses.filter((entry) => entry.skipReasons.length > 0),
  items: analyses,
};

await writeJson(previewJsonPath, report);
await writeText(previewMdPath, renderMarkdownReport(report));

console.log(`Wrote ${rel(previewJsonPath)}`);
console.log(`Wrote ${rel(previewMdPath)}`);
console.log(`${apply ? "Apply" : "Dry run"} complete: ${summary.totalItems} item(s), ${summary.skippedItemCount} skipped, ${applyResult.filesChanged.length} file(s) changed.`);

function analyzeDecision(rawDecision, index) {
  const id = String(rawDecision?.id ?? "").trim();
  const reviewItem = reviewItemById.get(id) ?? null;
  const finalDecision = normalizeFinalDecision(rawDecision?.finalDecision);
  const batch = normalizeBatch(rawDecision?.batch ?? reviewItem?.batch);
  const screenshotPath = normalizeText(rawDecision?.screenshotPath ?? reviewItem?.sourceScreenshotPath);
  const category = normalizeText(rawDecision?.discrepancyCategory ?? rawDecision?.category ?? reviewItem?.discrepancyCategory);
  const approvedQid = normalizeQid(rawDecision?.approvedQid);
  const rawLocaleAnswerKey = normalizeAnswerKey(rawDecision?.localeAnswerKey);
  const confirmAmbiguousDuplicateLabel = rawDecision?.confirmAmbiguousDuplicateLabel === true;
  const masterQuestion = approvedQid ? masterQuestionByQid.get(approvedQid) ?? null : null;
  const masterType = normalizeQuestionType(masterQuestion?.type);
  const answerKeyAlignment = buildAnswerKeyAlignment({
    reviewItem,
    masterQuestion,
    selectedLocaleAnswerKey: rawLocaleAnswerKey,
  });
  const localeAnswerKey = answerKeyAlignment.selectedLocaleAnswerKey || rawLocaleAnswerKey;
  const sourceKey = batch && screenshotPath ? `${batch}::${screenshotPath}` : "";
  const validationErrors = [];
  const validationWarnings = [];

  if (!id) validationErrors.push("missing item id");
  if (id && !reviewItem) validationErrors.push("item id is not present in ru-discrepancy-review-items.json");
  if (idCounts.get(id) > 1) validationErrors.push("duplicate decision id in exported decisions JSON");
  if (!VALID_FINAL_DECISIONS.has(finalDecision)) validationErrors.push(`invalid finalDecision: ${rawDecision?.finalDecision ?? ""}`);
  if (!batch) validationErrors.push("missing batch");
  if (!screenshotPath) validationErrors.push("missing screenshotPath");

  validateDecisionFlags({ rawDecision, finalDecision, validationErrors });

  if (finalDecision === "approve") {
    if (!approvedQid) validationErrors.push("approvedQid is required for approve");
    if (approvedQid && !masterQuestion) validationErrors.push(`approvedQid ${approvedQid} was not found in master questions.json`);
    validateAnswerForApprovedQid({ localeAnswerKey, masterType, approvedQid, answerKeyAlignment, confirmAmbiguousDuplicateLabel, validationErrors, validationWarnings });
  }

  if (finalDecision === "new") {
    if (approvedQid) validationErrors.push("approvedQid must be blank for create-new");
    if (!localeAnswerKey || localeAnswerKey === UNKNOWN_KEY) {
      validationErrors.push("create-new requires a concrete localeAnswerKey");
    } else if (!isKnownAnswerKey(localeAnswerKey)) {
      validationErrors.push(`invalid create-new localeAnswerKey: ${localeAnswerKey}`);
    }
    validateLocaleAnswerAgainstSource({ localeAnswerKey, answerKeyAlignment, finalDecision, confirmAmbiguousDuplicateLabel, validationErrors, validationWarnings });
  }

  if (finalDecision === "unresolved" || finalDecision === "delete" || finalDecision === "ignore") {
    if (approvedQid && finalDecision !== "ignore") {
      validationWarnings.push(`${finalDecision} decision carries approvedQid ${approvedQid}; apply will clear it in batch decisions`);
    }
    if (localeAnswerKey && localeAnswerKey !== UNKNOWN_KEY && !isKnownAnswerKey(localeAnswerKey)) {
      validationErrors.push(`invalid localeAnswerKey: ${localeAnswerKey}`);
    }
  }

  const workbench = lookupWorkbenchDecision({ batch, screenshotPath });
  if (finalDecision !== "ignore") {
    if (!workbench.path) validationErrors.push(`workbench decisions file not found for ${batch}`);
    if (workbench.path && workbench.matches.length === 0) validationErrors.push("no matching source item found in batch workbench decisions");
    if (workbench.matches.length > 1) validationErrors.push("multiple matching source items found in batch workbench decisions");
  }

  const missingProductionMerge = analyzeMissingProductionMerge({
    category,
    finalDecision,
    approvedQid,
    batch,
    productionQids,
  });

  const riskLevel = String(rawDecision?.aiReview?.riskLevel ?? reviewItem?.riskLevel ?? "").toLowerCase();
  const requiresRiskOverride = riskLevel === "high";
  const riskyOrAmbiguous =
    requiresRiskOverride ||
    /needs human review|possible better qid/i.test(String(rawDecision?.aiReview?.recommendation ?? reviewItem?.aiReviewRecommendation ?? "")) ||
    validationWarnings.length > 0;

  return {
    index,
    id,
    category,
    batch,
    screenshotPath,
    sourceKey,
    finalDecision,
    approvedQid,
    rawLocaleAnswerKey,
    localeAnswerKey,
    createNewQuestion: rawDecision?.createNewQuestion === true,
    keepUnresolved: rawDecision?.keepUnresolved === true,
    deleteQuestion: rawDecision?.deleteQuestion === true,
    ignoreReconciliation: rawDecision?.ignoreReconciliation === true,
    confirmAmbiguousDuplicateLabel,
    reviewerNotes: normalizeText(rawDecision?.reviewerNotes),
    newQuestionTopic: normalizeText(rawDecision?.newQuestionTopic),
    newQuestionSubtopics: Array.isArray(rawDecision?.newQuestionSubtopics)
      ? rawDecision.newQuestionSubtopics.map(normalizeText).filter(Boolean)
      : [],
    selectedCandidate: rawDecision?.selectedCandidate ?? null,
    originalDecision: rawDecision?.originalDecision ?? null,
    aiReview: rawDecision?.aiReview ?? {
      recommendation: reviewItem?.aiReviewRecommendation ?? "",
      riskLevel: reviewItem?.riskLevel ?? "",
      justification: reviewItem?.aiReviewJustification ?? "",
      suggestedNextAction: reviewItem?.suggestedNextAction ?? "",
    },
    masterQuestion: masterQuestion
      ? {
          qid: approvedQid,
          type: masterType,
          number: masterQuestion.number ?? null,
          prompt: masterQuestion.prompt ?? "",
        }
      : null,
    answerKeyAlignment,
    productionStatus: approvedQid
      ? (productionQids.has(approvedQid) ? "present in production translations" : "missing from production translations")
      : "no approved qid",
    workbenchDecisionPath: workbench.path ? rel(workbench.path) : null,
    workbenchDecisionIndex: workbench.matches.length === 1 ? workbench.matches[0].index : null,
    workbenchDecisionId: workbench.matches.length === 1 ? workbench.matches[0].item.id ?? null : null,
    missingProductionMerge,
    validationErrors,
    validationWarnings,
    riskyOrAmbiguous,
    requiresRiskOverride,
    skipReasons: [],
    applyEligible: false,
    plannedApplyAction: null,
  };
}

function validateDecisionFlags({ rawDecision, finalDecision, validationErrors }) {
  const expected = {
    approve: { createNewQuestion: false, keepUnresolved: false, deleteQuestion: false, ignoreReconciliation: false },
    new: { createNewQuestion: true, keepUnresolved: false, deleteQuestion: false, ignoreReconciliation: false },
    unresolved: { createNewQuestion: false, keepUnresolved: true, deleteQuestion: false, ignoreReconciliation: false },
    delete: { createNewQuestion: false, keepUnresolved: false, deleteQuestion: true, ignoreReconciliation: false },
    ignore: { createNewQuestion: false, keepUnresolved: false, deleteQuestion: false, ignoreReconciliation: true },
  }[finalDecision];

  if (!expected) return;

  for (const [key, value] of Object.entries(expected)) {
    if ((rawDecision?.[key] === true) !== value) {
      validationErrors.push(`${key} flag conflicts with finalDecision=${finalDecision}`);
    }
  }
}

function validateAnswerForApprovedQid({ localeAnswerKey, masterType, approvedQid, answerKeyAlignment, confirmAmbiguousDuplicateLabel, validationErrors, validationWarnings }) {
  if (!approvedQid) return;

  if (!localeAnswerKey || localeAnswerKey === UNKNOWN_KEY) {
    validationErrors.push(`localeAnswerKey is required for approval ${approvedQid}`);
    return;
  }

  if (!isKnownAnswerKey(localeAnswerKey)) {
    validationErrors.push(`invalid localeAnswerKey for approval ${approvedQid}: ${localeAnswerKey}`);
    return;
  }

  validateLocaleAnswerAgainstSource({ localeAnswerKey, answerKeyAlignment, finalDecision: "approve", confirmAmbiguousDuplicateLabel, validationErrors, validationWarnings });

  if (answerKeyAlignment.hasLetterMismatch) {
    const source = `${answerKeyAlignment.sourceAnswerKey || "unknown"}${answerKeyAlignment.sourceCorrectText ? ` / ${answerKeyAlignment.sourceCorrectText}` : ""}`;
    const master = `${answerKeyAlignment.masterAnswerKey || "unknown"}${answerKeyAlignment.masterCorrectText ? ` / ${answerKeyAlignment.masterCorrectText}` : ""}`;
    const meaning = answerKeyAlignment.sourceMasterMeaning?.matches
      ? "meaning appears aligned"
      : "meaning alignment requires manual confirmation";
    validationWarnings.push(`answer-key letter mismatch accepted for review: source ${source} vs master ${master}; ${meaning}`);
  }

  if (answerKeyAlignment.autoNormalizedRowAnswer) {
    validationWarnings.push(`auto-normalized ROW answer accepted: source selected key ${answerKeyAlignment.selectedRawLocaleAnswerKey || answerKeyAlignment.sourceRawAnswerKey || "unknown"} -> exported ${answerKeyAlignment.selectedLocaleAnswerKey || localeAnswerKey}`);
  }

  if (masterType === "ROW" && MCQ_KEYS.has(localeAnswerKey)) {
    validationErrors.push(`ROW approval ${approvedQid} must use Right/Wrong, not source label ${localeAnswerKey}`);
  }
}

function validateLocaleAnswerAgainstSource({ localeAnswerKey, answerKeyAlignment, finalDecision, confirmAmbiguousDuplicateLabel, validationErrors, validationWarnings }) {
  if (!answerKeyAlignment) return;
  if (!localeAnswerKey || localeAnswerKey === UNKNOWN_KEY) return;

  const sourceType = answerKeyAlignment.sourceQuestionType || "MCQ";
  if (sourceType === "ROW" && MCQ_KEYS.has(localeAnswerKey)) {
    validationErrors.push(`ROW source item must use Right/Wrong localeAnswerKey, not ${localeAnswerKey}`);
  }
  if (sourceType === "MCQ" && ROW_KEYS.has(localeAnswerKey)) {
    validationErrors.push(`MCQ source item must use A/B/C/D localeAnswerKey, not ${localeAnswerKey}`);
  }
  if (!answerKeyAlignment.selectedExistsInSource) {
    validationErrors.push(`localeAnswerKey ${localeAnswerKey} was not found in source/local options`);
  }
  if (answerKeyAlignment.selectedIsAmbiguous) {
    if (confirmAmbiguousDuplicateLabel) {
      validationWarnings.push(`manually confirmed duplicate-label answer accepted for localeAnswerKey ${localeAnswerKey}`);
    } else {
      validationErrors.push(`localeAnswerKey ${localeAnswerKey} is ambiguous because the selected source label appears more than once`);
    }
  }
  if (answerKeyAlignment.hasDuplicateSourceLabels || answerKeyAlignment.hasMissingSourceLabels) {
    validationWarnings.push(`corrupted source option labels require manual confirmation for ${finalDecision}: detected ${answerKeyAlignment.detectedSourceLabels.join(", ") || "none"}`);
  }
}

function lookupWorkbenchDecision({ batch, screenshotPath }) {
  if (!batch) return { path: null, doc: null, matches: [] };
  const workbenchPath = path.join(STAGING_DIR, `${LANG}-${batch}-workbench-decisions.json`);
  if (!fileExists(workbenchPath)) return { path: workbenchPath, doc: null, matches: [] };

  let cached = workbenchCache.get(workbenchPath);
  if (!cached) {
    const doc = readJson(workbenchPath);
    const items = Array.isArray(doc.items) ? doc.items : [];
    cached = { path: workbenchPath, doc, items, dirty: false };
    workbenchCache.set(workbenchPath, cached);
  }

  const matches = cached.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => matchesSourcePath(item, screenshotPath));

  return { path: workbenchPath, doc: cached.doc, matches };
}

function matchesSourcePath(item, screenshotPath) {
  const source = normalizeText(screenshotPath);
  if (!source) return false;
  const values = [
    item?.sourceImage,
    item?.itemId,
    item?.file,
    item?.id,
  ].map((value) => String(value ?? "").trim()).filter(Boolean);

  return values.some((value) => value === source || value.endsWith(`:${source}`) || value.endsWith(`/${source}`));
}

function analyzeMissingProductionMerge({ category, finalDecision, approvedQid, batch, productionQids: translatedQids }) {
  const needed = category === "missing-production-qid" && finalDecision === "approve" && approvedQid && !translatedQids.has(approvedQid);
  if (!needed) {
    return {
      needed: false,
      eligibleNow: false,
      qid: approvedQid || null,
      sourcePreviewPath: null,
      reason: "",
    };
  }

  const preview = findLocalizationPreviewEntry({ batch, qid: approvedQid });
  return {
    needed: true,
    eligibleNow: Boolean(preview.entry),
    qid: approvedQid,
    sourcePreviewPath: preview.path ? rel(preview.path) : null,
    reason: preview.entry
      ? "approved qid is missing from production and a staging/archive preview entry was found"
      : "approved qid is missing from production, but no staging/archive preview entry currently contains this qid; rebuild/apply the batch staging first",
  };
}

function findLocalizationPreviewEntry({ batch, qid }) {
  if (!batch || !qid) return { path: null, entry: null };
  const names = [
    `translations.${LANG}.${batch}.full.preview.json`,
    `translations.${LANG}.${batch}.existing.preview.json`,
    `translations.${LANG}.${batch}.preview.json`,
    `translations.${LANG}.${batch}.rescued.preview.json`,
  ];
  const dirs = [
    STAGING_DIR,
    path.join(ROOT, "qbank-tools", "generated", "archive", LANG, batch, "staging"),
  ];

  for (const dir of dirs) {
    for (const name of names) {
      const candidatePath = path.join(dir, name);
      if (!fileExists(candidatePath)) continue;
      const doc = readJson(candidatePath);
      const entry = doc?.questions?.[qid] ?? null;
      if (entry) return { path: candidatePath, entry };
    }
  }

  return { path: null, entry: null };
}

function finalizeEligibility(analysis) {
  if (analysis.validationErrors.length > 0) {
    analysis.skipReasons.push(...analysis.validationErrors);
  }

  if (analysis.requiresRiskOverride && !allowRisky) {
    analysis.skipReasons.push("high-risk item requires --allow-risky true for apply");
  }

  if (analysis.finalDecision === "new" && (analysis.localeAnswerKey === "Right" || analysis.localeAnswerKey === "Wrong")) {
    analysis.skipReasons.push("create-new Right/Wrong items cannot be safely represented by the existing batch apply pipeline; staged separately only");
  }

  if (analysis.finalDecision === "ignore") {
    analysis.plannedApplyAction = "no-op reconciliation ignore";
    analysis.applyEligible = analysis.skipReasons.length === 0;
    return;
  }

  if (analysis.missingProductionMerge.needed && !analysis.missingProductionMerge.eligibleNow) {
    analysis.validationWarnings.push(analysis.missingProductionMerge.reason);
  }

  analysis.plannedApplyAction = `update ${analysis.workbenchDecisionPath ?? "missing workbench decisions file"}`;
  analysis.applyEligible = analysis.skipReasons.length === 0;
}

async function applyReviewedChanges(items) {
  const eligibleItems = items.filter((item) => item.applyEligible && item.finalDecision !== "ignore");
  const changedFiles = new Set();
  const backups = [];
  const skipped = items.filter((item) => item.skipReasons.length > 0);

  const backupRoot = path.join(
    ROOT,
    "qbank-tools",
    "generated",
    "archive",
    LANG,
    `discrepancy-review-apply-${safeTimestamp(generatedAt)}`,
  );

  for (const item of eligibleItems) {
    const cache = workbenchCache.get(path.resolve(ROOT, item.workbenchDecisionPath ?? ""));
    const directCache = [...workbenchCache.values()].find((entry) => rel(entry.path) === item.workbenchDecisionPath);
    const target = cache ?? directCache;
    if (!target) {
      item.skipReasons.push("internal error: cached workbench file not found during apply");
      continue;
    }
    const targetItem = target.items[item.workbenchDecisionIndex];
    if (!targetItem) {
      item.skipReasons.push("internal error: workbench decision index no longer exists during apply");
      continue;
    }
    applyToWorkbenchItem(targetItem, item);
    target.doc.generatedAt = generatedAt;
    target.dirty = true;
    changedFiles.add(target.path);
  }

  for (const targetPath of changedFiles) {
    const backupPath = path.join(backupRoot, rel(targetPath));
    await ensureDir(path.dirname(backupPath));
    await fsp.copyFile(targetPath, backupPath);
    backups.push({
      source: rel(targetPath),
      backup: rel(backupPath),
    });
  }

  for (const target of workbenchCache.values()) {
    if (target.dirty) {
      await writeJson(target.path, target.doc);
    }
  }

  const createNewItems = items
    .filter((item) => item.finalDecision === "new")
    .map((item) => ({
      id: item.id,
      batch: item.batch,
      screenshotPath: item.screenshotPath,
      localeAnswerKey: item.localeAnswerKey,
      topic: item.newQuestionTopic,
      subtopics: item.newQuestionSubtopics,
      reviewerNotes: item.reviewerNotes,
      confirmAmbiguousDuplicateLabel: item.confirmAmbiguousDuplicateLabel === true,
      applyEligible: item.applyEligible,
      skipReasons: item.skipReasons,
    }));
  if (createNewItems.length > 0) {
    await writeJson(createNewStagePath, {
      generatedAt,
      lang: LANG,
      dataset,
      sourceDecisionsPath: rel(decisionsPath),
      note: "Create-new items are staged for human/new-question promotion review only. This script never writes create-new items directly to production qbank.",
      items: createNewItems,
    });
  }

  const missingProductionItems = items
    .filter((item) => item.missingProductionMerge.needed)
    .map((item) => ({
      id: item.id,
      batch: item.batch,
      qid: item.approvedQid,
      screenshotPath: item.screenshotPath,
      localeAnswerKey: item.localeAnswerKey,
      productionStatus: item.productionStatus,
      eligibleNow: item.missingProductionMerge.eligibleNow,
      sourcePreviewPath: item.missingProductionMerge.sourcePreviewPath,
      reason: item.missingProductionMerge.reason,
      confirmAmbiguousDuplicateLabel: item.confirmAmbiguousDuplicateLabel === true,
    }));
  if (missingProductionItems.length > 0) {
    await writeJson(missingProductionStagePath, {
      generatedAt,
      lang: LANG,
      dataset,
      sourceDecisionsPath: rel(decisionsPath),
      note: "Missing-production qids are staged for merge preparation only. Production translations are not modified by this script.",
      items: missingProductionItems,
    });
  }

  return {
    applied: true,
    filesChanged: [
      ...[...changedFiles].map(rel),
      ...(createNewItems.length ? [rel(createNewStagePath)] : []),
      ...(missingProductionItems.length ? [rel(missingProductionStagePath)] : []),
    ],
    backups,
    skippedItemCount: skipped.length,
    createNewStagePath: createNewItems.length ? rel(createNewStagePath) : null,
    missingProductionStagePath: missingProductionItems.length ? rel(missingProductionStagePath) : null,
    note: "Production qbank files were not modified. Existing batch workbench decision files were backed up before updates.",
  };
}

function applyToWorkbenchItem(target, decision) {
  if (decision.finalDecision === "approve") {
    target.approvedQid = decision.approvedQid;
    target.createNewQuestion = false;
    target.keepUnresolved = false;
    target.deleteQuestion = false;
    target.newQuestionLocalAnswerKey = null;
    target.confirmedCorrectOptionKey = MCQ_KEYS.has(decision.localeAnswerKey) ? decision.localeAnswerKey : null;
    target.answerKeyUnknown = decision.localeAnswerKey === UNKNOWN_KEY;
    target.useCurrentStagedAnswerKey = false;
  } else if (decision.finalDecision === "new") {
    target.approvedQid = null;
    target.createNewQuestion = true;
    target.keepUnresolved = false;
    target.deleteQuestion = false;
    target.confirmedCorrectOptionKey = null;
    target.newQuestionLocalAnswerKey = MCQ_KEYS.has(decision.localeAnswerKey) ? decision.localeAnswerKey : null;
    target.answerKeyUnknown = false;
    target.useCurrentStagedAnswerKey = false;
  } else if (decision.finalDecision === "unresolved") {
    target.approvedQid = null;
    target.createNewQuestion = false;
    target.keepUnresolved = true;
    target.deleteQuestion = false;
    target.confirmedCorrectOptionKey = null;
    target.newQuestionLocalAnswerKey = null;
    target.answerKeyUnknown = decision.localeAnswerKey === UNKNOWN_KEY;
    target.useCurrentStagedAnswerKey = false;
  } else if (decision.finalDecision === "delete") {
    target.approvedQid = null;
    target.createNewQuestion = false;
    target.keepUnresolved = false;
    target.deleteQuestion = true;
    target.confirmedCorrectOptionKey = null;
    target.newQuestionLocalAnswerKey = null;
    target.answerKeyUnknown = false;
    target.useCurrentStagedAnswerKey = false;
  }

  if (decision.newQuestionTopic) target.newQuestionProvisionalTopic = decision.newQuestionTopic;
  if (decision.newQuestionSubtopics.length > 0) target.newQuestionProvisionalSubtopics = [...decision.newQuestionSubtopics];
  if (decision.reviewerNotes) target.reviewerNotes = decision.reviewerNotes;
}

function buildSummary(items) {
  const countsByAction = Object.fromEntries([...VALID_FINAL_DECISIONS].map((key) => [key, 0]));
  const countsByCategory = {};
  const countsByBatch = {};
  for (const item of items) {
    countsByAction[item.finalDecision] = (countsByAction[item.finalDecision] ?? 0) + 1;
    countsByCategory[item.category] = (countsByCategory[item.category] ?? 0) + 1;
    countsByBatch[item.batch] = (countsByBatch[item.batch] ?? 0) + 1;
  }

  return {
    totalItems: items.length,
    validItemCount: items.filter((item) => item.validationErrors.length === 0).length,
    invalidItemCount: items.filter((item) => item.validationErrors.length > 0).length,
    skippedItemCount: items.filter((item) => item.skipReasons.length > 0).length,
    applyEligibleCount: items.filter((item) => item.applyEligible).length,
    approveExistingQidCount: countsByAction.approve,
    createNewQuestionCount: countsByAction.new,
    keepUnresolvedCount: countsByAction.unresolved,
    deleteQuestionCount: countsByAction.delete,
    ignoreReconciliationCount: countsByAction.ignore,
    countsByAction,
    countsByCategory,
    countsByBatch,
    missingProductionQidMergeNeededCount: items.filter((item) => item.missingProductionMerge.needed).length,
    autoNormalizedRowAnswerCount: items.filter((item) => item.answerKeyAlignment?.autoNormalizedRowAnswer).length,
    answerKeyLetterMismatchCount: items.filter((item) => item.answerKeyAlignment?.hasLetterMismatch).length,
    manuallyConfirmedDuplicateLabelCount: items.filter((item) => item.answerKeyAlignment?.selectedIsAmbiguous && item.confirmAmbiguousDuplicateLabel === true).length,
    corruptedSourceLabelCount: items.filter((item) => item.answerKeyAlignment?.hasDuplicateSourceLabels || item.answerKeyAlignment?.hasMissingSourceLabels).length,
    corruptedSourceLabelBlockedCount: items.filter((item) => ((item.answerKeyAlignment?.selectedIsAmbiguous && item.confirmAmbiguousDuplicateLabel !== true) || (item.localeAnswerKey && item.localeAnswerKey !== UNKNOWN_KEY && !item.answerKeyAlignment?.selectedExistsInSource))).length,
    riskyOrAmbiguousCount: items.filter((item) => item.riskyOrAmbiguous).length,
  };
}

function renderMarkdownReport(report) {
  const lines = [];
  lines.push("# RU Discrepancy Apply Preview");
  lines.push("");
  lines.push(`Generated at: ${report.generatedAt}`);
  lines.push(`Mode: ${report.apply ? "apply" : "dry-run"}`);
  lines.push(`Production qbank modified: no`);
  lines.push("");
  lines.push("## Inputs");
  lines.push("");
  lines.push(`- Decisions: \`${report.sourcePaths.decisionsPath}\``);
  lines.push(`- Review items: \`${report.sourcePaths.itemsPath}\``);
  lines.push(`- Production translations checked: \`${report.sourcePaths.productionTranslationsPath}\``);
  lines.push("");
  lines.push("## Counts By Action");
  lines.push("");
  lines.push("| action | count |");
  lines.push("|---|---:|");
  lines.push(`| approve existing qid | ${report.summary.approveExistingQidCount} |`);
  lines.push(`| create new question | ${report.summary.createNewQuestionCount} |`);
  lines.push(`| keep unresolved | ${report.summary.keepUnresolvedCount} |`);
  lines.push(`| delete question | ${report.summary.deleteQuestionCount} |`);
  lines.push(`| ignore/count reconciliation | ${report.summary.ignoreReconciliationCount} |`);
  lines.push("");
  lines.push("## Validation Summary");
  lines.push("");
  lines.push(`- Total items: ${report.summary.totalItems}`);
  lines.push(`- Valid items: ${report.summary.validItemCount}`);
  lines.push(`- Invalid items: ${report.summary.invalidItemCount}`);
  lines.push(`- Apply-eligible items: ${report.summary.applyEligibleCount}`);
  lines.push(`- Skipped items: ${report.summary.skippedItemCount}`);
  lines.push(`- Risky/ambiguous items: ${report.summary.riskyOrAmbiguousCount}`);
  lines.push(`- Missing-production-qid merge-needed items: ${report.summary.missingProductionQidMergeNeededCount}`);
  lines.push(`- Auto-normalized ROW answers: ${report.summary.autoNormalizedRowAnswerCount}`);
  lines.push(`- Answer-key letter mismatches accepted for review: ${report.summary.answerKeyLetterMismatchCount}`);
  lines.push(`- Manually confirmed duplicate-label answers: ${report.summary.manuallyConfirmedDuplicateLabelCount}`);
  lines.push(`- Corrupted source label items: ${report.summary.corruptedSourceLabelCount}`);
  lines.push(`- Corrupted source label items blocked by selected answer ambiguity/missing source key: ${report.summary.corruptedSourceLabelBlockedCount}`);
  lines.push("");

  lines.push("## Auto-normalized ROW Answers");
  lines.push("");
  if (report.autoNormalizedRowAnswerItems.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| item | source selected key | source selected text | exported locale key |");
    lines.push("|---|---|---|---|");
    for (const item of report.autoNormalizedRowAnswerItems) {
      const alignment = item.answerKeyAlignment;
      lines.push(`| ${md(item.id)} | ${md(alignment.selectedRawLocaleAnswerKey || alignment.sourceRawAnswerKey)} | ${md(alignment.selectedLocaleCorrectText || alignment.sourceCorrectText)} | ${md(item.localeAnswerKey)} |`);
    }
  }
  lines.push("");

  lines.push("## Answer-key Letter Mismatches Accepted Because Local/Source Option Order Differs");
  lines.push("");
  if (report.answerKeyLetterMismatchesAccepted.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| item | qid | source/local answer | master answer | selected locale answer | meaning check |");
    lines.push("|---|---|---|---|---|---|");
    for (const item of report.answerKeyLetterMismatchesAccepted) {
      const alignment = item.answerKeyAlignment;
      lines.push(`| ${md(item.id)} | ${md(item.approvedQid)} | ${md(`${alignment.sourceAnswerKey} / ${alignment.sourceCorrectText}`)} | ${md(`${alignment.masterAnswerKey} / ${alignment.masterCorrectText}`)} | ${md(`${alignment.selectedLocaleAnswerKey} / ${alignment.selectedLocaleCorrectText}`)} | ${md(`${alignment.sourceMasterMeaning?.method ?? ""} ${alignment.sourceMasterMeaning?.score ?? ""}`)} |`);
    }
  }
  lines.push("");

  lines.push("## Manually Confirmed Duplicate-label Answers");
  lines.push("");
  if (report.manuallyConfirmedDuplicateLabelAnswers.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| item | action | selected | detected labels | validation |");
    lines.push("|---|---|---|---|---|");
    for (const item of report.manuallyConfirmedDuplicateLabelAnswers) {
      const alignment = item.answerKeyAlignment;
      lines.push(`| ${md(item.id)} | ${md(item.finalDecision)} | ${md(alignment.selectedLocaleAnswerKey)} | ${md(alignment.detectedSourceLabels.join(", "))} | ${md([...item.validationErrors, ...item.validationWarnings].join("; "))} |`);
    }
  }
  lines.push("");

  lines.push("## Corrupted Source Labels Requiring Manual Confirmation");
  lines.push("");
  if (report.corruptedSourceLabelItems.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| item | selected | manual confirmation | detected labels | duplicate | missing | validation |");
    lines.push("|---|---|---|---|---|---|---|");
    for (const item of report.corruptedSourceLabelItems) {
      const alignment = item.answerKeyAlignment;
      lines.push(`| ${md(item.id)} | ${md(alignment.selectedLocaleAnswerKey)} | ${item.confirmAmbiguousDuplicateLabel === true ? "yes" : "no"} | ${md(alignment.detectedSourceLabels.join(", "))} | ${md(alignment.duplicateSourceLabels.join(", "))} | ${md(alignment.missingSourceLabels.join(", "))} | ${md([...item.validationErrors, ...item.validationWarnings].join("; "))} |`);
    }
  }
  lines.push("");

  lines.push("## Missing Production QIDs");
  lines.push("");
  if (report.missingProductionQidMergeNeeded.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| batch | qid | answer | source preview | status |");
    lines.push("|---|---|---|---|---|");
    for (const item of report.missingProductionQidMergeNeeded) {
      lines.push(`| ${md(item.batch)} | ${md(item.approvedQid)} | ${md(item.localeAnswerKey)} | ${md(item.missingProductionMerge.sourcePreviewPath ?? "")} | ${md(item.missingProductionMerge.reason)} |`);
    }
  }
  lines.push("");

  lines.push("## Skipped Items");
  lines.push("");
  if (report.skippedItems.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| item | action | reason |");
    lines.push("|---|---|---|");
    for (const item of report.skippedItems) {
      lines.push(`| ${md(item.id)} | ${md(item.finalDecision)} | ${md(item.skipReasons.join("; "))} |`);
    }
  }
  lines.push("");

  lines.push("## Risky Or Ambiguous Items");
  lines.push("");
  if (report.riskyOrAmbiguousItems.length === 0) {
    lines.push("- None");
  } else {
    lines.push("| item | action | risk/recommendation |");
    lines.push("|---|---|---|");
    for (const item of report.riskyOrAmbiguousItems) {
      lines.push(`| ${md(item.id)} | ${md(item.finalDecision)} | ${md([item.aiReview?.riskLevel, item.aiReview?.recommendation].filter(Boolean).join(" / "))} |`);
    }
  }
  lines.push("");

  lines.push("## Apply Result");
  lines.push("");
  lines.push(`- Anything applied: ${report.applyResult.applied ? "yes" : "no"}`);
  lines.push(`- Files changed: ${report.applyResult.filesChanged.length}`);
  for (const filePath of report.applyResult.filesChanged) lines.push(`  - \`${filePath}\``);
  if (report.applyResult.backups.length > 0) {
    lines.push("- Backups:");
    for (const backup of report.applyResult.backups) lines.push(`  - \`${backup.source}\` -> \`${backup.backup}\``);
  }
  lines.push(`- Note: ${report.applyResult.note}`);
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function optionLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((option, index) => {
    if (typeof option === "string") {
      const match = option.match(/^\s*([A-DА-ГВ])[\).]?\s*(.+)$/iu);
      const rawLabel = match ? match[1].trim() : optionLabel(index);
      const normalizedLabel = normalizeOptionKey(rawLabel) || optionLabel(index);
      return {
        rawLabel,
        normalizedLabel,
        key: normalizedLabel,
        text: match ? match[2].trim() : normalizeText(option),
      };
    }
    const rawLabel = normalizeText(option?.rawLabel ?? option?.originalKey ?? option?.key ?? option?.id ?? option?.label) || optionLabel(index);
    const normalizedLabel = normalizeOptionKey(rawLabel) || optionLabel(index);
    return {
      rawLabel,
      normalizedLabel,
      key: normalizedLabel,
      id: normalizeText(option?.id),
      text: normalizeText(option?.text ?? option?.translatedText ?? option?.label),
    };
  });
}

function normalizeOptionKey(value) {
  const key = normalizeText(value).toUpperCase();
  if (!key) return "";
  if (key === "А") return "A";
  if (key === "В") return "B";
  if (key === "С") return "C";
  if (key === "Д") return "D";
  return MCQ_KEYS.has(key) ? key : "";
}

function normalizedOptionText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function tokenizeOptionText(value) {
  return normalizedOptionText(value)
    .split(/\s+/u)
    .filter((token) => token.length > 1 && !["a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "the", "to", "with"].includes(token));
}

function optionMeaningSimilarity(a, b) {
  const left = normalizedOptionText(a);
  const right = normalizedOptionText(b);
  if (!left || !right) return { score: 0, method: "missing", matches: false };
  if (left === right) return { score: 1, method: "exact", matches: true };
  if (left.includes(right) || right.includes(left)) return { score: 0.92, method: "containment", matches: true };
  const leftTokens = new Set(tokenizeOptionText(left));
  const rightTokens = new Set(tokenizeOptionText(right));
  if (!leftTokens.size || !rightTokens.size) return { score: 0, method: "no-keywords", matches: false };
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  const score = overlap / Math.min(leftTokens.size, rightTokens.size);
  return { score: Number(score.toFixed(4)), method: "keyword-overlap", matches: score >= 0.5 };
}

function normalizeRowAnswerKeyFromOptionText(value) {
  const normalized = normalizedOptionText(value);
  if (!normalized) return null;
  if (
    normalized.includes("incorrect")
    || normalized.includes("wrong")
    || normalized.includes("false")
    || normalized.includes("не правильно")
    || normalized.includes("неправильно")
  ) {
    return "Wrong";
  }
  if (
    normalized.includes("correct")
    || normalized.includes("right")
    || normalized.includes("true")
    || normalized.includes("правильно")
  ) {
    return "Right";
  }
  return null;
}

function rowAnswerKeyFromText(value) {
  return normalizeRowAnswerKeyFromOptionText(value) || "";
}

function parseSourceOptionRecords(options, expectedLabels) {
  const normalized = normalizeOptions(options);
  const labels = normalized.map((option) => normalizeOptionKey(option.normalizedLabel || option.key || option.rawLabel));
  const counts = new Map();
  for (const label of labels.filter(Boolean)) counts.set(label, (counts.get(label) || 0) + 1);
  const missingExpectedLabels = expectedLabels.filter((label) => !counts.has(label));
  const duplicateLabels = [...counts.entries()].filter(([, count]) => count > 1).map(([label]) => label);
  const records = normalized.map((option, index) => {
    const normalizedLabel = normalizeOptionKey(option.normalizedLabel || option.key || option.rawLabel) || optionLabel(index);
    return {
      rawLabel: normalizeText(option.rawLabel || option.key || option.label) || optionLabel(index),
      normalizedLabel,
      key: normalizedLabel,
      text: normalizeText(option.text),
      index,
      rowAnswerKey: rowAnswerKeyFromText(option.text),
      isDuplicateLabel: duplicateLabels.includes(normalizedLabel),
      isMissingExpectedLabel: false,
    };
  });
  return {
    records,
    detectedLabels: labels.filter(Boolean),
    expectedLabels,
    duplicateLabels,
    missingExpectedLabels,
    hasDuplicateLabels: duplicateLabels.length > 0,
    hasMissingLabels: missingExpectedLabels.length > 0,
  };
}

function sourceQuestionType(sourceOptions, sourceOptionsEnglish, masterQuestion) {
  if (masterQuestion && normalizeQuestionType(masterQuestion.type) === "ROW") return "ROW";
  const displayOptions = sourceOptionsEnglish.length ? sourceOptionsEnglish : sourceOptions;
  if (displayOptions.length === 2 && displayOptions.every((option) => rowAnswerKeyFromText(option.text))) return "ROW";
  if (sourceOptions.length === 2 && sourceOptions.every((option) => rowAnswerKeyFromText(option.text))) return "ROW";
  return "MCQ";
}

function resolveOptionRecordByKey(records, key, sourceType) {
  const normalizedKey = normalizeAnswerKey(key);
  if (!normalizedKey) return null;
  if (sourceType === "ROW" && ROW_KEYS.has(normalizedKey)) {
    const matches = records.filter((record) => record.rowAnswerKey === normalizedKey);
    return matches.length === 1 ? matches[0] : null;
  }
  const matches = records.filter((record) => record.normalizedLabel === normalizedKey);
  return matches.length === 1 ? matches[0] : null;
}

function resolveOptionTextByKey(key, primaryRecords, fallbackRecords, sourceType) {
  const primary = resolveOptionRecordByKey(primaryRecords, key, sourceType);
  if (primary?.text) return primary.text;
  const fallback = resolveOptionRecordByKey(fallbackRecords, key, sourceType);
  return fallback?.text || "";
}

function normalizeAnswerForSourceType(key, sourceType, primaryRecords, fallbackRecords) {
  const normalizedKey = normalizeAnswerKey(key);
  if (sourceType !== "ROW") return normalizedKey;
  if (ROW_KEYS.has(normalizedKey)) return normalizedKey;
  const record = resolveOptionRecordByKey(primaryRecords, normalizedKey, "MCQ")
    || resolveOptionRecordByKey(fallbackRecords, normalizedKey, "MCQ");
  return record?.rowAnswerKey || normalizedKey;
}

function masterAnswerKey(question) {
  if (!question) return "";
  const raw = normalizeAnswerKey(question.answerRaw);
  if (raw) return raw;
  const row = normalizeAnswerKey(question.correctRow);
  if (row) return row;
  const optionId = normalizeText(question.correctOptionId);
  const options = normalizeOptions(question.options);
  if (optionId && options.length) {
    const match = options.find((option) => option.id === optionId || option.key === optionId);
    if (match) return normalizeAnswerKey(match.key);
    const ordinal = optionId.match(/_o([1-4])$/u);
    if (ordinal) return String.fromCharCode(64 + Number(ordinal[1]));
  }
  return "";
}

function masterCorrectOptionText(question, answerKey) {
  if (!question || !answerKey) return "";
  if (normalizeQuestionType(question.type) === "ROW") return answerKey;
  const match = normalizeOptions(question.options).find((option) => normalizeAnswerKey(option.key || option.id) === answerKey);
  return normalizeText(match?.text);
}

function optionKeyExistsInSource(key, sourceType, displayRecords, rawRecords) {
  return Boolean(
    resolveOptionRecordByKey(displayRecords, key, sourceType)
    || resolveOptionRecordByKey(rawRecords, key, sourceType)
  );
}

function optionKeyIsAmbiguous(key, sourceType, records) {
  const normalizedKey = normalizeAnswerKey(key);
  if (!normalizedKey) return false;
  if (sourceType === "ROW" && ROW_KEYS.has(normalizedKey)) {
    return records.filter((record) => record.rowAnswerKey === normalizedKey).length > 1;
  }
  return records.filter((record) => record.normalizedLabel === normalizedKey).length > 1;
}

function buildAnswerKeyAlignment({ reviewItem, masterQuestion, selectedLocaleAnswerKey }) {
  const sourceOptions = normalizeOptions(reviewItem?.sourceOptions ?? []);
  const sourceOptionsEnglish = normalizeOptions(reviewItem?.sourceOptionsEnglish ?? []);
  const sourceType = sourceQuestionType(sourceOptions, sourceOptionsEnglish, masterQuestion);
  const expectedLabels = sourceType === "ROW" ? ROW_SOURCE_LABELS : MCQ_OPTION_LABELS;
  const displaySourceOptions = sourceOptionsEnglish.length ? sourceOptionsEnglish : sourceOptions;
  const displayParsed = parseSourceOptionRecords(displaySourceOptions, expectedLabels);
  const rawParsed = parseSourceOptionRecords(sourceOptions, expectedLabels);
  const displayRecords = displayParsed.records;
  const rawRecords = rawParsed.records;
  const sourceRawAnswerKey = normalizeAnswerKey(reviewItem?.sourceAnswerKey);
  const selectedRawLocaleAnswerKey = normalizeAnswerKey(selectedLocaleAnswerKey);
  const sourceAnswerKey = normalizeAnswerForSourceType(sourceRawAnswerKey, sourceType, displayRecords, rawRecords);
  const selectedKey = normalizeAnswerForSourceType(selectedRawLocaleAnswerKey, sourceType, displayRecords, rawRecords);
  const masterKey = masterAnswerKey(masterQuestion);
  const sourceCorrectText = resolveOptionTextByKey(sourceAnswerKey, displayRecords, rawRecords, sourceType);
  const selectedLocaleCorrectText = resolveOptionTextByKey(selectedKey, displayRecords, rawRecords, sourceType);
  const masterCorrectText = masterCorrectOptionText(masterQuestion, masterKey);
  const sourceMasterMeaning = optionMeaningSimilarity(sourceCorrectText, masterCorrectText);
  const selectedMasterMeaning = optionMeaningSimilarity(selectedLocaleCorrectText, masterCorrectText);
  const hasLetterMismatch = Boolean(sourceAnswerKey && masterKey && sourceAnswerKey !== masterKey);
  const sourceWasAutoNormalized = sourceType === "ROW"
    && Boolean(sourceRawAnswerKey)
    && ROW_KEYS.has(sourceAnswerKey)
    && sourceRawAnswerKey !== sourceAnswerKey;
  const selectedWasAutoNormalized = sourceType === "ROW"
    && Boolean(selectedRawLocaleAnswerKey)
    && ROW_KEYS.has(selectedKey)
    && selectedRawLocaleAnswerKey !== selectedKey;
  const selectedExistsInSource = !selectedKey || selectedKey === UNKNOWN_KEY
    ? false
    : optionKeyExistsInSource(selectedKey, sourceType, displayRecords, rawRecords);
  const selectedIsAmbiguous = optionKeyIsAmbiguous(selectedKey, sourceType, displayRecords)
    || optionKeyIsAmbiguous(selectedKey, sourceType, rawRecords);
  const hasDuplicateSourceLabels = displayParsed.hasDuplicateLabels || rawParsed.hasDuplicateLabels;
  const hasMissingSourceLabels = displayParsed.hasMissingLabels || rawParsed.hasMissingLabels;
  const warnings = [];
  if (hasLetterMismatch) warnings.push("Letter mismatch detected. Choose the source/local meaning, not the master letter.");
  if (selectedWasAutoNormalized || sourceWasAutoNormalized) {
    warnings.push(`Auto-normalized ROW answer: source selected key ${selectedRawLocaleAnswerKey || sourceRawAnswerKey || "unknown"} maps to exported locale key ${selectedKey || sourceAnswerKey || "unknown"}.`);
  }
  if (hasDuplicateSourceLabels) warnings.push("Corrupted source option labels detected.");
  if (hasMissingSourceLabels) warnings.push(`Source option labels are incomplete. Detected labels: ${displayParsed.detectedLabels.join(", ") || "none"}.`);
  if (selectedKey && selectedKey !== UNKNOWN_KEY && !selectedExistsInSource) warnings.push(`Selected locale answer ${selectedKey} was not found in source options.`);
  if (selectedIsAmbiguous) warnings.push(`Selected locale answer ${selectedKey} is ambiguous because that source label appears more than once.`);
  return {
    sourceQuestionType: sourceType,
    sourceRawAnswerKey,
    sourceAnswerKey,
    sourceCorrectText,
    masterQuestionType: masterQuestion ? normalizeQuestionType(masterQuestion.type) : "",
    masterAnswerKey: masterKey,
    masterCorrectText,
    selectedRawLocaleAnswerKey,
    selectedLocaleAnswerKey: selectedKey,
    selectedLocaleCorrectText,
    sourceWasAutoNormalized,
    selectedWasAutoNormalized,
    autoNormalizedRowAnswer: sourceWasAutoNormalized || selectedWasAutoNormalized,
    hasLetterMismatch,
    hasDuplicateSourceLabels,
    hasMissingSourceLabels,
    selectedExistsInSource,
    selectedIsAmbiguous,
    recommendedLocaleAnswerKey: sourceAnswerKey || selectedKey || masterKey,
    warningLevel: selectedIsAmbiguous || (selectedKey && selectedKey !== UNKNOWN_KEY && !selectedExistsInSource) || hasDuplicateSourceLabels || hasMissingSourceLabels ? "high" : (hasLetterMismatch ? "medium" : "low"),
    sourceMasterMeaning,
    selectedMasterMeaning,
    sourceOptionRecords: displayRecords,
    rawSourceOptionRecords: rawRecords,
    expectedSourceLabels: expectedLabels,
    detectedSourceLabels: displayParsed.detectedLabels,
    duplicateSourceLabels: uniqueStrings([...displayParsed.duplicateLabels, ...rawParsed.duplicateLabels]),
    missingSourceLabels: uniqueStrings([...displayParsed.missingExpectedLabels, ...rawParsed.missingExpectedLabels]),
    warnings,
  };
}

function normalizeFinalDecision(value) {
  const raw = String(value ?? "").trim();
  if (raw === "create-new" || raw === "createNewQuestion") return "new";
  if (raw === "keep-unresolved" || raw === "keepUnresolved") return "unresolved";
  if (raw === "deleteQuestion") return "delete";
  if (raw === "approve-existing-qid") return "approve";
  if (raw === "ignoreReconciliation") return "ignore";
  return raw;
}

function normalizeBatch(value) {
  const text = normalizeText(value);
  return /^batch-\d+$/u.test(text) ? text : "";
}

function normalizeQid(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^q?(\d{1,4})$/iu);
  if (!match) return "";
  return `q${match[1].padStart(4, "0")}`;
}

function normalizeAnswerKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (MCQ_KEYS.has(upper)) return upper;
  if (["R", "RIGHT", "TRUE", "CORRECT"].includes(upper)) return "Right";
  if (["W", "WRONG", "FALSE", "INCORRECT"].includes(upper)) return "Wrong";
  if (upper === UNKNOWN_KEY) return UNKNOWN_KEY;
  return raw;
}

function normalizeQuestionType(value) {
  const raw = String(value ?? "").trim().toUpperCase();
  return raw === "ROW" ? "ROW" : "MCQ";
}

function isKnownAnswerKey(value) {
  return MCQ_KEYS.has(value) || ROW_KEYS.has(value);
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/gu, " ").trim();
}

function extractQuestionList(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function countStrings(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

function uniqueStrings(values) {
  return [...new Set(values.map(normalizeText).filter(Boolean))];
}

function actionSignature(item) {
  return JSON.stringify({
    finalDecision: item.finalDecision,
    approvedQid: item.approvedQid,
    localeAnswerKey: item.localeAnswerKey,
    createNewQuestion: item.createNewQuestion,
    keepUnresolved: item.keepUnresolved,
    deleteQuestion: item.deleteQuestion,
    ignoreReconciliation: item.ignoreReconciliation,
  });
}

function safeTimestamp(value) {
  return String(value).replace(/[^0-9A-Za-z-]/gu, "-");
}

function md(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\r?\n/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function rel(targetPath) {
  return path.relative(ROOT, targetPath);
}
