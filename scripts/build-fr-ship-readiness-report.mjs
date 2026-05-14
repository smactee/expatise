#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DATASET_DIR = path.join(ROOT, "public", "qbank", "2023-test1");
const REPORTS_DIR = path.join(ROOT, "qbank-tools", "generated", "reports");
const STAGING_DIR = path.join(ROOT, "qbank-tools", "generated", "staging");

const reportJsonPath = path.join(REPORTS_DIR, "fr-ship-readiness-report.json");
const reportMdPath = path.join(REPORTS_DIR, "fr-ship-readiness-report.md");

const questions = questionArray(readJson(path.join(DATASET_DIR, "questions.json")));
const rawQuestions = questionArray(readJson(path.join(DATASET_DIR, "questions.raw.json")));
const frTranslations = translationQuestions(readJson(path.join(DATASET_DIR, "translations.fr.json")));
const finalPreview = readJson(path.join(STAGING_DIR, "fr-new-question-promotion-final-preview.json"));
const unresolved = readJsonIfExists(path.join(STAGING_DIR, "fr-new-question-promotion-unresolved.json"), { items: [] });
const rejected = readJsonIfExists(path.join(STAGING_DIR, "fr-new-question-promotion-rejected.json"), { items: [] });
const workbenchDecisions = readJsonIfExists(path.join(STAGING_DIR, "fr-new-question-promotion-workbench-decisions.json"), { items: [] });
const promotionApplyReport = readJsonIfExists(path.join(REPORTS_DIR, "fr-new-question-promotion-apply-report.json"), null);
const propagationReport = readJsonIfExists(path.join(REPORTS_DIR, "propagation-report.json"), null);
const coverageReport = readJsonIfExists(path.join(REPORTS_DIR, "localization-coverage-matrix.fr.wrapup.json"), null);
const integrityReport = readJsonIfExists(path.join(REPORTS_DIR, "qbank-integrity-audit.json"), { critical: [], warnings: [] });

const masterQids = questionArrayQids(questions);
const rawQids = questionArrayQids(rawQuestions);
const masterQidSet = new Set(masterQids);
const rawQidSet = new Set(rawQids);
const frQids = Object.keys(frTranslations).map(normalizeQid).filter(Boolean).sort(compareQid);
const frQidSet = new Set(frQids);
const promotedItems = Array.isArray(finalPreview?.items) ? finalPreview.items : [];
const promotedQids = promotedItems.map((item) => normalizeQid(item.proposedQid)).filter(Boolean).sort(compareQid);
const unresolvedItems = Array.isArray(unresolved?.items) ? unresolved.items : [];
const rejectedItems = Array.isArray(rejected?.items) ? rejected.items : [];
const skippedUnreviewedItems = (Array.isArray(workbenchDecisions?.items) ? workbenchDecisions.items : [])
  .filter((item) => item?.reviewed !== true);
const critical = Array.isArray(integrityReport?.critical)
  ? integrityReport.critical
  : Array.isArray(integrityReport?.criticalBlockers)
    ? integrityReport.criticalBlockers
    : [];
const warnings = Array.isArray(integrityReport?.warnings) ? integrityReport.warnings : [];

const missingInMaster = promotedQids.filter((qid) => !masterQidSet.has(qid));
const missingInRaw = promotedQids.filter((qid) => !rawQidSet.has(qid));
const missingReadyFrench = promotedQids.filter((qid) => !isUsableTranslation(frTranslations[qid]));
const missingTranslationEntries = masterQids.filter((qid) => !frQidSet.has(qid));
const placeholderEntries = Object.entries(frTranslations)
  .filter(([, entry]) => isPlaceholderTranslation(entry))
  .map(([qid]) => normalizeQid(qid))
  .filter(Boolean)
  .sort(compareQid);
const usableFrenchQids = Object.entries(frTranslations)
  .filter(([, entry]) => isUsableTranslation(entry))
  .map(([qid]) => normalizeQid(qid))
  .filter(Boolean)
  .sort(compareQid);
const duplicateWarnings = warnings.filter((warning) => warning?.type === "duplicate-candidate");
const missingProductionTranslationWarnings = warnings.filter((warning) => warning?.type === "translation-missing-qid");
const validationBlockers = [
  ...missingInMaster.map((qid) => ({ type: "promoted-qid-missing-from-questions", qid })),
  ...missingInRaw.map((qid) => ({ type: "promoted-qid-missing-from-raw-questions", qid })),
  ...missingReadyFrench.map((qid) => ({ type: "promoted-qid-missing-ready-french-translation", qid })),
];
const criticalBlockers = [...critical, ...validationBlockers];
const warningReasons = [
  ...(warnings.length ? [`integrity warnings: ${warnings.length}`] : []),
  ...(unresolvedItems.length ? [`unresolved promotion candidates: ${unresolvedItems.length}`] : []),
  ...(skippedUnreviewedItems.length ? [`skipped unreviewed promotion candidates: ${skippedUnreviewedItems.length}`] : []),
  ...(placeholderEntries.length ? [`French placeholder translations: ${placeholderEntries.length}`] : []),
];

const recommendation = criticalBlockers.length
  ? "do-not-ship"
  : warningReasons.length
    ? "ship-with-warnings"
    : "ship";

const report = {
  generatedAt: new Date().toISOString(),
  lang: "fr",
  dataset: "2023-test1",
  recommendation,
  summary: {
    finalFrenchCoverageUsable: usableFrenchQids.length,
    finalFrenchEntries: frQids.length,
    frenchPlaceholderEntries: placeholderEntries.length,
    previousFrenchCoverageUsable: promotionApplyReport?.frenchCoverage?.after ?? null,
    newlyPromotedQidCount: promotedQids.length,
    unresolvedRemainingCount: unresolvedItems.length,
    skippedRemainingCount: skippedUnreviewedItems.length,
    rejectedRemainingCount: rejectedItems.length,
    masterQuestionCount: masterQids.length,
    rawQuestionCount: rawQids.length,
    criticalBlockers: criticalBlockers.length,
    warnings: warnings.length,
    duplicateWarnings: duplicateWarnings.length,
    missingProductionTranslationWarnings: missingProductionTranslationWarnings.length,
  },
  promotedQids,
  unresolvedRemaining: unresolvedItems.map((item) => item.candidateId ?? item.sourceImage ?? item.itemId).filter(Boolean),
  skippedRemaining: skippedUnreviewedItems.map((item) => item.candidateId ?? item.sourceImage ?? item.itemId).filter(Boolean),
  rejectedRemaining: rejectedItems.map((item) => item.candidateId ?? item.sourceImage ?? item.itemId).filter(Boolean),
  linkedExistingQidsFromReview: promotionApplyReport?.linkedExistingQids ?? [],
  validation: {
    missingInMaster,
    missingInRaw,
    missingReadyFrench,
    missingTranslationEntries,
    placeholderEntries,
    criticalBlockers,
    warningReasons,
  },
  propagation: propagationReport
    ? {
        reportPath: rel(path.join(REPORTS_DIR, "propagation-report.json")),
        masterQids: propagationReport?.summary?.masterQids ?? null,
        languagesProcessed: propagationReport?.languagesProcessed ?? [],
        entriesAddedPerLanguage: propagationReport?.entriesAddedPerLanguage ?? {},
        totalEntriesAdded: propagationReport?.summary?.totalEntriesAdded ?? null,
      }
    : null,
  coverageReport: coverageReport
    ? {
        path: rel(path.join(REPORTS_DIR, "localization-coverage-matrix.fr.wrapup.json")),
        existingCoverageSummary: coverageReport.existingCoverageSummary ?? null,
      }
    : null,
  integrity: {
    path: rel(path.join(REPORTS_DIR, "qbank-integrity-audit.json")),
    critical: critical.length,
    warnings: warnings.length,
    warningTypes: countBy(warnings, (warning) => warning?.type ?? "unknown"),
  },
};

fs.mkdirSync(REPORTS_DIR, { recursive: true });
fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(reportMdPath, renderMarkdown(report));

console.log(`Wrote ${rel(reportJsonPath)}`);
console.log(`Wrote ${rel(reportMdPath)}`);
console.log(`Recommendation: ${report.recommendation}`);
console.log(`French usable coverage: ${report.summary.previousFrenchCoverageUsable ?? "unknown"} -> ${report.summary.finalFrenchCoverageUsable}`);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  return fs.existsSync(filePath) ? readJson(filePath) : fallback;
}

function questionArray(doc) {
  if (Array.isArray(doc)) return doc;
  if (Array.isArray(doc?.questions)) return doc.questions;
  return [];
}

function translationQuestions(doc) {
  return doc?.questions && typeof doc.questions === "object" && !Array.isArray(doc.questions) ? doc.questions : {};
}

function questionArrayQids(items) {
  return items.map((item) => normalizeQid(item?.id ?? item?.qid)).filter(Boolean).sort(compareQid);
}

function normalizeQid(value) {
  const text = String(value ?? "").trim().toLowerCase();
  const match = text.match(/^q?(\d+)$/);
  return match ? `q${match[1].padStart(4, "0")}` : text || null;
}

function compareQid(left, right) {
  const leftNumber = Number(String(left).replace(/^q/i, ""));
  const rightNumber = Number(String(right).replace(/^q/i, ""));
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  return String(left).localeCompare(String(right));
}

function isUsableTranslation(entry) {
  return Boolean(entry && typeof entry.prompt === "string" && entry.prompt.trim());
}

function isPlaceholderTranslation(entry) {
  return Boolean(entry && (entry.translationStatus === "missing" || entry.source === "auto-propagation" || !isUsableTranslation(entry)));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function renderMarkdown(reportValue) {
  const lines = [];
  lines.push("# French Ship Readiness Report", "");
  lines.push(`Generated: ${reportValue.generatedAt}`);
  lines.push(`Recommendation: ${reportValue.recommendation}`, "");
  lines.push("## Summary", "");
  lines.push(`- Final French usable coverage: ${reportValue.summary.finalFrenchCoverageUsable}`);
  lines.push(`- French entries including placeholders: ${reportValue.summary.finalFrenchEntries}`);
  lines.push(`- French placeholder entries: ${reportValue.summary.frenchPlaceholderEntries}`);
  lines.push(`- Newly promoted qids: ${reportValue.summary.newlyPromotedQidCount}`);
  lines.push(`- Unresolved remaining: ${reportValue.summary.unresolvedRemainingCount}`);
  lines.push(`- Skipped remaining: ${reportValue.summary.skippedRemainingCount}`);
  lines.push(`- Rejected remaining: ${reportValue.summary.rejectedRemainingCount}`);
  lines.push(`- Master question count: ${reportValue.summary.masterQuestionCount}`);
  lines.push(`- Critical blockers: ${reportValue.summary.criticalBlockers}`);
  lines.push(`- Integrity warnings: ${reportValue.summary.warnings}`);
  lines.push(`- Duplicate warnings: ${reportValue.summary.duplicateWarnings}`, "");
  lines.push("## Promoted QIDs", "");
  lines.push(reportValue.promotedQids.join(", ") || "None.");
  lines.push("");
  lines.push("## Remaining Review Queues", "");
  lines.push(`- Unresolved: ${reportValue.unresolvedRemaining.join(", ") || "none"}`);
  lines.push(`- Skipped: ${reportValue.skippedRemaining.join(", ") || "none"}`);
  lines.push(`- Rejected: ${reportValue.rejectedRemaining.join(", ") || "none"}`);
  lines.push("");
  if (reportValue.validation.warningReasons.length) {
    lines.push("## Warning Reasons", "");
    for (const reason of reportValue.validation.warningReasons) {
      lines.push(`- ${reason}`);
    }
    lines.push("");
  }
  lines.push("## Propagation", "");
  if (reportValue.propagation) {
    lines.push(`- Languages processed: ${reportValue.propagation.languagesProcessed.join(", ")}`);
    lines.push(`- Total entries added: ${reportValue.propagation.totalEntriesAdded}`);
    lines.push(`- Entries added per language: ${Object.entries(reportValue.propagation.entriesAddedPerLanguage).map(([lang, count]) => `${lang} ${count}`).join(", ")}`);
  } else {
    lines.push("No propagation report found.");
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}
