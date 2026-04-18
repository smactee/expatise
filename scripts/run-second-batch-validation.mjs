#!/usr/bin/env node

import path from "node:path";

import { parsePilotArgs } from "./next-language-preflight-lib.mjs";
import {
  OUTPUT_DIR,
  buildHumanOutcomeClass,
  buildPreflightItemIndex,
  countSignals,
  ensureOutputDir,
  loadJapaneseReviewDatasets,
  nowIso,
  routeCountsToMarkdown,
  runBatchProfileComparison,
  summarizeRunRoutes,
  truthyFlag,
  writeCsv,
  writeMarkdown,
} from "./next-language-validation-lib.mjs";

const args = parsePilotArgs();
const batchId = args.batchId || "batch-003";
const lang = args.lang || "ja";
const dataset = args.dataset || "2023-test1";
const comparisonProfile = args.comparisonProfile || "calibrated";
const outputPrefix = args.outputPrefix || "";

ensureOutputDir();

const { originalRun, calibratedRun, originalArtifacts, calibratedArtifacts } = await runBatchProfileComparison({
  lang,
  batchId,
  dataset,
  runBaseline: args.runBaseline === true,
  writeArtifacts: true,
  prefixBase: `${outputPrefix}validation_`,
  comparisonProfile,
});

const datasets = loadJapaneseReviewDatasets();
const originalIndex = buildPreflightItemIndex(originalRun);
const calibratedIndex = buildPreflightItemIndex(calibratedRun);

const comparisonRows = originalRun.pilotItems.map((item) => {
  const key = `${batchId}:${item.itemId ?? item.sourceImage}`;
  const calibratedItem = calibratedIndex.get(key);
  const reviewRow = datasets.reviewByKey.get(key) ?? null;
  const evalRow = datasets.evalByKey.get(key) ?? null;
  return {
    itemId: item.itemId ?? "",
    sourceImage: item.sourceImage ?? "",
    baselineSection: item.baselineSection,
    baselineRoute: item.baselineRoute,
    suggestedQid: item.suggestedQid ?? "",
    suggestedScore: item.suggestedScore ?? "",
    humanFinalDecision: reviewRow?.finalDecision ?? "",
    humanFinalQid: reviewRow?.finalQid ?? "",
    humanOutcomeClass: buildHumanOutcomeClass(reviewRow, evalRow),
    humanAutoMatchCorrect: evalRow?.auto_match_correct ?? "",
    humanAutoMatchOverridden: evalRow?.auto_match_overridden ?? "",
    humanAnswerKeyChanged: evalRow?.answer_key_changed ?? "",
    originalPreflightStatus: item.preflightStatus,
    originalRecommendedRoute: item.recommendedRoute,
    originalSignals: item.decisionSignals.map((signal) => signal.code).join("|"),
    calibratedPreflightStatus: calibratedItem?.preflightStatus ?? "",
    calibratedRecommendedRoute: calibratedItem?.recommendedRoute ?? "",
    calibratedSignals: calibratedItem?.decisionSignals.map((signal) => signal.code).join("|") ?? "",
    routeChanged: item.recommendedRoute !== calibratedItem?.recommendedRoute ? "true" : "false",
  };
});

const csvPath = path.join(OUTPUT_DIR, `${outputPrefix}second_batch_validation.csv`);
const mdPath = path.join(OUTPUT_DIR, `${outputPrefix}second_batch_validation.md`);

await writeCsv(csvPath, [
  "itemId",
  "sourceImage",
  "baselineSection",
  "baselineRoute",
  "suggestedQid",
  "suggestedScore",
  "humanFinalDecision",
  "humanFinalQid",
  "humanOutcomeClass",
  "humanAutoMatchCorrect",
  "humanAutoMatchOverridden",
  "humanAnswerKeyChanged",
  "originalPreflightStatus",
  "originalRecommendedRoute",
  "originalSignals",
  "calibratedPreflightStatus",
  "calibratedRecommendedRoute",
  "calibratedSignals",
  "routeChanged",
], comparisonRows);
await writeMarkdown(mdPath, buildValidationMarkdown({
  batchId,
  dataset,
  lang,
  originalRun,
  calibratedRun,
  comparisonRows,
  comparisonProfile,
}));

console.log(JSON.stringify({
  lang,
  batchId,
  dataset,
  comparisonProfile,
  rows: comparisonRows.length,
  originalArtifacts,
  calibratedArtifacts,
  csvPath,
  mdPath,
}, null, 2));

function buildValidationMarkdown({ batchId, dataset, lang, originalRun, calibratedRun, comparisonRows, comparisonProfile }) {
  const originalCounts = summarizeRunRoutes(originalRun);
  const calibratedCounts = summarizeRunRoutes(calibratedRun);
  const changedRoutes = comparisonRows.filter((row) => row.routeChanged === "true").length;
  const matchedRows = comparisonRows.filter((row) => row.baselineSection === "matched");
  const matchedKnownCorrect = matchedRows.filter((row) => row.humanAutoMatchCorrect === "true");
  const matchedKnownRisk = matchedRows.filter((row) =>
    row.humanAutoMatchOverridden === "true" ||
    ["create_new", "unresolved", "delete"].includes(row.humanOutcomeClass),
  );
  const originalSignalCounts = countSignals(originalRun.pilotItems);
  const calibratedSignalCounts = countSignals(calibratedRun.pilotItems);

  const riskJudgment =
    matchedKnownRisk.length === 0
      ? "No adjudicated bad matched items were present in this batch, so this validation mainly measures strictness, not false-positive protection."
      : (() => {
        const originalRiskExposure = matchedKnownRisk.filter((row) => row.originalRecommendedRoute === "auto-match ok").length;
        const calibratedRiskExposure = matchedKnownRisk.filter((row) => row.calibratedRecommendedRoute === "auto-match ok").length;
        if (calibratedRiskExposure > originalRiskExposure) {
          return "Calibrated preflight is looser on some adjudicated risky matched items in this batch and should not become the default yet.";
        }
        if (calibratedRiskExposure === originalRiskExposure) {
          return "Calibrated preflight recovered known-good matches without increasing adjudicated risky matched exposure in this batch.";
        }
        return "Calibrated preflight reduced adjudicated risky matched exposure further in this batch.";
      })();

  return [
    "# Second Batch Validation",
    "",
    `Generated at ${nowIso()} for \`${lang}/${batchId}\` on dataset \`${dataset}\` comparing \`original\` vs \`${comparisonProfile}\`.`,
    "",
    "## Batch Choice",
    "",
    `- validation batch: ${batchId}`,
    "- reason: it has diverse adjudicated outcomes including overrides, create-new, unresolved, and delete, so it is a better generalization check than batch-020 alone.",
    "",
    "## Route Counts",
    "",
    ...routeCountsToMarkdown("baseline", {
      autoMatchOk: originalRun.pilotItems.filter((item) => item.baselineRoute === "auto-match ok").length,
      manualReview: originalRun.pilotItems.filter((item) => item.baselineRoute === "manual review").length,
      likelyCreateNew: 0,
      likelyUnresolved: originalRun.pilotItems.filter((item) => item.baselineRoute === "likely unresolved").length,
      likelyDelete: 0,
      downgraded: 0,
      rerouted: 0,
    }),
    ...routeCountsToMarkdown("original preflight", originalCounts),
    ...routeCountsToMarkdown(`${comparisonProfile} preflight`, calibratedCounts),
    "",
    "## Profile Difference",
    "",
    `- items with different routes between original and calibrated: ${changedRoutes}`,
    `- matched items in batch: ${matchedRows.length}`,
    `- adjudicated matched auto-correct items: ${matchedKnownCorrect.length}`,
    `- adjudicated matched risky items: ${matchedKnownRisk.length}`,
    `- original kept matched auto-correct items as auto-match ok: ${matchedKnownCorrect.filter((row) => row.originalRecommendedRoute === "auto-match ok").length}`,
    `- ${comparisonProfile} kept matched auto-correct items as auto-match ok: ${matchedKnownCorrect.filter((row) => row.calibratedRecommendedRoute === "auto-match ok").length}`,
    `- original exposed matched risky items as auto-match ok: ${matchedKnownRisk.filter((row) => row.originalRecommendedRoute === "auto-match ok").length}`,
    `- ${comparisonProfile} exposed matched risky items as auto-match ok: ${matchedKnownRisk.filter((row) => row.calibratedRecommendedRoute === "auto-match ok").length}`,
    "",
    "## Triggered Signals",
    "",
    ...Object.entries(originalSignalCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([code, count]) => `- original ${code}: ${count}`),
    ...Object.entries(calibratedSignalCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 8)
      .map(([code, count]) => `- ${comparisonProfile} ${code}: ${count}`),
    "",
    "## Judgment",
    "",
    `- ${riskJudgment}`,
  ].join("\n");
}
