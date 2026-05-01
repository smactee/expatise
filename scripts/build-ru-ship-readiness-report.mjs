#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const LANG = "ru";
const DATASET = "2023-test1";
const MASTER_PATH = path.join(ROOT, "public", "qbank", DATASET, "questions.json");
const RAW_MASTER_PATH = path.join(ROOT, "public", "qbank", DATASET, "questions.raw.json");
const TRANSLATIONS_PATH = path.join(ROOT, "public", "qbank", DATASET, "translations.ru.json");
const IMAGE_DIR = path.join(ROOT, "public", "qbank", DATASET, "images");
const DISCREPANCY_PREVIEW_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "ru-discrepancy-apply-preview.json");
const BATCH08_APPLY_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "apply-workbench-decisions-ru-batch-08.json");
const BATCH08_FULL_REVIEW_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "full-batch-merge-review-ru-batch-08.json");
const BATCH08_FULL_PREVIEW_PATH = path.join(ROOT, "qbank-tools", "generated", "staging", "translations.ru.batch-08.full.preview.json");
const BATCH08_FULL_DRY_RUN_PATH = path.join(ROOT, "qbank-tools", "generated", "staging", "translations.ru.batch-08.full.merge-dry-run.json");
const CREATE_NEW_STAGE_PATH = path.join(ROOT, "qbank-tools", "generated", "staging", "ru-discrepancy-create-new-candidates.json");
const MISSING_PROD_STAGE_PATH = path.join(ROOT, "qbank-tools", "generated", "staging", "ru-discrepancy-missing-production-merge-candidates.json");
const REPORT_JSON_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "ru-ship-readiness-report.json");
const REPORT_MD_PATH = path.join(ROOT, "qbank-tools", "generated", "reports", "ru-ship-readiness-report.md");

const MCQ_KEYS = new Set(["A", "B", "C", "D"]);
const ROW_KEYS = new Set(["Right", "Wrong"]);
const WATCH_QIDS = ["q0245", "q0176"];

const masterDoc = readJson(MASTER_PATH);
const rawMasterDoc = readJson(RAW_MASTER_PATH);
const translationsDoc = readJson(TRANSLATIONS_PATH);
const discrepancyPreview = readJsonIfExists(DISCREPANCY_PREVIEW_PATH, null);
const batch08Apply = readJsonIfExists(BATCH08_APPLY_PATH, null);
const batch08FullReview = readJsonIfExists(BATCH08_FULL_REVIEW_PATH, null);
const batch08FullPreview = readJsonIfExists(BATCH08_FULL_PREVIEW_PATH, { questions: {} });
const batch08FullDryRun = readJsonIfExists(BATCH08_FULL_DRY_RUN_PATH, { questions: {} });
const createNewStage = readJsonIfExists(CREATE_NEW_STAGE_PATH, { items: [] });
const missingProductionStage = readJsonIfExists(MISSING_PROD_STAGE_PATH, { items: [] });

const masterQuestions = questionArray(masterDoc);
const rawMasterQuestions = questionArray(rawMasterDoc);
const masterByQid = new Map(masterQuestions.map((question) => [normalizeQid(question.id ?? question.qid), question]));
const rawMasterQids = new Set(rawMasterQuestions.map((question) => normalizeQid(question.id ?? question.qid)).filter(Boolean));
const masterQids = new Set(masterByQid.keys());
const translations = translationsDoc.questions && typeof translationsDoc.questions === "object" ? translationsDoc.questions : {};
const translationQids = new Set(Object.keys(translations).map(normalizeQid).filter(Boolean));

const missingQids = [...masterQids].filter((qid) => !translationQids.has(qid)).sort(compareQid);
const extraQids = [...translationQids].filter((qid) => !masterQids.has(qid)).sort(compareQid);
const rawOnlyMasterQids = [...rawMasterQids].filter((qid) => !masterQids.has(qid)).sort(compareQid);

const validation = validateTranslations();
const imageAudit = auditImageAssets();
const discrepancyAudit = summarizeDiscrepancyPreview();
const batch08Audit = summarizeBatch08();
const watchedQids = Object.fromEntries(WATCH_QIDS.map((qid) => [qid, watchQidStatus(qid)]));

const criticalIssues = [
  validation.invalidLocaleAnswerKeys.length ? `${validation.invalidLocaleAnswerKeys.length} invalid MCQ locale answer key(s)` : "",
  validation.invalidRowAnswers.length ? `${validation.invalidRowAnswers.length} invalid ROW answer issue(s)` : "",
  extraQids.length ? `${extraQids.length} extra production translation qid(s) not present in questions.json` : "",
  imageAudit.missingAssetReferences.length ? `${imageAudit.missingAssetReferences.length} missing image asset reference(s)` : "",
].filter(Boolean);

const warnings = [
  missingQids.length ? `${missingQids.length} master qid(s) do not have Russian production translations` : "",
  watchedQids.q0245?.inProduction === false || watchedQids.q0176?.inProduction === false
    ? "q0245/q0176 are staged in batch-08 outputs but still absent from production translations.ru.json"
    : "",
  batch08Audit.safeToMergeNextStep === false ? "batch-08 full merge review is not marked safe-to-merge because it still reports blocker(s)" : "",
  discrepancyAudit.createNewRightWrongStagedOnlyCount ? `${discrepancyAudit.createNewRightWrongStagedOnlyCount} create-new Right/Wrong items remain staged-only and accepted for this release context` : "",
  discrepancyAudit.highRiskAcceptedCount ? `${discrepancyAudit.highRiskAcceptedCount} high-risk discrepancy items remain skipped by the conservative apply script and accepted for this release context` : "",
].filter(Boolean);

const recommendation = criticalIssues.length === 0 ? "ship" : "do not ship";

const report = {
  generatedAt: new Date().toISOString(),
  lang: LANG,
  dataset: DATASET,
  recommendation,
  safeEnoughToShip: recommendation === "ship",
  rationale: recommendation === "ship"
    ? "No critical production-data integrity failures were found. Coverage is partial, and q0245/q0176 remain staged-but-not-production, but those are release caveats rather than corrupt production data."
    : "Critical production-data integrity failures were found; resolve them before publishing.",
  sourcePaths: {
    masterQuestions: rel(MASTER_PATH),
    rawMasterQuestions: rel(RAW_MASTER_PATH),
    productionTranslations: rel(TRANSLATIONS_PATH),
    discrepancyApplyPreview: rel(DISCREPANCY_PREVIEW_PATH),
    batch08ApplyReport: rel(BATCH08_APPLY_PATH),
    batch08FullMergeReview: rel(BATCH08_FULL_REVIEW_PATH),
    batch08FullPreview: rel(BATCH08_FULL_PREVIEW_PATH),
    batch08FullDryRun: rel(BATCH08_FULL_DRY_RUN_PATH),
    createNewStage: rel(CREATE_NEW_STAGE_PATH),
    missingProductionStage: rel(MISSING_PROD_STAGE_PATH),
  },
  fileHashes: {
    productionTranslationsSha256: sha256File(TRANSLATIONS_PATH),
    masterQuestionsSha256: sha256File(MASTER_PATH),
    rawMasterQuestionsSha256: sha256File(RAW_MASTER_PATH),
  },
  counts: {
    masterQids: masterQuestions.length,
    rawMasterQids: rawMasterQuestions.length,
    rawOnlyMasterQids,
    productionRussianTranslations: translationQids.size,
    productionCoveragePercent: percent(translationQids.size, masterQids.size),
    missingQidsComparedToQuestionsJson: missingQids.length,
    extraQidsNotInQuestionsJson: extraQids.length,
    masterTypeCounts: countBy(masterQuestions, (question) => questionType(question)),
    translatedTypeCounts: countTranslatedTypes(),
  },
  missingQids,
  extraQids,
  validation,
  duplicateQidConflicts: {
    productionJsonObjectDuplicateKeysDetectable: false,
    productionExtraQidCount: extraQids.length,
    discrepancyDuplicateApprovalItems: discrepancyPreview?.summary?.countsByCategory?.["duplicate-approval"] ?? null,
    note: "Duplicate object keys cannot be preserved after JSON.parse; this audit checks production extra qids and discrepancy duplicate-approval accounting.",
  },
  watchedQids,
  batch08: batch08Audit,
  discrepancy: discrepancyAudit,
  createNewStagedOnly: {
    totalCreateNewStageItems: Array.isArray(createNewStage.items) ? createNewStage.items.length : 0,
    rightWrongStagedOnlyItems: discrepancyAudit.createNewRightWrongStagedOnlyItems,
  },
  unresolvedProductionBoundItems: discrepancyAudit.unresolvedProductionBoundItems,
  highRiskManuallyAcceptedItems: discrepancyAudit.highRiskAcceptedItems,
  imageAssets: imageAudit,
  criticalIssues,
  warnings,
};

await fsp.mkdir(path.dirname(REPORT_JSON_PATH), { recursive: true });
await fsp.writeFile(REPORT_JSON_PATH, `${JSON.stringify(report, null, 2)}\n`);
await fsp.writeFile(REPORT_MD_PATH, renderMarkdown(report));

console.log(`Wrote ${rel(REPORT_JSON_PATH)}`);
console.log(`Wrote ${rel(REPORT_MD_PATH)}`);
console.log(`Recommendation: ${recommendation}`);
console.log(`RU production translations: ${translationQids.size}/${masterQids.size}`);
console.log(`Missing qids: ${missingQids.length}; extra qids: ${extraQids.length}`);

function validateTranslations() {
  const invalidLocaleAnswerKeys = [];
  const invalidRowAnswers = [];
  const translatedMcqMissingOptions = [];
  const translatedMcqMissingLocaleAnswerKey = [];
  const localeAnswerKeyNotInSourceOrder = [];
  const rowTranslationsWithMcqAnswerKey = [];

  for (const [qidRaw, translation] of Object.entries(translations)) {
    const qid = normalizeQid(qidRaw);
    const master = masterByQid.get(qid);
    if (!master) continue;
    const type = questionType(master);
    const localeKey = normalizeAnswerKey(translation.localeCorrectOptionKey);

    if (type === "mcq") {
      if (!translation.options || typeof translation.options !== "object" || Object.keys(translation.options).length === 0) {
        translatedMcqMissingOptions.push(qid);
      }
      if (!localeKey) {
        translatedMcqMissingLocaleAnswerKey.push(qid);
      } else if (!MCQ_KEYS.has(localeKey)) {
        invalidLocaleAnswerKeys.push({ qid, localeCorrectOptionKey: translation.localeCorrectOptionKey, reason: "MCQ localeCorrectOptionKey must be A/B/C/D" });
      }
      const sourceKeys = new Set(Array.isArray(translation.localeOptionOrder)
        ? translation.localeOptionOrder.map((entry) => normalizeAnswerKey(entry.sourceKey)).filter(Boolean)
        : []);
      if (localeKey && MCQ_KEYS.has(localeKey) && sourceKeys.size > 0 && !sourceKeys.has(localeKey)) {
        localeAnswerKeyNotInSourceOrder.push({ qid, localeCorrectOptionKey: localeKey, sourceKeys: [...sourceKeys].sort() });
      }
    }

    if (type === "row") {
      if (translation.localeCorrectOptionKey) {
        if (!ROW_KEYS.has(localeKey)) {
          rowTranslationsWithMcqAnswerKey.push({ qid, localeCorrectOptionKey: translation.localeCorrectOptionKey });
        }
      }
      const masterAnswer = normalizeAnswerKey(master.answerRaw ?? master.correctRow);
      if (!ROW_KEYS.has(masterAnswer)) {
        invalidRowAnswers.push({ qid, answerRaw: master.answerRaw, correctRow: master.correctRow, reason: "Master ROW answer is not Right/Wrong" });
      }
    }
  }

  return {
    invalidLocaleAnswerKeys,
    invalidRowAnswers,
    translatedMcqMissingOptions,
    translatedMcqMissingLocaleAnswerKey,
    localeAnswerKeyNotInSourceOrder,
    rowTranslationsWithMcqAnswerKey,
    counts: {
      invalidLocaleAnswerKeys: invalidLocaleAnswerKeys.length,
      invalidRowAnswers: invalidRowAnswers.length,
      translatedMcqMissingOptions: translatedMcqMissingOptions.length,
      translatedMcqMissingLocaleAnswerKey: translatedMcqMissingLocaleAnswerKey.length,
      localeAnswerKeyNotInSourceOrder: localeAnswerKeyNotInSourceOrder.length,
      rowTranslationsWithMcqAnswerKey: rowTranslationsWithMcqAnswerKey.length,
    },
  };
}

function auditImageAssets() {
  const imageQids = [];
  const assetReferences = [];
  const missingAssetReferences = [];

  for (const question of masterQuestions) {
    const qid = normalizeQid(question.id ?? question.qid);
    const assets = Array.isArray(question.assets) ? question.assets : [];
    const imageAssets = assets.filter((asset) => asset?.kind === "image" || asset?.src);
    if (imageAssets.length > 0) imageQids.push(qid);
    for (const asset of imageAssets) {
      const src = String(asset.src ?? "");
      const filePath = src.startsWith("/qbank/")
        ? path.join(ROOT, "public", src.replace(/^\/+/, ""))
        : path.join(IMAGE_DIR, path.basename(src));
      const record = { qid, src, filePath: rel(filePath), exists: fs.existsSync(filePath) };
      assetReferences.push(record);
      if (!record.exists) missingAssetReferences.push(record);
    }
  }

  return {
    masterQidsWithImages: imageQids.length,
    translatedQidsWithMasterImages: imageQids.filter((qid) => translationQids.has(qid)).length,
    assetReferenceCount: assetReferences.length,
    missingAssetReferences,
  };
}

function summarizeDiscrepancyPreview() {
  const items = Array.isArray(discrepancyPreview?.items) ? discrepancyPreview.items : [];
  const skipped = items.filter((item) => Array.isArray(item.skipReasons) && item.skipReasons.length > 0);
  const createNewRightWrongStagedOnlyItems = skipped.filter((item) => item.skipReasons.some((reason) => reason.includes("create-new Right/Wrong")));
  const highRiskAcceptedItems = skipped.filter((item) => item.skipReasons.some((reason) => reason.includes("high-risk item requires")));
  const unresolvedProductionBoundItems = skipped.filter((item) => ["approve", "new"].includes(item.finalDecision)).map(compactDiscrepancyItem);
  return {
    applied: discrepancyPreview?.applyResult?.applied ?? null,
    summary: discrepancyPreview?.summary ?? null,
    skippedCount: skipped.length,
    createNewRightWrongStagedOnlyCount: createNewRightWrongStagedOnlyItems.length,
    createNewRightWrongStagedOnlyItems: createNewRightWrongStagedOnlyItems.map(compactDiscrepancyItem),
    highRiskAcceptedCount: highRiskAcceptedItems.length,
    highRiskAcceptedItems: highRiskAcceptedItems.map(compactDiscrepancyItem),
    unresolvedProductionBoundItems,
    manuallyConfirmedDuplicateLabelCount: discrepancyPreview?.summary?.manuallyConfirmedDuplicateLabelCount ?? null,
  };
}

function summarizeBatch08() {
  const fullPreviewQuestions = batch08FullPreview.questions && typeof batch08FullPreview.questions === "object" ? batch08FullPreview.questions : {};
  const fullDryRunQuestions = batch08FullDryRun.questions && typeof batch08FullDryRun.questions === "object" ? batch08FullDryRun.questions : {};
  return {
    applyCounts: batch08Apply?.counts ?? null,
    applySafeToMergeNextStep: batch08Apply?.safeToMergeNextStep ?? null,
    applyBlockers: batch08Apply?.blockers ?? [],
    fullReviewSafeToMergeNextStep: batch08FullReview?.safeToMergeNextStep ?? null,
    fullReviewBlockers: batch08FullReview?.blockers ?? [],
    safeToMergeNextStep: batch08FullReview?.safeToMergeNextStep ?? batch08Apply?.safeToMergeNextStep ?? null,
    fullPreviewQidCount: Object.keys(fullPreviewQuestions).length,
    fullDryRunProductionQidCount: Object.keys(fullDryRunQuestions).length,
    fullPreviewContainsQ0245: Boolean(fullPreviewQuestions.q0245),
    fullPreviewContainsQ0176: Boolean(fullPreviewQuestions.q0176),
    fullDryRunContainsQ0245: Boolean(fullDryRunQuestions.q0245),
    fullDryRunContainsQ0176: Boolean(fullDryRunQuestions.q0176),
  };
}

function watchQidStatus(qid) {
  const fullPreviewQuestions = batch08FullPreview.questions && typeof batch08FullPreview.questions === "object" ? batch08FullPreview.questions : {};
  const fullDryRunQuestions = batch08FullDryRun.questions && typeof batch08FullDryRun.questions === "object" ? batch08FullDryRun.questions : {};
  const stageItems = Array.isArray(missingProductionStage.items) ? missingProductionStage.items : [];
  return {
    inMasterQuestions: masterQids.has(qid),
    inProduction: translationQids.has(qid),
    inBatch08FullPreview: Boolean(fullPreviewQuestions[qid]),
    inBatch08FullDryRun: Boolean(fullDryRunQuestions[qid]),
    inMissingProductionStage: stageItems.some((item) => normalizeQid(item.qid) === qid),
    stageItem: stageItems.find((item) => normalizeQid(item.qid) === qid) ?? null,
  };
}

function countTranslatedTypes() {
  const counts = {};
  for (const qid of translationQids) {
    const master = masterByQid.get(qid);
    const type = master ? questionType(master) : "extra";
    counts[type] = (counts[type] ?? 0) + 1;
  }
  return counts;
}

function compactDiscrepancyItem(item) {
  return {
    id: item.id,
    batch: item.batch,
    screenshotPath: item.screenshotPath,
    finalDecision: item.finalDecision,
    approvedQid: item.approvedQid,
    localeAnswerKey: item.localeAnswerKey,
    riskLevel: item.aiReview?.riskLevel ?? "",
    recommendation: item.aiReview?.recommendation ?? "",
    skipReasons: item.skipReasons ?? [],
  };
}

function renderMarkdown(data) {
  const lines = [];
  lines.push("# RU Ship-Readiness Report");
  lines.push("");
  lines.push(`Generated at: ${data.generatedAt}`);
  lines.push(`Recommendation: **${data.recommendation.toUpperCase()}**`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(`- Production RU translations: ${data.counts.productionRussianTranslations}/${data.counts.masterQids} (${data.counts.productionCoveragePercent}%)`);
  lines.push(`- Missing qids vs questions.json: ${data.counts.missingQidsComparedToQuestionsJson}`);
  lines.push(`- Extra qids not in questions.json: ${data.counts.extraQidsNotInQuestionsJson}`);
  lines.push(`- Critical issues: ${data.criticalIssues.length ? data.criticalIssues.join("; ") : "none"}`);
  lines.push(`- Rationale: ${data.rationale}`);
  lines.push("");
  if (data.warnings.length) {
    lines.push("## Release Warnings");
    lines.push("");
    for (const warning of data.warnings) lines.push(`- ${warning}`);
    lines.push("");
  }
  lines.push("## Counts");
  lines.push("");
  lines.push(`- questions.json master qids: ${data.counts.masterQids}`);
  lines.push(`- questions.raw.json qids: ${data.counts.rawMasterQids}`);
  lines.push(`- raw-only qids absent from questions.json: ${data.counts.rawOnlyMasterQids.length ? data.counts.rawOnlyMasterQids.join(", ") : "none"}`);
  lines.push(`- master type counts: ${JSON.stringify(data.counts.masterTypeCounts)}`);
  lines.push(`- translated type counts: ${JSON.stringify(data.counts.translatedTypeCounts)}`);
  lines.push("");
  lines.push("## Production Translation Integrity");
  lines.push("");
  lines.push(`- Invalid MCQ locale answer keys: ${data.validation.counts.invalidLocaleAnswerKeys}`);
  lines.push(`- Invalid ROW answer issues: ${data.validation.counts.invalidRowAnswers}`);
  lines.push(`- Translated MCQs missing option objects: ${data.validation.counts.translatedMcqMissingOptions}`);
  lines.push(`- Translated MCQs missing localeCorrectOptionKey: ${data.validation.counts.translatedMcqMissingLocaleAnswerKey}`);
  lines.push(`- Locale answer keys not present in source option order: ${data.validation.counts.localeAnswerKeyNotInSourceOrder}`);
  lines.push(`- ROW translations carrying MCQ answer keys: ${data.validation.counts.rowTranslationsWithMcqAnswerKey}`);
  lines.push("");
  lines.push("## q0245 / q0176");
  lines.push("");
  for (const qid of WATCH_QIDS) {
    const status = data.watchedQids[qid];
    lines.push(`- ${qid}: production=${yesNo(status.inProduction)}, batch08 full preview=${yesNo(status.inBatch08FullPreview)}, batch08 full dry-run=${yesNo(status.inBatch08FullDryRun)}, missing-production stage=${yesNo(status.inMissingProductionStage)}`);
  }
  lines.push("");
  lines.push("## Discrepancy Apply Status");
  lines.push("");
  lines.push(`- Apply run marked applied: ${yesNo(data.discrepancy.applied)}`);
  lines.push(`- Skipped after conservative apply: ${data.discrepancy.skippedCount}`);
  lines.push(`- Create-new Right/Wrong staged-only items: ${data.discrepancy.createNewRightWrongStagedOnlyCount}`);
  lines.push(`- High-risk manually accepted items still skipped by conservative apply: ${data.discrepancy.highRiskAcceptedCount}`);
  lines.push(`- Manually confirmed duplicate-label answers: ${data.discrepancy.manuallyConfirmedDuplicateLabelCount}`);
  lines.push("");
  lines.push("## Batch-08 Staging");
  lines.push("");
  lines.push(`- Apply counts: ${JSON.stringify(data.batch08.applyCounts)}`);
  lines.push(`- Full preview qids: ${data.batch08.fullPreviewQidCount}`);
  lines.push(`- Full dry-run production qids: ${data.batch08.fullDryRunProductionQidCount}`);
  lines.push(`- Safe to merge next step: ${yesNo(data.batch08.safeToMergeNextStep)}`);
  lines.push(`- Blockers: ${data.batch08.fullReviewBlockers.length}`);
  for (const blocker of data.batch08.fullReviewBlockers) lines.push(`  - ${blocker.qid}: ${(blocker.reasons ?? []).join(", ")}`);
  lines.push("");
  lines.push("## Image Asset References");
  lines.push("");
  lines.push(`- Master qids with images: ${data.imageAssets.masterQidsWithImages}`);
  lines.push(`- Translated qids with master images: ${data.imageAssets.translatedQidsWithMasterImages}`);
  lines.push(`- Asset references checked: ${data.imageAssets.assetReferenceCount}`);
  lines.push(`- Missing asset references: ${data.imageAssets.missingAssetReferences.length}`);
  lines.push("");
  lines.push("## Remaining Missing QIDs");
  lines.push("");
  lines.push(data.missingQids.length ? data.missingQids.join(", ") : "None");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function questionArray(doc) {
  if (Array.isArray(doc.questions)) return doc.questions;
  if (doc.questions && typeof doc.questions === "object") return Object.values(doc.questions);
  return [];
}

function questionType(question) {
  return String(question?.type ?? "").trim().toLowerCase() || "unknown";
}

function normalizeQid(value) {
  const raw = String(value ?? "").trim();
  const match = raw.match(/^q?(\d{1,4})$/iu);
  return match ? `q${match[1].padStart(4, "0")}` : raw;
}

function normalizeAnswerKey(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  if (MCQ_KEYS.has(upper)) return upper;
  if (["R", "RIGHT", "TRUE", "CORRECT"].includes(upper)) return "Right";
  if (["W", "WRONG", "FALSE", "INCORRECT"].includes(upper)) return "Wrong";
  return raw;
}

function compareQid(a, b) {
  return Number(a.replace(/\D/gu, "")) - Number(b.replace(/\D/gu, ""));
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readJsonIfExists(filePath, fallback) {
  return fs.existsSync(filePath) ? readJson(filePath) : fallback;
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function percent(part, total) {
  return total ? Number(((part / total) * 100).toFixed(2)) : 0;
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function yesNo(value) {
  if (value === null || value === undefined) return "unknown";
  return value ? "yes" : "no";
}
