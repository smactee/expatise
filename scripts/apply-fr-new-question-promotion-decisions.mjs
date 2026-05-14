#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  STAGING_DIR,
  fileExists,
  getDatasetPaths,
  parseArgs,
  readJson,
  stableNow,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";
import {
  loadMasterQuestions,
} from "../qbank-tools/lib/new-question-promotion-gate.mjs";

const LANG = "fr";
const BATCH_ID = "wrapup";
const VALID_NORMALIZED_DECISIONS = new Set([
  "promoteNewQuestion",
  "linkExistingQid",
  "needsHumanReview",
  "rejectCandidate",
]);
const ANSWER_KEYS = new Set(["A", "B", "C", "D", "R", "W", "UNKNOWN", null]);

const args = parseArgs();
const apply = String(args.apply ?? "false").trim().toLowerCase() === "true";
const dataset = String(args.dataset ?? DEFAULT_DATASET).trim() || DEFAULT_DATASET;
const generatedAt = stableNow();

const decisionsPath = path.join(STAGING_DIR, "fr-new-question-promotion-workbench-decisions.json");
const workbenchPath = path.join(REPORTS_DIR, "fr-new-question-promotion-workbench.json");
const candidatesPath = path.join(STAGING_DIR, "fr-wrapup-new-question-candidates.json");
const dryRunReportPath = path.join(REPORTS_DIR, "fr-new-question-promotion-apply-report.dry-run.json");
const reportJsonPath = path.join(REPORTS_DIR, "fr-new-question-promotion-apply-report.json");
const reportMdPath = path.join(REPORTS_DIR, "fr-new-question-promotion-apply-report.md");
const finalPreviewPath = path.join(STAGING_DIR, "fr-new-question-promotion-final-preview.json");
const unresolvedPath = path.join(STAGING_DIR, "fr-new-question-promotion-unresolved.json");
const rejectedPath = path.join(STAGING_DIR, "fr-new-question-promotion-rejected.json");

const datasetPaths = getDatasetPaths(dataset, LANG);
const translationsPath = datasetPaths.translationPath;
const protectedPaths = [
  datasetPaths.questionsPath,
  datasetPaths.rawQuestionsPath,
  path.join(datasetPaths.datasetDir, "image-color-tags.json"),
  ...listNonFrenchTranslations(datasetPaths.datasetDir),
].filter((filePath) => fileExists(filePath));

const protectedHashesBefore = hashFiles(protectedPaths);
const questionsHashBefore = hashFileIfExists(datasetPaths.questionsPath);
const translationsHashBefore = hashFileIfExists(translationsPath);
const auditBefore = readIntegritySnapshot();

if (!fileExists(decisionsPath)) throw new Error(`Missing decisions file: ${rel(decisionsPath)}`);
if (!fileExists(workbenchPath)) throw new Error(`Missing workbench artifact: ${rel(workbenchPath)}`);
if (!fileExists(candidatesPath)) throw new Error(`Missing candidates file: ${rel(candidatesPath)}`);

const decisionsDoc = readJson(decisionsPath);
const workbenchDoc = readJson(workbenchPath);
const candidatesDoc = readJson(candidatesPath);
const master = loadMasterQuestions({ root: ROOT, dataset });
const existingTranslationsDoc = fileExists(translationsPath)
  ? readJson(translationsPath)
  : { meta: { locale: LANG }, questions: {} };

validateTopLevel(decisionsDoc, workbenchDoc, candidatesDoc);

const workbenchByCandidateId = new Map((workbenchDoc.items ?? []).map((item) => [String(item.candidateId ?? ""), item]));
const candidateById = new Map((candidatesDoc.items ?? []).map((item) => [String(item.candidateId ?? ""), item]));
const existingQids = new Set(master.questions.map((question) => question.qid));
const decisions = decisionsDoc.items ?? [];

const counts = {
  totalDecisions: decisions.length,
  reviewedCount: 0,
  unreviewedSkippedCount: 0,
  safeToPromoteCount: 0,
  linkedExistingQidCount: 0,
  needsHumanReviewCount: 0,
  rejectedCount: 0,
  invalidSkippedCount: 0,
};
const warnings = [];
const invalidItems = [];
const skippedUnreviewed = [];
const finalPreviewItems = [];
const unresolvedItems = [];
const rejectedItems = [];
const linkedExistingQids = [];
const linkedTranslationEntries = {};
const appliedDecisionItems = [];

for (const rawDecision of decisions) {
  const decision = normalizeDecision(rawDecision);
  const workbenchItem = workbenchByCandidateId.get(decision.candidateId);
  const candidate = candidateById.get(decision.candidateId);
  const validation = validateDecision(decision, workbenchItem, candidate);
  if (!validation.ok) {
    counts.invalidSkippedCount += 1;
    invalidItems.push({
      candidateId: decision.candidateId,
      decision: decision.rawDecision,
      reasons: validation.errors,
    });
    continue;
  }

  if (!decision.reviewed) {
    counts.unreviewedSkippedCount += 1;
    skippedUnreviewed.push({
      candidateId: decision.candidateId,
      decision: decision.normalizedDecision,
      reason: "Decision is not marked reviewed.",
    });
    continue;
  }

  counts.reviewedCount += 1;

  if (decision.normalizedDecision === "promoteNewQuestion") {
    const item = buildFinalPromotionPreviewItem({ decision, candidate, workbenchItem });
    finalPreviewItems.push(item);
    counts.safeToPromoteCount += 1;
    appliedDecisionItems.push({
      candidateId: decision.candidateId,
      status: apply ? "staged-final-promotion-preview" : "would-stage-final-promotion-preview",
      proposedQid: decision.proposedQid,
    });
    continue;
  }

  if (decision.normalizedDecision === "linkExistingQid") {
    const linkSafety = evaluateExistingQidLinkSafety({ decision, candidate, workbenchItem });
    if (!linkSafety.safe) {
      counts.needsHumanReviewCount += 1;
      unresolvedItems.push(buildUnresolvedItem({
        decision,
        candidate,
        workbenchItem,
        status: "unsafe-existing-qid-link",
        reason: linkSafety.reasons.join("; "),
      }));
      warnings.push(`${decision.candidateId}: skipped existing-qid link to ${decision.linkedExistingQid}; ${linkSafety.reasons.join("; ")}`);
      appliedDecisionItems.push({
        candidateId: decision.candidateId,
        status: "skipped-unsafe-existing-qid-link",
        linkedExistingQid: decision.linkedExistingQid,
        reasons: linkSafety.reasons,
      });
      continue;
    }

    const linkedEntry = buildLinkedExistingTranslation({ decision, candidate, masterQuestion: linkSafety.masterQuestion });
    linkedTranslationEntries[decision.linkedExistingQid] = linkedEntry;
    linkedExistingQids.push(decision.linkedExistingQid);
    counts.linkedExistingQidCount += 1;
    appliedDecisionItems.push({
      candidateId: decision.candidateId,
      status: apply ? "linked-existing-qid-localization" : "would-link-existing-qid-localization",
      linkedExistingQid: decision.linkedExistingQid,
    });
    continue;
  }

  if (decision.normalizedDecision === "needsHumanReview") {
    unresolvedItems.push(buildUnresolvedItem({
      decision,
      candidate,
      workbenchItem,
      status: "needs-human-review",
      reason: decision.promotionNotes || decision.reviewerNotes || "Reviewer kept this promotion candidate unresolved.",
    }));
    counts.needsHumanReviewCount += 1;
    appliedDecisionItems.push({
      candidateId: decision.candidateId,
      status: "kept-in-promotion-unresolved-queue",
    });
    continue;
  }

  if (decision.normalizedDecision === "rejectCandidate") {
    rejectedItems.push(buildRejectedItem({
      decision,
      candidate,
      workbenchItem,
      status: "rejected",
      reason: decision.promotionNotes || decision.reviewerNotes || "Reviewer rejected this promotion candidate.",
    }));
    counts.rejectedCount += 1;
    appliedDecisionItems.push({
      candidateId: decision.candidateId,
      status: "marked-rejected-in-staging",
    });
  }
}

const finalPreviewDoc = {
  schemaVersion: 1,
  lang: LANG,
  batchId: BATCH_ID,
  dataset,
  generatedAt,
  reviewOnly: true,
  sourceDecisions: rel(decisionsPath),
  sourceCandidates: rel(candidatesPath),
  note: "Final reviewed promotion preview only. This file does not promote into questions.json.",
  nextManualStep: "If you decide to promote these candidates into the master qbank, review this preview and then run or adapt the existing apply-new-question-promotion flow explicitly. The existing apply script writes questions.raw.json and translations.fr.json directly, so do not run it without a final human approval.",
  items: finalPreviewItems,
};

const unresolvedDoc = {
  schemaVersion: 1,
  lang: LANG,
  batchId: BATCH_ID,
  dataset,
  generatedAt,
  sourceDecisions: rel(decisionsPath),
  items: unresolvedItems,
};

const rejectedDoc = {
  schemaVersion: 1,
  lang: LANG,
  batchId: BATCH_ID,
  dataset,
  generatedAt,
  sourceDecisions: rel(decisionsPath),
  items: rejectedItems,
};

const nextTranslationsDoc = buildNextTranslationsDoc(linkedTranslationEntries);
const frenchCoverageBefore = Object.keys(existingTranslationsDoc.questions ?? {}).length;
const frenchCoverageAfter = Object.keys(nextTranslationsDoc.questions ?? {}).length;
const filesWouldChange = [
  rel(reportJsonPath),
  rel(reportMdPath),
  rel(finalPreviewPath),
  rel(unresolvedPath),
  rel(rejectedPath),
  ...(Object.keys(linkedTranslationEntries).length > 0 ? [rel(translationsPath)] : []),
].sort();
const filesChanged = [];

if (apply) {
  await writeJson(finalPreviewPath, finalPreviewDoc);
  await writeJson(unresolvedPath, unresolvedDoc);
  await writeJson(rejectedPath, rejectedDoc);
  filesChanged.push(rel(finalPreviewPath), rel(unresolvedPath), rel(rejectedPath));

  if (Object.keys(linkedTranslationEntries).length > 0) {
    await writeJson(translationsPath, nextTranslationsDoc);
    filesChanged.push(rel(translationsPath));
  }
}

const protectedHashesAfter = hashFiles(protectedPaths);
const protectedFilesUnchanged = compareHashes(protectedHashesBefore, protectedHashesAfter);
if (!protectedFilesUnchanged) {
  throw new Error("Protected master/non-French qbank files changed unexpectedly.");
}

const questionsHashAfter = hashFileIfExists(datasetPaths.questionsPath);
const translationsHashAfter = hashFileIfExists(translationsPath);
const questionsChanged = questionsHashBefore !== questionsHashAfter;
const translationsFrChanged = translationsHashBefore !== translationsHashAfter;

const report = {
  generatedAt,
  mode: apply ? "apply" : "dry-run",
  applied: apply,
  lang: LANG,
  dataset,
  sourceDecisions: rel(decisionsPath),
  sourceWorkbench: rel(workbenchPath),
  sourceCandidates: rel(candidatesPath),
  outputs: {
    dryRunReport: rel(dryRunReportPath),
    applyReportJson: rel(reportJsonPath),
    applyReportMd: rel(reportMdPath),
    finalPreview: rel(finalPreviewPath),
    unresolved: rel(unresolvedPath),
    rejected: rel(rejectedPath),
  },
  counts,
  linkedExistingQids: [...new Set(linkedExistingQids)].sort(),
  stagedPromotionCandidateIds: finalPreviewItems.map((item) => item.candidateId),
  unresolvedCandidateIds: unresolvedItems.map((item) => item.candidateId),
  rejectedCandidateIds: rejectedItems.map((item) => item.candidateId),
  invalidItems,
  skippedUnreviewed,
  warnings,
  frenchCoverage: {
    before: frenchCoverageBefore,
    after: frenchCoverageAfter,
    delta: frenchCoverageAfter - frenchCoverageBefore,
  },
  integrity: {
    before: auditBefore,
    after: null,
    afterNote: "Run npm run audit-qbank-integrity after apply to populate the final after-audit state.",
  },
  questionsJsonChanged: questionsChanged,
  translationsFrChanged,
  protectedFilesUnchanged,
  protectedFiles: protectedPaths.map(rel),
  filesChanged: apply ? [...new Set([...filesChanged, rel(reportJsonPath), rel(reportMdPath)])].sort() : [],
  filesWouldChange,
  appliedDecisionItems,
};

const reportMd = renderReportMd(report);
if (apply) {
  await writeJson(reportJsonPath, report);
  await writeText(reportMdPath, reportMd);
} else {
  await writeJson(dryRunReportPath, report);
}

console.log(
  [
    `${apply ? "Applied" : "Dry run"} French new-question promotion decisions.`,
    `reviewed=${counts.reviewedCount}`,
    `stagedPromotions=${counts.safeToPromoteCount}`,
    `linkedExistingQids=${counts.linkedExistingQidCount}`,
    `unresolved=${counts.needsHumanReviewCount}`,
    `rejected=${counts.rejectedCount}`,
    `skippedUnreviewed=${counts.unreviewedSkippedCount}`,
    `questionsChanged=${questionsChanged ? "yes" : "no"}`,
    `translationsFrChanged=${translationsFrChanged ? "yes" : "no"}`,
    `coverage ${frenchCoverageBefore} -> ${frenchCoverageAfter}`,
  ].join(" "),
);

function validateTopLevel(decisions, workbench, candidates) {
  const errors = [];
  if (Number(decisions?.schemaVersion) !== 1) errors.push("decisions schemaVersion must be 1.");
  if (String(decisions?.lang ?? "") !== LANG) errors.push(`decisions lang must be ${LANG}.`);
  if (String(decisions?.workbenchType ?? "") !== "fr-new-question-promotion") {
    errors.push("decisions workbenchType must be fr-new-question-promotion.");
  }
  if (!Array.isArray(decisions?.items)) errors.push("decisions items must be an array.");
  if (!Array.isArray(workbench?.items)) errors.push("workbench artifact items must be an array.");
  if (!Array.isArray(candidates?.items)) errors.push("candidate items must be an array.");
  if (errors.length > 0) throw new Error(errors.join("\n"));
}

function normalizeDecision(item) {
  const normalizedDecision = normalizeDecisionValue(item?.decision);
  return {
    candidateId: normalizeText(item?.candidateId) ?? "",
    rawDecision: item?.decision ?? null,
    normalizedDecision,
    proposedQid: normalizeQid(item?.proposedQid),
    proposedMasterNumber: Number.isFinite(Number(item?.proposedMasterNumber)) ? Number(item.proposedMasterNumber) : null,
    linkedExistingQid: normalizeQid(item?.linkedExistingQid),
    localAnswerKey: normalizeAnswerKey(item?.localAnswerKey),
    topic: normalizeText(item?.topic),
    subtopics: Array.isArray(item?.subtopics) ? item.subtopics.map(normalizeText).filter(Boolean) : [],
    reviewerNotes: normalizeText(item?.reviewerNotes) ?? "",
    promotionNotes: normalizeText(item?.promotionNotes) ?? "",
    reviewed: item?.reviewed === true,
    reviewedAt: normalizeText(item?.reviewedAt),
  };
}

function normalizeDecisionValue(value) {
  const raw = String(value ?? "").trim();
  const compact = raw.toLowerCase().replace(/[-_\s]+/g, "");
  if (["promotenewquestion", "safetopromote"].includes(compact)) return "promoteNewQuestion";
  if (["linkexistingqid", "likelyduplicate"].includes(compact)) return "linkExistingQid";
  if (["needshumanreview", "needshuman", "needsreview"].includes(compact)) return "needsHumanReview";
  if (["reject", "rejectduplicate", "deletecandidate", "deletequestion"].includes(compact)) return "rejectCandidate";
  return raw;
}

function validateDecision(decision, workbenchItem, candidate) {
  const errors = [];
  if (!decision.candidateId) errors.push("candidateId is required.");
  if (!workbenchItem) errors.push("candidateId does not exist in fr-new-question-promotion-workbench.json.");
  if (!candidate) errors.push("candidateId does not exist in fr-wrapup-new-question-candidates.json.");
  if (!VALID_NORMALIZED_DECISIONS.has(decision.normalizedDecision)) {
    errors.push(`Invalid decision: ${decision.rawDecision ?? "(missing)"}.`);
  }
  if (!ANSWER_KEYS.has(decision.localAnswerKey)) errors.push(`Invalid localAnswerKey: ${decision.localAnswerKey}.`);

  if (decision.normalizedDecision === "promoteNewQuestion") {
    if (!decision.proposedQid) errors.push("promoteNewQuestion requires proposedQid.");
    if (decision.proposedQid && existingQids.has(decision.proposedQid)) {
      errors.push(`proposedQid ${decision.proposedQid} already exists in master qbank.`);
    }
    if (!decision.proposedMasterNumber) errors.push("promoteNewQuestion requires proposedMasterNumber.");
    if (normalizeQuestionType(candidate?.effectiveQuestionType) === "MCQ" && !normalizeChoiceKey(decision.localAnswerKey)) {
      errors.push("MCQ promoteNewQuestion requires localAnswerKey A/B/C/D.");
    }
  }

  if (decision.normalizedDecision === "linkExistingQid") {
    if (!decision.linkedExistingQid) errors.push("linkExistingQid requires linkedExistingQid.");
    if (decision.linkedExistingQid && !master.byQid.has(decision.linkedExistingQid)) {
      errors.push(`linkedExistingQid ${decision.linkedExistingQid} was not found in master qbank.`);
    }
  }

  return { ok: errors.length === 0, errors };
}

function buildFinalPromotionPreviewItem({ decision, candidate, workbenchItem }) {
  return {
    candidateId: decision.candidateId,
    proposedQid: decision.proposedQid,
    proposedMasterNumber: decision.proposedMasterNumber,
    sourceLang: LANG,
    sourceBatch: normalizeText(candidate.sourceBatch ?? decision.sourceBatch ?? workbenchItem?.sourceBatch),
    sourceImage: normalizeText(candidate.sourceImage ?? workbenchItem?.sourceImage),
    sourceItemId: normalizeText(candidate.sourceItemId ?? workbenchItem?.sourceItemId),
    effectiveQuestionType: normalizeQuestionType(candidate.effectiveQuestionType ?? workbenchItem?.type),
    promptRawJa: normalizeText(candidate.promptRawJa ?? workbenchItem?.promptRaw),
    promptGlossEn: normalizeText(candidate.promptGlossEn ?? workbenchItem?.promptGloss),
    optionsRawJa: Array.isArray(candidate.optionsRawJa) ? candidate.optionsRawJa : [],
    optionsGlossEn: Array.isArray(candidate.optionsGlossEn) ? candidate.optionsGlossEn : [],
    correctKeyRaw: normalizeText(candidate.correctKeyRaw),
    correctAnswerRaw: normalizeText(candidate.correctAnswerRaw),
    newQuestionLocalAnswerKey: decision.localAnswerKey,
    provisionalTopic: decision.topic ?? candidate.provisionalTopic ?? null,
    provisionalSubtopics: decision.subtopics.length > 0
      ? decision.subtopics
      : Array.isArray(candidate.provisionalSubtopics) ? candidate.provisionalSubtopics : [],
    linkedExistingAssetCandidate: candidate.linkedExistingAssetCandidate ?? null,
    duplicateSafety: workbenchItem?.duplicateSafety ?? null,
    nearestExistingQids: workbenchItem?.duplicateSafety?.nearestExistingQids ?? [],
    duplicateScore: workbenchItem?.duplicateSafety?.duplicateScore ?? null,
    promotionRecommendation: "safeToPromote",
    reviewerNotes: decision.reviewerNotes,
    promotionNotes: decision.promotionNotes,
    reviewedAt: decision.reviewedAt,
    status: "ready-for-final-human-promotion-review",
  };
}

function evaluateExistingQidLinkSafety({ decision, candidate, workbenchItem }) {
  const masterQuestion = master.byQid.get(decision.linkedExistingQid);
  const reasons = [];
  if (!masterQuestion) {
    return { safe: false, reasons: [`linked qid ${decision.linkedExistingQid} not found`], masterQuestion: null };
  }

  const sourceType = normalizeQuestionType(candidate.effectiveQuestionType ?? workbenchItem?.type);
  const masterType = normalizeQuestionType(masterQuestion.type);
  if (sourceType !== masterType) reasons.push(`question type mismatch (${sourceType} vs ${masterType})`);

  if (masterType === "ROW") {
    const rowOk = ["A", "B", "R", "W"].includes(decision.localAnswerKey);
    if (!rowOk) reasons.push("ROW link requires a clear Yes/No or R/W local answer key.");
    return { safe: reasons.length === 0, reasons, masterQuestion };
  }

  if (!normalizeChoiceKey(decision.localAnswerKey)) {
    reasons.push("MCQ link requires localAnswerKey A/B/C/D.");
  }

  const sourceOptions = buildSourceOptions(candidate);
  const localCorrect = sourceOptions.find((option) => option.key === decision.localAnswerKey);
  const masterCorrect = masterQuestion.options.find((option) => option.key === masterQuestion.answerKey) ?? null;
  if (!localCorrect || !masterCorrect) {
    reasons.push("Could not resolve reviewed local correct option or master correct option.");
  } else {
    const sourceText = localCorrect.gloss || localCorrect.text;
    const score = textSimilarity(sourceText, masterCorrect.text);
    if (score < 0.7) {
      reasons.push(`correct-option semantic score too low (${score.toFixed(3)}): source "${sourceText}" vs master "${masterCorrect.text}"`);
    }
    if (hasProhibitionPolarityConflict(sourceText, masterCorrect.text)) {
      reasons.push(`correct-option polarity conflict: source "${sourceText}" vs master "${masterCorrect.text}"`);
    }
  }

  const optionCountMatches = sourceOptions.length === masterQuestion.options.length;
  if (!optionCountMatches) reasons.push(`option count mismatch (${sourceOptions.length} vs ${masterQuestion.options.length})`);

  return { safe: reasons.length === 0, reasons, masterQuestion };
}

function buildLinkedExistingTranslation({ decision, candidate, masterQuestion }) {
  const type = normalizeQuestionType(masterQuestion.type);
  const base = {
    prompt: normalizeText(candidate.promptRawJa) ?? "",
    explanation: "",
    sourceMode: "direct",
    confidence: "high",
    reviewStatus: "ready",
  };

  if (type === "ROW") {
    return base;
  }

  const sourceOptions = buildSourceOptions(candidate);
  const aligned = alignSourceOptionsToMaster(sourceOptions, masterQuestion.options);
  const localeOptionOrder = aligned.map((entry) => ({
    sourceIndex: entry.sourceIndex,
    sourceKey: entry.key,
    sourceText: entry.text,
    sourceTextBody: stripOptionKeyPrefix(entry.text, entry.key),
    sourceGlossEn: entry.gloss || undefined,
    canonicalOptionId: entry.masterOption?.id,
    canonicalOptionKey: entry.masterOption?.key,
    canonicalOptionText: entry.masterOption?.text,
    alignmentScore: entry.score,
    alignmentMethod: "fr-promotion-link-review",
    manualAnswerKeyConfirmed: entry.key === decision.localAnswerKey ? true : undefined,
    confirmedAsCorrectKey: entry.key === decision.localAnswerKey ? true : undefined,
  }));
  const masterCorrect = masterQuestion.options.find((option) => option.key === masterQuestion.answerKey) ?? null;
  const options = {};
  for (const entry of localeOptionOrder) {
    if (entry.canonicalOptionId) {
      options[entry.canonicalOptionId] = stripOptionKeyPrefix(entry.sourceText, entry.sourceKey);
    }
  }

  return cleanObject({
    ...base,
    options,
    localeOptionOrder,
    optionMeaningMap: localeOptionOrder,
    localeCorrectOptionKey: decision.localAnswerKey,
    correctOptionAlignment: masterCorrect ? {
      sourceKey: decision.localAnswerKey,
      canonicalOptionId: masterCorrect.id,
      canonicalOptionKey: masterCorrect.key,
      canonicalOptionText: masterCorrect.text,
      method: "manual-answer-key-confirmed",
      manualAnswerKeyConfirmed: true,
    } : undefined,
  });
}

function buildUnresolvedItem({ decision, candidate, workbenchItem, status, reason }) {
  return {
    candidateId: decision.candidateId,
    sourceBatch: candidate.sourceBatch ?? workbenchItem?.sourceBatch ?? null,
    sourceImage: candidate.sourceImage ?? workbenchItem?.sourceImage ?? null,
    status,
    reason,
    decision: decision.rawDecision,
    linkedExistingQid: decision.linkedExistingQid,
    localAnswerKey: decision.localAnswerKey,
    promptRawJa: candidate.promptRawJa ?? workbenchItem?.promptRaw ?? null,
    promptGlossEn: candidate.promptGlossEn ?? workbenchItem?.promptGloss ?? null,
    optionsRawJa: Array.isArray(candidate.optionsRawJa) ? candidate.optionsRawJa : [],
    optionsGlossEn: Array.isArray(candidate.optionsGlossEn) ? candidate.optionsGlossEn : [],
    nearestExistingQids: workbenchItem?.duplicateSafety?.nearestExistingQids ?? [],
    reviewerNotes: decision.reviewerNotes,
    promotionNotes: decision.promotionNotes,
  };
}

function buildRejectedItem({ decision, candidate, workbenchItem, status, reason }) {
  return {
    candidateId: decision.candidateId,
    sourceBatch: candidate.sourceBatch ?? workbenchItem?.sourceBatch ?? null,
    sourceImage: candidate.sourceImage ?? workbenchItem?.sourceImage ?? null,
    status,
    reason,
    localAnswerKey: decision.localAnswerKey,
    promptRawJa: candidate.promptRawJa ?? workbenchItem?.promptRaw ?? null,
    promptGlossEn: candidate.promptGlossEn ?? workbenchItem?.promptGloss ?? null,
    reviewerNotes: decision.reviewerNotes,
    promotionNotes: decision.promotionNotes,
  };
}

function buildNextTranslationsDoc(linkedEntries) {
  const nextQuestions = {
    ...(existingTranslationsDoc.questions ?? {}),
    ...linkedEntries,
  };
  return {
    meta: {
      ...(existingTranslationsDoc.meta ?? {}),
      locale: LANG,
      translatedQuestions: Object.keys(nextQuestions).length,
      generatedAt,
      localeAnswerKeySupport: true,
      mergedBatches: Array.from(
        new Set([...(existingTranslationsDoc.meta?.mergedBatches ?? []), "wrapup-new-question-links"].map(String))
      ),
    },
    questions: sortObjectByKey(nextQuestions),
  };
}

function readIntegritySnapshot() {
  const auditPath = path.join(REPORTS_DIR, "qbank-integrity-audit.json");
  if (!fileExists(auditPath)) {
    return { criticalBlockers: null, warnings: null, generatedAt: null };
  }
  const doc = readJson(auditPath);
  return {
    criticalBlockers: Number(doc.summary?.criticalBlockers ?? (Array.isArray(doc.criticalBlockers) ? doc.criticalBlockers.length : 0)),
    warnings: Number(doc.summary?.warnings ?? (Array.isArray(doc.warnings) ? doc.warnings.length : 0)),
    generatedAt: doc.generatedAt ?? null,
  };
}

function buildSourceOptions(candidate) {
  const raw = Array.isArray(candidate.optionsRawJa) ? candidate.optionsRawJa : [];
  const gloss = Array.isArray(candidate.optionsGlossEn) ? candidate.optionsGlossEn : [];
  const length = Math.max(raw.length, gloss.length);
  return Array.from({ length }, (_, index) => ({
    sourceIndex: index,
    key: String.fromCharCode(65 + index),
    text: normalizeText(raw[index]) ?? "",
    gloss: normalizeText(gloss[index]) ?? "",
  }));
}

function alignSourceOptionsToMaster(sourceOptions, masterOptions) {
  const available = [...masterOptions];
  return sourceOptions.map((sourceOption) => {
    let best = null;
    let bestScore = -1;
    for (const masterOption of available) {
      const score = textSimilarity(sourceOption.gloss || sourceOption.text, masterOption.text);
      if (score > bestScore) {
        best = masterOption;
        bestScore = score;
      }
    }
    if (best) available.splice(available.indexOf(best), 1);
    return { ...sourceOption, masterOption: best, score: Number(Math.max(bestScore, 0).toFixed(4)) };
  });
}

function textSimilarity(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function tokenSet(value) {
  return new Set(
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token && !["the", "a", "an", "to", "of", "and", "or", "is", "are", "be"].includes(token))
  );
}

function hasProhibitionPolarityConflict(sourceText, masterText) {
  const sourceNegative = /\b(no|not|forbidden|prohibited|interdit|interdite|interdiction)\b/i.test(String(sourceText ?? ""));
  const masterNegative = /\b(no|not|forbidden|prohibited|interdit|interdite|interdiction)\b/i.test(String(masterText ?? ""));
  return sourceNegative !== masterNegative;
}

function normalizeQuestionType(value) {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "ROW") return "ROW";
  if (text === "MCQ") return "MCQ";
  return text || "UNKNOWN";
}

function normalizeQid(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^q\d{4}$/i.test(text)) return text.toLowerCase();
  const digits = text.match(/\d{1,4}/)?.[0];
  return digits ? `q${digits.padStart(4, "0")}` : text.toLowerCase();
}

function normalizeAnswerKey(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const text = String(value).trim().toUpperCase();
  return ANSWER_KEYS.has(text) ? text : text;
}

function normalizeChoiceKey(value) {
  const text = String(value ?? "").trim().toUpperCase();
  return /^[A-D]$/.test(text) ? text : null;
}

function normalizeText(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

function stripOptionKeyPrefix(text, sourceKey) {
  const raw = normalizeText(text) ?? "";
  if (!raw) return "";
  const keyPattern = sourceKey ? escapeRegExp(sourceKey) : "[A-D]";
  const stripped = raw.replace(new RegExp(`^${keyPattern}(?:[\\s\\.:：\\)\\]\\-])?\\s*`, "i"), "").trim();
  return stripped || raw;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null && entry !== ""));
}

function sortObjectByKey(value) {
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
}

function listNonFrenchTranslations(datasetDir) {
  if (!fileExists(datasetDir)) return [];
  return fs
    .readdirSync(datasetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^translations\.(?!fr\.json$)[a-z0-9-]+\.json$/i.test(entry.name))
    .map((entry) => path.join(datasetDir, entry.name));
}

function hashFiles(files) {
  const hashes = new Map();
  for (const filePath of files) hashes.set(filePath, hashFile(filePath));
  return hashes;
}

function hashFileIfExists(filePath) {
  return fileExists(filePath) ? hashFile(filePath) : null;
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

function renderReportMd(report) {
  const lines = [
    "# French New-Question Promotion Apply Report",
    "",
    `- Mode: ${report.mode}`,
    `- Total decisions: ${report.counts.totalDecisions}`,
    `- Reviewed decisions: ${report.counts.reviewedCount}`,
    `- Skipped unreviewed: ${report.counts.unreviewedSkippedCount}`,
    `- Staged final promotion preview: ${report.counts.safeToPromoteCount}`,
    `- Linked existing qids: ${report.counts.linkedExistingQidCount}`,
    `- Needs human review: ${report.counts.needsHumanReviewCount}`,
    `- Rejected: ${report.counts.rejectedCount}`,
    `- Invalid skipped: ${report.counts.invalidSkippedCount}`,
    `- questions.json changed: ${report.questionsJsonChanged ? "yes" : "no"}`,
    `- translations.fr.json changed: ${report.translationsFrChanged ? "yes" : "no"}`,
    `- French coverage: ${report.frenchCoverage.before} -> ${report.frenchCoverage.after} (${report.frenchCoverage.delta >= 0 ? "+" : ""}${report.frenchCoverage.delta})`,
    `- Integrity before: ${report.integrity.before.criticalBlockers} critical blockers, ${report.integrity.before.warnings} warnings`,
    "",
    "## Outputs",
    `- Final preview: ${report.outputs.finalPreview}`,
    `- Unresolved queue: ${report.outputs.unresolved}`,
    `- Rejected queue: ${report.outputs.rejected}`,
    "",
    "## Linked Existing QIDs",
    ...formatList(report.linkedExistingQids),
    "",
    "## Staged Promotion Candidates",
    ...formatList(report.stagedPromotionCandidateIds),
    "",
    "## Unresolved Candidates",
    ...formatList(report.unresolvedCandidateIds),
    "",
    "## Warnings",
    ...formatList(report.warnings),
    "",
    "## Files",
    ...(report.applied ? report.filesChanged : report.filesWouldChange).map((filePath) => `- ${filePath}`),
  ];
  if (report.skippedUnreviewed.length) {
    lines.push("", "## Skipped Unreviewed", ...report.skippedUnreviewed.map((item) => `- ${item.candidateId}: ${item.reason}`));
  }
  if (report.invalidItems.length) {
    lines.push("", "## Invalid Items", ...report.invalidItems.map((item) => `- ${item.candidateId}: ${(item.reasons ?? []).join("; ")}`));
  }
  lines.push("", "## Next Manual Step", "- Direct master promotion was not run. Review the final preview first. The existing `scripts/apply-new-question-promotion.mjs` writes master qbank files directly, so run it only after explicit final approval and after adapting/copying the final reviewed preview into that script's expected input paths.");
  return `${lines.join("\n")}\n`;
}

function formatList(values) {
  if (!Array.isArray(values) || values.length === 0) return ["- none"];
  return values.map((value) => `- ${value}`);
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}
