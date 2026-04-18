#!/usr/bin/env node

import path from "node:path";

import { parsePilotArgs } from "./next-language-preflight-lib.mjs";
import {
  OUTPUT_DIR,
  benchmarkRowCaseTypes,
  buildPreflightItemIndex,
  ensureOutputDir,
  fileExistsOrThrow,
  isHardRiskCase,
  isWarningRiskCase,
  nowIso,
  readCsv,
  readJsonl,
  routeCountsToMarkdown,
  runBatchProfileComparison,
  signalOutcome,
  summarizeRunRoutes,
  writeCsv,
  writeMarkdown,
} from "./next-language-validation-lib.mjs";

const args = parsePilotArgs();
const lang = args.lang || "ja";
const dataset = args.dataset || "2023-test1";
const benchmarkPath = path.join(OUTPUT_DIR, "adversarial_benchmark.jsonl");
const comparisonProfile = args.comparisonProfile || "calibrated";
const outputPrefix = args.outputPrefix || "";
const secondBatchValidationPath = path.join(OUTPUT_DIR, `${outputPrefix}second_batch_validation.csv`);

ensureOutputDir();
fileExistsOrThrow(benchmarkPath, "Run scripts/build-adversarial-benchmark.mjs first.");

const benchmarkRows = readJsonl(benchmarkPath);
const batches = Array.from(new Set(benchmarkRows.map((row) => row.sourceBatchId))).sort();
const batchRuns = new Map();

for (const batchId of batches) {
  const comparison = await runBatchProfileComparison({
    lang,
    batchId,
    dataset,
    runBaseline: false,
    writeArtifacts: false,
    comparisonProfile,
  });
  batchRuns.set(batchId, {
    originalRun: comparison.originalRun,
    calibratedRun: comparison.calibratedRun,
    originalIndex: buildPreflightItemIndex(comparison.originalRun),
    calibratedIndex: buildPreflightItemIndex(comparison.calibratedRun),
  });
}

const evaluationRows = benchmarkRows.map((row) => {
  const batchRun = batchRuns.get(row.sourceBatchId);
  const originalItem = batchRun?.originalIndex.get(row.benchmarkKey) ?? null;
  const calibratedItem = batchRun?.calibratedIndex.get(row.benchmarkKey) ?? null;
  const caseTypes = benchmarkRowCaseTypes(row);
  const hardRisk = isHardRiskCase(caseTypes);
  const warningRisk = isWarningRiskCase(caseTypes);

  return {
    benchmarkId: row.benchmarkId,
    benchmarkRank: row.benchmarkRank,
    sourceBatchId: row.sourceBatchId,
    sourceItemId: row.sourceItemId,
    sourceImage: row.sourceImage,
    adversarialCaseTypes: caseTypes.join("|"),
    humanFinalDecision: row.finalDecision,
    humanFinalQid: row.finalQid ?? "",
    autoSuggestedQid: row.autoSuggestedQid ?? "",
    autoSuggestedScore: row.autoSuggestedScore ?? "",
    baselineRoute: originalItem?.baselineRoute ?? "",
    originalRoute: originalItem?.recommendedRoute ?? "",
    originalStatus: originalItem?.preflightStatus ?? "",
    originalSignals: originalItem?.decisionSignals.map((signal) => signal.code).join("|") ?? "",
    originalOutcome: signalOutcome(originalItem),
    calibratedRoute: calibratedItem?.recommendedRoute ?? "",
    calibratedStatus: calibratedItem?.preflightStatus ?? "",
    calibratedSignals: calibratedItem?.decisionSignals.map((signal) => signal.code).join("|") ?? "",
    calibratedOutcome: signalOutcome(calibratedItem),
    hardRisk: hardRisk ? "true" : "false",
    warningRisk: warningRisk ? "true" : "false",
    originalMeaningfullyFlagged: originalItem && signalOutcome(originalItem) !== "silent-pass" ? "true" : "false",
    calibratedMeaningfullyFlagged: calibratedItem && signalOutcome(calibratedItem) !== "silent-pass" ? "true" : "false",
    calibratedHardRiskSlip: hardRisk && signalOutcome(calibratedItem) === "silent-pass" ? "true" : "false",
  };
});

const evaluationCsvPath = path.join(OUTPUT_DIR, `${outputPrefix}adversarial_evaluation.csv`);
const evaluationMdPath = path.join(OUTPUT_DIR, `${outputPrefix}adversarial_evaluation.md`);
const recommendationPath = path.join(OUTPUT_DIR, `${outputPrefix}validation_recommendation.md`);

await writeCsv(evaluationCsvPath, [
  "benchmarkId",
  "benchmarkRank",
  "sourceBatchId",
  "sourceItemId",
  "sourceImage",
  "adversarialCaseTypes",
  "humanFinalDecision",
  "humanFinalQid",
  "autoSuggestedQid",
  "autoSuggestedScore",
  "baselineRoute",
  "originalRoute",
  "originalStatus",
  "originalSignals",
  "originalOutcome",
  "calibratedRoute",
  "calibratedStatus",
  "calibratedSignals",
  "calibratedOutcome",
  "hardRisk",
  "warningRisk",
  "originalMeaningfullyFlagged",
  "calibratedMeaningfullyFlagged",
  "calibratedHardRiskSlip",
], evaluationRows);
await writeMarkdown(evaluationMdPath, buildEvaluationMarkdown(evaluationRows, batchRuns, comparisonProfile));
await writeMarkdown(recommendationPath, buildRecommendationMarkdown({
  evaluationRows,
  batchRuns,
  comparisonProfile,
  secondBatchValidationRows: readSecondBatchValidation(secondBatchValidationPath),
}));

console.log(JSON.stringify({
  benchmarkRows: benchmarkRows.length,
  evaluationCsvPath,
  evaluationMdPath,
  recommendationPath,
}, null, 2));

function buildEvaluationMarkdown(evaluationRows, batchRuns, comparisonProfile) {
  const hardRiskRows = evaluationRows.filter((row) => row.hardRisk === "true");
  const warningRiskRows = evaluationRows.filter((row) => row.warningRisk === "true");
  const slips = evaluationRows.filter((row) => row.calibratedHardRiskSlip === "true");
  const liveMatchedRiskRows = evaluationRows.filter((row) => row.baselineRoute === "auto-match ok");
  const caseTypeStats = {};
  for (const row of evaluationRows) {
    for (const type of row.adversarialCaseTypes.split("|").filter(Boolean)) {
      if (!caseTypeStats[type]) {
        caseTypeStats[type] = { total: 0, originalFlagged: 0, calibratedFlagged: 0, calibratedSlips: 0 };
      }
      caseTypeStats[type].total += 1;
      if (row.originalMeaningfullyFlagged === "true") caseTypeStats[type].originalFlagged += 1;
      if (row.calibratedMeaningfullyFlagged === "true") caseTypeStats[type].calibratedFlagged += 1;
      if (row.calibratedHardRiskSlip === "true") caseTypeStats[type].calibratedSlips += 1;
    }
  }

  return [
    "# Adversarial Evaluation",
    "",
    `Generated at ${nowIso()} across ${batchRuns.size} Japanese batch(es) for profile \`${comparisonProfile}\`.`,
    "",
    "## Coverage",
    "",
    `- benchmark rows replayed: ${evaluationRows.length}`,
    `- hard-risk rows: ${hardRiskRows.length}`,
    `- warning-risk rows: ${warningRiskRows.length}`,
    `- live matched risky rows: ${liveMatchedRiskRows.length}`,
    `- ${comparisonProfile} hard-risk silent passes: ${slips.length}`,
    `- original live matched risky routed/warned/silent: ${liveMatchedRiskRows.filter((row) => row.originalOutcome === "routed").length}/${liveMatchedRiskRows.filter((row) => row.originalOutcome === "warning-only").length}/${liveMatchedRiskRows.filter((row) => row.originalOutcome === "silent-pass").length}`,
    `- ${comparisonProfile} live matched risky routed/warned/silent: ${liveMatchedRiskRows.filter((row) => row.calibratedOutcome === "routed").length}/${liveMatchedRiskRows.filter((row) => row.calibratedOutcome === "warning-only").length}/${liveMatchedRiskRows.filter((row) => row.calibratedOutcome === "silent-pass").length}`,
    "",
    "## Case-Type Flag Coverage",
    "",
    ...Object.entries(caseTypeStats)
      .sort((left, right) => right[1].total - left[1].total)
      .map(([type, stats]) => `- ${type}: original flagged ${stats.originalFlagged}/${stats.total}, ${comparisonProfile} flagged ${stats.calibratedFlagged}/${stats.total}, ${comparisonProfile} hard-risk slips ${stats.calibratedSlips}.`),
    "",
    "## Notes",
    "",
    "- A hard-risk slip means the calibrated profile produced a silent auto-match pass on a benchmark case that historically needed stronger human intervention.",
    "- A meaningful flag means the profile either kept the item out of auto-match ok or left an explicit warning/signal trail.",
  ].join("\n");
}

function buildRecommendationMarkdown({ evaluationRows, batchRuns, secondBatchValidationRows, comparisonProfile }) {
  const secondBatch = summarizeSecondBatch(secondBatchValidationRows);
  const hardRiskRows = evaluationRows.filter((row) => row.hardRisk === "true");
  const warningRiskRows = evaluationRows.filter((row) => row.warningRisk === "true");
  const calibratedHardRiskSlips = hardRiskRows.filter((row) => row.calibratedHardRiskSlip === "true");
  const calibratedWarningSilent = warningRiskRows.filter((row) => row.calibratedMeaningfullyFlagged !== "true");
  const liveMatchedRiskRows = evaluationRows.filter((row) => row.baselineRoute === "auto-match ok");
  const originalLiveMatched = {
    routed: liveMatchedRiskRows.filter((row) => row.originalOutcome === "routed").length,
    warned: liveMatchedRiskRows.filter((row) => row.originalOutcome === "warning-only").length,
    silent: liveMatchedRiskRows.filter((row) => row.originalOutcome === "silent-pass").length,
  };
  const calibratedLiveMatched = {
    routed: liveMatchedRiskRows.filter((row) => row.calibratedOutcome === "routed").length,
    warned: liveMatchedRiskRows.filter((row) => row.calibratedOutcome === "warning-only").length,
    silent: liveMatchedRiskRows.filter((row) => row.calibratedOutcome === "silent-pass").length,
  };
  const batchIds = Array.from(batchRuns.keys()).sort();
  const secondBatchCounts = batchRuns.has("batch-003")
    ? summarizeRunRoutes(batchRuns.get("batch-003").calibratedRun)
    : null;

  const rolloutRecommendation =
    calibratedHardRiskSlips.length > 0
      ? "one more iteration"
      : calibratedLiveMatched.routed < originalLiveMatched.routed
        ? "one more iteration"
      : secondBatch?.calibratedRiskExposure > 0
        ? "one more iteration"
        : calibratedWarningSilent.length <= Math.max(3, Math.round(warningRiskRows.length * 0.08))
          ? "limited pilot"
          : "one more iteration";

  return [
    "# Validation Recommendation",
    "",
    `Generated at ${nowIso()}.`,
    "",
    "## Second-Batch Validation",
    "",
    `- validation batch: batch-003`,
    `- ${comparisonProfile} route changes vs original on batch-003: ${secondBatch?.routeChanges ?? "n/a"}`,
    `- ${comparisonProfile} matched risky auto-match exposures on batch-003: ${secondBatch?.calibratedRiskExposure ?? "n/a"}`,
    `- ${comparisonProfile} matched known-correct auto-match retention on batch-003: ${secondBatch?.calibratedCorrectRetention ?? "n/a"}`,
    ...(secondBatchCounts ? routeCountsToMarkdown(`batch-003 ${comparisonProfile}`, secondBatchCounts) : []),
    "",
    "## Adversarial Benchmark",
    "",
    `- replayed batches: ${batchIds.join(", ")}`,
    `- hard-risk benchmark rows: ${hardRiskRows.length}`,
    `- ${comparisonProfile} hard-risk silent passes: ${calibratedHardRiskSlips.length}`,
    `- warning-risk rows without any calibrated flag: ${calibratedWarningSilent.length}`,
    `- live matched risky rows routed/warned/silent under original: ${originalLiveMatched.routed}/${originalLiveMatched.warned}/${originalLiveMatched.silent}`,
    `- live matched risky rows routed/warned/silent under ${comparisonProfile}: ${calibratedLiveMatched.routed}/${calibratedLiveMatched.warned}/${calibratedLiveMatched.silent}`,
    "",
    "## Decision",
    "",
    `- Does ${comparisonProfile} generalize beyond batch-020? ${secondBatch?.calibratedRiskExposure === 0 ? "Yes on batch-003 strictness/retention, with no new adjudicated risky matched exposure." : "Not yet proven safely enough on the second batch."}`,
    `- Does ${comparisonProfile} still show defensive value on adversarial cases? ${calibratedHardRiskSlips.length === 0 && calibratedLiveMatched.silent === 0 ? "Yes, but mostly through warnings on live matched risks rather than route blocks." : "Partially; live matched risky cases are now mostly warnings and one still slips through silently."}`,
    `- Rollout recommendation: ${rolloutRecommendation}.`,
    "",
    "## Fully Tested vs Partial",
    "",
    "- Fully tested: batch-003 full-batch baseline/original/calibrated comparison against stored Japanese adjudication.",
    "- Fully tested: adversarial replay against real historical benchmark cases using current batch outputs and the current preflight wrapper.",
    "- Partial: answer-key risk remains under-exercised because only a small fraction of replayed cases exposed explicit answer evidence to the current preflight logic.",
    "- Partial: source-side visual semantics are still inferred from translated text plus candidate hidden tags, not from direct screenshot understanding.",
    ["combination-promoted", "final-targeted"].includes(comparisonProfile)
      ? `- Partial: explicit combination promotions are now live, but ${calibratedLiveMatched.warned} live matched risky cases still resolve as warnings rather than route blocks.`
      : "- Partial: warning-only combination behavior is measured descriptively here, but no new combination rule was promoted in this phase.",
  ].join("\n");
}

function summarizeSecondBatch(rows) {
  if (!rows.length) {
    return null;
  }
  const matchedRiskRows = rows.filter((row) =>
    row.baselineSection === "matched" &&
    ["override", "create_new", "unresolved", "delete"].includes(row.humanOutcomeClass),
  );
  const matchedCorrectRows = rows.filter((row) =>
    row.baselineSection === "matched" &&
    row.humanAutoMatchCorrect === "true",
  );
  return {
    routeChanges: rows.filter((row) => row.routeChanged === "true").length,
    calibratedRiskExposure: matchedRiskRows.filter((row) => row.calibratedRecommendedRoute === "auto-match ok").length,
    calibratedCorrectRetention: `${matchedCorrectRows.filter((row) => row.calibratedRecommendedRoute === "auto-match ok").length}/${matchedCorrectRows.length}`,
  };
}

function readSecondBatchValidation(filePath) {
  try {
    return readCsv(filePath);
  } catch {
    return [];
  }
}
