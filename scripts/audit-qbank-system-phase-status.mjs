#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import {
  DEFAULT_DATASET,
  REPORTS_DIR,
  ROOT,
  fileExists,
  getDatasetPaths,
  readJson,
  writeJson,
  writeText,
} from "../qbank-tools/lib/pipeline.mjs";
import {
  compareQid,
  isAutoPropagationPlaceholder,
  normalizeQid,
  questionArray,
  questionQid,
  translationQuestions,
} from "../qbank-tools/lib/missing-localization-backfill.mjs";

const dataset = DEFAULT_DATASET;
const datasetPaths = getDatasetPaths(dataset);
const outputJsonPath = path.join(REPORTS_DIR, "qbank-system-phase-status.json");
const outputMdPath = path.join(REPORTS_DIR, "qbank-system-phase-status.md");

const sourcePaths = {
  questions: datasetPaths.questionsPath,
  rawQuestions: datasetPaths.rawQuestionsPath,
  translationsRu: path.join(datasetPaths.datasetDir, "translations.ru.json"),
  translationsKo: path.join(datasetPaths.datasetDir, "translations.ko.json"),
  translationsJa: path.join(datasetPaths.datasetDir, "translations.ja.json"),
  imageColorTags: datasetPaths.imageColorTagsPath,
  decisionMemory: path.join(ROOT, "qbank-tools", "history", "decision-memory.json"),
  missingQidBackfillAudit: path.join(REPORTS_DIR, "missing-qid-backfill-system-audit.json"),
  duplicateCandidateAudit: path.join(REPORTS_DIR, "duplicate-candidate-audit.json"),
  tagIntelligenceReport: path.join(REPORTS_DIR, "tag-intelligence-report.json"),
  qbankToolsFileAudit: path.join(REPORTS_DIR, "qbank-tools-file-audit.json"),
  qbankIntegrityAudit: path.join(REPORTS_DIR, "qbank-integrity-audit.json"),
  newQuestionPromotionReview: path.join(REPORTS_DIR, "new-question-promotion-review.ru.all.json"),
  mediumArchiveApplyReport: path.join(REPORTS_DIR, "qbank-tools-medium-archive-apply-report.json"),
};

const masterDoc = readJson(sourcePaths.questions);
const rawDoc = readJson(sourcePaths.rawQuestions);
const imageTagsDoc = readJsonIfExists(sourcePaths.imageColorTags, { questions: {} });
const decisionMemory = readJsonIfExists(sourcePaths.decisionMemory, { summary: {}, records: [] });
const missingQidAudit = readJsonIfExists(sourcePaths.missingQidBackfillAudit, null);
const duplicateAudit = readJsonIfExists(sourcePaths.duplicateCandidateAudit, null);
const tagReport = readJsonIfExists(sourcePaths.tagIntelligenceReport, null);
const fileAudit = readJsonIfExists(sourcePaths.qbankToolsFileAudit, null);
const integrityAudit = readJsonIfExists(sourcePaths.qbankIntegrityAudit, null);
const newQuestionReview = readJsonIfExists(sourcePaths.newQuestionPromotionReview, null);
const mediumArchiveApply = readJsonIfExists(sourcePaths.mediumArchiveApplyReport, null);

const masterQids = uniqueSorted(questionArray(masterDoc).map(questionQid).filter(Boolean));
const masterQidSet = new Set(masterQids);
const rawQids = uniqueSorted(questionArray(rawDoc).map(questionQid).filter(Boolean));
const rawQidSet = new Set(rawQids);
const productionCoverage = Object.fromEntries(["ru", "ko", "ja"].map((lang) => [lang, auditLanguageCoverage(lang)]));
const criticalBlockersCount = Number(integrityAudit?.summary?.criticalBlockers ?? 0);
const decisionMemoryCountsByType = decisionMemory?.summary?.byDecisionType ?? countBy(decisionMemory?.records ?? [], (record) => record.decisionType ?? "unknown");
const tagCoverage = tagReport?.summary ? {
  trusted: Number(tagReport.summary.trustedTagQids ?? 0),
  lowConfidence: Number(tagReport.summary.lowConfidenceTagQids ?? 0),
  missing: Number(tagReport.summary.missingTagQids ?? 0),
  imageQidsMissingObjectTags: Number(tagReport.summary.imageQidsMissingObjectTags ?? 0),
  tagsOutsideVocabulary: Number(tagReport.summary.tagsOutsideVocabulary ?? 0),
} : null;
const duplicateRisks = duplicateAudit?.summary ? {
  duplicatePairsFound: Number(duplicateAudit.summary.duplicatePairsFound ?? 0),
  exactDuplicateRisks: Number(duplicateAudit.summary.exactDuplicateRisks ?? 0),
  likelyDuplicates: Number(duplicateAudit.summary.likelyDuplicates ?? 0),
  needsHumanReview: Number(duplicateAudit.summary.needsHumanReview ?? 0),
  mediumIntegrityCandidates: Number(integrityAudit?.duplicates?.counts?.medium ?? 0),
  highIntegrityCandidates: Number(integrityAudit?.duplicates?.counts?.high ?? 0),
} : null;
const cleanupMetrics = {
  fileAuditArchiveCandidates: Number(fileAudit?.summary?.archiveCandidates ?? 0),
  fileAuditUnknownReviewNeeded: Number(fileAudit?.summary?.unknownReviewNeededCount ?? 0),
  mediumArchiveFilesArchived: Number(mediumArchiveApply?.summary?.filesArchived ?? 0),
  mediumArchiveTotalSize: Number(mediumArchiveApply?.summary?.totalSize ?? 0),
};
const buildStatus = detectBuildStatus();

const phases = [
  russianShipReadinessPhase(),
  englishMasterPhase(),
  missingQidBackfillPhase(),
  newQuestionPromotionPhase(),
  duplicateDetectionPhase(),
  decisionMemoryPhase(),
  tagIntelligencePhase(),
  repoCleanupPhase(),
];

const report = {
  generatedAt: new Date().toISOString(),
  dataset,
  sourcePaths: Object.fromEntries(Object.entries(sourcePaths).map(([key, value]) => [key, relative(value)])),
  summary: {
    criticalBlockersCount,
    buildStatus,
    productionLanguageCoverage: productionCoverage,
    decisionMemoryEntryCountsByType: decisionMemoryCountsByType,
    tagCoverage,
    duplicateRisksRemaining: duplicateRisks,
    remainingCleanupCandidates: cleanupMetrics,
    recommendedNextPhase: recommendedNextPhase(phases),
  },
  phases,
};

await writeJson(outputJsonPath, report);
await writeText(outputMdPath, renderMarkdown(report));

console.log(`Wrote ${relative(outputJsonPath)}`);
console.log(`Wrote ${relative(outputMdPath)}`);
console.log(`Critical blockers: ${criticalBlockersCount}`);
for (const phase of phases) {
  console.log(`${phase.phase}: ${phase.status}`);
}
console.log(`Recommended next phase: ${report.summary.recommendedNextPhase}`);

function russianShipReadinessPhase() {
  const ru = productionCoverage.ru;
  const ruIntegrity = translationIntegrity("ru");
  const blockers = [];
  const warnings = [];

  if (criticalBlockersCount > 0) blockers.push(`${criticalBlockersCount} qbank integrity critical blockers remain.`);
  if (ru.missingQids.length > 0) blockers.push(`Russian is missing ${ru.missingQids.length} master qids.`);
  if (ru.extraQids.length > 0) warnings.push(`Russian has ${ru.extraQids.length} extra qids.`);
  if (ruIntegrity.invalidLocaleAnswerKeys > 0 || ruIntegrity.malformedObjects > 0 || ruIntegrity.emptyTextIssues > 0) {
    blockers.push("Russian translation integrity has invalid answer keys, malformed objects, or empty text issues.");
  }

  return phaseRecord({
    phase: "1. Russian ship-readiness",
    status: blockers.length === 0 && ru.coveragePercent === 100 ? "complete" : "partial",
    evidenceFiles: [sourcePaths.translationsRu, sourcePaths.qbankIntegrityAudit],
    keyMetrics: {
      coveragePercent: ru.coveragePercent,
      productionPresentQids: ru.productionPresentQids,
      missingQids: ru.missingQids.length,
      extraQids: ru.extraQids.length,
      criticalBlockers: criticalBlockersCount,
      invalidLocaleAnswerKeys: ruIntegrity.invalidLocaleAnswerKeys,
    },
    blockers,
    warnings,
    recommendedNextAction: blockers.length ? "Resolve Russian integrity blockers before shipping." : "Keep Russian in regression audit before future qbank changes.",
  });
}

function englishMasterPhase() {
  const masterOnly = masterQids.filter((qid) => !rawQidSet.has(qid)).sort(compareQid);
  const rawOnly = rawQids.filter((qid) => !masterQidSet.has(qid)).sort(compareQid);
  const promptMismatches = Number(integrityAudit?.masterRaw?.counts?.promptMismatches ?? 0);
  const invalidMasterAnswers = Number(integrityAudit?.masterAnswers?.counts?.invalidMcqAnswers ?? 0)
    + Number(integrityAudit?.masterAnswers?.counts?.invalidRowAnswers ?? 0);
  const blockers = [];
  const warnings = [];

  if (invalidMasterAnswers > 0) blockers.push(`${invalidMasterAnswers} invalid master answers remain.`);
  if (rawOnly.length > 0) warnings.push(`${rawOnly.length} raw-only qids remain: ${rawOnly.slice(0, 10).join(", ")}`);
  if (masterOnly.length > 0) warnings.push(`${masterOnly.length} master-only qids remain.`);
  if (promptMismatches > 0) warnings.push(`${promptMismatches} raw/master prompt mismatches are tracked as non-critical warnings.`);

  return phaseRecord({
    phase: "2. English master source-of-truth",
    status: blockers.length === 0 && rawOnly.length === 0 && masterOnly.length === 0 ? "complete" : blockers.length === 0 ? "mostly-complete" : "partial",
    evidenceFiles: [sourcePaths.questions, sourcePaths.rawQuestions, sourcePaths.qbankIntegrityAudit],
    keyMetrics: {
      masterQids: masterQids.length,
      rawQids: rawQids.length,
      rawOnlyQids: rawOnly.length,
      masterOnlyQids: masterOnly.length,
      promptMismatches,
      invalidMasterAnswers,
    },
    blockers,
    warnings,
    recommendedNextAction: rawOnly.length ? "Resolve or explicitly document raw-only qids so master/raw drift is intentional." : "Keep master edits behind integrity audit and build.",
  });
}

function missingQidBackfillPhase() {
  const totalMissing = Object.values(productionCoverage).reduce((sum, entry) => sum + entry.missingQids.length, 0);
  const scriptsFound = Number(missingQidAudit?.scripts?.summary?.found ?? 0);
  const scriptsRequired = Number(missingQidAudit?.scripts?.summary?.required ?? 6);
  const memoryEntries = Number(missingQidAudit?.decisionMemory?.backfillEntryCount ?? decisionMemoryCountsByType["backfill-generation"] ?? 0);
  const autoPropagationAvailable = Boolean(missingQidAudit?.autoPropagation?.supportedByCommand ?? fileExists(path.join(ROOT, "scripts", "propagate-new-master-qids.mjs")));
  const blockers = [];
  const warnings = [];

  if (scriptsFound < scriptsRequired) blockers.push(`Backfill scripts found ${scriptsFound}/${scriptsRequired}.`);
  if (totalMissing > 0) warnings.push(`${totalMissing} production missing qids remain across tracked languages.`);
  if (!autoPropagationAvailable) blockers.push("Auto-propagation command is missing.");
  if (missingQidAudit?.remainingBlockers?.length) {
    warnings.push(...missingQidAudit.remainingBlockers.map((entry) => entry.issue));
  }

  return phaseRecord({
    phase: "3. Missing-qid backfill",
    status: blockers.length ? "partial" : warnings.length ? "mostly-complete" : "complete",
    evidenceFiles: [sourcePaths.missingQidBackfillAudit],
    keyMetrics: {
      scriptsFound,
      scriptsRequired,
      totalMissingProductionQids: totalMissing,
      backfillDecisionMemoryEntries: memoryEntries,
      autoPropagationAvailable,
    },
    blockers,
    warnings,
    recommendedNextAction: warnings.length ? "Add propagation to the standard master-edit workflow and regenerate the backfill audit after any language change." : "Keep using backfill validation before merges.",
  });
}

function newQuestionPromotionPhase() {
  const counts = newQuestionReview?.counts ?? {};
  const scripts = [
    "scripts/prepare-new-question-promotion-preview.mjs",
    "scripts/review-new-question-promotions.mjs",
    "scripts/apply-new-question-promotion.mjs",
  ];
  const missingScripts = scripts.filter((scriptPath) => !fileExists(path.join(ROOT, scriptPath)));
  const needsReview = Number(counts.needs_human_review ?? 0);
  const candidatesReviewed = Number(counts.candidatesReviewed ?? 0);
  const blockers = [];
  const warnings = [];

  if (missingScripts.length > 0) blockers.push(`Missing promotion scripts: ${missingScripts.join(", ")}`);
  if (!newQuestionReview) warnings.push("No current new-question promotion review report found.");
  if (needsReview > 0) warnings.push(`${needsReview} new-question candidates still need human review.`);

  return phaseRecord({
    phase: "4. New-question promotion",
    status: blockers.length ? "partial" : needsReview > 0 || !newQuestionReview ? "mostly-complete" : "complete",
    evidenceFiles: [sourcePaths.newQuestionPromotionReview, ...scripts.map((scriptPath) => path.join(ROOT, scriptPath))],
    keyMetrics: {
      candidatesDiscovered: Number(counts.candidatesDiscovered ?? 0),
      candidatesReviewed,
      safeToPromote: Number(counts.safe_to_promote ?? 0),
      needsHumanReview: needsReview,
      likelyDuplicate: Number(counts.likely_duplicate ?? 0),
    },
    blockers,
    warnings,
    recommendedNextAction: needsReview > 0 ? "Manually resolve remaining new-question promotion review items before applying promotions." : "Keep promotion previews/reviews before adding master qids.",
  });
}

function duplicateDetectionPhase() {
  const risks = duplicateRisks ?? {};
  const blockers = [];
  const warnings = [];

  if (Number(risks.exactDuplicateRisks ?? 0) > 0) blockers.push(`${risks.exactDuplicateRisks} exact duplicate risks remain.`);
  if (Number(risks.likelyDuplicates ?? 0) > 0) blockers.push(`${risks.likelyDuplicates} likely duplicate risks remain.`);
  if (Number(risks.needsHumanReview ?? 0) > 0) warnings.push(`${risks.needsHumanReview} duplicate candidate pairs need human review.`);
  if (Number(risks.mediumIntegrityCandidates ?? 0) > 0) warnings.push(`${risks.mediumIntegrityCandidates} medium-confidence duplicate candidates remain in integrity audit.`);

  return phaseRecord({
    phase: "5. Duplicate detection",
    status: blockers.length ? "partial" : warnings.length ? "mostly-complete" : "complete",
    evidenceFiles: [sourcePaths.duplicateCandidateAudit, sourcePaths.qbankIntegrityAudit],
    keyMetrics: risks,
    blockers,
    warnings,
    recommendedNextAction: warnings.length ? "Work down needs-human-review duplicate pairs and export decisions to memory." : "Keep duplicate audit in release checks.",
  });
}

function decisionMemoryPhase() {
  const totalRecords = Number(decisionMemory?.summary?.totalRecords ?? (decisionMemory?.records ?? []).length);
  const blockers = [];
  const warnings = [];

  if (!fileExists(sourcePaths.decisionMemory)) blockers.push("Decision memory file is missing.");
  if (!fileExists(path.join(ROOT, "qbank-tools", "history", "decision-memory.schema.json"))) warnings.push("Decision memory schema file is missing.");
  if (totalRecords === 0) blockers.push("Decision memory has no records.");

  return phaseRecord({
    phase: "6. Decision memory",
    status: blockers.length ? "partial" : "complete",
    evidenceFiles: [sourcePaths.decisionMemory, path.join(ROOT, "qbank-tools", "history", "decision-memory.schema.json")],
    keyMetrics: {
      totalRecords,
      byDecisionType: decisionMemoryCountsByType,
      byFinalDecision: decisionMemory?.summary?.byFinalDecision ?? {},
    },
    blockers,
    warnings,
    recommendedNextAction: "Keep updating decision memory after duplicate, promotion, and localization decisions.",
  });
}

function tagIntelligencePhase() {
  const tags = tagCoverage ?? {};
  const blockers = [];
  const warnings = [];

  if (!tagReport) blockers.push("Tag intelligence report is missing.");
  if (Number(tags.imageQidsMissingObjectTags ?? 0) > 0) warnings.push(`${tags.imageQidsMissingObjectTags} image qids are missing object tags.`);
  if (Number(tags.lowConfidence ?? 0) > 0) warnings.push(`${tags.lowConfidence} qids have low-confidence tags.`);
  if (Number(tags.missing ?? 0) > 0) warnings.push(`${tags.missing} master qids have no object tags; many may be non-image questions.`);

  return phaseRecord({
    phase: "7. Tag intelligence",
    status: blockers.length ? "not-started" : Number(tags.imageQidsMissingObjectTags ?? 0) === 0 ? "mostly-complete" : "partial",
    evidenceFiles: [sourcePaths.tagIntelligenceReport, sourcePaths.imageColorTags],
    keyMetrics: tags,
    blockers,
    warnings,
    recommendedNextAction: Number(tags.imageQidsMissingObjectTags ?? 0) > 0 ? "Backfill the remaining image qid object tags and rerun tag intelligence." : "Use low-confidence tag review to improve duplicate and image replacement ranking.",
  });
}

function repoCleanupPhase() {
  const blockers = [];
  const warnings = [];

  if (!fileAudit) blockers.push("Qbank tools file audit is missing.");
  if (cleanupMetrics.fileAuditArchiveCandidates > 0) warnings.push(`${cleanupMetrics.fileAuditArchiveCandidates} archive candidates remain in file audit.`);
  if (cleanupMetrics.fileAuditUnknownReviewNeeded > 0) warnings.push(`${cleanupMetrics.fileAuditUnknownReviewNeeded} files still need manual cleanup classification.`);

  return phaseRecord({
    phase: "8. Repo cleanup / workflow hygiene",
    status: blockers.length ? "not-started" : cleanupMetrics.fileAuditUnknownReviewNeeded > 0 || cleanupMetrics.fileAuditArchiveCandidates > 0 ? "partial" : "complete",
    evidenceFiles: [sourcePaths.qbankToolsFileAudit, sourcePaths.mediumArchiveApplyReport],
    keyMetrics: cleanupMetrics,
    blockers,
    warnings,
    recommendedNextAction: "Continue cleanup in planned archive-only passes, then rerun the qbank-tools file audit.",
  });
}

function auditLanguageCoverage(lang) {
  const translationPath = path.join(datasetPaths.datasetDir, `translations.${lang}.json`);
  if (!fileExists(translationPath)) {
    return {
      lang,
      exists: false,
      fileEntries: 0,
      productionPresentQids: 0,
      filePresentMasterQids: 0,
      coveragePercent: 0,
      fileCoveragePercent: 0,
      placeholderQids: [],
      missingQids: masterQids,
      extraQids: [],
    };
  }

  const doc = readJson(translationPath);
  const translations = translationQuestions(doc);
  const qids = new Set(Object.keys(translations).map(normalizeQid).filter(Boolean));
  const placeholderQids = new Set(Object.entries(translations)
    .filter(([, entry]) => isAutoPropagationPlaceholder(entry))
    .map(([qid]) => normalizeQid(qid))
    .filter(Boolean));
  const productionQids = new Set([...qids].filter((qid) => !placeholderQids.has(qid)));
  const productionPresentQids = masterQids.filter((qid) => productionQids.has(qid)).sort(compareQid);
  const filePresentMasterQids = masterQids.filter((qid) => qids.has(qid)).sort(compareQid);
  const missingQids = masterQids.filter((qid) => !productionQids.has(qid)).sort(compareQid);
  const extraQids = [...qids].filter((qid) => !masterQidSet.has(qid)).sort(compareQid);

  return {
    lang,
    exists: true,
    fileEntries: Object.keys(translations).length,
    productionPresentQids: productionPresentQids.length,
    filePresentMasterQids: filePresentMasterQids.length,
    coveragePercent: percent(productionPresentQids.length, masterQids.length),
    fileCoveragePercent: percent(filePresentMasterQids.length, masterQids.length),
    placeholderQids: [...placeholderQids].filter((qid) => masterQidSet.has(qid)).sort(compareQid),
    missingQids,
    extraQids,
  };
}

function translationIntegrity(lang) {
  const entry = (integrityAudit?.translations ?? []).find((translation) => translation.lang === lang);
  return entry?.counts ?? {};
}

function phaseRecord({ phase, status, evidenceFiles, keyMetrics, blockers, warnings, recommendedNextAction }) {
  return {
    phase,
    status,
    evidenceFiles: evidenceFiles.filter(Boolean).map(relative),
    keyMetrics,
    blockers,
    warnings,
    recommendedNextAction,
  };
}

function recommendedNextPhase(phases) {
  const priority = [
    "8. Repo cleanup / workflow hygiene",
    "5. Duplicate detection",
    "7. Tag intelligence",
    "4. New-question promotion",
    "3. Missing-qid backfill",
    "2. English master source-of-truth",
    "1. Russian ship-readiness",
    "6. Decision memory",
  ];
  const byName = new Map(phases.map((phase) => [phase.phase, phase]));
  for (const phaseName of priority) {
    const phase = byName.get(phaseName);
    if (phase && phase.status !== "complete") return phase.phase;
  }
  return "All phases are complete; keep regression audits in the release workflow.";
}

function detectBuildStatus() {
  const nextBuildId = path.join(ROOT, ".next", "BUILD_ID");
  if (!fileExists(nextBuildId)) {
    return {
      available: false,
      status: "not-recorded",
      evidence: null,
    };
  }
  const stat = fs.statSync(nextBuildId);
  return {
    available: true,
    status: "build-artifact-present",
    evidence: relative(nextBuildId),
    modifiedAt: stat.mtime.toISOString(),
  };
}

function renderMarkdown(report) {
  const lines = [];
  lines.push("# QBank System Phase Status", "");
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Dataset: ${report.dataset}`);
  lines.push(`Critical blockers: ${report.summary.criticalBlockersCount}`);
  lines.push(`Recommended next phase: ${report.summary.recommendedNextPhase}`);
  lines.push("");
  lines.push("## Phase Statuses", "");
  lines.push("| Phase | Status | Blockers | Warnings | Recommended next action |");
  lines.push("| --- | --- | ---: | ---: | --- |");
  for (const phase of report.phases) {
    lines.push(`| ${phase.phase} | ${phase.status} | ${phase.blockers.length} | ${phase.warnings.length} | ${escapeCell(phase.recommendedNextAction)} |`);
  }
  lines.push("");
  lines.push("## Production Language Coverage", "");
  lines.push("| Language | Coverage | Production qids | Missing | Extra | Placeholders |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const [lang, entry] of Object.entries(report.summary.productionLanguageCoverage)) {
    lines.push(`| ${lang} | ${entry.coveragePercent}% | ${entry.productionPresentQids} | ${entry.missingQids.length} | ${entry.extraQids.length} | ${entry.placeholderQids.length} |`);
  }
  lines.push("");
  lines.push("## Decision Memory Counts By Type", "");
  lines.push(...markdownKeyValueTable(report.summary.decisionMemoryEntryCountsByType, "decisionType", "count"));
  lines.push("");
  lines.push("## Phase Details", "");
  for (const phase of report.phases) {
    lines.push(`### ${phase.phase}`, "");
    lines.push(`- Status: ${phase.status}`);
    lines.push(`- Evidence: ${phase.evidenceFiles.join(", ") || "none"}`);
    lines.push(`- Blockers: ${phase.blockers.length ? phase.blockers.join("; ") : "none"}`);
    lines.push(`- Warnings: ${phase.warnings.length ? phase.warnings.join("; ") : "none"}`);
    lines.push(`- Next action: ${phase.recommendedNextAction}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function markdownKeyValueTable(record, keyLabel, valueLabel) {
  const entries = Object.entries(record ?? {});
  if (!entries.length) return ["None."];
  return [
    `| ${keyLabel} | ${valueLabel} |`,
    "| --- | ---: |",
    ...entries.map(([key, value]) => `| ${escapeCell(key)} | ${value} |`),
  ];
}

function readJsonIfExists(filePath, fallback) {
  return fileExists(filePath) ? readJson(filePath) : fallback;
}

function uniqueSorted(values) {
  return [...new Set(values)].sort(compareQid);
}

function countBy(values, keyFn) {
  const counts = {};
  for (const value of values) {
    const key = String(keyFn(value));
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function relative(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}
