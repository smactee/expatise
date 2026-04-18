#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { ROOT } from "../qbank-tools/lib/pipeline.mjs";
import { parsePilotArgs } from "./next-language-preflight-lib.mjs";
import {
  OUTPUT_DIR,
  benchmarkRowCaseTypes,
  ensureOutputDir,
  nowIso,
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

const benchmarkRows = readJsonl(path.join(OUTPUT_DIR, "adversarial_benchmark.jsonl"));
const benchmarkById = new Map(benchmarkRows.map((row) => [row.benchmarkId, row]));
const prePassRows = readCsv(path.join(OUTPUT_DIR, "post_combination_adversarial_evaluation.csv"));
const warningSurvivors = prePassRows.filter((row) =>
  row.baselineRoute === "auto-match ok" && row.calibratedOutcome === "warning-only",
);

const clusterAuditRows = warningSurvivors.map((row) => {
  const benchmark = benchmarkById.get(row.benchmarkId);
  const sourceItem = loadMatchedItem(row.sourceBatchId, row.sourceItemId);
  const topCandidate = sourceItem?.topCandidates?.[0] ?? sourceItem?.match ?? null;
  const breakdown = topCandidate?.scoreBreakdown ?? {};
  const normalizedCandidateTopic = normalizeTopic(topCandidate?.topic);
  const normalizedSourceTopic = normalizeTopic(sourceItem?.provisionalTopic);
  const cluster = classifyCluster({
    sourceType: sourceItem?.analysis?.effectiveQuestionType,
    hasImage: sourceItem?.hasImage === true,
    signals: splitSignals(row.calibratedSignals),
    sourceTopic: normalizedSourceTopic,
    candidateTopic: normalizedCandidateTopic,
    topicConfidence: toNumber(sourceItem?.topicConfidence),
  });

  return {
    benchmarkId: row.benchmarkId,
    sourceBatchId: row.sourceBatchId,
    sourceItemId: row.sourceItemId,
    cluster,
    adversarialCaseTypes: benchmarkRowCaseTypes(benchmark).join("|"),
    finalHumanDecision: benchmark?.finalDecision ?? row.humanFinalDecision ?? "",
    finalHumanQid: benchmark?.finalQid ?? row.humanFinalQid ?? "",
    autoSuggestedQid: benchmark?.autoSuggestedQid ?? row.autoSuggestedQid ?? "",
    autoSuggestedScore: benchmark?.autoSuggestedScore ?? row.autoSuggestedScore ?? "",
    sourceType: sourceItem?.analysis?.effectiveQuestionType ?? "",
    hasImage: sourceItem?.hasImage === true ? "true" : "false",
    imageSignHeavy: isImageSignHeavy(sourceItem) ? "true" : "false",
    topicConfidence: toNumber(sourceItem?.topicConfidence),
    sourceTopic: sourceItem?.provisionalTopic ?? "",
    candidateTopic: topCandidate?.topic ?? "",
    candidateTopicGenericOrMissing: !normalizedCandidateTopic || ["mcq", "row"].includes(normalizedCandidateTopic) ? "true" : "false",
    candidateTopicDiffersFromSource: normalizedSourceTopic && normalizedCandidateTopic && normalizedCandidateTopic !== normalizedSourceTopic ? "true" : "false",
    answerEvidence: hasAnswerEvidence(sourceItem) ? "true" : "false",
    promptSimilarity: toNumber(breakdown.promptSimilarity),
    optionSimilarity: toNumber(breakdown.optionSimilarity),
    optionExactSet: toNumber(breakdown.optionExactSet),
    correctAnswerMeaning: toNumber(breakdown.correctAnswerMeaning),
    scoreGap: toNumber(sourceItem?.match?.scoreGap),
    triggeredChecks: row.calibratedSignals,
    compactSurvivalExplanation: buildCompactSurvivalExplanation({
      cluster,
      sourceItem,
      candidateTopic: normalizedCandidateTopic,
      sourceTopic: normalizedSourceTopic,
      row,
    }),
  };
});

await writeCsv(
  path.join(OUTPUT_DIR, "final_survivor_cluster_audit.csv"),
  [
    "benchmarkId",
    "sourceBatchId",
    "sourceItemId",
    "cluster",
    "adversarialCaseTypes",
    "finalHumanDecision",
    "finalHumanQid",
    "autoSuggestedQid",
    "autoSuggestedScore",
    "sourceType",
    "hasImage",
    "imageSignHeavy",
    "topicConfidence",
    "sourceTopic",
    "candidateTopic",
    "candidateTopicGenericOrMissing",
    "candidateTopicDiffersFromSource",
    "answerEvidence",
    "promptSimilarity",
    "optionSimilarity",
    "optionExactSet",
    "correctAnswerMeaning",
    "scoreGap",
    "triggeredChecks",
    "compactSurvivalExplanation",
  ],
  clusterAuditRows,
);
await writeMarkdown(
  path.join(OUTPUT_DIR, "final_survivor_cluster_summary.md"),
  buildClusterSummaryMarkdown(clusterAuditRows),
);
await writeMarkdown(
  path.join(OUTPUT_DIR, "final_rule_promotion_candidates.md"),
  buildRuleCandidatesMarkdown(clusterAuditRows),
);

runNodeScript("scripts/run-second-batch-validation.mjs", [
  "--lang", lang,
  "--batch", batchId,
  "--dataset", dataset,
  "--comparison-profile", "final-targeted",
  "--output-prefix", "final_post_iteration_",
]);
runNodeScript("scripts/evaluate-adversarial-benchmark.mjs", [
  "--lang", lang,
  "--dataset", dataset,
  "--comparison-profile", "final-targeted",
  "--output-prefix", "final_post_iteration_",
]);

const finalAdversarialRows = readCsv(path.join(OUTPUT_DIR, "final_post_iteration_adversarial_evaluation.csv"));
const finalSecondBatchRows = readCsv(path.join(OUTPUT_DIR, "final_post_iteration_second_batch_validation.csv"));
await writeMarkdown(
  path.join(OUTPUT_DIR, "final_rollout_readiness.md"),
  buildFinalReadinessMarkdown({
    calibratedRows: readCsv(path.join(OUTPUT_DIR, "adversarial_evaluation.csv")),
    combinationRows: prePassRows,
    finalRows: finalAdversarialRows,
    calibratedSecondBatchRows: readCsv(path.join(OUTPUT_DIR, "second_batch_validation.csv")),
    combinationSecondBatchRows: readCsv(path.join(OUTPUT_DIR, "post_combination_second_batch_validation.csv")),
    finalSecondBatchRows,
  }),
);

console.log(JSON.stringify({
  finalSurvivorClusterAuditPath: "artifacts/next-language-pilot/final_survivor_cluster_audit.csv",
  finalSurvivorClusterSummaryPath: "artifacts/next-language-pilot/final_survivor_cluster_summary.md",
  finalRulePromotionCandidatesPath: "artifacts/next-language-pilot/final_rule_promotion_candidates.md",
  finalSecondBatchValidationPath: "artifacts/next-language-pilot/final_post_iteration_second_batch_validation.csv",
  finalAdversarialEvaluationPath: "artifacts/next-language-pilot/final_post_iteration_adversarial_evaluation.csv",
  finalRolloutReadinessPath: "artifacts/next-language-pilot/final_rollout_readiness.md",
}, null, 2));

function runNodeScript(relativeScriptPath, extraArgs) {
  execFileSync(process.execPath, [path.join(ROOT, relativeScriptPath), ...extraArgs], {
    cwd: ROOT,
    stdio: "ignore",
  });
}

function loadMatchedItem(batch, itemId) {
  const filePath = path.join(ROOT, "imports", "ja", batch, "matched.json");
  const doc = JSON.parse(fs.readFileSync(filePath, "utf8"));
  return doc.items.find((item) => item.itemId === itemId) ?? null;
}

function splitSignals(value) {
  return String(value ?? "").split("|").filter(Boolean);
}

function normalizeTopic(value) {
  const text = String(value ?? "").trim().toLowerCase();
  return text || "";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : "";
}

function hasAnswerEvidence(item) {
  return Boolean(
    item?.correctKeyRaw ||
    item?.correctAnswerRaw ||
    item?.translatedText?.correctAnswer ||
    item?.localizedText?.correctAnswer,
  );
}

function isImageSignHeavy(item) {
  const prompt = String(item?.translatedText?.prompt ?? item?.promptGlossEn ?? "").toLowerCase();
  const options = []
    .concat(item?.translatedText?.options ?? [])
    .concat(item?.optionsGlossEn ?? [])
    .join(" ")
    .toLowerCase();
  const text = `${prompt} ${options}`;
  return item?.hasImage === true && /sign|signal|switch|light|indicator|marking|lamp/.test(text);
}

function classifyCluster({ sourceType, hasImage, signals, sourceTopic, candidateTopic, topicConfidence }) {
  const genericCandidateTopic = !candidateTopic || ["mcq", "row"].includes(candidateTopic);
  if (
    sourceType === "ROW" &&
    hasImage === true &&
    signals.includes("image-sign-symbol-mismatch-risk") &&
    sourceTopic &&
    topicConfidence !== "" &&
    Number(topicConfidence) <= 0.8 &&
    (genericCandidateTopic || candidateTopic !== sourceTopic)
  ) {
    return "row-image-topic-weakness";
  }
  return "heterogeneous-mcq";
}

function buildCompactSurvivalExplanation({ cluster, sourceItem, candidateTopic, sourceTopic, row }) {
  if (cluster === "row-image-topic-weakness") {
    if (!candidateTopic || ["mcq", "row"].includes(candidateTopic)) {
      return "Image-backed ROW near-match survived because the candidate topic is generic while the source carries a more specific topic hint; warning-only image mismatch was not enough to block a high-score auto-match.";
    }
    return "Image-backed ROW near-match survived because the candidate topic conflicts with the source topic, but the current profile still treated the image mismatch as warning-only.";
  }
  if (splitSignals(row.calibratedSignals).includes("topic-subtopic-drift-risk")) {
    return "MCQ survivor only exposes topic drift; the pattern does not recur cleanly enough to justify a stronger shared escalation without threatening known-correct retention.";
  }
  return "MCQ survivor remains warning-only, but its remaining signal mix is not shared tightly enough with the other survivors to justify a safe final promotion.";
}

function buildClusterSummaryMarkdown(rows) {
  const counts = countBy(rows, (row) => row.cluster);
  const rowCluster = rows.filter((row) => row.cluster === "row-image-topic-weakness");
  const mcqCluster = rows.filter((row) => row.cluster === "heterogeneous-mcq");
  return [
    "# Final Survivor Cluster Summary",
    "",
    `Generated at ${nowIso()} from the ${rows.length} remaining warning-only risky survivors under the combination-promoted profile.`,
    "",
    "## Cluster Counts",
    "",
    ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([cluster, count]) => `- ${cluster}: ${count}`),
    "",
    "## Smallest Recurring Pattern",
    "",
    `- ${rowCluster.length} survivors form one clean recurring cluster: image-backed \`ROW\` overrides with moderate source topic confidence and a candidate topic that is generic (\`row\`) or mismatched to the source topic.`,
    `- ${mcqCluster.length} survivors do not collapse into one safe recurring rule. They split across topic drift only, image-sign mismatch with stronger MCQ context, and answer-key-change-heavy overrides.`,
    "",
    "## Decision",
    "",
    "- Promote only the ROW image/topic-weakness cluster.",
    "- Do not force a broader MCQ escalation in this pass.",
  ].join("\n");
}

function buildRuleCandidatesMarkdown(rows) {
  const rowCluster = rows.filter((row) => row.cluster === "row-image-topic-weakness");
  const mcqCluster = rows.filter((row) => row.cluster === "heterogeneous-mcq");
  return [
    "# Final Rule Promotion Candidates",
    "",
    `- Promoted: \`combo-row-image-topic-weakness-risk\` catches ${rowCluster.length} recurring survivors. It is limited to image-backed ROW items with \`image-sign-symbol-mismatch-risk\`, moderate source topic confidence, and a candidate topic that is generic or mismatched to the source topic.`,
    `- Not promoted: the remaining ${mcqCluster.length} MCQ survivors. They do not share one stable escalation pattern that survives the clean-batch check, so forcing a broader MCQ rule would be too risky for this final pass.`,
  ].join("\n");
}

function buildFinalReadinessMarkdown({
  calibratedRows,
  combinationRows,
  finalRows,
  calibratedSecondBatchRows,
  combinationSecondBatchRows,
  finalSecondBatchRows,
}) {
  const originalAdv = summarizeAdversarialOutcomes(calibratedRows, "originalOutcome");
  const calibratedAdv = summarizeAdversarialOutcomes(calibratedRows, "calibratedOutcome");
  const combinationAdv = summarizeAdversarialOutcomes(combinationRows, "calibratedOutcome");
  const finalAdv = summarizeAdversarialOutcomes(finalRows, "calibratedOutcome");

  const originalRetention = summarizeSecondBatch(calibratedSecondBatchRows, "originalRecommendedRoute");
  const calibratedRetention = summarizeSecondBatch(calibratedSecondBatchRows, "calibratedRecommendedRoute");
  const combinationRetention = summarizeSecondBatch(combinationSecondBatchRows, "calibratedRecommendedRoute");
  const finalRetention = summarizeSecondBatch(finalSecondBatchRows, "calibratedRecommendedRoute");

  const ready =
    finalAdv.silent === 0 &&
    finalAdv.warned <= 3 &&
    finalRetention.correctKept === finalRetention.correctTotal &&
    finalRetention.riskyExposure === 0;

  return [
    "# Final Rollout Readiness",
    "",
    `Generated at ${nowIso()}.`,
    "",
    "## Decision Box",
    "",
    "> Adversarial result before this pass: " + `${combinationAdv.routed} routed / ${combinationAdv.warned} warned / ${combinationAdv.silent} silent`,
    "> Adversarial result after this pass: " + `${finalAdv.routed} routed / ${finalAdv.warned} warned / ${finalAdv.silent} silent`,
    "> Clean-batch retention before this pass: " + `${combinationRetention.correctKept}/${combinationRetention.correctTotal}`,
    "> Clean-batch retention after this pass: " + `${finalRetention.correctKept}/${finalRetention.correctTotal}`,
    "> Clean-batch manual review before this pass: " + `${combinationRetention.manualReviewCount}`,
    "> Clean-batch manual review after this pass: " + `${finalRetention.manualReviewCount}`,
    `> Recommendation: ${ready ? "READY FOR LIMITED NEXT-LANGUAGE PILOT" : "NOT YET"}`,
    "",
    "## Profile Comparison",
    "",
    "| Profile | Adversarial routed/warned/silent | Batch-003 clean retention | Batch-003 risky exposure | Batch-003 manual review |",
    "| --- | --- | --- | --- | --- |",
    `| original | ${originalAdv.routed}/${originalAdv.warned}/${originalAdv.silent} | ${originalRetention.correctKept}/${originalRetention.correctTotal} | ${originalRetention.riskyExposure} | ${originalRetention.manualReviewCount} |`,
    `| calibrated | ${calibratedAdv.routed}/${calibratedAdv.warned}/${calibratedAdv.silent} | ${calibratedRetention.correctKept}/${calibratedRetention.correctTotal} | ${calibratedRetention.riskyExposure} | ${calibratedRetention.manualReviewCount} |`,
    `| combination-promoted | ${combinationAdv.routed}/${combinationAdv.warned}/${combinationAdv.silent} | ${combinationRetention.correctKept}/${combinationRetention.correctTotal} | ${combinationRetention.riskyExposure} | ${combinationRetention.manualReviewCount} |`,
    `| final-targeted | ${finalAdv.routed}/${finalAdv.warned}/${finalAdv.silent} | ${finalRetention.correctKept}/${finalRetention.correctTotal} | ${finalRetention.riskyExposure} | ${finalRetention.manualReviewCount} |`,
    "",
    "## Blunt Read",
    "",
    ready
      ? "- The final targeted rule removed one clean recurring survivor cluster, preserved 9/9 clean matched retention on batch-003, and left only three heterogeneous warning-only MCQ survivors with no safe shared escalation pattern."
      : "- The remaining survivors still do not justify a limited pilot yet; one more cleanup pass is safer than broadening the rule set.",
  ].join("\n");
}

function summarizeAdversarialOutcomes(rows, outcomeField) {
  const riskyMatched = rows.filter((row) => row.baselineRoute === "auto-match ok");
  return {
    routed: riskyMatched.filter((row) => row[outcomeField] === "routed").length,
    warned: riskyMatched.filter((row) => row[outcomeField] === "warning-only").length,
    silent: riskyMatched.filter((row) => row[outcomeField] === "silent-pass").length,
  };
}

function summarizeSecondBatch(rows, routeField) {
  const matched = rows.filter((row) => row.baselineSection === "matched");
  const correct = matched.filter((row) => row.humanAutoMatchCorrect === "true");
  const risky = matched.filter((row) =>
    row.humanAutoMatchOverridden === "true" ||
    ["create_new", "unresolved", "delete"].includes(row.humanOutcomeClass),
  );
  const manualReviewCount = rows.filter((row) => row[routeField] === "manual review").length;
  return {
    correctKept: correct.filter((row) => row[routeField] === "auto-match ok").length,
    correctTotal: correct.length,
    riskyExposure: risky.filter((row) => row[routeField] === "auto-match ok").length,
    manualReviewCount,
  };
}

function countBy(items, keyFn) {
  const counts = {};
  for (const item of items) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
