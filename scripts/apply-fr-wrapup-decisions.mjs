#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  IMPORTS_DIR,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  fileExists,
  getDatasetPaths,
  loadQbankContext,
  parseArgs,
  readJson,
  stableNow,
  textSimilarity,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";

const LANG = "fr";
const WRAPUP_BATCH_ID = "wrapup";
const VALID_DECISIONS = new Set([
  "approveExistingQid",
  "createNewQuestion",
  "keepUnresolved",
  "deleteQuestion",
]);
const VALID_LOCAL_KEYS = new Set(["A", "B", "C", "D", "UNKNOWN", null]);

const args = parseArgs();
const apply = String(args.apply ?? "false").trim().toLowerCase() === "true";
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const generatedAt = stableNow();

const decisionsPath = path.join(STAGING_DIR, "fr-wrapup-workbench-decisions.json");
const artifactPath = path.join(REPORTS_DIR, "fr-wrapup-workbench.json");
const canonicalReportJsonPath = path.join(REPORTS_DIR, "fr-wrapup-apply-report.json");
const canonicalReportMdPath = path.join(REPORTS_DIR, "fr-wrapup-apply-report.md");
const dryRunReportJsonPath = path.join(REPORTS_DIR, "fr-wrapup-apply-report.dry-run.json");
const dryRunReportMdPath = path.join(REPORTS_DIR, "fr-wrapup-apply-report.dry-run.md");
const wrapupExistingPreviewPath = path.join(STAGING_DIR, "translations.fr.wrapup.preview.json");
const wrapupNewQuestionCandidatesPath = path.join(STAGING_DIR, "fr-wrapup-new-question-candidates.json");
const wrapupNewQuestionDecisionsPath = path.join(STAGING_DIR, "fr-wrapup-new-question-decisions.json");
const wrapupUnresolvedPath = path.join(STAGING_DIR, "fr-wrapup-unresolved-decisions.json");
const wrapupDeletedPath = path.join(STAGING_DIR, "fr-wrapup-delete-decisions.json");

const datasetPaths = getDatasetPaths(dataset, "ko");
const translationsPath = path.join(ROOT, "public", "qbank", dataset, "translations.fr.json");
const protectedPaths = [
  datasetPaths.questionsPath,
  datasetPaths.rawQuestionsPath,
  path.join(ROOT, "public", "qbank", dataset, "image-color-tags.json"),
  datasetPaths.tagsPatchPath,
].filter((filePath) => fileExists(filePath));

const protectedHashesBefore = hashFiles(protectedPaths);
const translationsHashBefore = fileExists(translationsPath) ? hashFile(translationsPath) : null;

if (!fileExists(decisionsPath)) {
  throw new Error(`Wrap-up decisions file not found: ${rel(decisionsPath)}`);
}
if (!fileExists(artifactPath)) {
  throw new Error(`Wrap-up workbench artifact not found: ${rel(artifactPath)}`);
}

const decisionsDoc = readJson(decisionsPath);
const artifactDoc = readJson(artifactPath);
const context = loadQbankContext({ dataset, referenceLang: "ko" });
const questionMap = new Map(context.questions.map((question) => [question.qid, question]));
const existingTranslationsDoc = fileExists(translationsPath)
  ? readJson(translationsPath)
  : { meta: { locale: LANG }, questions: {} };

validateTopLevelDocs(decisionsDoc, artifactDoc);

const artifactItems = Array.isArray(artifactDoc.items) ? artifactDoc.items : [];
const artifactMap = new Map(artifactItems.map((item) => [String(item?.id ?? item?.itemId ?? "").trim(), item]));
const sourceMap = buildFrenchSourceMap();
const existingTranslationCountBefore = Object.keys(existingTranslationsDoc.questions ?? {}).length;

const counts = {
  totalReviewedItems: 0,
  appliedApproveExistingQid: 0,
  stagedCreateNewQuestion: 0,
  keptUnresolved: 0,
  deleteQuestion: 0,
  skippedInvalid: 0,
  skippedUnreviewed: 0,
};
const warnings = [];
const invalidItems = [];
const skippedItems = [];
const affectedQids = [];
const overlappingProductionQids = [];
const newQuestionCandidates = [];
const unresolvedItems = [];
const deletedItems = [];
const perBatchUpdates = new Map();
const approvedPreviewQuestions = {};
const appliedItemSummaries = [];
let newQuestionOrdinal = 1;

const decisionItems = Array.isArray(decisionsDoc.items) ? decisionsDoc.items : [];
for (const rawItem of decisionItems) {
  const normalized = normalizeWrapupDecision(rawItem);
  const validation = validateItem(normalized, rawItem);
  if (!validation.ok) {
    counts.skippedInvalid += 1;
    invalidItems.push({
      itemId: normalized.itemId,
      sourceBatch: normalized.sourceBatch,
      decision: normalized.decision,
      reasons: validation.errors,
    });
    continue;
  }

  if (normalized.reviewed !== true) {
    counts.skippedUnreviewed += 1;
    skippedItems.push({
      itemId: normalized.itemId,
      sourceBatch: normalized.sourceBatch,
      decision: normalized.decision,
      reason: "Item is not marked reviewed in fr-wrapup-workbench-decisions.json.",
    });
    continue;
  }

  counts.totalReviewedItems += 1;
  const artifactItem = artifactMap.get(normalized.itemId);
  const sourceItem = resolveSourceItem(normalized, artifactItem);
  const baseSummary = {
    itemId: normalized.itemId,
    sourceBatch: normalized.sourceBatch,
    sourceId: normalized.sourceId,
    sourceScreenshot: normalized.sourceScreenshot,
    decision: normalized.decision,
    approvedQid: normalized.approvedQid,
    localAnswerKey: normalized.localAnswerKey,
  };

  if (normalized.decision === "approveExistingQid") {
    const question = questionMap.get(normalized.approvedQid);
    if (!question) {
      counts.skippedInvalid += 1;
      invalidItems.push({
        ...baseSummary,
        reasons: [`Approved qid ${normalized.approvedQid} was not found in ${dataset}.`],
      });
      continue;
    }

    const previewResult = buildApprovedPreviewEntry({
      sourceItem,
      decision: {
        confirmedCorrectOptionKey: normalizeChoiceKey(normalized.localAnswerKey),
        reviewerNotes: normalized.reviewerNotes,
        answerKeyUnknown: normalized.localAnswerKey === "UNKNOWN",
      },
      question,
      lang: LANG,
      batchId: normalized.sourceBatch ?? WRAPUP_BATCH_ID,
    });

    if (previewResult.validationErrors.length > 0) {
      counts.skippedInvalid += 1;
      invalidItems.push({
        ...baseSummary,
        reasons: previewResult.validationErrors,
      });
      continue;
    }

    approvedPreviewQuestions[question.qid] = previewResult.previewEntry;
    affectedQids.push(question.qid);
    if (existingTranslationsDoc.questions?.[question.qid]) {
      overlappingProductionQids.push(question.qid);
    }
    counts.appliedApproveExistingQid += 1;
    queuePerBatchUpdate(normalized);
    appliedItemSummaries.push({
      ...baseSummary,
      status: apply ? "applied-to-existing-qid" : "would-apply-to-existing-qid",
      localeCorrectOptionKey: previewResult.previewEntry.localeCorrectOptionKey ?? null,
    });
    continue;
  }

  if (normalized.decision === "createNewQuestion") {
    const candidate = buildNewQuestionCandidate({
      item: sourceItem,
      decision: normalized,
      ordinal: newQuestionOrdinal,
    });
    newQuestionOrdinal += 1;
    newQuestionCandidates.push(candidate);
    counts.stagedCreateNewQuestion += 1;
    queuePerBatchUpdate(normalized);
    appliedItemSummaries.push({
      ...baseSummary,
      candidateId: candidate.candidateId,
      status: apply ? "staged-new-question-candidate" : "would-stage-new-question-candidate",
    });
    continue;
  }

  if (normalized.decision === "keepUnresolved") {
    unresolvedItems.push(buildFollowUpItem(sourceItem, normalized, {
      status: "keep-unresolved",
      reason: normalized.explanation || normalized.reviewerNotes || "Reviewer kept this item unresolved.",
    }));
    counts.keptUnresolved += 1;
    queuePerBatchUpdate(normalized);
    appliedItemSummaries.push({
      ...baseSummary,
      status: apply ? "kept-unresolved" : "would-keep-unresolved",
    });
    continue;
  }

  if (normalized.decision === "deleteQuestion") {
    deletedItems.push(buildFollowUpItem(sourceItem, normalized, {
      status: "delete-question",
      reason: normalized.explanation || normalized.reviewerNotes || "Reviewer marked this source item for deletion/ignore.",
    }));
    counts.deleteQuestion += 1;
    queuePerBatchUpdate(normalized);
    appliedItemSummaries.push({
      ...baseSummary,
      status: apply ? "marked-delete-in-staging" : "would-mark-delete-in-staging",
    });
  }
}

const uniqueAffectedQids = [...new Set(affectedQids)].sort();
const duplicateApprovedQids = findDuplicates(affectedQids);
if (duplicateApprovedQids.length > 0) {
  warnings.push(
    `Multiple wrap-up items target the same approved qid(s): ${duplicateApprovedQids.join(", ")}. Last sanitized entry would win in translations.fr.json.`
  );
}

const previewDoc = {
  meta: {
    locale: LANG,
    generatedAt,
    reviewedBatchId: WRAPUP_BATCH_ID,
    dataset,
    sourceReviewDecisionsPath: rel(decisionsPath),
    approvedCount: counts.appliedApproveExistingQid,
    createNewQuestionCount: counts.stagedCreateNewQuestion,
    keepUnresolvedCount: counts.keptUnresolved,
    deleteQuestionCount: counts.deleteQuestion,
    skippedInvalidCount: counts.skippedInvalid,
    skippedUnreviewedCount: counts.skippedUnreviewed,
    stagingOnly: true,
    answerKeyPolicy: "Reviewed wrap-up local answer keys are preserved independently from canonical English option letters.",
  },
  questions: approvedPreviewQuestions,
};

const newQuestionCandidatesDoc = {
  generatedAt,
  lang: LANG,
  dataset,
  sourceDecisionPath: rel(decisionsPath),
  items: newQuestionCandidates,
};

const newQuestionDecisionsDoc = {
  generatedAt,
  lang: LANG,
  dataset,
  sourceDecisionPath: rel(decisionsPath),
  items: newQuestionCandidates.map((candidate) => ({
    candidateId: candidate.candidateId,
    sourceBatch: candidate.sourceBatch,
    sourceImage: candidate.sourceImage,
    sourceItemId: candidate.sourceItemId,
    newQuestionLocalAnswerKey: candidate.newQuestionLocalAnswerKey,
    provisionalTopic: candidate.provisionalTopic,
    provisionalSubtopics: candidate.provisionalSubtopics,
    reviewerNotes: candidate.reviewerNotes,
    status: candidate.status,
  })),
};

const unresolvedDoc = {
  generatedAt,
  lang: LANG,
  dataset,
  sourceDecisionPath: rel(decisionsPath),
  items: unresolvedItems,
};

const deletedDoc = {
  generatedAt,
  lang: LANG,
  dataset,
  sourceDecisionPath: rel(decisionsPath),
  items: deletedItems,
};

const productionMerge = buildProductionMergeDoc({
  previewQuestions: approvedPreviewQuestions,
  existingTranslationsDoc,
  qidsToMerge: uniqueAffectedQids,
});

const filesChanged = [];
const filesWouldChange = [
  rel(canonicalReportJsonPath),
  rel(canonicalReportMdPath),
  rel(wrapupExistingPreviewPath),
  rel(wrapupNewQuestionCandidatesPath),
  rel(wrapupNewQuestionDecisionsPath),
  rel(wrapupUnresolvedPath),
  rel(wrapupDeletedPath),
  rel(translationsPath),
  ...[...perBatchUpdates.keys()].map((batchId) => rel(batchDecisionPath(batchId))),
].sort();

if (apply) {
  await writeJson(wrapupExistingPreviewPath, previewDoc);
  await writeJson(wrapupNewQuestionCandidatesPath, newQuestionCandidatesDoc);
  await writeJson(wrapupNewQuestionDecisionsPath, newQuestionDecisionsDoc);
  await writeJson(wrapupUnresolvedPath, unresolvedDoc);
  await writeJson(wrapupDeletedPath, deletedDoc);
  filesChanged.push(
    rel(wrapupExistingPreviewPath),
    rel(wrapupNewQuestionCandidatesPath),
    rel(wrapupNewQuestionDecisionsPath),
    rel(wrapupUnresolvedPath),
    rel(wrapupDeletedPath),
  );

  for (const [batchId, updates] of perBatchUpdates.entries()) {
    const result = await applyPerBatchDecisionUpdates(batchId, updates);
    filesChanged.push(...result.filesChanged);
    warnings.push(...result.warnings);
  }

  if (productionMerge.blockers.length > 0) {
    warnings.push(
      `Skipped translations.fr.json write because production merge blockers remain: ${productionMerge.blockers.join("; ")}`
    );
  } else {
    await writeJson(translationsPath, productionMerge.nextDoc);
    filesChanged.push(rel(translationsPath));
  }

  filesChanged.push(rel(canonicalReportJsonPath), rel(canonicalReportMdPath));
}

const protectedHashesAfter = hashFiles(protectedPaths);
const protectedFilesUnchanged = compareHashes(protectedHashesBefore, protectedHashesAfter);
if (!protectedFilesUnchanged) {
  throw new Error("Protected qbank master files changed unexpectedly during wrap-up application.");
}

const translationsHashAfter = fileExists(translationsPath) ? hashFile(translationsPath) : null;
const translationsChanged = translationsHashBefore !== translationsHashAfter;
const existingTranslationCountAfter = Object.keys(productionMerge.nextDoc.questions ?? {}).length;

const report = {
  generatedAt,
  mode: apply ? "apply" : "dry-run",
  applied: apply,
  lang: LANG,
  dataset,
  sourceDecisionPath: rel(decisionsPath),
  sourceWorkbenchArtifactPath: rel(artifactPath),
  reports: {
    canonicalJson: rel(canonicalReportJsonPath),
    canonicalMd: rel(canonicalReportMdPath),
    dryRunJson: rel(dryRunReportJsonPath),
    dryRunMd: rel(dryRunReportMdPath),
  },
  counts,
  sourceItemCount: decisionItems.length,
  qidsAffected: uniqueAffectedQids,
  overlappingProductionQids: [...new Set(overlappingProductionQids)].sort(),
  newQuestionCandidateIds: newQuestionCandidates.map((item) => item.candidateId),
  unresolvedIds: unresolvedItems.map((item) => item.itemId),
  deleteQuestionIds: deletedItems.map((item) => item.itemId),
  invalidItems,
  skippedItems,
  warnings,
  productionMerge: {
    previewPath: rel(wrapupExistingPreviewPath),
    translationsPath: rel(translationsPath),
    qidCount: uniqueAffectedQids.length,
    blockers: productionMerge.blockers,
    validations: productionMerge.validations,
  },
  frenchCoverage: {
    before: existingTranslationCountBefore,
    after: existingTranslationCountAfter,
    delta: existingTranslationCountAfter - existingTranslationCountBefore,
  },
  filesChanged: apply ? [...new Set(filesChanged)].sort() : [],
  filesWouldChange,
  translationsFrChanged: translationsChanged,
  protectedFilesUnchanged,
  protectedFiles: protectedPaths.map(rel),
  appliedItems: appliedItemSummaries,
};

const reportMd = buildReportMd(report);
if (apply) {
  await writeJson(canonicalReportJsonPath, report);
  await writeText(canonicalReportMdPath, reportMd);
} else {
  await writeJson(dryRunReportJsonPath, report);
  await writeText(dryRunReportMdPath, reportMd);
  await writeJson(canonicalReportJsonPath, report);
  await writeText(canonicalReportMdPath, reportMd);
}

console.log(
  [
    `${apply ? "Applied" : "Dry run"} French wrap-up decisions.`,
    `approveExistingQid=${counts.appliedApproveExistingQid}`,
    `createNewQuestion=${counts.stagedCreateNewQuestion}`,
    `keepUnresolved=${counts.keptUnresolved}`,
    `deleteQuestion=${counts.deleteQuestion}`,
    `skippedInvalid=${counts.skippedInvalid}`,
    `skippedUnreviewed=${counts.skippedUnreviewed}`,
    `translationsFrChanged=${translationsChanged ? "yes" : "no"}`,
    `coverage ${existingTranslationCountBefore} -> ${existingTranslationCountAfter}`,
  ].join(" "),
);

function validateTopLevelDocs(decisions, artifact) {
  const errors = [];
  if (Number(decisions?.schemaVersion) !== 1) errors.push("decisions schemaVersion must be 1.");
  if (String(decisions?.lang ?? "") !== LANG) errors.push(`decisions lang must be ${LANG}.`);
  if (!Array.isArray(decisions?.items)) errors.push("decisions items must be an array.");
  if (Number(artifact?.schemaVersion) !== 1) errors.push("wrapup artifact schemaVersion must be 1.");
  if (String(artifact?.lang ?? "") !== LANG) errors.push(`wrapup artifact lang must be ${LANG}.`);
  if (!Array.isArray(artifact?.items)) errors.push("wrapup artifact items must be an array.");
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

function normalizeWrapupDecision(item) {
  const localAnswerKey = normalizeLocalAnswerKey(item?.localAnswerKey);
  const sourceBatch = normalizeText(item?.sourceBatch);
  const sourceId = normalizeText(item?.sourceId);
  return {
    itemId: normalizeText(item?.itemId) ?? normalizeText(item?.id) ?? "",
    itemType: normalizeText(item?.itemType) ?? null,
    sourceBatch,
    sourceId,
    sourceScreenshot: normalizeText(item?.sourceScreenshot) ?? sourceId,
    decision: normalizeText(item?.decision),
    approvedQid: normalizeText(item?.approvedQid),
    localAnswerKey,
    topic: normalizeText(item?.topic) ?? null,
    subtopics: Array.isArray(item?.subtopics)
      ? item.subtopics.map(normalizeText).filter(Boolean)
      : [],
    reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
    explanation: normalizeText(item?.explanation) ?? "",
    reviewed: item?.reviewed === true,
    reviewedAt: normalizeText(item?.reviewedAt) ?? null,
  };
}

function validateItem(item) {
  const errors = [];
  if (!item.itemId) errors.push("itemId is required.");
  if (!artifactMap.has(item.itemId)) errors.push("item id does not exist in fr-wrapup-workbench.json.");
  if (!item.sourceBatch) errors.push("sourceBatch is required.");
  if (!VALID_DECISIONS.has(item.decision)) errors.push(`Invalid decision: ${item.decision ?? "(missing)"}.`);
  if (!VALID_LOCAL_KEYS.has(item.localAnswerKey)) errors.push(`Invalid localAnswerKey: ${item.localAnswerKey}.`);

  if (item.decision === "approveExistingQid") {
    if (!item.approvedQid) {
      errors.push("approveExistingQid requires approvedQid.");
    } else if (!questionMap.has(item.approvedQid)) {
      errors.push(`approvedQid ${item.approvedQid} was not found in the master question bank.`);
    } else {
      const question = questionMap.get(item.approvedQid);
      if (normalizeQuestionType(question.type) === "MCQ" && !normalizeChoiceKey(item.localAnswerKey)) {
        errors.push(`MCQ approveExistingQid ${item.approvedQid} requires localAnswerKey A/B/C/D.`);
      }
    }
  }

  if (item.decision === "createNewQuestion" && !normalizeChoiceKey(item.localAnswerKey)) {
    errors.push("createNewQuestion requires localAnswerKey A/B/C/D.");
  }

  return { ok: errors.length === 0, errors };
}

function buildFrenchSourceMap() {
  const map = new Map();
  const frImportsDir = path.join(IMPORTS_DIR, LANG);
  if (!fileExists(frImportsDir)) return map;

  for (const entry of fs.readdirSync(frImportsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^batch-\d+/i.test(entry.name)) continue;
    const batchId = entry.name;
    for (const fileName of ["review-needed.json", "unresolved.json", "matched.json", "intake.json"]) {
      const filePath = path.join(frImportsDir, batchId, fileName);
      if (!fileExists(filePath)) continue;
      const doc = readJson(filePath);
      const items = Array.isArray(doc?.items) ? doc.items : [];
      for (const item of items) {
        indexSourceItem(map, batchId, item);
      }
    }
  }

  return map;
}

function indexSourceItem(map, batchId, item) {
  const keys = [
    item?.itemId,
    item?.sourceImage,
    item?.sourceScreenshot,
    item?.id,
  ].map(normalizeText).filter(Boolean);
  for (const key of keys) {
    const compoundKey = sourceMapKey(batchId, key);
    if (!map.has(compoundKey) || sourceRichness(item) > sourceRichness(map.get(compoundKey))) {
      map.set(compoundKey, item);
    }
  }
}

function sourceRichness(item) {
  let score = 0;
  if (item?.promptRawJa || item?.localizedText?.prompt) score += 3;
  if (item?.promptGlossEn || item?.translatedText?.prompt) score += 2;
  if (sourceOptionsRaw(item).length > 0) score += 2;
  if (Array.isArray(item?.topCandidates) && item.topCandidates.length > 0) score += 1;
  if (item?.match?.qid) score += 1;
  return score;
}

function sourceMapKey(batchId, sourceId) {
  return `${batchId}::${sourceId}`;
}

function resolveSourceItem(decision, artifactItem) {
  const direct = sourceMap.get(sourceMapKey(decision.sourceBatch, decision.sourceId)) ??
    sourceMap.get(sourceMapKey(decision.sourceBatch, decision.sourceScreenshot));
  if (direct) return direct;

  warnings.push(`Source item ${decision.itemId} was reconstructed from wrap-up artifact because import source was not found.`);
  return {
    itemId: decision.sourceId ?? decision.itemId,
    sourceImage: decision.sourceScreenshot ?? decision.sourceId ?? null,
    promptRawJa: artifactItem?.sourcePrompt ?? null,
    promptGlossEn: artifactItem?.sourcePromptGloss ?? null,
    optionsRawJa: Array.isArray(artifactItem?.sourceOptions)
      ? artifactItem.sourceOptions.map((option) => joinChoice(option?.key, option?.text))
      : [],
    optionsGlossEn: Array.isArray(artifactItem?.sourceOptions)
      ? artifactItem.sourceOptions.map((option) => joinChoice(option?.key, option?.gloss))
      : [],
    correctKeyRaw: normalizeChoiceKey(decision.localAnswerKey),
    correctAnswerRaw: null,
    localizedText: {
      prompt: artifactItem?.sourcePrompt ?? null,
      options: Array.isArray(artifactItem?.sourceOptions)
        ? artifactItem.sourceOptions.map((option) => joinChoice(option?.key, option?.text))
        : [],
      explanation: null,
    },
    translatedText: {
      prompt: artifactItem?.sourcePromptGloss ?? null,
      options: Array.isArray(artifactItem?.sourceOptions)
        ? artifactItem.sourceOptions.map((option) => joinChoice(option?.key, option?.gloss))
        : [],
      correctAnswer: null,
    },
    provisionalTopic: decision.topic,
    provisionalSubtopics: decision.subtopics,
    topCandidates: Array.isArray(artifactItem?.candidates)
      ? artifactItem.candidates.map((candidate) => ({ qid: candidate.qid, number: candidate.number }))
      : [],
  };
}

function buildApprovedPreviewEntry({ sourceItem, decision, question, lang, batchId }) {
  const promptRawJa = sourceItem.promptRawJa ?? sourceItem.localizedText?.prompt ?? null;
  const promptGlossEn = sourceItem.promptGlossEn ?? sourceItem.translatedText?.prompt ?? null;
  const optionsRawJa = sourceOptionsRaw(sourceItem);
  const optionsGlossEn = sourceOptionsGloss(sourceItem);
  const explanation = normalizeText(sourceItem.localizedText?.explanation) ?? "";
  const validationErrors = [];
  const questionType = normalizeQuestionType(question.type);
  const previewEntry = {
    prompt: promptRawJa,
    explanation,
    sourceMode: "reviewed-fr-wrapup",
    confidence: "reviewed-approved",
    reviewStatus: "staged-preview",
    sourceImage: sourceItem.sourceImage ?? null,
    sourceItemId: sourceItem.itemId,
    reviewerNotes: decision.reviewerNotes,
    promptRawJa,
    promptGlossEn,
    correctKeyRaw: sourceItem.correctKeyRaw ?? null,
    correctAnswerRaw: sourceItem.correctAnswerRaw ?? null,
    canonicalQuestionType: questionType,
    stagingOnly: true,
    localeAnswerKeyPolicy: "Preserve reviewed French local answer key independently from canonical English option letters.",
    provenance: {
      sourceLang: lang,
      batchId,
      approvedQid: question.qid,
      source: "fr-wrapup-workbench",
    },
  };

  if (questionType !== "MCQ") {
    previewEntry.optionsRawJa = [];
    previewEntry.optionsGlossEn = [];
    previewEntry.localeCorrectOptionKey = null;
    previewEntry.canonicalCorrectRow = question.correctAnswer?.correctRow ?? null;
    previewEntry.canonicalCorrectAnswer = question.correctAnswer?.correctOptionText ?? null;
    previewEntry.answerKeyNeedsManualConfirmation = false;
    previewEntry.answerKeyConfirmationReason = "ROW question; no locale-specific option key applies.";
    return { previewEntry, validationErrors };
  }

  const reviewedKey = normalizeChoiceKey(decision.confirmedCorrectOptionKey);
  if (!reviewedKey) {
    validationErrors.push(`Reviewed local answer key is required for MCQ ${question.qid}.`);
    return { previewEntry, validationErrors };
  }

  const sourceOptions = buildSourceOptions(optionsRawJa, optionsGlossEn);
  const canonicalOptions = buildCanonicalOptions(question);
  const alignment = alignSourceOptions(sourceOptions, canonicalOptions);

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
  previewEntry.localeCorrectOptionKey = reviewedKey;
  previewEntry.canonicalCorrectOptionId = question.correctAnswer?.correctOptionId ?? null;
  previewEntry.canonicalCorrectOptionKey = question.correctAnswer?.correctOptionKey ?? null;
  previewEntry.answerKeyNeedsManualConfirmation = false;
  previewEntry.answerKeyConfirmationReason = "French local answer key confirmed in reviewed wrap-up decisions.";
  previewEntry.correctOptionAlignment = {
    sourceKey: reviewedKey,
    canonicalOptionId: previewEntry.canonicalCorrectOptionId,
    canonicalOptionKey: previewEntry.canonicalCorrectOptionKey,
    sourceText: null,
    sourceGlossEn: null,
    canonicalOptionText: question.correctAnswer?.correctOptionText ?? null,
    alignmentScore: null,
    method: "manual-answer-key-confirmed",
    manualAnswerKeyConfirmed: true,
  };

  const localeOptionEntry = findEntryByKey(previewEntry.localeOptionOrder, reviewedKey);
  const meaningEntry = findEntryByKey(previewEntry.optionMeaningMap, reviewedKey);
  if (!localeOptionEntry || !meaningEntry) {
    validationErrors.push(`Reviewed key ${reviewedKey} is not present in source options for ${question.qid}.`);
    return { previewEntry, validationErrors };
  }

  applyConfirmedMapping(previewEntry, {
    confirmedKey: reviewedKey,
    localeOptionEntry,
    meaningEntry,
  });

  return { previewEntry, validationErrors };
}

function buildProductionMergeDoc({ previewQuestions, existingTranslationsDoc, qidsToMerge }) {
  const nextQuestions = {
    ...(existingTranslationsDoc.questions ?? {}),
  };

  for (const qid of qidsToMerge) {
    if (!previewQuestions[qid]) continue;
    nextQuestions[qid] = sanitizeQuestionEntry(previewQuestions[qid]);
  }

  const nextDoc = {
    meta: {
      ...(existingTranslationsDoc.meta ?? {}),
      locale: LANG,
      translatedQuestions: Object.keys(nextQuestions).length,
      generatedAt,
      mergedBatches: Array.from(
        new Set([...(existingTranslationsDoc.meta?.mergedBatches ?? []), WRAPUP_BATCH_ID].map((value) => String(value)))
      ),
      localeAnswerKeySupport: true,
    },
    questions: nextQuestions,
  };

  const validations = qidsToMerge.map((qid) =>
    validateMergedQuestion({
      qid,
      mergedEntry: nextQuestions[qid],
      previewEntry: previewQuestions[qid],
      masterQuestion: questionMap.get(qid),
    })
  );
  const blockers = [];
  for (const validation of validations) {
    if (!validation.qidExists) blockers.push(`${validation.qid}: qid not found in master questions`);
    if (!validation.localeOptionOrderPreserved) blockers.push(`${validation.qid}: locale option order mismatch`);
    if (!validation.localeCorrectOptionKeyPresent) blockers.push(`${validation.qid}: locale correct option key missing`);
    if (!validation.localeCorrectOptionKeyMapped) blockers.push(`${validation.qid}: locale correct option key did not map through optionMeaningMap`);
  }

  return { nextDoc, validations, blockers };
}

function sanitizeQuestionEntry(question) {
  const canonicalType = normalizeQuestionType(question?.canonicalQuestionType);
  const output = {
    prompt: normalizeText(question?.prompt ?? question?.promptRawJa) ?? "",
    explanation: normalizeText(question?.explanation) ?? "",
    sourceMode: "direct",
    confidence: "high",
    reviewStatus: "ready",
  };

  if (canonicalType !== "MCQ") {
    return output;
  }

  const localeOptionOrder = Array.isArray(question?.localeOptionOrder)
    ? question.localeOptionOrder.map((entry) => cleanObject(sanitizeAlignmentEntry(entry)))
    : [];
  const optionMeaningMap = Array.isArray(question?.optionMeaningMap)
    ? question.optionMeaningMap.map((entry) => cleanObject(sanitizeAlignmentEntry(entry)))
    : [];

  const orderedOptions = {};
  for (const entry of localeOptionOrder) {
    const optionId = normalizeText(entry.canonicalOptionId);
    if (!optionId || optionId in orderedOptions) continue;
    const text = stripOptionKeyPrefix(entry.sourceTextBody ?? entry.sourceText ?? "", entry.sourceKey);
    if (text) orderedOptions[optionId] = text;
  }

  for (const [optionId, optionText] of Object.entries(question?.options ?? {})) {
    if (!(optionId in orderedOptions)) {
      orderedOptions[optionId] = stripOptionKeyPrefix(optionText, null);
    }
  }

  return cleanObject({
    ...output,
    options: Object.keys(orderedOptions).length > 0 ? orderedOptions : undefined,
    localeOptionOrder: localeOptionOrder.length > 0 ? localeOptionOrder : undefined,
    optionMeaningMap: optionMeaningMap.length > 0 ? optionMeaningMap : undefined,
    localeCorrectOptionKey: normalizeChoiceKey(question?.localeCorrectOptionKey),
  });
}

function sanitizeAlignmentEntry(entry) {
  const sourceKey = normalizeChoiceKey(entry?.sourceKey);
  return {
    sourceIndex: Number.isFinite(entry?.sourceIndex) ? Number(entry.sourceIndex) : undefined,
    sourceKey,
    sourceText: normalizeText(entry?.sourceText) ?? undefined,
    sourceTextBody: stripOptionKeyPrefix(entry?.sourceTextBody ?? entry?.sourceText ?? "", sourceKey) || undefined,
    sourceGlossEn: normalizeText(entry?.sourceGlossEn) ?? undefined,
    canonicalOptionId: normalizeText(entry?.canonicalOptionId) ?? undefined,
    canonicalOptionKey: normalizeChoiceKey(entry?.canonicalOptionKey) ?? undefined,
    canonicalOptionText: normalizeText(entry?.canonicalOptionText) ?? undefined,
    alignmentScore: Number.isFinite(entry?.alignmentScore) ? Number(entry.alignmentScore) : undefined,
    alignmentMethod: normalizeText(entry?.alignmentMethod) ?? undefined,
    manualAnswerKeyConfirmed: entry?.manualAnswerKeyConfirmed === true ? true : undefined,
    confirmedAsCorrectKey: entry?.confirmedAsCorrectKey === true ? true : undefined,
  };
}

function validateMergedQuestion({ qid, mergedEntry, previewEntry, masterQuestion }) {
  const canonicalType = normalizeQuestionType(masterQuestion?.type);
  const localeOptionOrder = Array.isArray(mergedEntry?.localeOptionOrder) ? mergedEntry.localeOptionOrder : [];
  const optionMeaningMap = Array.isArray(mergedEntry?.optionMeaningMap) ? mergedEntry.optionMeaningMap : [];
  const localeCorrectOptionKey = normalizeChoiceKey(mergedEntry?.localeCorrectOptionKey);
  const previewOrder = Array.isArray(previewEntry?.localeOptionOrder) ? previewEntry.localeOptionOrder : [];

  const orderPreserved = canonicalType !== "MCQ"
    ? true
    : JSON.stringify(localeOptionOrder.map((entry) => ({
      sourceKey: normalizeChoiceKey(entry?.sourceKey),
      canonicalOptionId: normalizeText(entry?.canonicalOptionId),
    }))) === JSON.stringify(previewOrder.map((entry) => ({
      sourceKey: normalizeChoiceKey(entry?.sourceKey),
      canonicalOptionId: normalizeText(entry?.canonicalOptionId),
    })));

  const mappedMeaning = canonicalType !== "MCQ"
    ? null
    : optionMeaningMap.find((entry) => normalizeChoiceKey(entry?.sourceKey) === localeCorrectOptionKey) ?? null;

  return {
    qid,
    type: canonicalType,
    qidExists: Boolean(masterQuestion),
    localeOptionOrderPreserved: orderPreserved,
    localeCorrectOptionKeyPresent: canonicalType !== "MCQ" ? true : Boolean(localeCorrectOptionKey),
    localeCorrectOptionKeyMapped: canonicalType !== "MCQ" ? true : Boolean(mappedMeaning),
    localeCorrectOptionKey,
    correctMeaningCanonicalOptionId: mappedMeaning?.canonicalOptionId ?? null,
  };
}

function buildNewQuestionCandidate({ item, decision, ordinal }) {
  return {
    candidateId: `nqc-fr-wrapup-${String(ordinal).padStart(3, "0")}`,
    sourceLang: LANG,
    sourceBatch: decision.sourceBatch,
    sourceImage: item.sourceImage ?? decision.sourceScreenshot ?? null,
    sourceItemId: item.itemId ?? decision.sourceId ?? decision.itemId,
    effectiveQuestionType: item.analysis?.effectiveQuestionType ?? item.analysis?.declaredQuestionType ?? null,
    promptRawJa: item.promptRawJa ?? item.localizedText?.prompt ?? null,
    promptGlossEn: item.promptGlossEn ?? item.translatedText?.prompt ?? null,
    optionsRawJa: sourceOptionsRaw(item),
    optionsGlossEn: sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    newQuestionLocalAnswerKey: normalizeChoiceKey(decision.localAnswerKey),
    provisionalTopic: decision.topic ?? item.provisionalTopic ?? null,
    provisionalSubtopics: decision.subtopics.length > 0
      ? decision.subtopics
      : Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topicConfidence: item.topicConfidence ?? null,
    topicSignals: Array.isArray(item.topicSignals) ? item.topicSignals : [],
    linkedExistingAssetCandidate: linkedExistingAssetCandidate(item),
    reviewerNotes: decision.reviewerNotes,
    explanation: decision.explanation,
    status: "pending-superset-review",
  };
}

function buildFollowUpItem(item, decision, { status, reason }) {
  return {
    itemId: decision.itemId,
    sourceBatch: decision.sourceBatch,
    sourceImage: item.sourceImage ?? decision.sourceScreenshot ?? null,
    sourceItemId: item.itemId ?? decision.sourceId ?? decision.itemId,
    status,
    reason,
    reviewerNotes: decision.reviewerNotes,
    explanation: decision.explanation,
    approvedQid: decision.approvedQid,
    localAnswerKey: decision.localAnswerKey,
    promptRawJa: item.promptRawJa ?? item.localizedText?.prompt ?? null,
    promptGlossEn: item.promptGlossEn ?? item.translatedText?.prompt ?? null,
    optionsRawJa: sourceOptionsRaw(item),
    optionsGlossEn: sourceOptionsGloss(item),
    correctKeyRaw: item.correctKeyRaw ?? null,
    correctAnswerRaw: item.correctAnswerRaw ?? null,
    provisionalTopic: decision.topic ?? item.provisionalTopic ?? null,
    provisionalSubtopics: decision.subtopics.length > 0
      ? decision.subtopics
      : Array.isArray(item.provisionalSubtopics) ? item.provisionalSubtopics : [],
    topCandidates: Array.isArray(item.topCandidates) ? item.topCandidates : [],
  };
}

function queuePerBatchUpdate(decision) {
  if (!decision.sourceBatch) return;
  const updates = perBatchUpdates.get(decision.sourceBatch) ?? [];
  updates.push(decision);
  perBatchUpdates.set(decision.sourceBatch, updates);
}

async function applyPerBatchDecisionUpdates(batchId, updates) {
  const filePath = batchDecisionPath(batchId);
  const result = { filesChanged: [], warnings: [] };
  if (!fileExists(filePath)) {
    result.warnings.push(`Per-batch decisions file not found for ${batchId}; aggregate wrap-up staging was still written.`);
    return result;
  }

  const doc = readJson(filePath);
  if (!Array.isArray(doc?.items)) {
    result.warnings.push(`Per-batch decisions file has no items array: ${rel(filePath)}`);
    return result;
  }

  const itemMap = new Map();
  for (const item of doc.items) {
    for (const key of [item?.id, item?.itemId, item?.sourceImage].map(normalizeText).filter(Boolean)) {
      itemMap.set(key, item);
    }
  }

  let changed = false;
  for (const update of updates) {
    const target = itemMap.get(update.sourceId) ?? itemMap.get(update.sourceScreenshot) ?? null;
    if (!target) {
      result.warnings.push(`Could not find ${update.itemId} in ${rel(filePath)}.`);
      continue;
    }
    applyDecisionToBatchItem(target, update);
    changed = true;
  }

  if (changed) {
    doc.exportedAt = generatedAt;
    doc.source = {
      ...(doc.source && typeof doc.source === "object" ? doc.source : {}),
      wrapupApplyDecisionPath: rel(decisionsPath),
      wrapupAppliedAt: generatedAt,
    };
    await writeJson(filePath, doc);
    result.filesChanged.push(rel(filePath));
  }

  return result;
}

function applyDecisionToBatchItem(target, decision) {
  target.approvedQid = decision.decision === "approveExistingQid" ? decision.approvedQid : null;
  target.qid = decision.decision === "approveExistingQid" ? decision.approvedQid : target.qid ?? null;
  target.createNewQuestion = decision.decision === "createNewQuestion";
  target.keepUnresolved = decision.decision === "keepUnresolved";
  target.deleteQuestion = decision.decision === "deleteQuestion";
  target.confirmedCorrectOptionKey = decision.decision === "approveExistingQid"
    ? normalizeChoiceKey(decision.localAnswerKey)
    : null;
  target.newQuestionLocalAnswerKey = decision.decision === "createNewQuestion"
    ? normalizeChoiceKey(decision.localAnswerKey)
    : null;
  target.answerKeyUnknown = decision.localAnswerKey === "UNKNOWN";
  target.reviewerNotes = decision.reviewerNotes;
  target.explanation = decision.explanation;
  target.newQuestionProvisionalTopic = decision.topic ?? target.newQuestionProvisionalTopic ?? null;
  target.newQuestionProvisionalSubtopics = decision.subtopics.length > 0
    ? decision.subtopics
    : target.newQuestionProvisionalSubtopics ?? [];
  target.wrapupDecisionAppliedAt = generatedAt;
  target.wrapupDecisionItemId = decision.itemId;
}

function batchDecisionPath(batchId) {
  return path.join(STAGING_DIR, `fr-${batchId}-workbench-decisions.json`);
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
    if (canonicalOption) byCanonicalId.set(canonicalOption.id, entry);
    return entry;
  });

  return { orderedSourceOptions, byCanonicalId, scoreMatrix };
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
      walk(index + 1, usedCanonicalIds, currentTotal + Number(row.get(canonicalOption.id) ?? 0), currentMapping);
      usedCanonicalIds.delete(canonicalOption.id);
      currentMapping.delete(sourceOption.sourceIndex);
    }
  }

  walk(0, new Set(), 0, new Map());
  return { totalScore: bestTotal, bySourceIndex: bestMapping };
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
  if (!Array.isArray(entries)) return null;
  return entries.find((entry) => normalizeChoiceKey(entry?.sourceKey) === normalizeChoiceKey(key)) ?? null;
}

function sourceOptionsRaw(item) {
  if (Array.isArray(item?.optionsRawJa) && item.optionsRawJa.length > 0) return item.optionsRawJa;
  if (Array.isArray(item?.localizedText?.options) && item.localizedText.options.length > 0) return item.localizedText.options;
  return [];
}

function sourceOptionsGloss(item) {
  if (Array.isArray(item?.optionsGlossEn) && item.optionsGlossEn.length > 0) return item.optionsGlossEn;
  if (Array.isArray(item?.translatedText?.options) && item.translatedText.options.length > 0) return item.translatedText.options;
  return [];
}

function linkedExistingAssetCandidate(item) {
  const candidate = (Array.isArray(item?.topCandidates) ? item.topCandidates : []).find(
    (entry) => entry?.image?.currentAssetSrc,
  );
  if (!candidate) return null;
  return {
    qid: candidate.qid,
    number: candidate.number,
    score: candidate.score ?? null,
    currentAssetSrc: candidate.image?.currentAssetSrc ?? null,
    assetHashes: Array.isArray(candidate.image?.assetHashes) ? candidate.image.assetHashes : [],
    status: "unconfirmed-existing-production-asset",
  };
}

function parseChoice(value) {
  const text = normalizeText(value);
  if (!text) return { key: null, body: null };
  const match = text.match(/^\s*([A-D])[\s.:：、．\)\]-]+(.*)$/i);
  if (match) return { key: match[1].toUpperCase(), body: normalizeText(match[2]) ?? null };
  return { key: null, body: text };
}

function fallbackChoiceKey(index) {
  return String.fromCharCode(65 + index);
}

function normalizeQuestionType(value) {
  return String(value ?? "").trim().toUpperCase() === "ROW" ? "ROW" : "MCQ";
}

function normalizeLocalAnswerKey(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const key = String(value).trim().toUpperCase();
  if (key === "UNKNOWN") return "UNKNOWN";
  return /^[A-D]$/.test(key) ? key : key;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function cleanObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== "")
  );
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripOptionKeyPrefix(text, sourceKey) {
  const raw = normalizeText(text) ?? "";
  if (!raw) return "";
  const keyPattern = sourceKey ? escapeRegExp(sourceKey) : "[A-D]";
  const stripped = raw.replace(new RegExp(`^${keyPattern}(?:[\\s\\.:：\\)\\]\\-])?\\s*`, "i"), "").trim();
  return stripped || raw;
}

function joinChoice(key, text) {
  const normalizedText = normalizeText(text);
  if (!normalizedText) return "";
  const normalizedKey = normalizeChoiceKey(key);
  if (!normalizedKey) return normalizedText;
  return normalizedText.startsWith(`${normalizedKey} `) ? normalizedText : `${normalizedKey} ${normalizedText}`;
}

function findDuplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

function buildReportMd(report) {
  const lines = [
    `# French Wrap-up Apply Report`,
    "",
    `- Mode: ${report.mode}`,
    `- Total source items: ${report.sourceItemCount}`,
    `- Reviewed items considered: ${report.counts.totalReviewedItems}`,
    `- Approve existing qid: ${report.counts.appliedApproveExistingQid}`,
    `- Create new question staged: ${report.counts.stagedCreateNewQuestion}`,
    `- Keep unresolved: ${report.counts.keptUnresolved}`,
    `- Delete question: ${report.counts.deleteQuestion}`,
    `- Skipped invalid: ${report.counts.skippedInvalid}`,
    `- Skipped unreviewed: ${report.counts.skippedUnreviewed}`,
    `- French coverage: ${report.frenchCoverage.before} -> ${report.frenchCoverage.after} (${report.frenchCoverage.delta >= 0 ? "+" : ""}${report.frenchCoverage.delta})`,
    `- translations.fr.json changed: ${report.translationsFrChanged ? "yes" : "no"}`,
    `- Protected qbank files unchanged: ${report.protectedFilesUnchanged ? "yes" : "no"}`,
    "",
    "## Reports",
    `- Canonical JSON: ${report.reports.canonicalJson}`,
    `- Canonical Markdown: ${report.reports.canonicalMd}`,
    `- Dry-run JSON: ${report.reports.dryRunJson}`,
    `- Dry-run Markdown: ${report.reports.dryRunMd}`,
    "",
    "## Affected QIDs",
    ...formatList(report.qidsAffected),
    "",
    "## New-question candidates",
    ...formatList(report.newQuestionCandidateIds),
    "",
    "## Unresolved IDs",
    ...formatList(report.unresolvedIds),
    "",
    "## Deleted/ignored IDs",
    ...formatList(report.deleteQuestionIds),
    "",
    "## Warnings",
    ...formatList(report.warnings),
  ];

  if (report.invalidItems.length > 0) {
    lines.push("", "## Invalid/skipped items");
    for (const item of report.invalidItems) {
      lines.push(`- ${item.itemId}: ${(item.reasons ?? []).join("; ")}`);
    }
  }

  if (report.skippedItems.length > 0) {
    lines.push("", "## Unreviewed skipped items");
    for (const item of report.skippedItems) {
      lines.push(`- ${item.itemId}: ${item.reason}`);
    }
  }

  if (report.productionMerge.blockers.length > 0) {
    lines.push("", "## Production merge blockers", ...formatList(report.productionMerge.blockers));
  }

  lines.push("", "## Files", ...(report.applied ? report.filesChanged : report.filesWouldChange).map((filePath) => `- ${filePath}`));
  return `${lines.join("\n")}\n`;
}

function formatList(values) {
  if (!Array.isArray(values) || values.length === 0) return ["- none"];
  return values.map((value) => `- ${value}`);
}

function hashFiles(files) {
  const hashes = new Map();
  for (const filePath of files) hashes.set(filePath, hashFile(filePath));
  return hashes;
}

function hashFile(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function compareHashes(left, right) {
  if (left.size !== right.size) return false;
  for (const [filePath, hash] of left.entries()) {
    if (right.get(filePath) !== hash) return false;
  }
  return true;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}
