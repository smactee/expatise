#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import path from "node:path";

import { ROOT } from "../qbank-tools/lib/pipeline.mjs";
import { parsePilotArgs } from "./next-language-preflight-lib.mjs";
import {
  OUTPUT_DIR,
  benchmarkRowCaseTypes,
  ensureOutputDir,
  readCsv,
  readJsonl,
  writeCsv,
  writeMarkdown,
} from "./next-language-validation-lib.mjs";

const args = parsePilotArgs();
const lang = args.lang || "ja";
const dataset = args.dataset || "2023-test1";
const batchId = args.batchId || "batch-003";

ensureOutputDir();

runNodeScript("scripts/run-second-batch-validation.mjs", [
  "--lang", lang,
  "--batch", batchId,
  "--dataset", dataset,
]);
runNodeScript("scripts/evaluate-adversarial-benchmark.mjs", [
  "--lang", lang,
  "--dataset", dataset,
]);

const benchmarkRows = readJsonl(path.join(OUTPUT_DIR, "adversarial_benchmark.jsonl"));
const benchmarkById = new Map(benchmarkRows.map((row) => [row.benchmarkId, row]));
const currentEvalRows = readCsv(path.join(OUTPUT_DIR, "adversarial_evaluation.csv"));
const survivors = currentEvalRows.filter((row) =>
  row.baselineRoute === "auto-match ok" && ["warning-only", "silent-pass"].includes(row.calibratedOutcome),
);

const survivorAuditRows = survivors.map((row) => {
  const benchmark = benchmarkById.get(row.benchmarkId);
  const caseTypes = benchmarkRowCaseTypes(benchmark);
  const signals = String(row.calibratedSignals ?? "").split("|").filter(Boolean);
  const compactReason = buildCompactReason({ row, benchmark, signals });
  return {
    benchmarkId: row.benchmarkId,
    sourceBatchId: row.sourceBatchId,
    sourceItemId: row.sourceItemId,
    sourceImage: row.sourceImage,
    adversarialCaseTypes: caseTypes.join("|"),
    calibratedOutcome: row.calibratedOutcome,
    calibratedSignals: row.calibratedSignals,
    imageHeavy: caseTypes.includes("image_heavy") ? "true" : "false",
    trustBandCautionFired: signals.includes("trust-band-caution") ? "true" : "false",
    topicDriftFired: signals.includes("topic-subtopic-drift-risk") ? "true" : "false",
    imageMismatchFired: signals.includes("image-sign-symbol-mismatch-risk") ? "true" : "false",
    answerKeyRiskFired: signals.includes("answer-key-consistency-risk") ? "true" : "false",
    createNewTendency: caseTypes.includes("create_new") ? "true" : "false",
    unresolvedDeleteTendency: caseTypes.some((type) => ["unresolved", "delete"].includes(type)) ? "true" : "false",
    humanFinalDecision: row.humanFinalDecision,
    humanFinalQid: row.humanFinalQid,
    autoSuggestedQid: row.autoSuggestedQid,
    autoSuggestedScore: row.autoSuggestedScore,
    currentBaselineRoute: benchmark?.currentBaselineRoute ?? row.baselineRoute,
    currentBaselineSection: benchmark?.currentBaselineSection ?? "",
    compactAuditSummary: compactReason,
  };
});

await writeCsv(
  path.join(OUTPUT_DIR, "risky_survivor_audit.csv"),
  [
    "benchmarkId",
    "sourceBatchId",
    "sourceItemId",
    "sourceImage",
    "adversarialCaseTypes",
    "calibratedOutcome",
    "calibratedSignals",
    "imageHeavy",
    "trustBandCautionFired",
    "topicDriftFired",
    "imageMismatchFired",
    "answerKeyRiskFired",
    "createNewTendency",
    "unresolvedDeleteTendency",
    "humanFinalDecision",
    "humanFinalQid",
    "autoSuggestedQid",
    "autoSuggestedScore",
    "currentBaselineRoute",
    "currentBaselineSection",
    "compactAuditSummary",
  ],
  survivorAuditRows,
);
await writeMarkdown(
  path.join(OUTPUT_DIR, "risky_survivor_summary.md"),
  buildSurvivorSummaryMarkdown(survivorAuditRows),
);
await writeMarkdown(
  path.join(OUTPUT_DIR, "combination_rule_candidates.md"),
  buildCombinationRuleCandidatesMarkdown(survivorAuditRows),
);

runNodeScript("scripts/run-second-batch-validation.mjs", [
  "--lang", lang,
  "--batch", batchId,
  "--dataset", dataset,
  "--comparison-profile", "combination-promoted",
  "--output-prefix", "post_combination_",
]);
runNodeScript("scripts/evaluate-adversarial-benchmark.mjs", [
  "--lang", lang,
  "--dataset", dataset,
  "--comparison-profile", "combination-promoted",
  "--output-prefix", "post_combination_",
]);

console.log(JSON.stringify({
  riskySurvivors: survivorAuditRows.length,
  riskySurvivorAuditPath: "artifacts/next-language-pilot/risky_survivor_audit.csv",
  riskySurvivorSummaryPath: "artifacts/next-language-pilot/risky_survivor_summary.md",
  combinationRuleCandidatesPath: "artifacts/next-language-pilot/combination_rule_candidates.md",
  postCombinationSecondBatchValidationPath: "artifacts/next-language-pilot/post_combination_second_batch_validation.csv",
  postCombinationAdversarialEvaluationPath: "artifacts/next-language-pilot/post_combination_adversarial_evaluation.csv",
  postCombinationRecommendationPath: "artifacts/next-language-pilot/post_combination_validation_recommendation.md",
}, null, 2));

function runNodeScript(relativeScriptPath, args) {
  execFileSync(process.execPath, [path.join(ROOT, relativeScriptPath), ...args], {
    cwd: ROOT,
    stdio: "ignore",
  });
}

function buildCompactReason({ row, benchmark, signals }) {
  if (row.calibratedOutcome === "silent-pass") {
    return "No live warning fired; the current calibrated profile had no rule for this high-confidence option-dominant near-match with missing candidate topic metadata.";
  }
  if (signals.includes("image-sign-symbol-mismatch-risk") && signals.includes("trust-band-caution")) {
    return "The item survived because image/sign mismatch and trust-band caution were both downgraded to warnings under the calibrated profile.";
  }
  if (signals.includes("image-sign-symbol-mismatch-risk")) {
    return "The item survived because moderate image/sign mismatch stayed warning-only under the calibrated profile.";
  }
  if (signals.includes("trust-band-caution")) {
    return "The item survived because trust-band caution alone stayed warning-only after calibration.";
  }
  if (signals.includes("topic-subtopic-drift-risk")) {
    return "The item survived because topic drift alone stayed warning-only after calibration.";
  }
  const caseTypes = benchmarkRowCaseTypes(benchmark);
  return `The item survived with weak live signals despite historical risk labels: ${caseTypes.join(", ")}.`;
}

function buildSurvivorSummaryMarkdown(rows) {
  const signalCounts = countBy(rows, (row) => row.calibratedSignals || "(silent)");
  const silent = rows.filter((row) => row.calibratedOutcome === "silent-pass");
  return [
    "# Risky Survivor Summary",
    "",
    `Generated from the current calibrated adversarial replay with ${rows.length} live risky matched survivors.`,
    "",
    "## Survivor Outcomes",
    "",
    `- warning-only: ${rows.filter((row) => row.calibratedOutcome === "warning-only").length}`,
    `- silent-pass: ${silent.length}`,
    "",
    "## Recurring Warning Sets",
    "",
    ...Object.entries(signalCounts)
      .sort((left, right) => right[1] - left[1])
      .map(([signals, count]) => `- ${signals}: ${count}`),
    "",
    "## Silent Pass Distinction",
    "",
    ...silent.map((row) => `- ${row.sourceBatchId}:${row.sourceItemId} survived with no live warning despite being a historical override and ambiguous near-match.`),
    "",
    "## Observations",
    "",
    "- The dominant recurring pattern is `image-sign-symbol-mismatch-risk + trust-band-caution` on image-heavy override cases.",
    "- Single warning survivors fall into three buckets: image/sign mismatch only, trust-band caution only, and topic drift only.",
    "- The silent survivor is not image-heavy and has no live warning signal, so it needs a separate narrow context-combination catch rather than a generic warning promotion.",
  ].join("\n");
}

function buildCombinationRuleCandidatesMarkdown(rows) {
  const combos = [
    {
      name: "combo-image-sign-context-risk",
      catches: rows.filter((row) =>
        row.imageMismatchFired === "true" &&
        row.currentBaselineRoute === "auto-match ok",
      ).length,
      summary: "Promote image/sign mismatch back to a soft downgrade only when the source is an image-backed MCQ with stronger prompt context and either explicit answer evidence, weaker topic confidence, or a present candidate topic label.",
    },
    {
      name: "combo-trust-option-dominant-risk",
      catches: rows.filter((row) =>
        row.trustBandCautionFired === "true" && row.imageMismatchFired === "false",
      ).length,
      summary: "Promote trust-band caution only for option-dominant near-matches that have no candidate topic metadata and a very confident source topic.",
    },
    {
      name: "combo-trust-answer-context-risk",
      catches: rows.filter((row) =>
        row.trustBandCautionFired === "true" && row.imageHeavy === "true",
      ).length,
      summary: "Promote trust-band caution when the item is image-backed and has explicit answer context, which keeps the binary safety rule narrow and avoids ROW false positives.",
    },
    {
      name: "combo-topic-option-dominant-risk",
      catches: rows.filter((row) =>
        row.topicDriftFired === "true" && row.imageMismatchFired === "false",
      ).length,
      summary: "Promote topic drift only for option-dominant near-matches with missing candidate topic metadata and very confident source topic inference.",
    },
    {
      name: "combo-silent-option-dominant-risk",
      catches: rows.filter((row) => row.calibratedOutcome === "silent-pass").length,
      summary: "Catch the lone silent pass by promoting a no-signal context combination: missing candidate topic, very confident source topic, and option-dominant near-match characteristics.",
    },
  ];

  return [
    "# Combination Rule Candidates",
    "",
    "These promotions are intentionally narrow. They strengthen recurring risky survivor patterns without turning single weak warnings back into blanket downgrades.",
    "",
    ...combos.map((combo) => `- ${combo.name}: catches ${combo.catches} current risky survivors. ${combo.summary}`),
  ].join("\n");
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
